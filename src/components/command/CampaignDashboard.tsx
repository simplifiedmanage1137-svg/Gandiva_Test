"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { CSSProperties, Key } from "react";
import {
  Tabs,
  Card,
  Row,
  Col,
  Tag,
  Table,
  message,
  Skeleton,
  Alert,
  Typography,
  Progress,
  Space,
  Badge,
  Button,
  Tooltip,
  DatePicker,
  Segmented,
  Divider,
  Select,
  Switch,
} from "antd";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
  LineChart,
  Line,
  LabelList,
} from "recharts";
import {
  AlertOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  HistoryOutlined,
  SafetyOutlined,
  MailOutlined,
  PhoneOutlined,
  DownloadOutlined,
  FileOutlined,
  FlagOutlined,
  PlusOutlined,
  MinusOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
} from "@ant-design/icons";
import AlertsPanel from "./AlertsPanel";
import QAPanel from "./QAPanel";
import LeadAuditPanel from "./LeadAuditPanel";
import { useAuth } from "@/context/AuthContext";
import { LEAD_TAGGING_OPTIONS } from "@/types/lead.types";
import { getLeadTableColumns } from "@/components/Leads/LeadTableColumns";

const { Text, Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;

type ChannelSummaryMetrics = {
  totalLeads: number;
  qualified: number;
  qualifiedPct: number;
  dq: number;
  dqPct: number;
  registrations: number;
  avgMsToQualify: number | null;
};

function formatAvgIngestToQualify(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const hours = ms / 3_600_000;
  if (hours < 72) return `${Math.round(hours * 10) / 10} hours`;
  const days = hours / 24;
  return `${Math.round(days * 10) / 10} days`;
}

function formatCampaignDateRange(start: string | null, end: string | null): string {
  const s = start && dayjs(start).isValid() ? dayjs(start).format("MMM D, YYYY") : null;
  const e = end && dayjs(end).isValid() ? dayjs(end).format("MMM D, YYYY") : null;
  if (s && e) return `${s} — ${e}`;
  if (s) return s;
  if (e) return e;
  return "—";
}

const EMPTY_CHANNEL_SUMMARY: ChannelSummaryMetrics = {
  totalLeads: 0,
  qualified: 0,
  qualifiedPct: 0,
  dq: 0,
  dqPct: 0,
  registrations: 0,
  avgMsToQualify: null,
};

interface CampaignAnalytics {
  metrics: {
    sponsor_name?: string;
    total_leads_allocated?: number;
    total_campaign_spend?: number;
    total_leads_delivered?: number;
    deficit_leads?: number;
    lead_increment?: number;
    lead_replace?: number;
    daily_reporting?: Record<string, unknown>;
    channel_split?: Record<string, number>;
  } | null;
  leads: {
    total: number;
    statusBreakdown: Record<string, number>;
    consentBreakdown: Record<string, number>;
    channelBreakdown: Record<string, number>;
    dailyLeads: { date: string; count: number }[];
  };
  trends?: {
    rangeStart: string;
    rangeEnd: string;
    daily: {
      date: string;
      leadVolume: number;
      qualificationRate: number | null;
      dqRate: number | null;
      registrationRate: number;
    }[];
    weekly: {
      period: string;
      leadVolume: number;
      qualificationRate: number | null;
      dqRate: number | null;
      registrationRate: number;
    }[];
  };
  alerts: { id: string; severity: string; is_resolved: boolean }[];
  channelSummary?: {
    email: ChannelSummaryMetrics;
    telemarketing: ChannelSummaryMetrics;
  };
  compliance?: {
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
}

type LeadPanelFilters = {
  leadTagging: string[];
  channels: string[];
  statuses: string[];
  repUserIds: string[];
  dateFrom: string | null;
  dateTo: string | null;
  consentTypes: string[];
  riskOnly: boolean;
  consentStatuses: string[];
};

interface LeadRow {
  id: string;
  organization_id?: string;
  campaign_id?: string;
  name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name: string | null;
  job_title?: string | null;
  phone?: string | null;
  city?: string | null;
  email: string | null;
  status: string;
  consent_status: string | null;
  channel: string | null;
  lead_tagging?: string | null;
  followup_date?: string | null;
  notes?: string | null;
  ingested_at?: string | null;
  qualified_at?: string | null;
  registered_at?: string | null;
  dq_reason_code?: string | null;
  delivery_status?: string | null;
  rep_id?: string | null;
  assigned_agent_id?: string | null;
  assigned_user?: {
    full_name?: string | null;
    email?: string | null;
    agent_code?: string | null;
    employee_id?: string | null;
  } | null;
  created_at: string;
  updated_at?: string;
  risk_flags: unknown;
  last_action?: string | null;
  last_action_at?: string | null;
}

interface CampaignDetail {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  campaign_type?: string | null;
  /** Lead aggregate label (campaigns.lead_aggregated). */
  lead_aggregated?: string | null;
  client_name: string | null;
  industry: string | null;
  geography: string | null;
  lead_type: string | null;
  cpl: number | null;
  revenue?: number | null;
  total_allocation: number | null;
  achieved: number | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  campaign_files?: {
    id: string;
    file_name: string;
    file_path: string;
    created_at: string;
    download_url?: string | null;
  }[] | null;
  clients?: { company_name?: string | null }[] | { company_name?: string | null } | null;
  campaign_metrics?: {
    sponsor_name?: string | null;
    total_leads_allocated?: number | null;
    total_campaign_spend?: number | null;
    total_leads_delivered?: number | null;
    daily_reporting?: Record<string, unknown> | null;
    channel_split?: Record<string, unknown> | null;
    deficit_leads?: number | null;
    lead_increment?: number | null;
    lead_replace?: number | null;
  }[] | {
    sponsor_name?: string | null;
    total_leads_allocated?: number | null;
    total_campaign_spend?: number | null;
    total_leads_delivered?: number | null;
    daily_reporting?: Record<string, unknown> | null;
    channel_split?: Record<string, unknown> | null;
    deficit_leads?: number | null;
    lead_increment?: number | null;
    lead_replace?: number | null;
  };
}

interface CampaignDashboardProps {
  campaignId: string;
  /** Opens this tab on load (e.g. `alerts` from `?tab=alerts`). */
  initialTab?: string | null;
  initialDeliveryStatus?: string | null;
}

interface CampaignMetricsHistoryRow {
  id: string;
  date: string;
  total_leads_delivered: number | null;
  total_campaign_spend: number | null;
  deficit_leads: number | null;
  lead_increment: number | null;
  lead_replace: number | null;
  channel_split: Record<string, unknown> | null;
  updated_by_user?: { full_name: string | null; email: string | null } | null;
  created_at: string;
}

const STATUS_COLORS_PIE = [
  "#1890ff", "#52c41a", "#faad14", "#ff4d4f",
  "#722ed1", "#13c2c2", "#fa8c16", "#a0d911",
];

const CONSENT_COLORS: Record<string, string> = {
  verified: "#52c41a",
  missing: "#ff4d4f",
  pending: "#faad14",
  disputed: "#fa8c16",
};

const LEAD_STATUS_FILTER_OPTIONS = [
  { value: "new", label: "New" },
  { value: "qa_pending", label: "QA Pending" },
  { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Disqualified" },
  { value: "registered", label: "Registered" },
  { value: "attended", label: "Attended" },
  { value: "no_show", label: "No-Show" },
];

const CHANNEL_FILTER_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "telemarketing", label: "Telemarketing" },
];

const CONSENT_TYPE_FILTER_OPTIONS = [
  { value: "landing_implicit", label: "Landing Page (implicit)" },
  { value: "tele_verbal", label: "Telemarketing (verbal)" },
  { value: "none", label: "None" },
];

const CONSENT_STATUS_FILTER_OPTIONS = [
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
  { value: "missing", label: "Missing" },
  { value: "disputed", label: "Disputed" },
];

function defaultLeadPanelFilters(): LeadPanelFilters {
  return {
    leadTagging: [],
    channels: [],
    statuses: [],
    repUserIds: [],
    dateFrom: null,
    dateTo: null,
    consentTypes: [],
    riskOnly: false,
    consentStatuses: [],
  };
}

/** Merge status keys case-insensitively for KPI math. */
function normalizeStatusBreakdown(bd: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(bd)) {
    const key = k.toLowerCase();
    out[key] = (out[key] ?? 0) + Number(v);
  }
  return out;
}

