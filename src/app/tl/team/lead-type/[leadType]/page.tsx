"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useDateFilter } from "@/hooks/useDateFilter";
import DateFilter from "@/components/Dashboard/DateFilter";
import {
  Skeleton, Table, Tag, Button, Input, Select, Space, Typography, Spin,
} from "antd";
import {
  ArrowLeftOutlined, DownloadOutlined, SearchOutlined,
  RiseOutlined, TeamOutlined, CheckCircleOutlined, PercentageOutlined,
} from "@ant-design/icons";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

const { Text } = Typography;

// ── Types ────────────────────────────────────────────────────────────────────

type Summary = {
  totalLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  activeCampaigns: number;
  totalCampaigns: number;
};

type AgentRow = {
  id: string;
  name: string;
  totalLeads: number;
  qualifiedLeads: number;
  conversionPct: number;
  activeCampaigns: number;
  leadsToday: number;
  leadsThisWeek: number;
  lastActivity: string | null;
  status: "Active" | "Idle";
};

type TrendPoint = { date: string; leads: number; qualified: number };

// ── Fetchers ─────────────────────────────────────────────────────────────────

function buildQs(params: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function fetchSummary(leadType: string, startDate?: string, endDate?: string): Promise<Summary> {
  const qs = buildQs({ start_date: startDate, end_date: endDate });
  const res = await fetch(`/api/tl/lead-type/${encodeURIComponent(leadType)}/summary${qs}`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
}

async function fetchAgents(leadType: string, startDate?: string, endDate?: string): Promise<{ agents: AgentRow[] }> {
  const qs = buildQs({ start_date: startDate, end_date: endDate });
  const res = await fetch(`/api/tl/lead-type/${encodeURIComponent(leadType)}/agents${qs}`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
}

async function fetchTrends(leadType: string, startDate?: string, endDate?: string, granularity?: string): Promise<{ trend: TrendPoint[] }> {
  const qs = buildQs({ start_date: startDate, end_date: endDate, granularity });
  const res = await fetch(`/api/tl/lead-type/${encodeURIComponent(leadType)}/trends${qs}`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  border: "1px solid #f0f0f0",
};

const statCards = [
  { key: "totalLeads",      label: "Total Leads",      icon: <TeamOutlined />,         color: "#1890ff", bg: "#e6f4ff" },
  { key: "qualifiedLeads",  label: "Qualified Leads",  icon: <CheckCircleOutlined />,  color: "#52c41a", bg: "#f6ffed" },
  { key: "conversionRate",  label: "Conversion Rate",  icon: <PercentageOutlined />,   color: "#faad14", bg: "#fffbe6" },
  { key: "activeCampaigns", label: "Active Campaigns", icon: <RiseOutlined />,         color: "#722ed1", bg: "#f9f0ff" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LeadTypeAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const rawLeadType = params?.leadType as string | undefined;
  const leadType = rawLeadType ? decodeURIComponent(rawLeadType) : "";

  const { hasRole, isInitialized } = useAuth();
  const enabled = Boolean(isInitialized && (hasRole("team_leader") || hasRole("tl")) && leadType);

  const { filterState, dateRange, setPreset, setCustomMonth, setCustomYear } = useDateFilter();

  const [agentSearch, setAgentSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const summaryQ = useQuery({
    queryKey: ["tl", "lead-type", leadType, "summary", dateRange.startDate, dateRange.endDate],
    queryFn: () => fetchSummary(leadType, dateRange.startDate, dateRange.endDate),
    enabled,
    staleTime: 60 * 1000,
  });

  const agentsQ = useQuery({
    queryKey: ["tl", "lead-type", leadType, "agents", dateRange.startDate, dateRange.endDate],
    queryFn: () => fetchAgents(leadType, dateRange.startDate, dateRange.endDate),
    enabled,
    staleTime: 60 * 1000,
  });

  const trendsQ = useQuery({
    queryKey: ["tl", "lead-type", leadType, "trends", dateRange.startDate, dateRange.endDate, dateRange.granularity],
    queryFn: () => fetchTrends(leadType, dateRange.startDate, dateRange.endDate, dateRange.granularity),
    enabled,
    staleTime: 60 * 1000,
  });

  const summary = summaryQ.data;
  const agentsList = agentsQ.data?.agents ?? [];
  const trendData = trendsQ.data?.trend ?? [];

  // ── Filtered agents ───────────────────────────────────────────────────────
  const filteredAgents = useMemo(() => {
    return agentsList.filter((a) => {
      const matchSearch = !agentSearch.trim() || a.name.toLowerCase().includes(agentSearch.trim().toLowerCase());
      const matchStatus = !statusFilter || a.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [agentsList, agentSearch, statusFilter]);

  // ── Top 5 agents for bar chart ────────────────────────────────────────────
  const topAgentsChart = useMemo(() =>
    [...agentsList]
      .sort((a, b) => b.totalLeads - a.totalLeads)
      .slice(0, 5)
      .map((a) => ({
        name: a.name.length > 12 ? `${a.name.slice(0, 11)}…` : a.name,
        leads: a.totalLeads,
        qualified: a.qualifiedLeads,
      })),
    [agentsList]
  );

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = filteredAgents.map((a) => ({
      "Agent Name": a.name,
      "Total Leads": a.totalLeads,
      "Qualified Leads": a.qualifiedLeads,
      "Conversion %": `${a.conversionPct}%`,
      "Active Campaigns": a.activeCampaigns,
      "Leads Today": a.leadsToday,
      "Leads This Week": a.leadsThisWeek,
      "Last Activity": a.lastActivity ? new Date(a.lastActivity).toLocaleString() : "—",
      "Status": a.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agent Performance");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${leadType}-agent-performance-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Agent table columns ───────────────────────────────────────────────────
  const columns = [
    {
      title: "#",
      key: "rank",
      width: 50,
      render: (_: unknown, __: unknown, i: number) => (
        <span style={{ fontWeight: 600, color: i < 3 ? "#faad14" : "#8c8c8c" }}>{i + 1}</span>
      ),
    },
    {
      title: "Agent Name",
      dataIndex: "name",
      key: "name",
      sorter: (a: AgentRow, b: AgentRow) => a.name.localeCompare(b.name),
      render: (name: string) => <span style={{ fontWeight: 600 }}>{name}</span>,
    },
    {
      title: "Total Leads",
      dataIndex: "totalLeads",
      key: "totalLeads",
      sorter: (a: AgentRow, b: AgentRow) => a.totalLeads - b.totalLeads,
      align: "center" as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "Qualified",
      dataIndex: "qualifiedLeads",
      key: "qualifiedLeads",
      sorter: (a: AgentRow, b: AgentRow) => a.qualifiedLeads - b.qualifiedLeads,
      align: "center" as const,
      render: (v: number) => <span style={{ color: "#52c41a", fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "Conversion %",
      dataIndex: "conversionPct",
      key: "conversionPct",
      sorter: (a: AgentRow, b: AgentRow) => a.conversionPct - b.conversionPct,
      align: "center" as const,
      render: (v: number) => (
        <Tag color={v >= 50 ? "green" : v >= 25 ? "orange" : "red"}>{v}%</Tag>
      ),
    },
    {
      title: "Active Campaigns",
      dataIndex: "activeCampaigns",
      key: "activeCampaigns",
      sorter: (a: AgentRow, b: AgentRow) => a.activeCampaigns - b.activeCampaigns,
      align: "center" as const,
    },
    {
      title: "Today",
      dataIndex: "leadsToday",
      key: "leadsToday",
      sorter: (a: AgentRow, b: AgentRow) => a.leadsToday - b.leadsToday,
      align: "center" as const,
    },
    {
      title: "This Week",
      dataIndex: "leadsThisWeek",
      key: "leadsThisWeek",
      sorter: (a: AgentRow, b: AgentRow) => a.leadsThisWeek - b.leadsThisWeek,
      align: "center" as const,
    },
    {
      title: "Last Activity",
      dataIndex: "lastActivity",
      key: "lastActivity",
      render: (v: string | null) =>
        v ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(v).toLocaleDateString()}
          </Text>
        ) : "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [{ text: "Active", value: "Active" }, { text: "Idle", value: "Idle" }],
      onFilter: (value: unknown, record: AgentRow) => record.status === value,
      render: (s: string) => (
        <Tag color={s === "Active" ? "green" : "default"}>{s}</Tag>
      ),
    },
  ];

  if (!isInitialized) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Button
            icon={<ArrowLeftOutlined />}
            type="link"
            style={{ padding: 0, marginBottom: 8, fontSize: 14 }}
            onClick={() => router.push("/tl/team")}
          >
            Back to Team
          </Button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{leadType}</h1>
            <Tag color="blue" style={{ fontSize: 13, padding: "2px 10px" }}>Lead Type Analytics</Tag>
          </div>
          <p style={{ margin: "4px 0 0", color: "#8c8c8c", fontSize: 14 }}>
            Performance breakdown for all campaigns and agents under this lead type.
          </p>
        </div>
        <DateFilter
          filterState={filterState}
          label={dateRange.label}
          onPresetChange={setPreset}
          onCustomMonthChange={setCustomMonth}
          onCustomYearChange={setCustomYear}
        />
      </div>

      {/* Summary Cards */}
      {summaryQ.isLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 24 }}>
          {statCards.map((card) => {
            const raw = summary?.[card.key as keyof Summary] ?? 0;
            const value = card.key === "conversionRate" ? `${raw}%` : raw;
            return (
              <div key={card.key} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: card.color, flexShrink: 0 }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ color: "#8c8c8c", fontSize: 13 }}>{card.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Leads Trend */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>Leads Trend</h3>
          {trendsQ.isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="ltLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ltQualified" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52c41a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#8c8c8c" fontSize={11} />
                <YAxis stroke="#8c8c8c" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="leads" stroke="#1890ff" strokeWidth={2} fillOpacity={1} fill="url(#ltLeads)" name="Total Leads" />
                <Area type="monotone" dataKey="qualified" stroke="#52c41a" strokeWidth={2} fillOpacity={1} fill="url(#ltQualified)" name="Qualified" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Agents Chart */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>Top Agent Performance</h3>
          {agentsQ.isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : topAgentsChart.length === 0 ? (
            <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa" }}>
              No agent data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topAgentsChart} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" stroke="#8c8c8c" fontSize={11} />
                <YAxis stroke="#8c8c8c" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="leads" fill="#1890ff" radius={[6, 6, 0, 0]} name="Total Leads" />
                <Bar dataKey="qualified" fill="#52c41a" radius={[6, 6, 0, 0]} name="Qualified" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Agent Performance Table */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            Agent Performance
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: "#8c8c8c" }}>
              ({filteredAgents.length} agents)
            </span>
          </h3>
          <Space wrap>
            <Input
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              placeholder="Search agent..."
              allowClear
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              placeholder="Filter by status"
              allowClear
              style={{ width: 160 }}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              options={[{ label: "Active", value: "Active" }, { label: "Idle", value: "Idle" }]}
            />
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={filteredAgents.length === 0}
            >
              Export
            </Button>
          </Space>
        </div>

        <Table
          dataSource={filteredAgents}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={agentsQ.isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} agents` }}
          locale={{ emptyText: "No agents found for this lead type" }}
          scroll={{ x: 900 }}
        />
      </div>
    </div>
  );
}
