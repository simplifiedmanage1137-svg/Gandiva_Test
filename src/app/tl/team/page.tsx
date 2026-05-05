"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useTLDashboard } from "@/hooks/useTLDashboard";
import { Skeleton } from "antd";
import { useMemo } from "react";
import {
  TLCampaignPerformanceChart,
  TLCampaignStatusPieChart,
} from "@/components/Dashboard/TLDashboardCharts";
import {
  FundProjectionScreenOutlined,
  TeamOutlined,
  RiseOutlined,
} from "@ant-design/icons";

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

      {/* Lead Type Analytics Table */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Lead Type Analytics</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#595959", width: "50%" }}>Lead Type</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#595959" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: "CDQA", types: ["CDQA"] },
              { label: "HQL, BANT, WEBINAR", types: ["HQL", "BANT", "WEBINAR"] },
              { label: "Live Events", types: ["Live Events"] },
              { label: "AG", types: ["AG"] },
            ].map((row) => (
              <tr
                key={row.label}
                style={{ borderBottom: "1px solid #f0f0f0" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <td style={{ padding: "12px 12px", color: "#1f1f1f" }}>{row.label}</td>
                <td style={{ padding: "12px 12px" }}>
                  {row.types.map((lt, idx) => (
                    <span key={lt}>
                      {idx > 0 && <span style={{ color: "#d9d9d9", margin: "0 6px" }}>|</span>}
                      <span
                        onClick={() => router.push(`/tl/team/lead-type/${encodeURIComponent(lt)}`)}
                        style={{ color: "#1677ff", cursor: "pointer", fontWeight: 500 }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLSpanElement).style.textDecoration = "underline")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLSpanElement).style.textDecoration = "none")}
                      >
                        {lt}
                      </span>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
