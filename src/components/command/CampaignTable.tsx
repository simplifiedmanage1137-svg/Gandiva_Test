"use client";

import type { HTMLAttributes } from "react";
import { Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SafetyOutlined } from "@ant-design/icons";
import Link from "next/link";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

interface CampaignMetrics {
  sponsor_name?: string | null;
  total_leads_allocated?: number | null;
  total_campaign_spend?: number | null;
  total_leads_delivered?: number | null;
  daily_reporting?: unknown;
  channel_split?: unknown;
  deficit_leads?: number | null;
  lead_increment?: number | null;
  lead_replace?: number | null;
}

export interface CampaignListStats {
  total_leads: number;
  qualified_count: number;
  qualified_pct: number;
  /** % of leads past QA (qualified / registered / attended / no_show). */
  qa_verified_pct: number;
  /** dq_override alert rows for this campaign. */
  override_count: number;
  /** Leads with missing or disputed consent. */
  consent_issues_count: number;
  dq_count: number;
  unresolved_alerts: number;
  compliance: "green" | "yellow" | "red";
}

export interface CommandCampaignRow {
  id: string;
  campaign_id: string;
  name: string;
  created_by_name?: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  client_name: string | null;
  lead_type: string | null;
  cpl: number | null;
  total_allocation: number | null;
  achieved: number | null;
  industry: string | null;
  geography: string | null;
  campaign_metrics?: CampaignMetrics | CampaignMetrics[];
  list_stats?: CampaignListStats;
}

interface CampaignTableProps {
  campaigns: CommandCampaignRow[];
  loading?: boolean;
}

const STATUS_TAG_PROPS: Record<string, { color: string }> = {
  active: { color: "success" },
  paused: { color: "warning" },
  completed: { color: "default" },
  cancelled: { color: "error" },
  draft: { color: "default" },
};

function formatLocalDate(iso: string | null): string {
  if (!iso) return "—";
  const strict = dayjs(iso, "YYYY-MM-DD", true);
  if (strict.isValid()) return strict.format("MMM D, YYYY");
  return dayjs(iso).format("MMM D, YYYY");
}

/** Keeps sortable headers on one line; minWidth stops flex layout from crushing columns. */
function headerCellProps(minWidth: number) {
  return (): HTMLAttributes<HTMLTableCellElement> => ({
    style: { whiteSpace: "nowrap", minWidth },
  });
}

function complianceShieldColor(level: "green" | "yellow" | "red") {
  if (level === "green") return "#52c41a";
  if (level === "yellow") return "#faad14";
  return "#ff4d4f";
}

function formatComplianceTooltip(stats: CampaignListStats | undefined): string {
  const q = stats?.qa_verified_pct ?? 0;
  const o = stats?.override_count ?? 0;
  const c = stats?.consent_issues_count ?? 0;
  return `${q}% QA verified | ${o} overrides | ${c} consent issues`;
}

function ComplianceShieldCell({ row }: { row: CommandCampaignRow }) {
  const stats = row.list_stats;
  const level = stats?.compliance ?? "green";
  return (
    <Tooltip title={formatComplianceTooltip(stats)} placement="topLeft">
      <Link
        href={`/dashboard/campaigns/${row.id}?tab=compliance`}
        prefetch={false}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "inherit",
        }}
        aria-label="Open campaign compliance"
      >
        <SafetyOutlined style={{ fontSize: 18, color: complianceShieldColor(level) }} />
      </Link>
    </Tooltip>
  );
}

