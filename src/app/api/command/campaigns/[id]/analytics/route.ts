import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCommandRole } from "@/lib/command/rules-engine";
import { getRoleNames, getCampaignAnalytics, getProfile } from "@/lib/command/db";
import dayjs from "dayjs";

export const dynamic = "force-dynamic";

interface LeadRow {
  id: string;
  status: string;
  consent_status: string | null;
  channel: string | null;
  delivery_status: string | null;
  created_at: string;
}

const QUALIFIED_LIKE = new Set(["qualified", "registered", "attended", "no_show"]);
const QA_REVIEWED = new Set(["qualified", "disqualified", "registered", "attended", "no_show"]);
const REGISTERED_LIKE = new Set(["registered", "attended", "no_show"]);

function normStatus(s: string): string {
  return String(s ?? "").toLowerCase();
}

function eachDayInRange(start: string, end: string): string[] {
  const a = dayjs(start, "YYYY-MM-DD", true);
  const b = dayjs(end, "YYYY-MM-DD", true);
  if (!a.isValid() || !b.isValid() || a.isAfter(b, "day")) return [];
  const out: string[] = [];
  for (let d = a; !d.isAfter(b, "day"); d = d.add(1, "day")) {
    out.push(d.format("YYYY-MM-DD"));
  }
  return out;
}

function normalizeLeadChannel(ch: string | null): "email" | "telemarketing" {
  const c = (ch ?? "email").toLowerCase();
  if (c === "telemarketing" || c === "tele") return "telemarketing";
  return "email";
}

interface LeadHistoryQualifyRow {
  lead_id: string;
  new_value: unknown;
  created_at: string;
}

/** First `status_change` row where new status is `qualified` (ingestion → qualification). */
async function fetchFirstQualifiedTimestamps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (leadIds.length === 0) return map;
  const chunkSize = 400;
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const slice = leadIds.slice(i, i + chunkSize);
    const { data, error } = (await supabase
      .from("lead_history")
      .select("lead_id, new_value, created_at")
      .in("lead_id", slice)
      .eq("change_type", "status_change")
      .order("created_at", { ascending: true })
      .limit(10000)) as {
      data: LeadHistoryQualifyRow[] | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const lid = row.lead_id;
      if (map.has(lid)) continue;
      const nv = row.new_value as { status?: string } | null;
      const st = nv?.status ? String(nv.status).toLowerCase() : "";
      if (st === "qualified") map.set(lid, row.created_at);
    }
  }
  return map;
}

export type ChannelSummaryPayload = {
  totalLeads: number;
  qualified: number;
  qualifiedPct: number;
  dq: number;
  dqPct: number;
  registrations: number;
  avgMsToQualify: number | null;
};

function buildChannelSummaries(
  typedLeads: LeadRow[],
  firstQualifiedAt: Map<string, string>
): { email: ChannelSummaryPayload; telemarketing: ChannelSummaryPayload } {
  type Acc = {
    totalLeads: number;
    qualified: number;
    dq: number;
    registrations: number;
    qualMs: number[];
  };
  const acc = (): Acc => ({
    totalLeads: 0,
    qualified: 0,
    dq: 0,
    registrations: 0,
    qualMs: [],
  });
  const email = acc();
  const telemarketing = acc();

  for (const lead of typedLeads) {
    const b = normalizeLeadChannel(lead.channel) === "telemarketing" ? telemarketing : email;
    b.totalLeads++;
    const st = normStatus(lead.status);
    if (QUALIFIED_LIKE.has(st)) b.qualified++;
    if (st === "disqualified") b.dq++;
    if (REGISTERED_LIKE.has(st)) b.registrations++;

    const qAt = firstQualifiedAt.get(lead.id);
    if (qAt) {
      const ms = new Date(qAt).getTime() - new Date(lead.created_at).getTime();
      if (ms >= 0 && Number.isFinite(ms)) b.qualMs.push(ms);
    }
  }

  const finalize = (b: Acc): ChannelSummaryPayload => {
    const t = b.totalLeads;
    const avgMs =
      b.qualMs.length > 0 ? b.qualMs.reduce((a, c) => a + c, 0) / b.qualMs.length : null;
    return {
      totalLeads: t,
      qualified: b.qualified,
      qualifiedPct: t > 0 ? Math.round((b.qualified / t) * 1000) / 10 : 0,
      dq: b.dq,
      dqPct: t > 0 ? Math.round((b.dq / t) * 1000) / 10 : 0,
      registrations: b.registrations,
      avgMsToQualify: avgMs,
    };
  };

  return { email: finalize(email), telemarketing: finalize(telemarketing) };
}

