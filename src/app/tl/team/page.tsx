"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useTLDashboard } from "@/hooks/useTLDashboard";
import { Skeleton, Tag } from "antd";
import { useMemo } from "react";
import {
  TLCampaignPerformanceChart,
  TLCampaignStatusPieChart,
} from "@/components/Dashboard/TLDashboardCharts";
import {
  FundProjectionScreenOutlined,
  TeamOutlined,
  RiseOutlined,
  RightOutlined,
} from "@ant-design/icons";

async function fetchLeadTypes(): Promise<{ leadTypes: string[] }> {
  const res = await fetch("/api/tl/lead-types", { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load lead types");
  return data;
}

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

const LEAD_TYPE_COLORS = [
  { bg: "#e6f4ff", border: "#91caff", text: "#0958d9", dot: "#1890ff" },
  { bg: "#f6ffed", border: "#b7eb8f", text: "#389e0d", dot: "#52c41a" },
  { bg: "#fff7e6", border: "#ffd591", text: "#d46b08", dot: "#fa8c16" },
  { bg: "#f9f0ff", border: "#d3adf7", text: "#531dab", dot: "#722ed1" },
  { bg: "#fff0f6", border: "#ffadd2", text: "#c41d7f", dot: "#eb2f96" },
  { bg: "#e6fffb", border: "#87e8de", text: "#08979c", dot: "#13c2c2" },
  { bg: "#feffe6", border: "#eaff8f", text: "#7cb305", dot: "#a0d911" },
];

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

  const { stats, campaigns } = useTLDashboard(enabled);

  const leadTypesQuery = useQuery({
    queryKey: ["tl", "lead-types"],
    queryFn: fetchLeadTypes,
    enabled,
    staleTime: 60 * 1000,
  });

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
  const leadTypes = leadTypesQuery.data?.leadTypes ?? [];

  const summaryCards = useMemo(() => {
    const s = statsData;
    const clientNames = new Set(
      campaignsList
        .map((c) => (c as unknown as { client_name?: string | null }).client_name)
        .filter(Boolean)
    );
    return [
      { title: "Total Campaigns", value: s?.totalCampaigns ?? 0, sub: "All time", icon: <FundProjectionScreenOutlined />, color: "#1890ff", bg: "#e6f4ff" },
      { title: "Total Clients", value: clientNames.size, sub: "Unique clients", icon: <TeamOutlined />, color: "#722ed1", bg: "#f9f0ff" },
      { title: "Total Leads", value: s?.totalLeads ?? 0, sub: "Across campaigns", icon: <RiseOutlined />, color: "#52c41a", bg: "#f6ffed" },
    ];
  }, [statsData, campaignsList]);

  const campaignPerformanceData = useMemo(() => {
    if (campaignsList.length === 0) return [];
    return [...campaignsList]
      .sort((a, b) => (b.total_leads ?? 0) - (a.total_leads ?? 0))
      .slice(0, 5)
      .map((c) => ({
        name: c.name.length > 16 ? `${c.name.slice(0, 15)}…` : c.name,
        leads: c.total_leads ?? 0,
        qualified: c.qualified_leads ?? 0,
      }));
  }, [campaignsList]);

  const campaignStatusPie = useMemo(() => {
    const total = statsData?.totalCampaigns ?? 0;
    const active = statsData?.activeCampaigns ?? 0;
    return [
      { name: "Active", value: active, color: "#52c41a" },
      { name: "Paused", value: Math.max(0, total - active - 1), color: "#faad14" },
      { name: "Draft", value: 1, color: "#8c8c8c" },
      { name: "Completed", value: 0, color: "#1890ff" },
    ].filter((d) => d.value > 0);
  }, [statsData]);

  const agentsWithLeads = useMemo(() => {
    const countMap = leadCountsQuery.data?.countByAgent ?? {};
    return agentsList.map((a) => ({
      id: a.id,
      name: a.full_name || a.email || "—",
      leads: countMap[a.id] ?? 0,
    }));
  }, [agentsList, leadCountsQuery.data]);

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>
          {summaryCards.map((card, i) => (
            <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: card.color, flexShrink: 0 }}>
                {card.icon}
              </div>
              <div>
                <div style={{ color: "#8c8c8c", fontSize: 13 }}>{card.title}</div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{card.value}</div>
                <div style={{ color: "#8c8c8c", fontSize: 12 }}>{card.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lead Type Cards */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Lead Type Analytics</h3>
          <p style={{ margin: "4px 0 0", color: "#8c8c8c", fontSize: 13 }}>
            Click a lead type to view detailed performance, agent stats, and trends.
          </p>
        </div>

        {leadTypesQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : leadTypes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#aaa", fontSize: 14 }}>
            No lead types found. Assign lead types to campaigns to see analytics here.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {leadTypes.map((lt, i) => {
              const palette = LEAD_TYPE_COLORS[i % LEAD_TYPE_COLORS.length];
              return (
                <div
                  key={lt}
                  onClick={() => router.push(`/tl/team/lead-type/${encodeURIComponent(lt)}`)}
                  style={{
                    background: palette.bg,
                    border: `1.5px solid ${palette.border}`,
                    borderRadius: 12,
                    padding: "20px 20px 16px",
                    cursor: "pointer",
                    transition: "transform 0.15s, box-shadow 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: palette.dot, display: "inline-block" }} />
                    <RightOutlined style={{ fontSize: 12, color: palette.text, opacity: 0.6 }} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: palette.text }}>{lt}</div>
                  <div style={{ fontSize: 12, color: palette.text, opacity: 0.75 }}>View analytics →</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr", gap: 20 }}>
        {/* Agents panel */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>
            Total Agents
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: "#8c8c8c" }}>
              ({agentsList.length})
            </span>
          </h3>
          {agentsQuery.isLoading || leadCountsQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : agentsWithLeads.length === 0 ? (
            <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", background: "#f5f5f5", borderRadius: 8 }}>
              No agents found
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto" }}>
              {agentsWithLeads.map((agent) => (
                <div
                  key={agent.id}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f9f9f9", borderRadius: 10, border: "1px solid #f0f0f0" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1890ff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {agent.name[0]?.toUpperCase() ?? "A"}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#1f1f1f" }}>{agent.name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#8c8c8c" }}>{agent.leads} lead{agent.leads !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <TLCampaignPerformanceChart data={campaignPerformanceData} />
        <TLCampaignStatusPieChart data={campaignStatusPie} />
      </div>
    </>
  );
}