function sumStatusKeys(bd: Record<string, number>, keys: string[]): number {
  let t = 0;
  for (const k of keys) {
    t += bd[k.toLowerCase()] ?? 0;
  }
  return t;
}

function pctFromPrev(curr: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round((curr / prev) * 1000) / 10;
}

function leadFullName(row: LeadRow): string {
  const combined = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return combined || row.name || "—";
}

function leadRepDisplay(row: LeadRow): string {
  const ch = (row.channel ?? "email").toLowerCase();
  if (ch !== "telemarketing") return "—";
  return (
    row.rep_id?.trim() ||
    row.assigned_user?.agent_code?.trim() ||
    row.assigned_user?.employee_id?.trim() ||
    row.assigned_user?.full_name?.trim() ||
    "—"
  );
}

function riskFlagTooltip(flags: unknown): string {
  if (!Array.isArray(flags) || flags.length === 0) return "";
  return flags
    .map((x) =>
      typeof x === "object" && x !== null && "description" in x
        ? String((x as { description: string }).description)
        : JSON.stringify(x)
    )
    .join("\n");
}

function leadStatusTagColor(status: string): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "qualified" || s === "registered" || s === "attended") return "success";
  if (s === "disqualified") return "error";
  if (s === "qa_pending") return "processing";
  if (s === "new") return "default";
  if (s === "no_show") return "volcano";
  return "blue";
}

function renderDescriptionWithLinks(raw: string) {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l, idx, arr) => l.length > 0 || (idx > 0 && arr[idx - 1].length > 0));

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return lines.map((line, lineIdx) => {
    const parts = line.split(urlRegex);
    return (
      <div key={`desc-line-${lineIdx}`} style={{ marginBottom: 6 }}>
        {parts.map((part, partIdx) => {
          if (!part) return null;
          if (part.startsWith("http://") || part.startsWith("https://")) {
            return (
              <a
                key={`desc-part-${lineIdx}-${partIdx}`}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#1677ff",
                  textDecoration: "underline",
                  wordBreak: "break-all",
                }}
              >
                {part}
              </a>
            );
          }
          return <span key={`desc-part-${lineIdx}-${partIdx}`}>{part}</span>;
        })}
      </div>
    );
  });
}

function ChannelSplitMiniBar({ email, tele }: { email: number; tele: number }) {
  const total = email + tele;
  if (total <= 0) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        No channel data
      </Text>
    );
  }
  const emailPct = (email / total) * 100;
  const telePct = (tele / total) * 100;
  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 10,
          borderRadius: 5,
          overflow: "hidden",
          background: "#f0f0f0",
        }}
      >
        {email > 0 && (
          <Tooltip title={`Email: ${email}`}>
            <div
              style={{
                width: `${emailPct}%`,
                minWidth: email > 0 ? 3 : 0,
                background: "#1890ff",
                transition: "width 0.2s ease",
              }}
            />
          </Tooltip>
        )}
        {tele > 0 && (
          <Tooltip title={`Telemarketing: ${tele}`}>
            <div
              style={{
                width: `${telePct}%`,
                minWidth: tele > 0 ? 3 : 0,
                background: "#722ed1",
                transition: "width 0.2s ease",
              }}
            />
          </Tooltip>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 11,
          color: "#8c8c8c",
        }}
      >
        <span>Email {email}</span>
        <span>Tele {tele}</span>
      </div>
    </div>
  );
}

