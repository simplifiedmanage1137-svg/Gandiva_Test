import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

    // Campaigns with this lead_type
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, status")
      .eq("organization_id", orgId)
      .eq("lead_type", decodedLeadType);

    const campaignIds = (campaigns ?? []).map((c: { id: string }) => c.id);
    const activeCampaigns = (campaigns ?? []).filter((c: { status: string }) => c.status === "active").length;

    if (campaignIds.length === 0) {
      return NextResponse.json({
        totalLeads: 0, qualifiedLeads: 0, conversionRate: 0,
        activeCampaigns: 0, totalCampaigns: 0,
      });
    }

    // Leads for those campaigns
    let leadsQ = supabase
      .from("leads")
      .select("id, qa_status, lead_tagging, created_at")
      .eq("organization_id", orgId)
      .in("campaign_id", campaignIds);

    if (startDate) leadsQ = leadsQ.gte("created_at", `${startDate}T00:00:00`);
    if (endDate) leadsQ = leadsQ.lte("created_at", `${endDate}T23:59:59`);

    const { data: leads } = await leadsQ;
    const leadsList = (leads ?? []) as { id: string; qa_status: string | null; lead_tagging: string | null; created_at: string }[];

    const totalLeads = leadsList.length;
    const qualifiedLeads = leadsList.filter(
      (l) => l.qa_status === "approved" || l.lead_tagging === "Scored"
    ).length;
    const conversionRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;

    return NextResponse.json({
      totalLeads,
      qualifiedLeads,
      conversionRate,
      activeCampaigns,
      totalCampaigns: campaignIds.length,
    });
  } catch (err) {
    console.error("Lead type summary error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
