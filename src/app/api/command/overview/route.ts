import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCommandRole } from "@/lib/command/rules-engine";
import { getProfile, getRoleNames } from "@/lib/command/db";
import { getAdminClientSafe } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type MetricsRow = {
  campaign_id: string;
  total_leads: number | null;
  total_leads_allocated: number | null;
  total_campaign_spend: number | null;
  total_leads_delivered: number | null;
  deficit_leads: number | null;
  lead_increment: number | null;
  lead_replace: number | null;
  daily_reporting: Record<string, unknown> | null;
  qa_pending_count: number | null;
  qualified_count: number | null;
  registered_count: number | null;
  attended_count: number | null;
  channel_split: Record<string, unknown> | null;
};

type LeadChannelRow = {
  created_at: string;
  channel: string | null;
  campaign_id: string;
  campaigns?: { name?: string | null } | { name?: string | null }[] | null;
};

type MetricsHistoryRow = {
  campaign_id: string;
  date: string;
  total_leads_delivered: number | null;
  total_campaign_spend: number | null;
  deficit_leads: number | null;
  channel_split: Record<string, unknown> | null;
  created_at: string;
};

async function getClientViewerUserIdsForOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
): Promise<string[]> {
  const admin = getAdminClientSafe();
  const lookupClient = admin ?? supabase;

  const { data: roleRows, error: roleErr } = await lookupClient
    .from("roles")
    .select("id, name")
    .eq("organization_id", organizationId);
  if (roleErr) throw new Error(roleErr.message);

  const clientViewerRoleIds = ((roleRows ?? []) as { id: string; name: string | null }[])
    .filter((r) => (r.name ?? "").toLowerCase().trim().replace(/\s+/g, "_") === "client_viewer")
    .map((r) => r.id);

  if (clientViewerRoleIds.length === 0) return [];

  const { data: links, error: linkErr } = await lookupClient
    .from("user_roles")
    .select("user_id")
    .in("role_id", clientViewerRoleIds);
  if (linkErr) throw new Error(linkErr.message);

  const userIds = [
    ...new Set(((links ?? []) as { user_id: string }[]).map((r) => r.user_id).filter(Boolean)),
  ];
  if (userIds.length === 0) return [];

  const { data: usersRows, error: usersErr } = await lookupClient
    .from("users")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", userIds);
  if (usersErr) throw new Error(usersErr.message);

  return ((usersRows ?? []) as { id: string }[]).map((u) => u.id);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = await getRoleNames(supabase, user.id);
  const isAllowed = hasCommandRole(roles) || roles.includes("client_viewer");
  if (!isAllowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await getProfile(supabase, user.id);
  const campaignIdParam = request.nextUrl.searchParams.get("campaign_id");

  let campaignsQuery = supabase
    .from("campaigns")
    .select("id, name, campaign_id, client_id")
    .eq("organization_id", profile?.organization_id ?? "");

  if (roles.includes("client_viewer")) {
    if (!profile?.client_id) {
      return NextResponse.json({
        campaigns: [],
        selectedCampaignId: campaignIdParam ?? null,
        kpis: { totalCampaigns: 0, totalLeads: 0, qualified: 0, registrations: 0, attendees: 0 },
        metrics: {
          total_leads_allocated: 0,
          total_campaign_spend: 0,
          total_leads_delivered: 0,
          deficit_leads: 0,
          lead_increment: 0,
          lead_replace: 0,
        },
        funnel: { leads: 0, qa: 0, qualified: 0, registered: 0, attended: 0 },
        bar: { registrations: 0, attendees: 0 },
        channelSplit: [],
        trendDaily: [],
        performance: { deliveryRate: 0, deficitRate: 0, registrationRate: 0, attendanceRate: 0 },
      });
    }
    campaignsQuery = campaignsQuery.eq("client_id", profile.client_id);
    const clientViewerUserIds = await getClientViewerUserIdsForOrg(
      supabase,
      profile.organization_id ?? ""
    );
    if (clientViewerUserIds.length === 0) {
      return NextResponse.json({
        campaigns: [],
        selectedCampaignId: campaignIdParam ?? null,
        kpis: { totalCampaigns: 0, totalLeads: 0, qualified: 0, registrations: 0, attendees: 0 },
        metrics: {
          total_leads_allocated: 0,
          total_campaign_spend: 0,
          total_leads_delivered: 0,
          deficit_leads: 0,
          lead_increment: 0,
          lead_replace: 0,
        },
        funnel: { leads: 0, qa: 0, qualified: 0, registered: 0, attended: 0 },
        bar: { registrations: 0, attendees: 0 },
        channelSplit: [],
        trendDaily: [],
        performance: { deliveryRate: 0, deficitRate: 0, registrationRate: 0, attendanceRate: 0 },
      });
    }
    campaignsQuery = campaignsQuery.in("created_by", clientViewerUserIds);
  }

  if (campaignIdParam) campaignsQuery = campaignsQuery.eq("id", campaignIdParam);

  const { data: campaigns, error: campaignsErr } = await campaignsQuery.order("created_at", { ascending: false });
  if (campaignsErr) return NextResponse.json({ error: campaignsErr.message }, { status: 500 });

  const campaignRows = (campaigns ?? []) as Array<{ id: string; name: string; campaign_id: string; client_id: string | null }>;
  const campaignIds = campaignRows.map((c) => c.id);

  if (campaignIds.length === 0) {
    return NextResponse.json({
      campaigns: campaignRows,
      selectedCampaignId: campaignIdParam ?? null,
      kpis: { totalCampaigns: campaignRows.length, totalLeads: 0, qualified: 0, registrations: 0, attendees: 0 },
      metrics: {
        total_leads_allocated: 0,
        total_campaign_spend: 0,
        total_leads_delivered: 0,
        deficit_leads: 0,
        lead_increment: 0,
        lead_replace: 0,
      },
      funnel: { leads: 0, qa: 0, qualified: 0, registered: 0, attended: 0 },
      bar: { registrations: 0, attendees: 0 },
      channelSplit: [],
      trendDaily: [],
      performance: { deliveryRate: 0, deficitRate: 0, registrationRate: 0, attendanceRate: 0 },
    });
  }

  const { data: metricsData, error: metricsErr } = await supabase
    .from("campaign_metrics")
    .select("campaign_id,total_leads,total_leads_allocated,total_campaign_spend,total_leads_delivered,deficit_leads,lead_increment,lead_replace,daily_reporting,qa_pending_count,qualified_count,registered_count,attended_count,channel_split")
    .in("campaign_id", campaignIds);
  if (metricsErr) return NextResponse.json({ error: metricsErr.message }, { status: 500 });

  const { data: leadsData, error: leadsErr } = await supabase
    .from("leads")
    .select("created_at, channel, campaign_id, campaigns(name)")
    .in("campaign_id", campaignIds);
  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });

  const { data: historyData, error: historyErr } = await supabase
    .from("campaign_metrics_history")
    .select("campaign_id,date,total_leads_delivered,total_campaign_spend,deficit_leads,channel_split,created_at")
    .in("campaign_id", campaignIds)
    .order("date", { ascending: true })
    .order("created_at", { ascending: false });
  if (historyErr) return NextResponse.json({ error: historyErr.message }, { status: 500 });

  const rows = (metricsData ?? []) as MetricsRow[];
  const leadRows = (leadsData ?? []) as LeadChannelRow[];
  const historyRows = (historyData ?? []) as MetricsHistoryRow[];
  const campaignNameById = new Map(campaignRows.map((c) => [c.id, c.name]));
  const sum = <K extends keyof MetricsRow>(key: K) =>
    rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);

  const totalLeads = sum("total_leads");
  const totalAllocated = sum("total_leads_allocated");
  const totalSpend = sum("total_campaign_spend");
  const delivered = sum("total_leads_delivered");
  const deficit = sum("deficit_leads");
  const increment = sum("lead_increment");
  const replace = sum("lead_replace");
  const qa = sum("qa_pending_count");
  const qualified = sum("qualified_count");
  const registrations = sum("registered_count");
  const attendees = sum("attended_count");

  const channelAgg: Record<string, number> = {};
  for (const row of rows) {
    const split = row.channel_split ?? {};
    if (split && typeof split === "object") {
      for (const [k, v] of Object.entries(split)) {
        channelAgg[k] = (channelAgg[k] ?? 0) + Number(v ?? 0);
      }
    }
  }

  const channelDailyMap: Record<
    string,
    { date: string; campaignName: string; email: number; telemarketing: number }
  > = {};
  for (const l of leadRows) {
    const date = (l.created_at ?? "").slice(0, 10);
    if (!date) continue;
    const campName = Array.isArray(l.campaigns)
      ? (l.campaigns[0]?.name ?? "Unknown Campaign")
      : (l.campaigns?.name ?? "Unknown Campaign");
    const key = `${date}__${l.campaign_id}`;
    if (!channelDailyMap[key]) {
      channelDailyMap[key] = { date, campaignName: campName, email: 0, telemarketing: 0 };
    }
    const channel = (l.channel ?? "email").toLowerCase();
    if (channel === "telemarketing") channelDailyMap[key].telemarketing += 1;
    else channelDailyMap[key].email += 1;
  }
  // Fallback: if leads table has no channel rows, derive from
  // campaign_metrics.daily_reporting + campaign_metrics.channel_split
  // so the chart remains useful for client_viewer dashboards.
  if (Object.keys(channelDailyMap).length === 0) {
    for (const row of rows) {
      const split = (row.channel_split ?? {}) as Record<string, unknown>;
      const daily = (row.daily_reporting ?? {}) as Record<string, unknown>;
      const campaignName = campaignNameById.get(row.campaign_id) ?? "Unknown Campaign";

      const emailRatioRaw =
        Number(split.email ?? split.Email ?? split["e-mail"] ?? 0);
      const teleRatioRaw =
        Number(split.telemarketing ?? split.tele ?? split.phone ?? split.calling ?? 0);
      const ratioDen = emailRatioRaw + teleRatioRaw;
      const emailRatio = ratioDen > 0 ? emailRatioRaw / ratioDen : 0.5;
      const teleRatio = ratioDen > 0 ? teleRatioRaw / ratioDen : 0.5;

      const dailyEntries = Object.entries(daily);
      if (dailyEntries.length === 0) {
        const delivered = Number(row.total_leads_delivered ?? 0);
        if (delivered <= 0) continue;
        const key = `overall__${row.campaign_id}`;
        channelDailyMap[key] = {
          date: "Overall",
          campaignName,
          email: Math.round(delivered * emailRatio),
          telemarketing: Math.max(0, delivered - Math.round(delivered * emailRatio)),
        };
        continue;
      }

      for (const [date, payload] of dailyEntries) {
        const p = payload as { delivered?: number; allocated?: number };
        const delivered = Number(p?.delivered ?? p?.allocated ?? 0);
        if (delivered <= 0) continue;
        const key = `${date}__${row.campaign_id}`;
        channelDailyMap[key] = {
          date,
          campaignName,
          email: Math.round(delivered * emailRatio),
          telemarketing: Math.max(0, delivered - Math.round(delivered * emailRatio)),
        };
      }
    }
  }
  const channelSplitDaily = Object.values(channelDailyMap).sort((a, b) =>
    a.date.localeCompare(b.date) || a.campaignName.localeCompare(b.campaignName)
  );

  // Trend from history table: pick latest row per (campaign,date), then aggregate by date.
  const latestPerCampaignDate = new Map<string, MetricsHistoryRow>();
  for (const h of historyRows) {
    const key = `${h.campaign_id}__${h.date}`;
    if (!latestPerCampaignDate.has(key)) latestPerCampaignDate.set(key, h);
  }
  const trendMap: Record<string, { date: string; leads_delivered: number; spend: number; deficit: number }> = {};
  for (const h of latestPerCampaignDate.values()) {
    if (!trendMap[h.date]) {
      trendMap[h.date] = { date: h.date, leads_delivered: 0, spend: 0, deficit: 0 };
    }
    trendMap[h.date].leads_delivered += Number(h.total_leads_delivered ?? 0);
    trendMap[h.date].spend += Number(h.total_campaign_spend ?? 0);
    trendMap[h.date].deficit += Number(h.deficit_leads ?? 0);
  }
  const trendDaily = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

  const toPct = (num: number, den: number) =>
    den > 0 ? Math.round((num / den) * 100) : 0;

  return NextResponse.json({
    campaigns: campaignRows,
    selectedCampaignId: campaignIdParam ?? null,
    kpis: {
      totalCampaigns: campaignRows.length,
      totalLeads,
      qualified,
      registrations,
      attendees,
    },
    metrics: {
      total_leads_allocated: totalAllocated,
      total_campaign_spend: totalSpend,
      total_leads_delivered: delivered,
      deficit_leads: deficit,
      lead_increment: increment,
      lead_replace: replace,
    },
    funnel: { leads: totalLeads, qa, qualified, registered: registrations, attended: attendees },
    bar: { registrations, attendees },
    channelSplit: Object.entries(channelAgg).map(([name, value]) => ({ name, value })),
    channelSplitDaily,
    trendDaily,
    performance: {
      deliveryRate: toPct(delivered, totalAllocated || totalLeads),
      deficitRate: toPct(deficit, totalAllocated || totalLeads),
      registrationRate: toPct(registrations, totalLeads),
      attendanceRate: toPct(attendees, registrations),
    },
  });
}

