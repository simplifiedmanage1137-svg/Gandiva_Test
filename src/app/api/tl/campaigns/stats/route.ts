import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ─── bucket builders ─────────────────────────────────────────────────────────

function buildDayKeys(startDate: string, endDate: string): string[] {
  const keys: string[] = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const end = new Date(ey, em - 1, ed);

  let cur = new Date(sy, sm - 1, sd);
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

// ─── label formatters ─────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** "2026-04-22" → "22 Apr"  (matches dayjs D MMM on client) */
function dayLabel(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "2026-04" → "Apr" | "Apr 26"  (matches dayjs MMM / MMM YY on client) */
function monthLabel(key: string, multiYear: boolean): string {
  const [y, m] = key.split("-").map(Number);
  const mon = MONTHS[m - 1];
  if (!multiYear) return mon;
  // "Apr 26" — 2-digit year, matches dayjs MMM YY
  return `${mon} ${String(y).slice(-2)}`;
}

// ─── route ───────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId = (profile as { organization_id: string | null } | null)?.organization_id;
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const startDate   = searchParams.get("start_date");
    const endDate     = searchParams.get("end_date");
    // "day" for this_month / last_month / custom_month; "month" for everything else
    const granularity = (searchParams.get("granularity") ?? "month") as "day" | "month";

    // ── Campaigns ────────────────────────────────────────────────────────────
    let campaignsQ = supabase
      .from("campaigns")
      .select("id, status, created_at")
      .eq("organization_id", orgId);
    if (startDate) campaignsQ = campaignsQ.gte("created_at", `${startDate}T00:00:00`);
    if (endDate)   campaignsQ = campaignsQ.lte("created_at", `${endDate}T23:59:59`);

    // ── Leads ─────────────────────────────────────────────────────────────────
    let leadsQ = supabase
      .from("leads")
      .select("id, status, campaign_id, created_at")
      .eq("organization_id", orgId);
    if (startDate) leadsQ = leadsQ.gte("created_at", `${startDate}T00:00:00`);
    if (endDate)   leadsQ = leadsQ.lte("created_at", `${endDate}T23:59:59`);

    const [campaignsRes, leadsRes] = await Promise.all([campaignsQ, leadsQ]);

    type CampaignRow = { id: string; status: string; created_at: string };
    type LeadRow    = { id: string; status: string; campaign_id: string | null; created_at: string };

    const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
    const leads     = (leadsRes.data ?? [])     as LeadRow[];

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const totalCampaigns  = campaigns.length;
    const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
    const totalLeads      = leads.length;
    const totalInterested = leads.filter((l) =>
      ["interested", "followup", "closed_won"].includes(l.status)
    ).length;
    const closedWon     = leads.filter((l) => l.status === "closed_won").length;
    const conversionPct = totalLeads > 0 ? Math.round((closedWon / totalLeads) * 100) : 0;

    // ── Lead Trend ────────────────────────────────────────────────────────────
    const effectiveStart = startDate ?? new Date().toISOString().slice(0, 10);
    const effectiveEnd   = endDate   ?? new Date().toISOString().slice(0, 10);

    let leadTrend: { date: string; leads: number; campaigns: number }[];

    if (granularity === "day") {
      // Daily buckets — for "this_month", "last_month", "custom_month"
      const dayKeys = buildDayKeys(effectiveStart, effectiveEnd);

      const byDay: Record<string, { leads: number; campaignIds: Set<string> }> = {};
      dayKeys.forEach((k) => { byDay[k] = { leads: 0, campaignIds: new Set() }; });

      leads.forEach((l) => {
        const k = l.created_at?.slice(0, 10); // YYYY-MM-DD
        if (!k || !(k in byDay)) return;
        byDay[k].leads += 1;
        if (l.campaign_id) byDay[k].campaignIds.add(l.campaign_id);
      });

      leadTrend = dayKeys.map((k) => ({
        date:      dayLabel(k),
        leads:     byDay[k].leads,
        campaigns: byDay[k].campaignIds.size,
      }));
    } else {
      // Monthly buckets — for multi-month / year ranges
      const startYear = Number(effectiveStart.slice(0, 4));
      const endYear   = Number(effectiveEnd.slice(0, 4));
      const multiYear = endYear > startYear;

      const monthKeys = buildMonthKeys(effectiveStart, effectiveEnd);

      const byMonth: Record<string, { leads: number; campaignIds: Set<string> }> = {};
      monthKeys.forEach((k) => { byMonth[k] = { leads: 0, campaignIds: new Set() }; });

      leads.forEach((l) => {
        const k = l.created_at?.slice(0, 7); // YYYY-MM
        if (!k || !(k in byMonth)) return;
        byMonth[k].leads += 1;
        if (l.campaign_id) byMonth[k].campaignIds.add(l.campaign_id);
      });

      leadTrend = monthKeys.map((k) => ({
        date:      monthLabel(k, multiYear),
        leads:     byMonth[k].leads,
        campaigns: byMonth[k].campaignIds.size,
      }));
    }

    return NextResponse.json({
      totalCampaigns,
      activeCampaigns,
      totalLeads,
      totalInterested,
      conversionPct,
      leadTrend,
    });
  } catch (err) {
    console.error("Fetch campaign stats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
