import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClientSafe, ADMIN_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId = (profile as { organization_id: string | null } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id);

    const roleNames = ((roleRows ?? []) as { roles: { name: string } | null }[])
      .map((r) => r.roles?.name?.toLowerCase().trim().replace(/\s+/g, "_"));

    if (!roleNames.includes("mis") && !roleNames.includes("admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getAdminClientSafe();
    if (!admin) return NextResponse.json({ error: ADMIN_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    const [campaignsRes, leadsRes] = await Promise.all([
      admin
        .from("campaigns")
        .select("id, campaign_id, name, client_id, client_name, status, created_at, assigned_team_leader_id, lead_type, industry, geography, start_date, end_date")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      admin
        .from("leads")
        .select("id, campaign_id, assigned_agent_id, qa_status")
        .eq("organization_id", orgId),
    ]);

    if (campaignsRes.error) return NextResponse.json({ error: campaignsRes.error.message }, { status: 500 });
    if (leadsRes.error) return NextResponse.json({ error: leadsRes.error.message }, { status: 500 });

    const campaigns = campaignsRes.data ?? [];
    const leads = (leadsRes.data ?? []) as { id: string; campaign_id: string; assigned_agent_id: string | null; qa_status: string | null }[];

    // Resolve TL names
    const tlIds = [...new Set(campaigns.map((c) => c.assigned_team_leader_id).filter(Boolean))] as string[];
    let tlNames: Record<string, string> = {};
    if (tlIds.length > 0) {
      const { data: tlUsers } = await supabase.from("users").select("id, full_name, email").in("id", tlIds);
      ((tlUsers ?? []) as { id: string; full_name: string | null; email: string | null }[]).forEach((u) => {
        tlNames[u.id] = u.full_name || u.email || "Unknown";
      });
    }

    // Resolve agent names per campaign
    const agentIds = [...new Set(leads.map((l) => l.assigned_agent_id).filter(Boolean))] as string[];
    let agentNames: Record<string, string> = {};
    if (agentIds.length > 0) {
      const { data: agentUsers } = await supabase.from("users").select("id, full_name, email").in("id", agentIds);
      ((agentUsers ?? []) as { id: string; full_name: string | null; email: string | null }[]).forEach((u) => {
        agentNames[u.id] = u.full_name || u.email || "Unknown";
      });
    }

    // Build per-campaign stats
    type CampaignStats = {
      leadCount: number;
      agentNames: string[];
      qaQualified: number;
      qaDisqualified: number;
      qaRectified: number;
      qaPending: number;
    };
    const statsMap = new Map<string, CampaignStats>();
    campaigns.forEach((c) => {
      statsMap.set(c.id, { leadCount: 0, agentNames: [], qaQualified: 0, qaDisqualified: 0, qaRectified: 0, qaPending: 0 });
    });

    const agentsByCampaign = new Map<string, Set<string>>();
    leads.forEach((l) => {
      const s = statsMap.get(l.campaign_id);
      if (!s) return;
      s.leadCount += 1;
      const qa = (l.qa_status ?? "").toLowerCase().trim();
      if (qa === "qualified") s.qaQualified += 1;
      else if (qa === "disqualified") s.qaDisqualified += 1;
      else if (qa === "rectified") s.qaRectified += 1;
      else s.qaPending += 1;

      if (l.assigned_agent_id) {
        if (!agentsByCampaign.has(l.campaign_id)) agentsByCampaign.set(l.campaign_id, new Set());
        agentsByCampaign.get(l.campaign_id)!.add(l.assigned_agent_id);
      }
    });

    agentsByCampaign.forEach((agentSet, campaignId) => {
      const s = statsMap.get(campaignId);
      if (s) s.agentNames = [...agentSet].map((id) => agentNames[id] ?? "Unknown");
    });

    const result = campaigns.map((c) => {
      const s = statsMap.get(c.id)!;
      return {
        id: c.id,
        campaign_id: c.campaign_id,
        name: c.name,
        client_id: c.client_id ?? null,
        client_name: c.client_name ?? "—",
        status: c.status,
        created_at: c.created_at,
        lead_type: c.lead_type ?? null,
        industry: c.industry ?? null,
        geography: c.geography ?? null,
        start_date: c.start_date ?? null,
        end_date: c.end_date ?? null,
        assigned_team_leader_name: c.assigned_team_leader_id ? (tlNames[c.assigned_team_leader_id] ?? null) : null,
        leadCount: s.leadCount,
        agentNames: s.agentNames,
        qaQualified: s.qaQualified,
        qaDisqualified: s.qaDisqualified,
        qaRectified: s.qaRectified,
        qaPending: s.qaPending,
        isDelivered: c.status?.toLowerCase() === "delivered",
      };
    });

    return NextResponse.json({ campaigns: result });
  } catch (err) {
    console.error("MIS campaigns list error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