function buildTrendSeries(typedLeads: LeadRow[], start: string, end: string) {
  const days = eachDayInRange(start, end);
  const daily = days.map((d) => {
    const ingested = typedLeads.filter((l) => l.created_at.slice(0, 10) === d).length;
    const cum = typedLeads.filter((l) => l.created_at.slice(0, 10) <= d);
    const n = cum.length;
    const q = cum.filter((l) => QUALIFIED_LIKE.has(normStatus(l.status))).length;
    const dq = cum.filter((l) => normStatus(l.status) === "disqualified").length;
    const reg = cum.filter((l) => REGISTERED_LIKE.has(normStatus(l.status))).length;
    const qualDen = Math.max(1, q);
    return {
      date: d,
      leadVolume: ingested,
      qualificationRate: n > 0 ? Math.round((q / n) * 1000) / 10 : null,
      dqRate: n > 0 ? Math.round((dq / n) * 1000) / 10 : null,
      registrationRate: Math.round((reg / qualDen) * 1000) / 10,
    };
  });

  const weekly: {
    period: string;
    leadVolume: number;
    qualificationRate: number | null;
    dqRate: number | null;
    registrationRate: number | null;
  }[] = [];

  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    if (chunk.length === 0) continue;
    const last = chunk[chunk.length - 1];
    weekly.push({
      period: `${chunk[0].date} → ${last.date}`,
      leadVolume: chunk.reduce((s, r) => s + r.leadVolume, 0),
      qualificationRate: last.qualificationRate,
      dqRate: last.dqRate,
      registrationRate: last.registrationRate,
    });
  }

  return { daily, weekly };
}

/** Registered funnel statuses for compliance score denominator. */
const REGISTERED_FOR_COMPLIANCE = new Set(["registered", "attended", "no_show"]);