export default function CampaignTable({ campaigns, loading }: CampaignTableProps) {
  const columns: ColumnsType<CommandCampaignRow> = [
    {
      title: "Campaign Name",
      key: "name",
      width: 280,
      ellipsis: true,
      sorter: (a, b) => a.name.localeCompare(b.name),
      onHeaderCell: headerCellProps(280),
      onCell: () => ({ style: { minWidth: 200, maxWidth: 360 } }),
      render: (_, row) => (
        <Link href={`/dashboard/campaigns/${row.id}`} style={{ fontWeight: 600 }}>
          {row.name}
        </Link>
      ),
    },
    {
      title: "Created By",
      dataIndex: "created_by_name",
      key: "created_by_name",
      width: 180,
      ellipsis: true,
      sorter: (a, b) => (a.created_by_name ?? "").localeCompare(b.created_by_name ?? ""),
      onHeaderCell: headerCellProps(180),
      onCell: () => ({ style: { minWidth: 180, whiteSpace: "nowrap" } }),
      render: (name: string | null | undefined) => name || "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 124,
      sorter: (a, b) => a.status.localeCompare(b.status),
      onHeaderCell: headerCellProps(124),
      onCell: () => ({ style: { minWidth: 124 } }),
      render: (status: string) => {
        const s = String(status ?? "").toLowerCase();
        const tag = STATUS_TAG_PROPS[s] ?? { color: "default" };
        const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
        return (
          <Tag color={tag.color} style={s === "completed" ? { color: "#595959", borderColor: "#d9d9d9" } : undefined}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: "Start Date",
      dataIndex: "start_date",
      key: "start_date",
      width: 136,
      sorter: (a, b) => {
        const x = a.start_date ?? "";
        const y = b.start_date ?? "";
        return x.localeCompare(y);
      },
      onHeaderCell: headerCellProps(136),
      onCell: () => ({ style: { minWidth: 136, whiteSpace: "nowrap" } }),
      render: (d: string | null) => (
        <span style={{ fontSize: 13 }}>{formatLocalDate(d)}</span>
      ),
    },
    {
      title: "End Date",
      dataIndex: "end_date",
      key: "end_date",
      width: 136,
      sorter: (a, b) => {
        const x = a.end_date ?? "";
        const y = b.end_date ?? "";
        return x.localeCompare(y);
      },
      onHeaderCell: headerCellProps(136),
      onCell: () => ({ style: { minWidth: 136, whiteSpace: "nowrap" } }),
      render: (d: string | null) => (
        <span style={{ fontSize: 13 }}>{formatLocalDate(d)}</span>
      ),
    },
    {
      title: "Total Leads",
      key: "total_leads",
      width: 118,
      sorter: (a, b) =>
        (a.list_stats?.total_leads ?? 0) - (b.list_stats?.total_leads ?? 0),
      onHeaderCell: headerCellProps(118),
      onCell: () => ({ style: { minWidth: 118, whiteSpace: "nowrap" } }),
      render: (_, row) => (
        <span style={{ fontWeight: 500 }}>{row.list_stats?.total_leads ?? 0}</span>
      ),
    },
    {
      title: "Qualified %",
      key: "qualified_pct",
      width: 132,
      align: "right",
      sorter: (a, b) =>
        (a.list_stats?.qualified_pct ?? 0) - (b.list_stats?.qualified_pct ?? 0),
      onHeaderCell: headerCellProps(132),
      onCell: () => ({ style: { minWidth: 132, whiteSpace: "nowrap" } }),
      render: (_, row) => {
        const p = row.list_stats?.qualified_pct ?? 0;
        return <span>{`${p}%`}</span>;
      },
    },
    {
      title: "DQ Count",
      key: "dq_count",
      width: 108,
      align: "right",
      sorter: (a, b) => (a.list_stats?.dq_count ?? 0) - (b.list_stats?.dq_count ?? 0),
      onHeaderCell: headerCellProps(108),
      onCell: () => ({ style: { minWidth: 108, whiteSpace: "nowrap" } }),
      render: (_, row) => <span>{row.list_stats?.dq_count ?? 0}</span>,
    },
    {
      title: "Alerts Count",
      key: "alerts_count",
      width: 128,
      align: "right",
      sorter: (a, b) =>
        (a.list_stats?.unresolved_alerts ?? 0) - (b.list_stats?.unresolved_alerts ?? 0),
      onHeaderCell: headerCellProps(128),
      onCell: () => ({ style: { minWidth: 128, whiteSpace: "nowrap" } }),
      render: (_, row) => {
        const n = row.list_stats?.unresolved_alerts ?? 0;
        return (
          <Link
            href={`/dashboard/campaigns/${row.id}?tab=alerts&alerts_filter=unresolved`}
            prefetch={false}
            style={{ fontWeight: n > 0 ? 600 : 400 }}
            aria-label="Open unresolved alerts for this campaign"
          >
            {n}
          </Link>
        );
      },
    },
    {
      title: "Compliance",
      key: "compliance",
      width: 104,
      align: "center",
      onHeaderCell: headerCellProps(104),
      onCell: () => ({ style: { minWidth: 104 } }),
      render: (_, row) => <ComplianceShieldCell row={row} />,
    },
  ];

  return (
    <Table<CommandCampaignRow>
      columns={columns}
      dataSource={campaigns}
      rowKey="id"
      loading={loading}
      size="middle"
      tableLayout="fixed"
      scroll={{ x: "max-content" }}
      pagination={{
        defaultPageSize: 25,
        showSizeChanger: true,
        pageSizeOptions: [10, 25, 50, 100],
        showTotal: (t) => `${t} campaigns`,
      }}
      style={{ background: "#fff", borderRadius: 8 }}
    />
  );
}
