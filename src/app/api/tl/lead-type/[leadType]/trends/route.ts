import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildDayKeys(startDate: string, endDate: string): string[] {
  const keys: string[] = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  let cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

function buildMonthKeys(startDate: string, endDate: string): string[] {
  const keys: string[] = [];
  const [sy, sm] = startDate.split("-").map(Number);
  const [ey, em] = endDate.split("-").map(Number);
  let year = sy, month = sm;
  while (year < ey || (year === ey && month <= em)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return keys;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadType: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("users").select("organization_id").eq("id", user.id).single();
    const orgId = (profile as { organization_id: string | null } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const { leadType } = await params;
    const decodedLeadType = decodeURIComponent(leadType);

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const granularity = (searchParams.get("granularity") ?? "month") as "day" | "month";

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id")
      .eq("organization_id", orgId)
      .eq("lead_type", decodedLeadType);

    const campaignIds = (campaigns ?? []).map((c: { id: string }) => c.id);
    if (campaignIds.length === 0) return NextResponse.json({ trend: [] });

    let leadsQ = supabase
      .from("leads")
      .select("id, qa_status, lead_tagging, created_at")
      .eq("organization_id", orgId)
      .in("campaign_id", campaignIds);

    if (startDate) leadsQ = leadsQ.gte("created_at", `${startDate}T00:00:00`);
    if (endDate) leadsQ = leadsQ.lte("created_at", `${endDate}T23:59:59`);

    const { data: leads } = await leadsQ;
    const leadsList = (leads ?? []) as { id: string; qa_status: string | null; lead_tagging: string | null; created_at: string }[];

    const now = new Date().toISOString().slice(0, 10);
    const effectiveStart = startDate ?? now;
    const effectiveEnd = endDate ?? now;

    let trend: { date: string; leads: number; qualified: number }[];

    if (granularity === "day") {
      const dayKeys = buildDayKeys(effectiveStart, effectiveEnd);
      const byDay: Record<string, { leads: number; qualified: number }> = {};
      dayKeys.forEach((k) => { byDay[k] = { leads: 0, qualified: 0 }; });
      leadsList.forEach((l) => {
        const k = l.created_at?.slice(0, 10);
        if (!k || !(k in byDay)) return;
        byDay[k].leads += 1;
        if (l.qa_status === "approved" || l.lead_tagging === "Scored") byDay[k].qualified += 1;
      });
      trend = dayKeys.map((k) => {
        const [, m, d] = k.split("-").map(Number);
        return { date: `${d} ${MONTHS[m - 1]}`, leads: byDay[k].leads, qualified: byDay[k].qualified };
      });
    } else {
      const startYear = Number(effectiveStart.slice(0, 4));
      const endYear = Number(effectiveEnd.slice(0, 4));
      const multiYear = endYear > startYear;
      const monthKeys = buildMonthKeys(effectiveStart, effectiveEnd);
      const byMonth: Record<string, { leads: number; qualified: number }> = {};
      monthKeys.forEach((k) => { byMonth[k] = { leads: 0, qualified: 0 }; });
      leadsList.forEach((l) => {
        const k = l.created_at?.slice(0, 7);
        if (!k || !(k in byMonth)) return;
        byMonth[k].leads += 1;
        if (l.qa_status === "approved" || l.lead_tagging === "Scored") byMonth[k].qualified += 1;
      });
      trend = monthKeys.map((k) => {
        const [y, m] = k.split("-").map(Number);
        const label = multiYear ? `${MONTHS[m - 1]} ${String(y).slice(-2)}` : MONTHS[m - 1];
        return { date: label, leads: byMonth[k].leads, qualified: byMonth[k].qualified };
      });
    }

    return NextResponse.json({ trend });
  } catch (err) {
    console.error("Lead type trends error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
