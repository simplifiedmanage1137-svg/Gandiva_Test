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
      .select("id")
      .eq("organization_id", orgId)
      .eq("lead_type", decodedLeadType);

    const campaignIds = (campaigns ?? []).map((c: { id: string }) => c.id);
    if (campaignIds.length === 0) return NextResponse.json({ agents: [] });

    // Leads for those campaigns
    let leadsQ = supabase
      .from("leads")
      .select("id, assigned_agent_id, created_by, qa_status, lead_tagging, created_at, campaign_id")
      .eq("organization_id", orgId)
      .in("campaign_id", campaignIds);

    if (startDate) leadsQ = leadsQ.gte("created_at", `${startDate}T00:00:00`);
    if (endDate) leadsQ = leadsQ.lte("created_at", `${endDate}T23:59:59`);

    const { data: leads } = await leadsQ;
    const leadsList = (leads ?? []) as {
      id: string;
      assigned_agent_id: string | null;
      created_by: string | null;
      qa_status: string | null;
      lead_tagging: string | null;
      created_at: string;
      campaign_id: string | null;
    }[];

    // Aggregate per agent (use assigned_agent_id, fallback to created_by)
    const agentMap: Record<string, {
      totalLeads: number;
      qualifiedLeads: number;
      campaignIds: Set<string>;
      leadsToday: number;
      leadsThisWeek: number;
      lastActivity: string | null;
    }> = {};

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    leadsList.forEach((l) => {
      const agentId = l.assigned_agent_id ?? l.created_by;
      if (!agentId) return;
      if (!agentMap[agentId]) {
        agentMap[agentId] = { totalLeads: 0, qualifiedLeads: 0, campaignIds: new Set(), leadsToday: 0, leadsThisWeek: 0, lastActivity: null };
      }
      const a = agentMap[agentId];
      a.totalLeads += 1;
      if (l.qa_status === "approved" || l.lead_tagging === "Scored") a.qualifiedLeads += 1;
      if (l.campaign_id) a.campaignIds.add(l.campaign_id);
      if (l.created_at?.slice(0, 10) === todayStr) a.leadsToday += 1;
      if (l.created_at >= weekAgo) a.leadsThisWeek += 1;
      if (!a.lastActivity || l.created_at > a.lastActivity) a.lastActivity = l.created_at;
    });

    // Fetch agent names
    const agentIds = Object.keys(agentMap);
    let userNames: Record<string, string> = {};
    if (agentIds.length > 0) {
      const { data: users } = await supabase
        .from("users").select("id, full_name, email").in("id", agentIds);
      ((users ?? []) as { id: string; full_name: string | null; email: string | null }[]).forEach((u) => {
        userNames[u.id] = u.full_name || u.email || "Unknown";
      });
    }

    // Determine active threshold: activity in last 24h
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const agents = agentIds.map((id) => {
      const a = agentMap[id];
      const conversionPct = a.totalLeads > 0 ? Math.round((a.qualifiedLeads / a.totalLeads) * 100) : 0;
      return {
        id,
        name: userNames[id] ?? "Unknown",
        totalLeads: a.totalLeads,
        qualifiedLeads: a.qualifiedLeads,
        conversionPct,
        activeCampaigns: a.campaignIds.size,
        leadsToday: a.leadsToday,
        leadsThisWeek: a.leadsThisWeek,
        lastActivity: a.lastActivity,
        status: a.lastActivity && a.lastActivity >= oneDayAgo ? "Active" : "Idle",
      };
    }).sort((a, b) => b.totalLeads - a.totalLeads);

    return NextResponse.json({ agents });
  } catch (err) {
    console.error("Lead type agents error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