export default function CampaignDashboard({
  campaignId,
  initialTab,
  initialDeliveryStatus,
}: CampaignDashboardProps) {
  const { hasRole } = useAuth();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<CampaignMetricsHistoryRow[]>([]);
  const [auditLeadId, setAuditLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [trendRangeOverride, setTrendRangeOverride] = useState<{ from: string; to: string } | null>(
    null
  );
  const [trendGranularity, setTrendGranularity] = useState<"daily" | "weekly">("daily");
  const [leadPanelFilters, setLeadPanelFilters] = useState<LeadPanelFilters>(defaultLeadPanelFilters);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadPage, setLeadPage] = useState(1);
  const [leadPageSize, setLeadPageSize] = useState(25);
  const [leadSortField, setLeadSortField] = useState("created_at");
  const [leadSortOrder, setLeadSortOrder] = useState<"ascend" | "descend">("descend");
  const [campaignReps, setCampaignReps] = useState<{ id: string; label: string; rep_id: string | null }[]>(
    []
  );
  const [selectedLeadKeys, setSelectedLeadKeys] = useState<Key[]>([]);
  const [allocationSaving, setAllocationSaving] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  /** Allocation snapshot when this campaign was first shown (for % trend vs initial). */
  const [allocationBaseline, setAllocationBaseline] = useState<number | null>(null);

  const isClientViewer = hasRole("client_viewer");
  const canBulkSelect =
    hasRole("internal_operator") || hasRole("internal_admin") || hasRole("admin");
  const canAdjustAllocation =
    !isClientViewer &&
    (hasRole("internal_operator") || hasRole("internal_admin") || hasRole("admin"));

  useEffect(() => {
    if (!initialTab) return;
    const t = initialTab.toLowerCase();
    if (t === "qa" && isClientViewer) return;
    const allowed = new Set([
      "overview",
      "description",
      "channels",
      "leads",
      "files",
      "compliance",
      "alerts",
      "history",
      "qa",
    ]);
    if (allowed.has(t)) setActiveTab(t);
  }, [initialTab, isClientViewer]);

  useEffect(() => {
    setAllocationBaseline(null);
  }, [campaignId]);
  useEffect(() => {
    setDescriptionExpanded(false);
  }, [campaignId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (trendRangeOverride) {
        sp.set("date_from", trendRangeOverride.from);
        sp.set("date_to", trendRangeOverride.to);
      }
      const qs = sp.toString();
      const analyticsUrl = `/api/command/campaigns/${campaignId}/analytics${qs ? `?${qs}` : ""}`;
      const [campRes, analyticsRes] = await Promise.all([
        fetch(`/api/command/campaigns/${campaignId}`),
        fetch(analyticsUrl),
      ]);

      const campData = await campRes.json() as { campaign?: CampaignDetail };
      const analyticsData = await analyticsRes.json() as CampaignAnalytics;

      setCampaign(campData.campaign ?? null);
      setAnalytics(analyticsData);
    } catch {
      message.error("Failed to load campaign data");
    } finally {
      setLoading(false);
    }
  }, [campaignId, trendRangeOverride]);

  useEffect(() => {
    if (loading || !campaign) return;
    const m = Array.isArray(campaign.campaign_metrics)
      ? campaign.campaign_metrics[0]
      : campaign.campaign_metrics;
    const v = Number(campaign.total_allocation ?? m?.total_leads_allocated ?? 0) || 0;
    setAllocationBaseline((b) => (b === null ? v : b));
  }, [loading, campaign]);

  const adjustAllocation = useCallback(
    async (delta: number) => {
      if (!canAdjustAllocation || delta === 0) return;
      setAllocationSaving(true);
      try {
        const resGet = await fetch(`/api/command/campaigns/${campaignId}`);
        const d = (await resGet.json()) as { campaign?: CampaignDetail };
        const c = d.campaign;
        if (!c) throw new Error("Campaign not found");
        const m = Array.isArray(c.campaign_metrics) ? c.campaign_metrics[0] : c.campaign_metrics;
        const current = Number(c.total_allocation ?? m?.total_leads_allocated ?? 0) || 0;
        const next = Math.max(0, current + delta);
        if (next === current) {
          if (delta < 0) message.info("Allocation is already at the minimum (0).");
          return;
        }
        const res = await fetch(`/api/command/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            total_allocation: next,
            total_leads_allocated: next,
          }),
        });
        const patchData = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(patchData.error ?? "Failed to update allocation");
        message.success(delta > 0 ? "Allocation increased" : "Allocation decreased");
        await fetchData();
      } catch (e) {
        message.error(e instanceof Error ? e.message : "Update failed");
      } finally {
        setAllocationSaving(false);
      }
    },
    [campaignId, canAdjustAllocation, fetchData]
  );

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("campaign_id", campaignId);
      sp.set("limit", String(leadPageSize));
      sp.set("offset", String((leadPage - 1) * leadPageSize));
      sp.set("sort", leadSortField);
      sp.set("sort_dir", leadSortOrder === "ascend" ? "asc" : "desc");
      const f = leadPanelFilters;
      if (f.statuses.length > 0) sp.set("status_in", f.statuses.join(","));
      if (f.channels.length > 0) sp.set("channel_in", f.channels.join(","));
      if (f.leadTagging.length > 0) sp.set("lead_tagging_in", f.leadTagging.join(","));
      if (f.repUserIds.length > 0) sp.set("rep_user_ids_in", f.repUserIds.join(","));
      if (f.dateFrom) sp.set("date_from", f.dateFrom);
      if (f.dateTo) sp.set("date_to", f.dateTo);
      if (f.consentTypes.length > 0) sp.set("consent_type_in", f.consentTypes.join(","));
      if (f.riskOnly) sp.set("risk_active", "1");
      if (f.consentStatuses.length > 0) sp.set("consent_status_in", f.consentStatuses.join(","));
      if (initialDeliveryStatus === "delivered" || initialDeliveryStatus === "not_delivered") {
        sp.set("delivery_status", initialDeliveryStatus);
      }
      const res = await fetch(`/api/command/leads?${sp.toString()}`);
      const data = (await res.json()) as { leads?: LeadRow[]; total?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load leads");
      setLeads(data.leads ?? []);
      setLeadsTotal(typeof data.total === "number" ? data.total : 0);
    } catch {
      message.error("Failed to load leads");
    } finally {
      setLeadsLoading(false);
    }
  }, [
    campaignId,
    initialDeliveryStatus,
    leadPage,
    leadPageSize,
    leadSortField,
    leadSortOrder,
    leadPanelFilters,
  ]);

  const fetchCampaignReps = useCallback(async () => {
    try {
      const res = await fetch(`/api/command/campaigns/${campaignId}/reps`);
      const data = (await res.json()) as { reps?: { id: string; label: string; rep_id: string | null }[] };
      setCampaignReps(data.reps ?? []);
    } catch {
      setCampaignReps([]);
    }
  }, [campaignId]);

  const exportLeadsCsv = useCallback(() => {
    const sp = new URLSearchParams();
    sp.set("campaign_id", campaignId);
    sp.set("format", "csv");
    sp.set("sort", leadSortField);
    sp.set("sort_dir", leadSortOrder === "ascend" ? "asc" : "desc");
    const f = leadPanelFilters;
    if (f.statuses.length > 0) sp.set("status_in", f.statuses.join(","));
    if (f.channels.length > 0) sp.set("channel_in", f.channels.join(","));
    if (f.leadTagging.length > 0) sp.set("lead_tagging_in", f.leadTagging.join(","));
    if (f.repUserIds.length > 0) sp.set("rep_user_ids_in", f.repUserIds.join(","));
    if (f.dateFrom) sp.set("date_from", f.dateFrom);
    if (f.dateTo) sp.set("date_to", f.dateTo);
    if (f.consentTypes.length > 0) sp.set("consent_type_in", f.consentTypes.join(","));
    if (f.riskOnly) sp.set("risk_active", "1");
    if (f.consentStatuses.length > 0) sp.set("consent_status_in", f.consentStatuses.join(","));
    if (initialDeliveryStatus === "delivered" || initialDeliveryStatus === "not_delivered") {
      sp.set("delivery_status", initialDeliveryStatus);
    }
    window.open(`/api/command/leads?${sp.toString()}`, "_blank", "noopener,noreferrer");
  }, [campaignId, initialDeliveryStatus, leadPanelFilters, leadSortField, leadSortOrder]);

  const fetchMetricsHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/command/campaigns/${campaignId}/history?limit=180`);
      const data = (await res.json()) as { history?: CampaignMetricsHistoryRow[] };
      setMetricsHistory(data.history ?? []);
    } catch {
      message.error("Failed to load campaign history");
    } finally {
      setHistoryLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "leads") {
      void fetchLeads();
    }
    if (activeTab === "history") {
      void fetchMetricsHistory();
    }
  }, [activeTab, fetchLeads, fetchMetricsHistory]);

  useEffect(() => {
    if (activeTab === "leads") {
      void fetchCampaignReps();
    }
  }, [activeTab, fetchCampaignReps]);

  useEffect(() => {
    setLeadPage(1);
    setSelectedLeadKeys([]);
  }, [leadPanelFilters]);

  const applyFunnelStage = useCallback((stageKey: string) => {
    setActiveTab("leads");
    switch (stageKey) {
      case "ingested":
        setLeadPanelFilters((p) => ({ ...p, statuses: [] }));
        break;
      case "qa_verified":
        setLeadPanelFilters((p) => ({
          ...p,
          statuses: ["qualified", "disqualified", "registered", "attended", "no_show"],
        }));
        break;
      case "qualified":
        setLeadPanelFilters((p) => ({
          ...p,
          statuses: ["qualified", "registered", "attended", "no_show"],
        }));
        break;
      case "registered":
        setLeadPanelFilters((p) => ({
          ...p,
          statuses: ["registered", "attended", "no_show"],
        }));
        break;
      case "attended":
        setLeadPanelFilters((p) => ({ ...p, statuses: ["attended"] }));
        break;
      default:
        break;
    }
    setLeadPage(1);
  }, []);

  const funnelStages = useMemo(() => {
    if (!analytics?.leads) return [];
    const sb = normalizeStatusBreakdown(analytics.leads.statusBreakdown);
    const total = analytics.leads.total;
    const cQa = sumStatusKeys(sb, ["qualified", "disqualified", "registered", "attended", "no_show"]);
    const cReg = sumStatusKeys(sb, ["registered", "attended", "no_show"]);
    const cAtt = sb.attended ?? 0;
    return [
      { key: "ingested", label: "Leads Ingested", count: total, fromPrev: null as number | null },
      { key: "registered", label: "Registered (Client LP)", count: cReg, fromPrev: pctFromPrev(cReg, cQa) },
      { key: "attended", label: "Attended", count: cAtt, fromPrev: pctFromPrev(cAtt, cReg) },
    ];
  }, [analytics]);

  const trendChartRows = useMemo(() => {
    if (!analytics?.trends) return [];
    return trendGranularity === "daily" ? analytics.trends.daily : analytics.trends.weekly;
  }, [analytics, trendGranularity]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    );
  }
  if (!campaign) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message="Campaign not found" type="error" />
      </div>
    );
  }
  const metrics = Array.isArray(campaign.campaign_metrics)
    ? campaign.campaign_metrics[0]
    : campaign.campaign_metrics;
  const channelSplitFromMetrics =
    metrics?.channel_split && typeof metrics.channel_split === "object"
      ? (metrics.channel_split as Record<string, number>)
      : {};

  const openAlerts = analytics?.alerts.filter((a) => !a.is_resolved).length ?? 0;
  const criticalAlerts = analytics?.alerts.filter(
    (a) => !a.is_resolved && a.severity === "critical"
  ).length ?? 0;

  const statusData = Object.entries(analytics?.leads.statusBreakdown ?? {}).map(
    ([name, value]) => ({ name, value })
  );

  const channelSource =
    Object.keys(channelSplitFromMetrics).length > 0
      ? channelSplitFromMetrics
      : (analytics?.leads.channelBreakdown ?? {});
  const channelData = Object.entries(channelSource).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "),
    value: Number(value) || 0,
  }));

  const emailLeads = Number(
    (channelSource as Record<string, unknown>).email ??
      (channelSource as Record<string, unknown>).Email ??
      0
  );
  const teleLeads = Number(
    (channelSource as Record<string, unknown>).telemarketing ??
      (channelSource as Record<string, unknown>).Telemarketing ??
      0
  );

  const totalLeadsKpi = analytics?.leads.total ?? 0;

  const allocationNow =
    Number(campaign.total_allocation ?? metrics?.total_leads_allocated ?? 0) || 0;
  const allocationBaselineValue = allocationBaseline ?? allocationNow;
  const allocationDelta = allocationNow - allocationBaselineValue;
  const allocationTrendPct = (() => {
    if (allocationBaselineValue <= 0) return allocationNow > 0 ? 100 : 0;
    return Math.round((Math.abs(allocationDelta) / allocationBaselineValue) * 1000) / 10;
  })();

  /** Remaining lead quota vs delivered: total allocation − total leads in scope. */
  const deficitLeadsKpi = allocationNow - totalLeadsKpi;

  const leadColumns: ColumnsType<LeadRow> = (() => {
    const misColumns = getLeadTableColumns({
      showActions: false,
      showDeliveryStatus: false,
    }) as unknown as ColumnsType<LeadRow>;
    return [
      ...misColumns,
      {
        title: <span style={{ whiteSpace: "nowrap" }}>Consent Status</span>,
        dataIndex: "consent_status",
        key: "consent_status",
        width: 150,
        sorter: true,
        sortOrder: leadSortField === "consent_status" ? leadSortOrder : null,
        render: (cs: string | null) => {
          const key = (cs ?? "pending").toLowerCase();
          return (
            <Tag
              style={
                key === "verified"
                  ? { background: CONSENT_COLORS.verified, color: "#fff", borderColor: CONSENT_COLORS.verified }
                  : key === "missing"
                  ? { background: CONSENT_COLORS.missing, color: "#fff", borderColor: CONSENT_COLORS.missing }
                  : key === "disputed"
                  ? { background: CONSENT_COLORS.disputed, color: "#fff", borderColor: CONSENT_COLORS.disputed }
                  : { background: CONSENT_COLORS.pending, color: "#262626", borderColor: CONSENT_COLORS.pending }
              }
            >
              {key}
            </Tag>
          );
        },
      },
      {
        title: "Rep ID",
        key: "assigned_agent_id",
        width: 110,
        sorter: true,
        sortOrder: leadSortField === "assigned_agent_id" ? leadSortOrder : null,
        render: (_, row) => <span style={{ fontSize: 12 }}>{leadRepDisplay(row)}</span>,
      },
      {
        title: "Last Action",
        dataIndex: "last_action",
        key: "last_action",
        width: 160,
        ellipsis: true,
        render: (v: string | null) => v ?? "—",
      },
      {
        title: "Last Action Date",
        dataIndex: "last_action_at",
        key: "last_action_at",
        width: 160,
        render: (v: string | null) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—"),
      },
      {
        title: "Risk",
        key: "risk",
        width: 56,
        align: "center",
        render: (_, row) => {
          const flags = (row.risk_flags as unknown[]) ?? [];
          const has = Array.isArray(flags) && flags.length > 0;
          const tip = riskFlagTooltip(row.risk_flags);
          if (!has) {
            return <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 16 }} />;
          }
          return (
            <Tooltip title={tip || "Active risk flags"}>
              <FlagOutlined style={{ color: "#ff4d4f", fontSize: 16 }} />
            </Tooltip>
          );
        },
      },
    ];
  })();

  const historyColumns: ColumnsType<CampaignMetricsHistoryRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 110,
    },
    {
      title: "Delivered",
      dataIndex: "total_leads_delivered",
      key: "total_leads_delivered",
      width: 100,
      render: (v: number | null) => v ?? 0,
    },
    {
      title: "Spend",
      dataIndex: "total_campaign_spend",
      key: "total_campaign_spend",
      width: 120,
      render: (v: number | null) => `$${Number(v ?? 0).toLocaleString()}`,
    },
    {
      title: "Deficit",
      dataIndex: "deficit_leads",
      key: "deficit_leads",
      width: 90,
      render: (v: number | null) => v ?? 0,
    },
    {
      title: "Increment/Replace",
      key: "inc_replace",
      width: 140,
      render: (_, r) => `${r.lead_increment ?? 0} / ${r.lead_replace ?? 0}`,
    },
    {
      title: "Channel Split",
      key: "channel_split",
      render: (_, r) => {
        const split = r.channel_split ?? {};
        const tags = Object.entries(split).map(([k, v]) => `${k}:${String(v)}`);
        return tags.length ? tags.join(" · ") : "—";
      },
    },
    {
      title: "Updated By",
      key: "updated_by_user",
      width: 180,
      render: (_, r) => r.updated_by_user?.full_name ?? r.updated_by_user?.email ?? "—",
    },
    {
      title: "Changed",
      key: "changed",
      width: 220,
      render: (_, row, index) => {
        const prev = metricsHistory[index + 1];
        if (!prev) return <Tag color="blue">Initial Snapshot</Tag>;
        const changed: string[] = [];
        if ((row.total_leads_delivered ?? 0) !== (prev.total_leads_delivered ?? 0)) changed.push("Delivered");
        if ((row.total_campaign_spend ?? 0) !== (prev.total_campaign_spend ?? 0)) changed.push("Spend");
        if ((row.deficit_leads ?? 0) !== (prev.deficit_leads ?? 0)) changed.push("Deficit");
        if ((row.lead_increment ?? 0) !== (prev.lead_increment ?? 0)) changed.push("Increment");
        if ((row.lead_replace ?? 0) !== (prev.lead_replace ?? 0)) changed.push("Replace");
        if (JSON.stringify(row.channel_split ?? {}) !== JSON.stringify(prev.channel_split ?? {})) changed.push("Channel Split");
        return changed.length ? (
          <Space size={[4, 4]} wrap>
            {changed.map((c) => (
              <Tag key={c} color="purple">{c}</Tag>
            ))}
          </Space>
        ) : (
          <Tag>None</Tag>
        );
      },
    },
  ];

  const fileColumns: ColumnsType<NonNullable<CampaignDetail["campaign_files"]>[number]> = [
    {
      title: "File name",
      dataIndex: "file_name",
      key: "file_name",
      ellipsis: true,
      render: (name: string) => name || "—",
    },
    {
      title: "Uploaded",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (v: string) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—"),
    },
    {
      title: "Action",
      key: "action",
      width: 130,
      align: "right",
      render: (_, row) =>
        row.download_url ? (
          <Button
            type="link"
            icon={<DownloadOutlined />}
            href={row.download_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </Button>
        ) : (
          <Text type="secondary">Unavailable</Text>
        ),
    },
  ];

  type ComplianceFlaggedRow = {
    id: string;
    fullName: string;
    company_name: string | null;
    channel: string | null;
    created_at: string;
    status: string;
    daysSinceIngestion: number;
  };

  const complianceFlaggedColumns: ColumnsType<ComplianceFlaggedRow> = [
    {
      title: "Name",
      dataIndex: "fullName",
      key: "fullName",
      width: 160,
      ellipsis: true,
    },
    {
      title: "Company",
      dataIndex: "company_name",
      key: "company_name",
      width: 160,
      ellipsis: true,
      render: (v: string | null) => v ?? "—",
    },
    {
      title: "Channel",
      dataIndex: "channel",
      key: "channel",
      width: 100,
      render: (ch: string | null) => {
        const c = (ch ?? "email").toLowerCase();
        const isTele = c === "telemarketing" || c === "tele";
        return <Tag color={isTele ? "purple" : "blue"}>{isTele ? "Tele" : "Email"}</Tag>;
      },
    },
    {
      title: "Ingestion date",
      dataIndex: "created_at",
      key: "created_at",
      width: 120,
      render: (v: string) => dayjs(v).format("YYYY-MM-DD"),
    },
    {
      title: "Current status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: string) => <Tag>{String(s ?? "").replace(/_/g, " ")}</Tag>,
    },
    {
      title: "Days since ingestion",
      dataIndex: "daysSinceIngestion",
      key: "daysSinceIngestion",
      width: 140,
      align: "right",
    },
  ];

  const comp = analytics?.compliance;
  const compScore = comp?.score;
  const compTypes = comp?.consentTypes;
  const compliancePieChartData = compTypes
    ? [
        {
          name: "Landing page",
          value: compTypes.landing_page,
          fill: "#1890ff",
          hint: "Digital/written consent with IP address and timestamp captured.",
        },
        {
          name: "Telemarketing (verbal)",
          value: compTypes.tele_verbal,
          fill: "#722ed1",
          hint: "Verbal consent with call recording reference stored.",
        },
        {
          name: "Missing",
          value: compTypes.missing,
          fill: "#ff4d4f",
          hint: "No consent record, incomplete capture, or incomplete landing/tele evidence.",
        },
        {
          name: "Disputed",
          value: compTypes.disputed,
          fill: "#fa8c16",
          hint: "Consent has been challenged (lead consent status Disputed).",
        },
      ]
    : [];

  const complianceStackTotal =
    (compTypes?.landing_page ?? 0) +
    (compTypes?.tele_verbal ?? 0) +
    (compTypes?.missing ?? 0) +
    (compTypes?.disputed ?? 0);

  const scoreCardPalette: Record<
    NonNullable<CampaignAnalytics["compliance"]>["score"]["band"],
    { border: string; bg: string; accent: string }
  > = {
    green: { border: "#b7eb8f", bg: "#f6ffed", accent: "#52c41a" },
    yellow: { border: "#ffe58f", bg: "#fffbe6", accent: "#faad14" },
    red: { border: "#ffccc7", bg: "#fff2f0", accent: "#ff4d4f" },
    neutral: { border: "#d9d9d9", bg: "#fafafa", accent: "#8c8c8c" },
  };

  const maxFunnelCount = Math.max(1, funnelStages[0]?.count ?? 1);
  const chTotalOverview = emailLeads + teleLeads;
  const overviewChannelStack = [{ name: "Leads", email: emailLeads, tele: teleLeads }];

  const tabItems = [
    {
      key: "overview",
      label: (
        <span>
          <EyeOutlined /> Overview
        </span>
      ),
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card
            title="Lead funnel"
            size="small"
            bordered
            style={{ borderRadius: 10 }}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Click a stage to filter the Leads tab
              </Text>
            }
          >
            <div
              style={{
                width: "100%",
                overflowX: "auto",
                overflowY: "hidden",
                WebkitOverflowScrolling: "touch",
                paddingBottom: 4,
                marginBottom: -4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: "clamp(4px, 1.5vw, 12px)",
                  width: "100%",
                  minWidth: "max(100%, 380px)",
                  minHeight: 200,
                  paddingTop: 8,
                }}
              >
                {funnelStages.map((st) => {
                  const barHeight = Math.max(
                    56,
                    Math.round((st.count / maxFunnelCount) * 172)
                  );
                  return (
                    <div
                      key={st.key}
                      style={{
                        flex: "1 1 0",
                        minWidth: "clamp(72px, 14vw, 140px)",
                        maxWidth: "20%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => applyFunnelStage(st.key)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            applyFunnelStage(st.key);
                          }
                        }}
                        style={{
                          width: "100%",
                          height: barHeight,
                          minHeight: 56,
                          borderRadius: 8,
                          background: "linear-gradient(180deg, #40a9ff 0%, #096dd9 100%)",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(24,144,255,0.22)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "6px 4px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            color: "#fff",
                            fontSize: "clamp(16px, 4vw, 22px)",
                            fontWeight: 700,
                            lineHeight: 1.1,
                          }}
                        >
                          {st.count}
                        </div>
                        {st.fromPrev != null && (
                          <Text
                            style={{
                              color: "rgba(255,255,255,0.9)",
                              fontSize: "clamp(9px, 2vw, 11px)",
                              lineHeight: 1.2,
                              marginTop: 2,
                            }}
                          >
                            {st.fromPrev}%
                          </Text>
                        )}
                      </div>
                      <Text
                        strong
                        style={{
                          marginTop: 8,
                          fontSize: "clamp(10px, 2.2vw, 12px)",
                          textAlign: "center",
                          lineHeight: 1.25,
                          display: "block",
                          width: "100%",
                          padding: "0 2px",
                        }}
                      >
                        {st.label}
                      </Text>
                      <Text
                        type="secondary"
                        style={{
                          fontSize: "clamp(9px, 1.8vw, 11px)",
                          textAlign: "center",
                          marginTop: 2,
                          lineHeight: 1.2,
                        }}
                      >
                        {st.fromPrev != null ? "from previous" : "all ingested"}
                      </Text>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card title="Channel split" size="small" bordered style={{ borderRadius: 10 }}>
            {chTotalOverview === 0 ? (
              <Text type="secondary">No channel data</Text>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={overviewChannelStack}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} stroke="#8c8c8c" />
                    <YAxis type="category" dataKey="name" width={56} hide />
                    <RTooltip
                      formatter={(value: number, name: string) => {
                        const pct = chTotalOverview ? ((value / chTotalOverview) * 100).toFixed(1) : "0";
                        return [`${value} (${pct}%)`, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="email" stackId="ch" fill="#1890ff" name="Email">
                      <LabelList
                        dataKey="email"
                        position="center"
                        fill="#fff"
                        fontSize={12}
                        formatter={(v: number) => (v > 0 ? String(v) : "")}
                      />
                    </Bar>
                    <Bar dataKey="tele" stackId="ch" fill="#722ed1" name="Telemarketing">
                      <LabelList
                        dataKey="tele"
                        position="center"
                        fill="#fff"
                        fontSize={12}
                        formatter={(v: number) => (v > 0 ? String(v) : "")}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ textAlign: "center", marginTop: 4 }}>
                  <Text type="secondary">
                    Email {emailLeads} (
                    {chTotalOverview ? ((emailLeads / chTotalOverview) * 100).toFixed(1) : "0"}
                    %) · Tele {teleLeads} (
                    {chTotalOverview ? ((teleLeads / chTotalOverview) * 100).toFixed(1) : "0"}
                    %) · Total {chTotalOverview}
                  </Text>
                </div>
              </>
            )}
          </Card>

          <Card
            title="Trend charts"
            size="small"
            bordered
            style={{ borderRadius: 10 }}
            extra={
              <Space wrap align="center">
                <Segmented
                  options={[
                    { label: "Daily", value: "daily" },
                    { label: "Weekly", value: "weekly" },
                  ]}
                  value={trendGranularity}
                  onChange={(v) => setTrendGranularity(v as "daily" | "weekly")}
                />
                <RangePicker
                  value={
                    analytics?.trends
                      ? [dayjs(analytics.trends.rangeStart), dayjs(analytics.trends.rangeEnd)]
                      : undefined
                  }
                  onChange={(vals) => {
                    if (!vals?.[0] || !vals?.[1]) return;
                    setTrendRangeOverride({
                      from: vals[0].format("YYYY-MM-DD"),
                      to: vals[1].format("YYYY-MM-DD"),
                    });
                  }}
                  allowClear={false}
                  format="YYYY-MM-DD"
                />
                <Button type="link" size="small" onClick={() => setTrendRangeOverride(null)}>
                  Reset range
                </Button>
              </Space>
            }
          >
            {!analytics?.trends || trendChartRows.length === 0 ? (
              <Text type="secondary">No trend data for this range.</Text>
            ) : (
              <>
                <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
                  Rates are cumulative snapshots by ingestion date (created_at) using current lead
                  status. Range: {analytics.trends.rangeStart} — {analytics.trends.rangeEnd}
                </Text>
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>
                      Lead volume ({trendGranularity === "daily" ? "daily" : "weekly"} ingestions)
                    </Text>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={trendChartRows} margin={{ left: 4, right: 8, top: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey={trendGranularity === "daily" ? "date" : "period"}
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                          height={48}
                        />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <RTooltip />
                        <Line
                          type="monotone"
                          dataKey="leadVolume"
                          stroke="#1890ff"
                          strokeWidth={2}
                          dot={false}
                          name="Ingested"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Col>
                </Row>
              </>
            )}
          </Card>
        </div>
      ),
    },
    {
      key: "description",
      label: (
        <span>
          <FileOutlined /> Description
        </span>
      ),
      children: (
        <Card size="small" bordered style={{ borderRadius: 10 }}>
          {campaign.description?.trim() ? (
            <>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.6,
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  ...(descriptionExpanded
                    ? {}
                    : {
                        display: "-webkit-box",
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }),
                }}
              >
                {renderDescriptionWithLinks(campaign.description.trim())}
              </div>
              <Button
                type="link"
                size="small"
                style={{ paddingLeft: 0, marginTop: 8, height: "auto" }}
                onClick={() => setDescriptionExpanded((v) => !v)}
              >
                {descriptionExpanded ? "Show Less" : "Show More"}
              </Button>
            </>
          ) : (
            <Text type="secondary">No description provided for this campaign.</Text>
          )}
        </Card>
      ),
    },
    {
      key: "channels",
      label: (
        <span>
          <AppstoreOutlined /> Channels
        </span>
      ),
      children: (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card
                title="Email"
                extra={<MailOutlined style={{ color: "#1890ff" }} />}
                size="small"
                bordered
                style={{ borderRadius: 10 }}
              >
                {(() => {
                  const s = analytics?.channelSummary?.email ?? EMPTY_CHANNEL_SUMMARY;
                  return (
                    <Space direction="vertical" size={10} style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <Text type="secondary">Total leads</Text>
                        <Text strong>{s.totalLeads}</Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <Text type="secondary">Qualified</Text>
                        <Text strong>
                          {s.qualified}{" "}
                          <Text type="secondary" style={{ fontWeight: 400 }}>
                            ({s.qualifiedPct}%)
                          </Text>
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <Text type="secondary">Disqualified</Text>
                        <Text strong>
                          {s.dq}{" "}
                          <Text type="secondary" style={{ fontWeight: 400 }}>
                            ({s.dqPct}%)
                          </Text>
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <Text type="secondary">Registrations</Text>
                        <Text strong>{s.registrations}</Text>
                      </div>
                      <Divider style={{ margin: "4px 0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <Text type="secondary">Avg. time to qualification</Text>
                        <Text strong>{formatAvgIngestToQualify(s.avgMsToQualify)}</Text>
                      </div>
                    </Space>
                  );
                })()}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                title="Telemarketing"
                extra={<PhoneOutlined style={{ color: "#52c41a" }} />}
                size="small"
                bordered
                style={{ borderRadius: 10 }}
              >
                {(() => {
                  const s = analytics?.channelSummary?.telemarketing ?? EMPTY_CHANNEL_SUMMARY;
                  return (
                    <Space direction="vertical" size={10} style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <Text type="secondary">Total leads</Text>
                        <Text strong>{s.totalLeads}</Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <Text type="secondary">Qualified</Text>
                        <Text strong>
                          {s.qualified}{" "}
                          <Text type="secondary" style={{ fontWeight: 400 }}>
                            ({s.qualifiedPct}%)
                          </Text>
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <Text type="secondary">Disqualified</Text>
                        <Text strong>
                          {s.dq}{" "}
                          <Text type="secondary" style={{ fontWeight: 400 }}>
                            ({s.dqPct}%)
                          </Text>
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <Text type="secondary">Registrations</Text>
                        <Text strong>{s.registrations}</Text>
                      </div>
                      <Divider style={{ margin: "4px 0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <Text type="secondary">Avg. time to qualification</Text>
                        <Text strong>{formatAvgIngestToQualify(s.avgMsToQualify)}</Text>
                      </div>
                    </Space>
                  );
                })()}
              </Card>
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 16 }}>
            Average time to qualification is from lead ingestion to the first &quot;qualified&quot;
            status in history; leads without that event are excluded from the average.
          </Text>
          <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="Lead Status Breakdown" size="small" bordered style={{ borderRadius: 10 }}>
                {statusData.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center" }}>
                    <Text type="secondary">No status data available</Text>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={STATUS_COLORS_PIE[i % STATUS_COLORS_PIE.length]} />
                    ))}
                  </Pie>
                  <RTooltip />
                  <Legend />
                </PieChart>
                </ResponsiveContainer>
                )}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Channel Split" size="small" bordered style={{ borderRadius: 10 }}>
              {channelData.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center" }}>
                  <Text type="secondary">No channel data available</Text>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={channelData} margin={{ left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" stroke="#8c8c8c" fontSize={12} />
                  <YAxis stroke="#8c8c8c" fontSize={12} />
                  <RTooltip />
                  <Bar dataKey="value" fill="#1890ff" radius={[6, 6, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
              )}
            </Card>
          </Col>
        </Row>
        </>
      ),
    },
    {
      key: "leads",
      label: (
        <span>
          <UnorderedListOutlined /> Leads ({leadsTotal || (analytics?.leads.total ?? 0)})
        </span>
      ),
      children: (
        <div>
          <Card size="small" title="Filters" style={{ marginBottom: 16, borderRadius: 10 }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} lg={6}>
                <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
                  Type (tagging)
                </Text>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="All"
                  style={{ width: "100%" }}
                  options={LEAD_TAGGING_OPTIONS}
                  value={leadPanelFilters.leadTagging}
                  onChange={(v) => setLeadPanelFilters((p) => ({ ...p, leadTagging: v }))}
                  maxTagCount="responsive"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
                  Channel
                </Text>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="All"
                  style={{ width: "100%" }}
                  options={CHANNEL_FILTER_OPTIONS}
                  value={leadPanelFilters.channels}
                  onChange={(v) => setLeadPanelFilters((p) => ({ ...p, channels: v }))}
                  maxTagCount="responsive"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
                  Lead status
                </Text>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="All"
                  style={{ width: "100%" }}
                  options={LEAD_STATUS_FILTER_OPTIONS}
                  value={leadPanelFilters.statuses}
                  onChange={(v) => setLeadPanelFilters((p) => ({ ...p, statuses: v }))}
                  maxTagCount="responsive"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
                  Rep
                </Text>
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="All reps"
                  style={{ width: "100%" }}
                  options={campaignReps.map((r) => ({ value: r.id, label: r.label }))}
                  value={leadPanelFilters.repUserIds}
                  onChange={(v) => setLeadPanelFilters((p) => ({ ...p, repUserIds: v }))}
                  maxTagCount="responsive"
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
                  Ingestion date
                </Text>
                <RangePicker
                  style={{ width: "100%" }}
                  value={
                    leadPanelFilters.dateFrom && leadPanelFilters.dateTo
                      ? [dayjs(leadPanelFilters.dateFrom), dayjs(leadPanelFilters.dateTo)]
                      : null
                  }
                  onChange={(vals) => {
                    if (!vals?.[0] || !vals[1]) {
                      setLeadPanelFilters((p) => ({ ...p, dateFrom: null, dateTo: null }));
                    } else {
                      setLeadPanelFilters((p) => ({
                        ...p,
                        dateFrom: vals[0]!.format("YYYY-MM-DD"),
                        dateTo: vals[1]!.format("YYYY-MM-DD"),
                      }));
                    }
                  }}
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
                  Consent type
                </Text>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="All"
                  style={{ width: "100%" }}
                  options={CONSENT_TYPE_FILTER_OPTIONS}
                  value={leadPanelFilters.consentTypes}
                  onChange={(v) => setLeadPanelFilters((p) => ({ ...p, consentTypes: v }))}
                  maxTagCount="responsive"
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
                  Consent status
                </Text>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="All"
                  style={{ width: "100%" }}
                  options={CONSENT_STATUS_FILTER_OPTIONS}
                  value={leadPanelFilters.consentStatuses}
                  onChange={(v) => setLeadPanelFilters((p) => ({ ...p, consentStatuses: v }))}
                  maxTagCount="responsive"
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
                  Risk flags
                </Text>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32 }}>
                  <Switch
                    checked={leadPanelFilters.riskOnly}
                    onChange={(v) => setLeadPanelFilters((p) => ({ ...p, riskOnly: v }))}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Only leads with active risk
                  </Text>
                </div>
              </Col>
              <Col xs={24} style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <Button onClick={() => setLeadPanelFilters(defaultLeadPanelFilters())}>Clear filters</Button>
                <Button icon={<DownloadOutlined />} onClick={() => exportLeadsCsv()}>
                  Export CSV
                </Button>
              </Col>
            </Row>
          </Card>

          {canBulkSelect && selectedLeadKeys.length > 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${selectedLeadKeys.length} lead${selectedLeadKeys.length !== 1 ? "s" : ""} selected`}
              description="Batch operations will be available in a future update."
            />
          )}

          <div style={{ marginBottom: 10 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {leadsTotal} lead{leadsTotal !== 1 ? "s" : ""} match filters
              {leadPanelFilters.statuses.length > 0 && (
                <Tag color="processing" style={{ marginLeft: 8 }}>
                  Status filter active
                </Tag>
              )}
            </Text>
          </div>

          <Table<LeadRow>
            rowSelection={
              canBulkSelect
                ? {
                    selectedRowKeys: selectedLeadKeys,
                    onChange: (keys) => setSelectedLeadKeys(keys),
                    preserveSelectedRowKeys: true,
                  }
                : undefined
            }
            columns={leadColumns}
            dataSource={leads}
            rowKey="id"
            loading={leadsLoading}
            size="small"
            scroll={{ x: "max-content" }}
            pagination={{
              current: leadPage,
              pageSize: leadPageSize,
              total: leadsTotal,
              showSizeChanger: true,
              pageSizeOptions: [25, 50, 100],
              showTotal: (t) => `${t} leads`,
            }}
            onChange={(pag, _filt, sorter) => {
              if (pag.pageSize != null && pag.pageSize !== leadPageSize) {
                setLeadPageSize(pag.pageSize);
                setLeadPage(1);
              } else if (pag.current != null) {
                setLeadPage(pag.current);
              }
              if (Array.isArray(sorter)) return;
              const sortKey = sorter.columnKey ?? sorter.field;
              if (sorter.order && sortKey != null) {
                setLeadSortField(String(sortKey));
                setLeadSortOrder(sorter.order);
                setLeadPage(1);
              }
            }}
            onRow={(row) => ({
              onClick: (e) => {
                const t = e.target as HTMLElement;
                if (t.closest?.("button, a, .ant-checkbox-wrapper, .ant-select")) return;
                setAuditLeadId(row.id);
              },
              style: { cursor: "pointer" },
            })}
          />
        </div>
      ),
    },
    {
      key: "files",
      label: (
        <span>
          <FileOutlined /> Files ({campaign.campaign_files?.length ?? 0})
        </span>
      ),
      children: (
        <Card size="small" bordered style={{ borderRadius: 10 }}>
          <Table
            rowKey="id"
            columns={fileColumns}
            dataSource={campaign.campaign_files ?? []}
            size="small"
            pagination={{ pageSize: 10, showTotal: (t) => `${t} file${t !== 1 ? "s" : ""}` }}
            locale={{ emptyText: "No files uploaded for this campaign yet." }}
          />
        </Card>
      ),
    },
    {
      key: "compliance",
      label: (
        <span>
          <SafetyOutlined /> Compliance
        </span>
      ),
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card
            size="small"
            bordered
            style={{
              borderRadius: 12,
              borderWidth: 2,
              borderColor: scoreCardPalette[compScore?.band ?? "neutral"].border,
              background: scoreCardPalette[compScore?.band ?? "neutral"].bg,
            }}
            title={
              <Space>
                <SafetyOutlined style={{ color: scoreCardPalette[compScore?.band ?? "neutral"].accent }} />
                <span style={{ fontWeight: 700 }}>Compliance score</span>
              </Space>
            }
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
              <div
                style={{
                  minWidth: 120,
                  textAlign: "center",
                  padding: "8px 16px",
                }}
              >
                {compScore?.percent != null ? (
                  <Title
                    level={2}
                    style={{
                      margin: 0,
                      color: scoreCardPalette[compScore.band].accent,
                      fontSize: 42,
                      lineHeight: 1.1,
                    }}
                  >
                    {compScore.percent}%
                  </Title>
                ) : (
                  <Title level={4} type="secondary" style={{ margin: 0 }}>
                    N/A
                  </Title>
                )}
                <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                  Verified consent ÷ registered leads
                </Text>
              </div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <Paragraph style={{ marginBottom: 0, fontSize: 15, lineHeight: 1.6 }}>
                  {compScore?.summary ?? "Loading compliance metrics…"}
                </Paragraph>
                <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
                  Green: all registered leads verified · Yellow: 95–99% · Red: below 95%
                </Text>
              </div>
            </div>
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card title="Consent evidence (all leads)" size="small" bordered style={{ borderRadius: 10 }}>
                {complianceStackTotal > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={compliancePieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          labelLine={false}
                          label={({ name, percent, value }) => {
                            const p = Number(percent ?? 0);
                            const v = Number(value ?? 0);
                            if (v <= 0 || p < 0.01) return "";
                            return `${name} ${(p * 100).toFixed(0)}%`;
                          }}
                        >
                          {compliancePieChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <RTooltip
                          content={({ payload }) => {
                            if (!payload?.length) return null;
                            const p = payload[0].payload as { name?: string; value?: number; hint?: string };
                            return (
                              <div
                                style={{
                                  background: "#fff",
                                  border: "1px solid #f0f0f0",
                                  borderRadius: 8,
                                  padding: "8px 12px",
                                  maxWidth: 280,
                                  fontSize: 12,
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                <div>{p.value ?? 0} leads</div>
                                {p.hint ? (
                                  <div style={{ marginTop: 6, color: "#8c8c8c" }}>{p.hint}</div>
                                ) : null}
                              </div>
                            );
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
                      Landing page: IP + timestamp (user agent when available in your capture flow).
                      Telemarketing: verbal method with recording URL. Missing: no usable consent record.
                    </Text>
                  </>
                ) : (
                  <div style={{ padding: 48, textAlign: "center" }}>
                    <Text type="secondary">No leads in this campaign yet.</Text>
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Segmented view" size="small" bordered style={{ borderRadius: 10 }}>
                {complianceStackTotal > 0 ? (
                  <ResponsiveContainer width="100%" height={72}>
                    <BarChart
                      layout="vertical"
                      data={[
                        {
                          id: "all",
                          landing_page: compTypes?.landing_page ?? 0,
                          tele_verbal: compTypes?.tele_verbal ?? 0,
                          missing: compTypes?.missing ?? 0,
                          disputed: compTypes?.disputed ?? 0,
                        },
                      ]}
                      margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                    >
                      <XAxis type="number" domain={[0, complianceStackTotal]} hide />
                      <YAxis type="category" dataKey="id" hide />
                      <RTooltip />
                      <Bar dataKey="landing_page" stackId="c" fill="#1890ff" name="Landing page" />
                      <Bar dataKey="tele_verbal" stackId="c" fill="#722ed1" name="Tele (verbal)" />
                      <Bar dataKey="missing" stackId="c" fill="#ff4d4f" name="Missing" />
                      <Bar dataKey="disputed" stackId="c" fill="#fa8c16" name="Disputed" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
                <div style={{ marginTop: complianceStackTotal > 0 ? 16 : 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Landing page", c: "#1890ff", n: compTypes?.landing_page ?? 0 },
                    { label: "Telemarketing (verbal)", c: "#722ed1", n: compTypes?.tele_verbal ?? 0 },
                    { label: "Missing", c: "#ff4d4f", n: compTypes?.missing ?? 0 },
                    { label: "Disputed", c: "#fa8c16", n: compTypes?.disputed ?? 0 },
                  ].map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Space size={8}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: row.c,
                            display: "inline-block",
                          }}
                        />
                        <Text style={{ fontSize: 13 }}>{row.label}</Text>
                      </Space>
                      <Text strong>{row.n}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>

          <Card
            title="Leads without compliant consent (Missing or Disputed)"
            size="small"
            bordered
            style={{ borderRadius: 10 }}
          >
            <Table<ComplianceFlaggedRow>
              rowKey="id"
              columns={complianceFlaggedColumns}
              dataSource={comp?.flaggedLeads ?? []}
              size="small"
              pagination={{ pageSize: 10, showTotal: (t) => `${t} lead${t !== 1 ? "s" : ""}` }}
              locale={{
                emptyText: (
                  <div style={{ padding: "24px 16px", textAlign: "center" }}>
                    <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 28, marginBottom: 8 }} />
                    <div>
                      <Text strong>No issues found</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 13, display: "block", marginTop: 4 }}>
                      No leads with Missing or Disputed consent status.
                    </Text>
                  </div>
                ),
              }}
              onRow={(row) => ({
                onClick: (e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest?.("button, a, .ant-checkbox-wrapper")) return;
                  setAuditLeadId(row.id);
                },
                style: { cursor: "pointer" },
              })}
            />
          </Card>
        </div>
      ),
    },
    {
      key: "alerts",
      label: (
        <span>
          <AlertOutlined />
          {" "}Alerts
          {openAlerts > 0 && (
            <Badge
              count={openAlerts}
              style={{ marginLeft: 8, backgroundColor: criticalAlerts > 0 ? "#ff4d4f" : "#faad14" }}
            />
          )}
        </span>
      ),
      children: (
        <AlertsPanel campaignId={campaignId} onOpenLeadAudit={(id) => setAuditLeadId(id)} />
      ),
    },
    {
      key: "history",
      label: (
        <span>
          <HistoryOutlined /> History
        </span>
      ),
      children: (
        <Card size="small" bordered style={{ borderRadius: 10 }}>
          <Table
            rowKey="id"
            columns={historyColumns}
            dataSource={metricsHistory}
            loading={historyLoading}
            size="small"
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 15, showTotal: (t) => `${t} updates` }}
          />
        </Card>
      ),
    },
    ...(!isClientViewer
      ? [
          {
            key: "qa",
            label: (
              <span>
                <ExclamationCircleOutlined /> QA
              </span>
            ),
            children: (
              <Card size="small" bordered style={{ borderRadius: 10 }}>
                <QAPanel campaignId={campaignId} onOpenLeadAudit={(id) => setAuditLeadId(id)} />
              </Card>
            ),
          },
        ]
      : []),
  ];

  const kpiCardStyle: CSSProperties = {
    flex: "1 1 160px",
    minWidth: 160,
    borderRadius: 10,
    textAlign: "center",
  };

  return (
    <div>
      <div
        style={{
          position: "sticky",
          // Pull up by dashboard Content padding so no grey strip shows above the bar while scrolling.
          top: "calc(-1 * var(--app-content-padding, 0px))",
          zIndex: 20,
          background: "#fff",
          padding: "16px 24px",
          marginBottom: 16,
          borderBottom: "1px solid #f0f0f0",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Title level={4} style={{ margin: 0 }}>
                {campaign.name}
              </Title>
              {campaign.campaign_id ? (
                <Tag color="default" style={{ fontFamily: "monospace" }}>
                  {campaign.campaign_id}
                </Tag>
              ) : null}
              <Tag
                color={
                  campaign.status === "active" ? "green" :
                  campaign.status === "paused" ? "orange" :
                  campaign.status === "completed" ? "blue" : "default"
                }
              >
                {campaign.status.toUpperCase()}
              </Tag>
            </div>
            <div style={{ marginTop: 10 }}>
              <Space
                wrap
                size={[20, 12]}
                split={
                  <Divider
                    type="vertical"
                    style={{ margin: 0, height: 44, borderColor: "#f0f0f0" }}
                  />
                }
              >
                <div style={{ minWidth: 120, maxWidth: 280 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    Sponsor name
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: 600, display: "block", marginTop: 4 }}>
                    {metrics?.sponsor_name?.trim() || "—"}
                  </Text>
                </div>
                <div style={{ minWidth: 120, maxWidth: 280 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    Client
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: 600, display: "block", marginTop: 4 }}>
                    {campaign.client_name?.trim() || "—"}
                  </Text>
                </div>
                <div style={{ minWidth: 120, maxWidth: 280 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    Campaign type
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: 600, display: "block", marginTop: 4 }}>
                    {campaign.campaign_type?.trim() || "—"}
                  </Text>
                </div>
                <div style={{ minWidth: 120, maxWidth: 280 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    Aggregate name
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: 600, display: "block", marginTop: 4 }}>
                    {campaign.lead_aggregated?.trim() || "—"}
                  </Text>
                </div>
                <div style={{ minWidth: 120, maxWidth: 280 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    Lead type
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: 600, display: "block", marginTop: 4 }}>
                    {campaign.lead_type?.trim() || "—"}
                  </Text>
                </div>
                <div style={{ minWidth: 160, maxWidth: 320 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    Industry / Geography
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: 600, display: "block", marginTop: 4 }}>
                    {[campaign.industry, campaign.geography].filter(Boolean).join(" / ") || "—"}
                  </Text>
                </div>
                <div style={{ minWidth: 200, maxWidth: 360 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    Campaign dates
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: 600, display: "block", marginTop: 4 }}>
                    {formatCampaignDateRange(campaign.start_date, campaign.end_date)}
                  </Text>
                </div>
                <div style={{ minWidth: 120, maxWidth: 240 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    CPL / Revenue
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: 600, display: "block", marginTop: 4 }}>
                    {(campaign.cpl ?? null) != null
                      ? `$${Number(campaign.cpl).toLocaleString()}`
                      : "—"}
                    {" / "}
                    {(campaign.revenue ?? null) != null
                      ? `$${Number(campaign.revenue).toLocaleString()}`
                      : "—"}
                  </Text>
                </div>
              </Space>
            </div>
          </div>

          <Space>
            {criticalAlerts > 0 && (
              <Tag color="red" icon={<AlertOutlined />}>
                {criticalAlerts} CRITICAL
              </Tag>
            )}
            <Button size="small" onClick={() => void fetchData()}>
              Refresh
            </Button>
          </Space>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
          <Card size="small" bordered styles={{ body: { padding: "14px 16px" } }} style={kpiCardStyle}>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Total Leads
            </Text>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: "#262626" }}>
              {totalLeadsKpi}
            </div>
          </Card>

          <Card size="small" bordered styles={{ body: { padding: "14px 16px" } }} style={kpiCardStyle}>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
              Channel Split
            </Text>
            <ChannelSplitMiniBar email={emailLeads} tele={teleLeads} />
          </Card>

          <Card
            size="small"
            bordered
            hoverable
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab("alerts")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveTab("alerts");
              }
            }}
            styles={{ body: { padding: "14px 16px" } }}
            style={{
              ...kpiCardStyle,
              cursor: "pointer",
              borderColor: openAlerts > 0 ? "#ffccc7" : undefined,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                Alerts
              </Text>
              {openAlerts > 0 && (
                <Badge count={openAlerts} style={{ backgroundColor: "#ff4d4f" }} />
              )}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                lineHeight: 1.2,
                color: openAlerts > 0 ? "#cf1322" : "#262626",
              }}
            >
              {openAlerts}
            </div>
            <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
              {criticalAlerts > 0
                ? `${criticalAlerts} critical`
                : openAlerts === 0
                  ? "No open alerts"
                  : "Tap to review"}
            </Text>
          </Card>

          <Card size="small" bordered styles={{ body: { padding: "14px 16px" } }} style={kpiCardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                Total Allocation
              </Text>
              {canAdjustAllocation && (
                <Space size={6}>
                  <Tooltip title="Decrease allocation by 1">
                    <Button
                      type="primary"
                      size="small"
                      shape="circle"
                      icon={<MinusOutlined />}
                      loading={allocationSaving}
                      disabled={allocationNow <= 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        void adjustAllocation(-1);
                      }}
                      style={{
                        minWidth: 28,
                        width: 28,
                        height: 28,
                        padding: 0,
                        background: "#ff4d4f",
                        borderColor: "#cf1322",
                      }}
                    />
                  </Tooltip>
                  <Tooltip title="Increase allocation by 1">
                    <Button
                      type="primary"
                      size="small"
                      shape="circle"
                      icon={<PlusOutlined />}
                      loading={allocationSaving}
                      onClick={(e) => {
                        e.stopPropagation();
                        void adjustAllocation(1);
                      }}
                      style={{
                        minWidth: 28,
                        width: 28,
                        height: 28,
                        padding: 0,
                        background: "#52c41a",
                        borderColor: "#389e0d",
                      }}
                    />
                  </Tooltip>
                </Space>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: 8,
                rowGap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: "#52c41a",
                }}
              >
                {allocationNow.toLocaleString()}
              </span>
              <span style={{ fontSize: 15, color: "#262626", fontWeight: 500 }}>
                ({allocationTrendPct}%
                {allocationDelta > 0 ? (
                  <CaretUpOutlined style={{ color: "#52c41a", fontSize: 15, marginLeft: 2 }} />
                ) : allocationDelta < 0 ? (
                  <CaretDownOutlined style={{ color: "#ff4d4f", fontSize: 15, marginLeft: 2 }} />
                ) : (
                  <MinusOutlined style={{ color: "#8c8c8c", fontSize: 15, marginLeft: 2 }} />
                )}
                )
              </span>
            </div>
            <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
              Lead quota (campaign)
            </Text>
          </Card>

          <Card size="small" bordered styles={{ body: { padding: "14px 16px" } }} style={kpiCardStyle}>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Deficit leads
            </Text>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: "#262626" }}>
              {deficitLeadsKpi.toLocaleString()}
            </div>
          </Card>
        </div>
      </div>

      <div style={{ padding: "0 24px 24px" }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="small"
          type="card"
        />
      </div>

      <LeadAuditPanel
        leadId={auditLeadId}
        open={Boolean(auditLeadId)}
        onClose={() => setAuditLeadId(null)}
        onLeadUpdated={() => {
          void fetchData();
          if (activeTab === "leads") void fetchLeads();
        }}
      />
    </div>
  );
}
