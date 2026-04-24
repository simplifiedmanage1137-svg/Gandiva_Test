"use client";

import { useMemo } from "react";
import { Skeleton, Table, Tag, Button } from "antd";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTLDashboard } from "@/hooks/useTLDashboard";
import { useQuery } from "@tanstack/react-query";
import {
  TLCampaignPerformanceChart,
  TLCampaignStatusPieChart,
} from "@/components/Dashboard/TLDashboardCharts";

// ── fetch agents ─────────────────────────────────────────────────────────────
async function fetchAgents(): Promise<{ agents: { id: string; full_name: string | null; email: string | null }[] }> {
  const res = await fetch("/api/tl/agents", { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load agents");
  return data;
}

async function fetchAgentLeadCounts(): Promise<{ countByAgent: Record<string, number> }> {
  const res = await fetch("/api/tl/agents/leads-count", { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load agent lead counts");
  return data;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

export default function TLTeamPage() {
  const router = useRouter();
  const { hasRole, isInitialized } = useAuth();
  const enabled = Boolean(isInitialized && (hasRole("team_leader") || hasRole("tl")));

  // Reuse the same hooks as TL Dashboard — no date filter on this page (all-time view)
  const { stats, campaigns } = useTLDashboard(enabled);

  const agentsQuery = useQuery({
    queryKey: ["tl", "agents"],
    queryFn: fetchAgents,
    enabled,
    staleTime: 60 * 1000,
  });

  const leadCountsQuery = useQuery({
    queryKey: ["tl", "agents", "leads-count"],
    queryFn: fetchAgentLeadCounts,
    enabled,
    staleTime: 60 * 1000,
  });

  const statsData = stats.data;
  const campaignsList = campaigns.data?.campaigns ?? [];
  const agentsList = agentsQuery.data?.agents ?? [];

  // ── Summary cards ─────────────────────────────────────────────────────────
  const summaryCards = useMemo(() => {
    const s = statsData;
    const totalInterested = s?.totalInterested ?? 0;
    const conversionPct   = s?.conversionPct   ?? 0;

    // Unique clients from campaign client_name field
    const clientNames = new Set(
      campaignsList
        .map((c) => (c as unknown as { client_name?: string | null }).client_name)
        .filter(Boolean)
    );

    return [
      { title: "Total Campaigns", value: s?.totalCampaigns ?? 0,  sub: "All time" },
      { title: "Total Clients",   value: clientNames.size,         sub: "Unique clients" },
      { title: "Total Leads",     value: s?.totalLeads ?? 0,       sub: "Across campaigns" },
     //  { title: "Conversion",      value: `${conversionPct}%`,      sub: `${totalInterested} interested` },
    ];
  }, [statsData, campaignsList]);

  // ── Campaign Performance chart data (same logic as TL Dashboard) ──────────
  const campaignPerformanceData = useMemo(() => {
    if (campaignsList.length === 0) return [];
    return [...campaignsList]
      .sort((a, b) => (b.total_leads ?? 0) - (a.total_leads ?? 0))
      .slice(0, 5)
      .map((c) => ({
        name: c.name.length > 16 ? `${c.name.slice(0, 15)}…` : c.name,
        leads:     c.total_leads     ?? 0,
        qualified: c.qualified_leads ?? 0,
      }));
  }, [campaignsList]);

  // ── Campaign Status pie data (same logic as TL Dashboard) ─────────────────
  const campaignStatusPie = useMemo(() => {
    const total  = statsData?.totalCampaigns  ?? 0;
    const active = statsData?.activeCampaigns ?? 0;
    return [
      { name: "Active",    value: active,                          color: "#52c41a" },
      { name: "Paused",    value: Math.max(0, total - active - 1), color: "#faad14" },
      { name: "Draft",     value: 1,                               color: "#8c8c8c" },
      { name: "Completed", value: 0,                               color: "#1890ff" },
    ].filter((d) => d.value > 0);
  }, [statsData]);

  // ── Agents with leads count ───────────────────────────────────────────────
  const agentsWithLeads = useMemo(() => {
    const countMap = leadCountsQuery.data?.countByAgent ?? {};
    return agentsList.map((a) => ({
      id:    a.id,
      name:  a.full_name || a.email || "—",
      leads: countMap[a.id] ?? 0,
    }));
  }, [agentsList, leadCountsQuery.data]);

  // ── Campaigns table rows ───────────────────────────────────────────────
  const campaignTableRows = useMemo(() =>
    campaignsList.map((c) => ({
      key:          c.id,
      id:           c.id,
      name:         c.name,
      status:       c.status,
      total_agents: c.total_agents ?? 0,
      total_leads:  c.total_leads  ?? 0,
    })),
    [campaignsList]
  );

  const campaignTableColumns = [
    {
      title: "Campaign Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, row: { status: string }) => (
        <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: string) => {
        const colorMap: Record<string, string> = { active: "green", paused: "orange", draft: "default", completed: "blue" };
        return <Tag color={colorMap[s] ?? "default"} style={{ textTransform: "capitalize" }}>{s}</Tag>;
      },
    },
    {
      title: "Total Agents",
      dataIndex: "total_agents",
      key: "total_agents",
      width: 120,
      align: "center" as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "Total Leads",
      dataIndex: "total_leads",
      key: "total_leads",
      width: 120,
      align: "center" as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "Action",
      key: "action",
      width: 130,
      align: "center" as const,
      render: (_: unknown, row: { id: string }) => (
        <Button
          type="primary"
          size="small"
          onClick={() => router.push(`/tl/campaigns/${row.id}`)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const isLoading = stats.isLoading || campaigns.isLoading || agentsQuery.isLoading || leadCountsQuery.isLoading;

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Team Dashboard</h1>
        <p style={{ margin: "4px 0 0", color: "#8c8c8c", fontSize: 14 }}>
          Overview of team performance and campaign insights.
        </p>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
            marginBottom: 24,
          }}
        >
          {summaryCards.map((card, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ color: "#8c8c8c", fontSize: 14 }}>{card.title}</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{card.value}</div>
              <div style={{ color: "#8c8c8c", fontSize: 13 }}>{card.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1.5fr",
          gap: 20,
        }}
      >
        {/* Total Agents panel */}
        <div style={cardStyle}>
          <h3 style={{ marginBottom: 16, margin: "0 0 16px" }}>
            Total Agents
            <span
              style={{
                marginLeft: 10,
                fontSize: 14,
                fontWeight: 400,
                color: "#8c8c8c",
              }}
            >
              ({agentsList.length})
            </span>
          </h3>
          {agentsQuery.isLoading || leadCountsQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : agentsWithLeads.length === 0 ? (
            <div
              style={{
                height: 250,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#aaa",
                background: "#f5f5f5",
                borderRadius: 8,
              }}
            >
              No agents found
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto" }}>
              {agentsWithLeads.map((agent) => (
                <div
                  key={agent.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "#f9f9f9",
                    borderRadius: 10,
                    border: "1px solid #f0f0f0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "#1890ff",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {agent.name[0]?.toUpperCase() ?? "A"}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#1f1f1f" }}>
                      {agent.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "#8c8c8c" }}>
                    {agent.leads} lead{agent.leads !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campaign Performance */}
        <TLCampaignPerformanceChart data={campaignPerformanceData} />

        {/* Campaign Status */}
        <TLCampaignStatusPieChart data={campaignStatusPie} />
      </div>

      {/* Campaigns Table */}
      <div style={{ ...cardStyle, marginTop: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
          All Campaigns
          <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 400, color: "#8c8c8c" }}>
            ({campaignTableRows.length})
          </span>
        </h3>
        <Table
          dataSource={campaignTableRows}
          columns={campaignTableColumns}
          rowKey="key"
          size="middle"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} campaigns` }}
          loading={campaigns.isLoading}
          locale={{ emptyText: "No campaigns found" }}
          style={{ borderRadius: 8 }}
        />
      </div>
    </>
  );
}
