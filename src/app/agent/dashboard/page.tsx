"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import DashboardGreeting from "@/components/Dashboard/DashboardGreeting";
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Avatar,
  Badge,
  Checkbox,
  Table,
  Button,
  Input,
  Select,
} from "antd";
import {
  FundProjectionScreenOutlined,
  RiseOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { useAgentDashboard, type AgentDashboardCampaignRow } from "@/hooks/useAgentDashboard";
import {
  StatCardsRowSkeleton,
  TableSkeleton,
} from "@/components/Dashboard/DashboardSkeletons";
import {
  AgentLeadTrendChart,
  AgentCampaignLeadsChart,
  AgentCampaignPieChart,
} from "@/components/Dashboard/AgentDashboardCharts";

const { Text, Title } = Typography;

const cardStyle = {
  borderRadius: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  border: "1px solid #f0f0f0",
  transition: "all 0.3s ease",
  cursor: "pointer" as const,
};

const statCardHover = (e: React.MouseEvent<HTMLDivElement>, enter: boolean) => {
  const el = e.currentTarget;
  el.style.boxShadow = enter ? "0 4px 16px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.04)";
  el.style.transform = enter ? "translateY(-2px)" : "translateY(0)";
};

const tasksData = [
  { id: 1, task: "Follow up with Campaign A leads", dueTime: "10:00 AM", priority: "high", completed: false },
  { id: 2, task: "Complete call backs - Campaign B", dueTime: "11:30 AM", priority: "high", completed: false },
  { id: 3, task: "Update lead status in CRM", dueTime: "02:00 PM", priority: "medium", completed: false },
  { id: 4, task: "Send proposal to qualified lead", dueTime: "03:30 PM", priority: "medium", completed: true },
  { id: 5, task: "Review tomorrow's call list", dueTime: "04:00 PM", priority: "low", completed: false },
];

const activityFeedData = [
  { id: 1, user: "You", action: "closed", target: "1 lead", value: "Campaign A", time: "5 mins ago", type: "success" },
  { id: 2, user: "You", action: "updated status", target: "3 leads", value: "to Contacted", time: "12 mins ago", type: "info" },
  { id: 3, user: "You", action: "added note to", target: "Lead #1245", value: "", time: "25 mins ago", type: "info" },
  { id: 4, user: "TL", action: "assigned", target: "5 new leads", value: "Campaign B", time: "45 mins ago", type: "default" },
  { id: 5, user: "You", action: "scheduled follow-up", target: "Acme Corp", value: "", time: "1 hour ago", type: "default" },
];

const statusColors: Record<string, string> = {
  draft: "default",
  active: "green",
  paused: "orange",
  completed: "blue",
};

export default function AgentDashboardPage() {
  const { profile, hasRole, isInitialized } = useAuth();
  const [isOffline, setIsOffline] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const enabled = Boolean(isInitialized && hasRole("agent"));
  const { dashboard, campaigns, refetch } = useAgentDashboard(enabled);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      setIsOffline(false);
      refetch();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refetch]);

  const summary = dashboard.data?.summary;
  const statsCards = useMemo(() => {
    const s = summary ?? {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalLeads: 0,
      activeLeads: 0,
      wonLeads: 0,
      conversionPct: 0,
    };
    return [
      {
        title: "Assigned Campaigns",
        value: String(s.totalCampaigns),
        change: "Total",
        trend: "neutral" as const,
        icon: <FundProjectionScreenOutlined />,
        color: "#1890ff",
        bgColor: "#e6f4ff",
      },
      {
        title: "Active Campaigns",
        value: String(s.activeCampaigns),
        change: "Running",
        trend: "up" as const,
        icon: <RiseOutlined />,
        color: "#52c41a",
        bgColor: "#f6ffed",
      },
      {
        title: "Leads",
        value: String(s.totalLeads),
        change: `${s.activeLeads} active`,
        trend: "neutral" as const,
        icon: <TeamOutlined />,
        color: "#722ed1",
        bgColor: "#f9f0ff",
      },
      {
        title: "Conversion %",
        value: `${s.conversionPct}%`,
        change: `${s.wonLeads} won`,
        trend: "up" as const,
        icon: <CheckCircleOutlined />,
        color: "#faad14",
        bgColor: "#fffbe6",
      },
    ];
  }, [summary]);

  const campaignList = useMemo(
    () => campaigns.data?.campaigns ?? [],
    [campaigns.data?.campaigns]
  );
  const chartSource = useMemo(
    () =>
      campaignList.length > 0 ? campaignList : dashboard.data?.recentCampaigns ?? [],
    [campaignList, dashboard.data?.recentCampaigns]
  );
  const campaignChartData = useMemo(
    () =>
      chartSource.slice(0, 6).map((c) => ({
        name: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
        leads: c.total_leads ?? 0,
        qualified: c.qualified_leads ?? c.won_leads ?? 0,
      })),
    [chartSource]
  );
  const campaignPieData =
    chartSource.length > 0
      ? chartSource
          .slice(0, 5)
          .map((c, i) => ({
            name: (c.name ?? "Unnamed").trim() || "Unnamed",
            value: c.total_leads ?? 0,
            color: ["#1890ff", "#52c41a", "#722ed1", "#faad14", "#13c2c2"][i % 5],
          }))
          .filter((d) => d.value > 0)
      : [{ name: "No data", value: 1, color: "#d9d9d9" }];

  const filteredCampaigns = useMemo(() => {
    let result = campaignList;
    const q = searchText.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          (c.name ?? "").toLowerCase().includes(q) ||
          (c.industry ?? "").toLowerCase().includes(q) ||
          (c.geography ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter) result = result.filter((c) => c.status === statusFilter);
    return result;
  }, [campaignList, searchText, statusFilter]);

  if (!isInitialized || !hasRole("agent")) {
    return null;
  }

  const statsReady = Boolean(summary);
  const campaignsReady = campaigns.isSuccess;

  return (
    <div style={{ padding: "0 4px" }}>
      <DashboardGreeting />

      {isOffline && (
        <div style={{ marginBottom: 24 }}>
          <Text type="danger" style={{ fontSize: 14 }}>
            You appear to be offline. Data will reload when back online, or{" "}
            <Button type="link" onClick={() => refetch()} style={{ padding: 0 }}>
              retry now
            </Button>
            .
          </Text>
        </div>
      )}

      {dashboard.error && (
        <div style={{ marginBottom: 24 }}>
          <Text type="danger">{dashboard.error instanceof Error ? dashboard.error.message : "Failed to load dashboard"}</Text>
          <Button type="link" onClick={() => refetch()} style={{ marginLeft: 8 }}>
            Retry
          </Button>
        </div>
      )}

      {!statsReady ? (
        <StatCardsRowSkeleton />
      ) : (
        <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
          {statsCards.map((stat, index) => (
            <Col xs={24} sm={12} xl={6} key={index}>
              <Card
                bordered={false}
                style={{ ...cardStyle, height: "100%" }}
                styles={{ body: { padding: "24px" } }}
                onMouseEnter={(e) => statCardHover(e, true)}
                onMouseLeave={(e) => statCardHover(e, false)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
                      {stat.title}
                    </Text>
                    <div style={{ fontSize: 32, fontWeight: 700, color: "#1f1f1f", lineHeight: 1, marginBottom: 12 }}>
                      {stat.value}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {stat.trend === "up" && <ArrowUpOutlined style={{ color: "#52c41a", fontSize: 12 }} />}
                      <Text style={{ fontSize: 12, color: "#8c8c8c", fontWeight: 500 }}>{stat.change}</Text>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: stat.bgColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      color: stat.color,
                    }}
                  >
                    {stat.icon}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} xl={8}>
          <AgentLeadTrendChart />
        </Col>
        <Col xs={24} xl={8}>
          <AgentCampaignLeadsChart data={campaignChartData} />
        </Col>
        <Col xs={24} xl={8}>
          <AgentCampaignPieChart data={campaignPieData} />
        </Col>
      </Row>

      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} xl={12}>
          <Card
            title={
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text strong style={{ fontSize: 16 }}>
                  My Tasks
                </Text>
                <Badge count={tasksData.filter((t) => !t.completed).length} style={{ backgroundColor: "#1890ff" }} />
              </div>
            }
            bordered={false}
            style={cardStyle}
            styles={{ body: { padding: "20px 24px" } }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {tasksData.map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: "14px 16px",
                    backgroundColor: task.completed ? "#fafafa" : "#fff",
                    border: "1px solid #f0f0f0",
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Checkbox checked={task.completed} />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: task.completed ? "#8c8c8c" : "#1f1f1f",
                        textDecoration: task.completed ? "line-through" : "none",
                      }}
                    >
                      {task.task}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {task.dueTime}
                    </Text>
                  </div>
                  <Tag
                    color={task.priority === "high" ? "red" : task.priority === "medium" ? "orange" : "default"}
                    style={{ fontSize: 11, margin: 0 }}
                  >
                    {task.priority.toUpperCase()}
                  </Tag>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card
            title={<Text strong style={{ fontSize: 16 }}>Activity Feed</Text>}
            bordered={false}
            style={cardStyle}
            styles={{ body: { padding: "20px 24px" } }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {activityFeedData.map((activity) => (
                <div key={activity.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Avatar
                    size={36}
                    style={{
                      backgroundColor: activity.type === "success" ? "#52c41a" : "#1890ff",
                      flexShrink: 0,
                    }}
                  >
                    {activity.user[0]}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "#1f1f1f" }}>
                      <Text strong style={{ fontSize: 13 }}>
                        {activity.user}
                      </Text>{" "}
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {activity.action}
                      </Text>{" "}
                      <Text strong style={{ fontSize: 13 }}>
                        {activity.target}
                      </Text>
                      {activity.value && (
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {" "}
                          {activity.value}
                        </Text>
                      )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                      {activity.time}
                    </Text>
                  </div>
                  {activity.type === "success" && (
                    <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 16, marginTop: 4 }} />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {!campaignsReady ? (
        <TableSkeleton rows={5} />
      ) : (
        <Row gutter={[20, 20]}>
          <Col xs={24}>
            <Card
              title={<Text strong style={{ fontSize: 16 }}>My Assigned Campaigns</Text>}
              bordered={false}
              style={cardStyle}
              extra={
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <Input
                    placeholder="Search campaigns..."
                    prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                    style={{ width: 220 }}
                  />
                  <Select
                    placeholder="Filter by status"
                    allowClear
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "draft", label: "Draft" },
                      { value: "active", label: "Active" },
                      { value: "paused", label: "Paused" },
                      { value: "completed", label: "Completed" },
                    ]}
                    style={{ width: 160 }}
                  />
                </div>
              }
            >
              <Table
                className="table-single-line"
                dataSource={filteredCampaigns}
                rowKey="id"
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (t) => `Total ${t} campaigns`,
                }}
                size="middle"
                scroll={{ x: 900 }}
                locale={{
                  emptyText: "No campaigns assigned yet. Your Team Leader can assign you to campaigns.",
                }}
                columns={[
                  {
                    title: "#",
                    key: "index",
                    width: 56,
                    align: "center" as const,
                    render: (_: unknown, __: unknown, i: number) => i + 1,
                  },
                  {
                    title: "Campaign",
                    dataIndex: "name",
                    key: "name",
                    ellipsis: true,
                    render: (val: string, r: AgentDashboardCampaignRow) => (
                      <Link href={`/agent/campaigns/${r.id}`} style={{ fontWeight: 600, fontSize: 14 }}>
                        {val}
                      </Link>
                    ),
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    key: "status",
                    width: 100,
                    render: (v: string) => (
                      <Tag color={statusColors[v] ?? "default"}>
                        {v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v}
                      </Tag>
                    ),
                  },
                  {
                    title: "Start Date",
                    dataIndex: "start_date",
                    key: "start_date",
                    width: 110,
                    render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—"),
                  },
                  {
                    title: "End Date",
                    dataIndex: "end_date",
                    key: "end_date",
                    width: 110,
                    render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—"),
                  },
                  { title: "Leads", dataIndex: "total_leads", key: "total_leads", width: 100 },
                  { title: "Active", dataIndex: "active_leads", key: "active_leads", width: 90 },
                  {
                    title: "",
                    key: "action",
                    width: 100,
                    render: (_: unknown, r: AgentDashboardCampaignRow) => (
                      <Link href={`/agent/campaigns/${r.id}`}>
                        <Button type="primary" size="small" icon={<EyeOutlined />}>
                          View
                        </Button>
                      </Link>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