interface ComplianceLeadRow {
  id: string;
  status: string;
  consent_status: string | null;
  channel: string | null;
  created_at: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

interface ConsentRecordRow {
  lead_id: string;
  consent_method: string | null;
  ip_address: string | null;
  recording_url: string | null;
  consent_given_at: string | null;
}

function latestConsentByLead(records: ConsentRecordRow[]): Map<string, ConsentRecordRow> {
  const m = new Map<string, ConsentRecordRow>();
  for (const r of records) {
    if (!m.has(r.lead_id)) m.set(r.lead_id, r);
  }
  return m;
}

/**
 * Evidence-based consent type for charts (all leads).
 * Disputed uses lead consent_status. Landing = digital/written with IP + timestamp.
 * Tele = verbal with recording URL. Missing = no usable record or incomplete capture.
 */
function consentTypeForChart(
  lead: Pick<ComplianceLeadRow, "consent_status">,
  rec: ConsentRecordRow | null
): "disputed" | "missing" | "landing_page" | "tele_verbal" {
  const cs = normStatus(lead.consent_status ?? "");
  if (cs === "disputed") return "disputed";

  if (!rec) return "missing";

  const method = (rec.consent_method ?? "").toLowerCase();
  if (method === "verbal") {
    return rec.recording_url ? "tele_verbal" : "missing";
  }
  if (method === "digital" || method === "written") {
    return rec.ip_address && rec.consent_given_at ? "landing_page" : "missing";
  }
  return "missing";
}

function leadDisplayName(l: ComplianceLeadRow): string {
  const combined = [l.first_name, l.last_name].filter(Boolean).join(" ").trim();
  return combined || l.name || "—";
}

export type CompliancePayload = {
  score: {
    registeredTotal: number;
    verifiedAmongRegistered: number;
    percent: number | null;
    summary: string;
    band: "green" | "yellow" | "red" | "neutral";
  };
  consentTypes: {
    landing_page: number;
    tele_verbal: number;
    missing: number;
    disputed: number;
  };
  flaggedLeads: {
    id: string;
    fullName: string;
    company_name: string | null;
    channel: string | null;
    created_at: string;
    status: string;
    daysSinceIngestion: number;
  }[];
};

function buildCompliancePayload(
  leads: ComplianceLeadRow[],
  consentRecords: ConsentRecordRow[]
): CompliancePayload {
  const byLead = latestConsentByLead(consentRecords);

  const consentTypes = {
    landing_page: 0,
    tele_verbal: 0,
    missing: 0,
    disputed: 0,
  };

  for (const lead of leads) {
    const rec = byLead.get(lead.id) ?? null;
    const bucket = consentTypeForChart(lead, rec);
    if (bucket === "landing_page") consentTypes.landing_page += 1;
    else if (bucket === "tele_verbal") consentTypes.tele_verbal += 1;
    else if (bucket === "disputed") consentTypes.disputed += 1;
    else consentTypes.missing += 1;
  }

  const registeredLeads = leads.filter((l) =>
    REGISTERED_FOR_COMPLIANCE.has(normStatus(l.status))
  );
  const registeredTotal = registeredLeads.length;
  const verifiedAmongRegistered = registeredLeads.filter(
    (l) => normStatus(l.consent_status ?? "") === "verified"
  ).length;

  let percent: number | null = null;
  if (registeredTotal > 0) {
    percent = Math.round((verifiedAmongRegistered / registeredTotal) * 1000) / 10;
  }

  let summary: string;
  let band: CompliancePayload["score"]["band"];
  if (registeredTotal === 0) {
    summary =
      "No registered leads yet — the compliance score applies to leads in Registered, Attended, or No-Show status.";
    band = "neutral";
  } else {
    summary = `${verifiedAmongRegistered} of ${registeredTotal} registered leads have verified consent (${percent}%).`;
    if (verifiedAmongRegistered === registeredTotal) {
      band = "green";
    } else if (percent !== null && percent >= 95) {
      band = "yellow";
    } else {
      band = "red";
    }
  }

  const flaggedLeads = leads
    .filter((l) => {
      const c = normStatus(l.consent_status ?? "");
      return c === "missing" || c === "disputed";
    })
    .map((l) => ({
      id: l.id,
      fullName: leadDisplayName(l),
      company_name: l.company_name,
      channel: l.channel,
      created_at: l.created_at,
      status: l.status,
      daysSinceIngestion: dayjs().diff(dayjs(l.created_at), "day"),
    }))
    .sort((a, b) => b.daysSinceIngestion - a.daysSinceIngestion);

  return {
    score: {
      registeredTotal,
      verifiedAmongRegistered,
      percent,
      summary,
      band,
    },
    consentTypes,
    flaggedLeads,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRoles = await getRoleNames(supabase, user.id);
  if (!hasCommandRole(userRoles) && !userRoles.includes("client_viewer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const profile = await getProfile(supabase, user.id);

  if (userRoles.includes("client_viewer")) {
    const { data: campaignGuard } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", id)
      .eq("client_id", profile?.client_id ?? "__no_client__")
      .single();
    if (!campaignGuard) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const { data: campaignDates } = await supabase
      .from("campaigns")
      .select("start_date, end_date")
      .eq("id", id)
      .single();

    const { metrics, leads, history, alerts } = await getCampaignAnalytics(supabase, id);

    const typedLeadsAll = leads as LeadRow[];
    const typedLeads = userRoles.includes("client_viewer")
      ? typedLeadsAll.filter(
          (l) => String(l.delivery_status ?? "").toLowerCase() === "delivered"
        )
      : typedLeadsAll;

    const statusBreakdown = typedLeads.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    const consentBreakdown = typedLeads.reduce<Record<string, number>>((acc, l) => {
      const cs = l.consent_status ?? "pending";
      acc[cs] = (acc[cs] ?? 0) + 1;
      return acc;
    }, {});

    const channelBreakdown = typedLeads.reduce<Record<string, number>>((acc, l) => {
      const ch = l.channel ?? "email";
      acc[ch] = (acc[ch] ?? 0) + 1;
      return acc;
    }, {});

    const dailyLeads = typedLeads.reduce<Record<string, number>>((acc, l) => {
      const day = l.created_at.slice(0, 10);
      acc[day] = (acc[day] ?? 0) + 1;
      return acc;
    }, {});

    const leadDays = typedLeads.map((l) => l.created_at.slice(0, 10)).sort();
    const dataMin = leadDays[0] ?? dayjs().format("YYYY-MM-DD");
    const dataMax = leadDays[leadDays.length - 1] ?? dataMin;

    const sp = request.nextUrl.searchParams;
    let rangeStart =
      sp.get("date_from")?.trim() ||
      dataMin ||
      (campaignDates as { start_date?: string | null } | null)?.start_date;
    let rangeEnd =
      sp.get("date_to")?.trim() ||
      dataMax ||
      (campaignDates as { end_date?: string | null } | null)?.end_date;

    if (!rangeStart) rangeStart = dataMin;
    if (!rangeEnd) rangeEnd = dataMax;
    if (rangeStart > rangeEnd) {
      const t = rangeStart;
      rangeStart = rangeEnd;
      rangeEnd = t;
    }

    const trends = buildTrendSeries(typedLeads, rangeStart, rangeEnd);

    const firstQualifiedAt = await fetchFirstQualifiedTimestamps(
      supabase,
      typedLeads.map((l) => l.id)
    );
    const channelSummary = buildChannelSummaries(typedLeads, firstQualifiedAt);

    let complianceLeadQuery = supabase
      .from("leads")
      .select(
        "id, status, consent_status, channel, created_at, name, first_name, last_name, company_name"
      )
      .eq("campaign_id", id);
    if (userRoles.includes("client_viewer")) {
      complianceLeadQuery = complianceLeadQuery.eq("delivery_status", "delivered");
    }
    const { data: complianceLeadRows, error: complianceLeadsErr } = await complianceLeadQuery;

    if (complianceLeadsErr) {
      throw new Error(complianceLeadsErr.message);
    }

    const { data: consentRecRows, error: consentRecErr } = await supabase
      .from("consent_records")
      .select("lead_id, consent_method, ip_address, recording_url, consent_given_at, created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false });

    if (consentRecErr) {
      throw new Error(consentRecErr.message);
    }

    const compliance = buildCompliancePayload(
      (complianceLeadRows ?? []) as ComplianceLeadRow[],
      (consentRecRows ?? []) as ConsentRecordRow[]
    );

    return NextResponse.json({
      metrics,
      leads: {
        total: typedLeads.length,
        statusBreakdown,
        consentBreakdown,
        channelBreakdown,
        dailyLeads: Object.entries(dailyLeads)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count })),
      },
      trends: {
        rangeStart,
        rangeEnd,
        daily: trends.daily,
        weekly: trends.weekly,
      },
      history,
      alerts,
      channelSummary,
      compliance,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
