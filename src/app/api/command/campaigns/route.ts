import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCommandRole } from "@/lib/command/rules-engine";
import {
  getProfile,
  getRoleNames,
  upsertCampaignMetrics,
  appendCampaignMetricsHistory,
  clampLimit,
  encodeCursor,
  decodeCursor,
  aggregateCommandLeadStatsByCampaign,
  aggregateUnresolvedAlertsByCampaign,
  aggregateDqOverrideAlertCountsByCampaign,
  type CommandListLeadAgg,
  type CommandListAlertAgg,
} from "@/lib/command/db";
import { getAdminClientSafe } from "@/lib/supabase/admin";
import { parsedRowsToLeadInserts } from "@/lib/command/campaignFormLeadPayloads";
import { createNotifications } from "@/lib/notifications";

const COMMAND_CAMPAIGN_LEAD_IMPORT_MAX = 500;

export const dynamic = "force-dynamic";

const LIST_MAX = 500;

function listCompliance(L: CommandListLeadAgg, A: CommandListAlertAgg): "green" | "yellow" | "red" {
  if (A.hasRed || L.disputedConsent > 0) return "red";
  if (A.hasYellow || L.missingConsent > 0 || L.pendingConsent > 0) return "yellow";
  return "green";
}

async function getClientViewerUserIdsForOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
): Promise<string[]> {
  const admin = getAdminClientSafe();
  const lookupClient = admin ?? supabase;

  let rolesQuery = lookupClient
    .from("roles")
    .select("id, name")
    .eq("organization_id", organizationId);
  const { data: roleRows, error: roleErr } = await rolesQuery;
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

  // Keep scope within same organization to avoid accidental cross-org leakage.
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

  const userRoles = await getRoleNames(supabase, user.id);
  const isAllowed = hasCommandRole(userRoles) || userRoles.includes("client_viewer");
  if (!isAllowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await getProfile(supabase, user.id);

  const sp = request.nextUrl.searchParams;

  if (sp.get("enrich") === "1") {
    const orgId = profile?.organization_id ?? "";
    const qRaw = sp.get("q")?.trim() ?? "";
    const statusGroup = (sp.get("status") ?? "all").toLowerCase();
    const dateFrom = sp.get("date_from")?.trim() ?? "";
    const dateTo = sp.get("date_to")?.trim() ?? "";

    const clientViewerId = profile?.client_id ?? null;
    let clientViewerUserIds: string[] = [];
    if (userRoles.includes("client_viewer")) {
      if (!clientViewerId) {
        return NextResponse.json({
          campaigns: [],
          total: 0,
          truncated: false,
          limit: LIST_MAX,
        });
      }
      clientViewerUserIds = await getClientViewerUserIdsForOrg(supabase, orgId);
      if (clientViewerUserIds.length === 0) {
        return NextResponse.json({
          campaigns: [],
          total: 0,
          truncated: false,
          limit: LIST_MAX,
        });
      }
    }

    let listQuery = supabase
      .from("campaigns")
      .select(
        `id, campaign_id, name, description, status, start_date, end_date,
         client_id, client_name, lead_type, campaign_type, cpl, revenue, total_allocation, achieved,
         pending_allocation, industry, geography, created_at, created_by,
         campaign_metrics(
           sponsor_name,
           total_leads_allocated,
           total_campaign_spend,
           total_leads_delivered,
           daily_reporting,
           channel_split,
           deficit_leads,
           lead_increment,
           lead_replace
         )`,
        { count: "exact" }
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(LIST_MAX);

    if (userRoles.includes("client_viewer") && clientViewerId) {
      listQuery = listQuery.eq("client_id", clientViewerId);
      listQuery = listQuery.in("created_by", clientViewerUserIds);
    }

    if (qRaw.length > 0) {
      const safe = qRaw.replace(/%/g, "").replace(/_/g, "");
      if (safe.length > 0) listQuery = listQuery.ilike("name", `%${safe}%`);
    }

    if (statusGroup === "active") listQuery = listQuery.eq("status", "active");
    if (statusGroup === "completed") listQuery = listQuery.eq("status", "completed");

    if (dateFrom && dateTo) {
      listQuery = listQuery
        .or(`start_date.is.null,start_date.lte.${dateTo}`)
        .or(`end_date.is.null,end_date.gte.${dateFrom}`);
    } else if (dateFrom) {
      listQuery = listQuery.or(`end_date.is.null,end_date.gte.${dateFrom}`);
    } else if (dateTo) {
      listQuery = listQuery.or(`start_date.is.null,start_date.lte.${dateTo}`);
    }

    const { data: listRows, count, error: listErr } = await listQuery;
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const rows = (listRows ?? []) as Record<string, unknown>[];
    const createdByIds = [...new Set(rows.map((r) => r.created_by).filter((id): id is string => typeof id === "string" && id.length > 0))];
    const creatorNameById: Record<string, string> = {};
    if (createdByIds.length > 0) {
      const admin = getAdminClientSafe();
      const usersClient = admin ?? supabase;
      let usersQuery = usersClient
        .from("users")
        .select("id, full_name, email")
        .in("id", createdByIds);
      if (admin && orgId) {
        usersQuery = usersQuery.eq("organization_id", orgId);
      }
      const { data: usersData } = await usersQuery;
      ((usersData ?? []) as { id: string; full_name: string | null; email: string | null }[]).forEach((u) => {
        creatorNameById[u.id] = u.full_name || u.email || "Unknown";
      });
    }
    const ids = rows.map((r) => r.id as string);

    let leadAgg: Record<string, CommandListLeadAgg> = {};
    let alertAgg: Record<string, CommandListAlertAgg> = {};
    let dqOverrideAgg: Record<string, number> = {};
    if (ids.length > 0) {
      try {
        [leadAgg, alertAgg, dqOverrideAgg] = await Promise.all([
          aggregateCommandLeadStatsByCampaign(supabase, orgId, ids, {
            deliveredOnly: userRoles.includes("client_viewer"),
          }),
          aggregateUnresolvedAlertsByCampaign(supabase, orgId, ids),
          aggregateDqOverrideAlertCountsByCampaign(supabase, orgId, ids),
        ]);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Aggregation failed" },
          { status: 500 }
        );
      }
    }

    const emptyLead = (): CommandListLeadAgg => ({
      total: 0,
      qualified: 0,
      qa_verified: 0,
      dq: 0,
      missingConsent: 0,
      disputedConsent: 0,
      pendingConsent: 0,
      verified: 0,
    });
    const emptyAlert = (): CommandListAlertAgg => ({
      count: 0,
      hasRed: false,
      hasYellow: false,
    });

    const enriched = rows.map((c) => {
      const id = c.id as string;
      const L = leadAgg[id] ?? emptyLead();
      const A = alertAgg[id] ?? emptyAlert();
      const qualifiedPct = L.total > 0 ? Math.round((L.qualified / L.total) * 1000) / 10 : 0;
      const qaVerifiedPct = L.total > 0 ? Math.round((L.qa_verified / L.total) * 100) : 0;
      const consentIssues = L.missingConsent + L.disputedConsent;
      const overrideCount = dqOverrideAgg[id] ?? 0;
      return {
        ...c,
        created_by_name:
          creatorNameById[(c.created_by as string | undefined) ?? ""] ??
          ((c.created_by as string | undefined) ? "Unknown" : null),
        list_stats: {
          total_leads: L.total,
          qualified_count: L.qualified,
          qualified_pct: qualifiedPct,
          qa_verified_pct: qaVerifiedPct,
          override_count: overrideCount,
          consent_issues_count: consentIssues,
          dq_count: L.dq,
          unresolved_alerts: A.count,
          compliance: listCompliance(L, A),
        },
      };
    });

    return NextResponse.json({
      campaigns: enriched,
      total: count ?? 0,
      truncated: (count ?? 0) > LIST_MAX,
      limit: LIST_MAX,
    });
  }

  const cursor = sp.get("cursor");
  const limit = clampLimit(sp.get("limit") ?? "25");

  let query = supabase
    .from("campaigns")
    .select(
      `id, campaign_id, name, description, status, start_date, end_date,
       client_id, client_name, lead_type, campaign_type, cpl, revenue, total_allocation, achieved,
       pending_allocation, industry, geography, created_at, created_by,
       campaign_metrics(
         sponsor_name,
         total_leads_allocated,
         total_campaign_spend,
         total_leads_delivered,
         daily_reporting,
         channel_split,
         deficit_leads,
         lead_increment,
         lead_replace
       )`,
      { count: "exact" }
    )
    .eq("organization_id", profile?.organization_id ?? "")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  // client_viewer: restrict to their own client's campaigns
  if (userRoles.includes("client_viewer")) {
    if (!profile?.client_id || !profile?.organization_id) {
      return NextResponse.json({ campaigns: [], total: 0, limit, nextCursor: null, hasMore: false });
    }
    const clientViewerUserIds = await getClientViewerUserIdsForOrg(
      supabase,
      profile.organization_id
    );
    if (clientViewerUserIds.length === 0) {
      return NextResponse.json({ campaigns: [], total: 0, limit, nextCursor: null, hasMore: false });
    }
    query = query.eq("client_id", profile.client_id);
    query = query.in("created_by", clientViewerUserIds);
  }

  // Cursor-based pagination
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      query = query.or(
        `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
      );
    }
  }

  const { data: campaigns, count, error } = await query;
  if (error) {
    const msg = error.message ?? "Failed to create campaign";
    const isDuplicateCampaignId =
      msg.includes("campaigns_campaign_id_unique") ||
      msg.toLowerCase().includes("duplicate key value");
    return NextResponse.json(
      {
        error: isDuplicateCampaignId
          ? "Campaign ID already exists. Please use a different Campaign ID."
          : msg,
      },
      { status: isDuplicateCampaignId ? 409 : 500 }
    );
  }

  const rows = (campaigns ?? []) as Record<string, unknown>[];
  const createdByIds = [...new Set(rows.map((r) => r.created_by).filter((id): id is string => typeof id === "string" && id.length > 0))];
  const creatorNameById: Record<string, string> = {};
  if (createdByIds.length > 0) {
    const admin = getAdminClientSafe();
    const usersClient = admin ?? supabase;
    let usersQuery = usersClient
      .from("users")
      .select("id, full_name, email")
      .in("id", createdByIds);
    if (admin && profile?.organization_id) {
      usersQuery = usersQuery.eq("organization_id", profile.organization_id);
    }
    const { data: usersData } = await usersQuery;
    ((usersData ?? []) as { id: string; full_name: string | null; email: string | null }[]).forEach((u) => {
      creatorNameById[u.id] = u.full_name || u.email || "Unknown";
    });
  }
  const hasMore = rows.length > limit;
  const items: Record<string, unknown>[] = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
    ...row,
    created_by_name:
      creatorNameById[(row.created_by as string | undefined) ?? ""] ??
      ((row.created_by as string | undefined) ? "Unknown" : null),
  }));
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor(last.id as string, last.created_at as string)
      : null;

  return NextResponse.json({ campaigns: items, total: count ?? 0, limit, nextCursor, hasMore });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRoles = await getRoleNames(supabase, user.id);
  const isCommand = hasCommandRole(userRoles);
  const isClientViewer = userRoles.includes("client_viewer");
  if (!isCommand && !isClientViewer) {
    return NextResponse.json(
      { error: "Forbidden — requires client_viewer or internal_operator (or higher)" },
      { status: 403 }
    );
  }

  const profile = await getProfile(supabase, user.id);
  const body = (await request.json()) as Record<string, unknown>;
  const admin = getAdminClientSafe();

  let insertClientId = (body.client_id as string | null) ?? null;
  if (!isCommand && isClientViewer) {
    if (!profile?.client_id) {
      return NextResponse.json(
        { error: "Forbidden — your account has no client assigned; contact an administrator." },
        { status: 403 }
      );
    }
    insertClientId = profile.client_id;
  }

  let resolvedClientName = (body.client_name as string | null) ?? null;
  if (insertClientId && !resolvedClientName) {
    if (admin) {
      const { data: clientRow } = await admin
        .from("clients")
        .select("company_name")
        .eq("id", insertClientId as string)
        .single();
      resolvedClientName = (clientRow as { company_name?: string | null } | null)?.company_name ?? null;
    }
  }

  if (isClientViewer && !admin) {
    return NextResponse.json(
      { error: "Admin API not configured. Set SUPABASE_SERVICE_ROLE_KEY in deployment environment." },
      { status: 503 }
    );
  }

  // client_viewer inserts must bypass campaigns RLS; API authorization above enforces scope.
  const writeClient = isClientViewer && admin ? admin : supabase;

  const { data: campaign, error } = (await writeClient
    .from("campaigns")
    .insert({
      organization_id: (profile?.organization_id ?? "") as string,
      campaign_id: body.campaign_id as string,
      name: body.name as string,
      description: (body.description as string | null) ?? null,
      industry: (body.industry as string | null) ?? null,
      geography: (body.geography as string | null) ?? null,
      start_date: (body.start_date as string | null) ?? null,
      end_date: (body.end_date as string | null) ?? null,
      status: (body.status as string) ?? "active",
      client_id: insertClientId,
      client_name: resolvedClientName,
      lead_type: (body.lead_type as string | null) ?? null,
      campaign_type: (body.campaign_type as string | null) ?? null,
      cpl: (body.cpl as number | null) ?? null,
      revenue: (body.revenue as number | null) ?? null,
      total_allocation: (body.total_allocation as number | null) ?? null,
      lead_aggregated: (body.lead_aggregated as string | null)?.trim() || null,
      created_by: user.id,
    } as never)
    .select()
    .single()) as unknown as {
    data: { id: string } | null;
    error: { message: string } | null;
  };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hasMetricsPayload =
    "sponsor_name" in body ||
    "total_leads_allocated" in body ||
    "total_campaign_spend" in body ||
    "total_leads_delivered" in body ||
    "daily_reporting" in body ||
    "channel_split" in body ||
    "deficit_leads" in body ||
    "lead_increment" in body ||
    "lead_replace" in body;

  if (hasMetricsPayload) {
    const historyPayload = {
      date: (body.metric_date as string | null) ?? undefined,
      total_leads_delivered: (body.total_leads_delivered as number) ?? 0,
      channel_split: (body.channel_split as Record<string, unknown> | null) ?? {},
      deficit_leads: (body.deficit_leads as number) ?? 0,
      lead_increment: (body.lead_increment as number) ?? 0,
      lead_replace: (body.lead_replace as number) ?? 0,
      total_campaign_spend: (body.total_campaign_spend as number) ?? 0,
      updated_by: user.id,
    };
    await upsertCampaignMetrics(
      writeClient,
      (campaign as unknown as { id: string }).id,
      {
        sponsor_name: (body.sponsor_name as string | null) ?? null,
        total_leads_allocated: (body.total_leads_allocated as number) ?? 0,
        total_campaign_spend: (body.total_campaign_spend as number) ?? 0,
        total_leads_delivered: (body.total_leads_delivered as number) ?? 0,
        daily_reporting: (body.daily_reporting as Record<string, unknown> | null) ?? {},
        channel_split: (body.channel_split as Record<string, unknown> | null) ?? {},
        deficit_leads: (body.deficit_leads as number) ?? 0,
        lead_increment: (body.lead_increment as number) ?? 0,
        lead_replace: (body.lead_replace as number) ?? 0,
      }
    );
    await appendCampaignMetricsHistory(
      writeClient,
      (campaign as unknown as { id: string }).id,
      historyPayload
    );
  }

  // Optional bulk lead import from campaign create form
  const rawLeads = Array.isArray(body.leads)
    ? (body.leads as Record<string, unknown>[])
    : [];
  if (rawLeads.length > COMMAND_CAMPAIGN_LEAD_IMPORT_MAX) {
    return NextResponse.json(
      { error: `Maximum ${COMMAND_CAMPAIGN_LEAD_IMPORT_MAX} leads per import` },
      { status: 400 }
    );
  }
  if (rawLeads.length > 0) {
    const leadPayloads = parsedRowsToLeadInserts(rawLeads, {
      organizationId: (profile?.organization_id ?? "") as string,
      campaignId: (campaign as { id: string }).id,
      createdBy: user.id,
    });

    if (leadPayloads.length > 0) {
      const { error: insertLeadsError } = await writeClient
        .from("leads")
        .insert(leadPayloads as never);
      if (insertLeadsError) {
        return NextResponse.json({ error: insertLeadsError.message }, { status: 500 });
      }
    }
  }

  // Notify internal operators when a client viewer creates a campaign.
  if (isClientViewer) {
    if (admin) {
      const orgId = (profile?.organization_id ?? "") as string;
      const { data: roleRows } = await admin
        .from("roles")
        .select("id, name")
        .eq("organization_id", orgId);

      const operatorRoleIds = ((roleRows ?? []) as { id: string; name: string | null }[])
        .filter((r) => (r.name ?? "").toLowerCase().trim().replace(/\s+/g, "_") === "internal_operator")
        .map((r) => r.id);

      if (operatorRoleIds.length > 0) {
        const { data: operatorRoleLinks } = await admin
          .from("user_roles")
          .select("user_id")
          .in("role_id", operatorRoleIds);

        const operatorIds = [...new Set(((operatorRoleLinks ?? []) as { user_id: string }[]).map((r) => r.user_id))]
          .filter((id) => id && id !== user.id);

        if (operatorIds.length > 0) {
          await createNotifications(
            operatorIds.map((receiverId) => ({
              title: "New Campaign Created",
              message: `Client viewer created campaign "${String(body.name ?? "Untitled Campaign")}".`,
              type: "campaign" as const,
              sender_id: user.id,
              receiver_id: receiverId,
              reference_type: "campaign" as const,
              reference_id: (campaign as { id: string }).id,
              organization_id: orgId,
            }))
          );
        }
      }
    }
  }

  return NextResponse.json({ campaign }, { status: 201 });
}
