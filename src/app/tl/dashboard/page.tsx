"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardGreeting from "@/components/Dashboard/DashboardGreeting";
import { useRouter } from "next/navigation";
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
  Empty,
} from "antd";
import {
  FundProjectionScreenOutlined,
  RiseOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  PercentageOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { useTLDashboard } from "@/hooks/useTLDashboard";
import { useDateFilter } from "@/hooks/useDateFilter";
import DateFilter from "@/components/Dashboard/DateFilter";
import {
  StatCardsRowSkeleton,
  TableSkeleton,
} from "@/components/Dashboard/DashboardSkeletons";
import {
  TLLeadTrendChart,
  TLCampaignPerformanceChart,
  TLCampaignStatusPieChart,
} from "@/components/Dashboard/TLDashboardCharts";

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
  { id: 1, task: "Review Campaign A performance", dueTime: "10:00 AM", priority: "high", completed: false },
  { id: 2, task: "Assign new agents to Campaign B", dueTime: "11:30 AM", priority: "high", completed: false },
  { id: 3, task: "Export weekly lead report", dueTime: "02:00 PM", priority: "medium", completed: false },
  { id: 4, task: "Update pipeline stages", dueTime: "03:30 PM", priority: "medium", completed: true },
  { id: 5, task: "Sync with QA on quality scores", dueTime: "04:00 PM", priority: "low", completed: false },
];

const activityFeedData = [
  { id: 1, user: "System", action: "Campaign", target: "Enterprise Q1", value: "activated", time: "5 mins ago", type: "success" },
  { id: 2, user: "Agent", action: "moved lead in", target: "Campaign B", value: "to Qualified", time: "12 mins ago", type: "info" },
  { id: 3, user: "You", action: "created", target: "Campaign C", value: "", time: "25 mins ago", type: "info" },
  { id: 4, user: "QA", action: "approved", target: "12 leads", value: "in Campaign A", time: "45 mins ago", type: "default" },
  { id: 5, user: "Agent", action: "closed", target: "3 deals", value: "Campaign B", time: "1 hour ago", type: "default" },
];

const statusColors: Record<string, string> = {
  draft: "default",
  active: "green",
  paused: "orange",
  completed: "blue",
};

export default function TeamLeaderDashboardPage() {
  const router = useRouter();
  const { hasRole, isInitialized, profile } = useAuth();
  const [isOffline, setIsOffline] = useState(false);

  const enabled = Boolean(isInitialized && (hasRole("team_leader") || hasRole("tl")));
  const { filterState, dateRange, setPreset, setCustomMonth, setCustomYear } = useDateFilter();
  const { stats, campaigns, refetch } = useTLDashboard(enabled, dateRange.startDate, dateRange.endDate, dateRange.granularity);

  // Auth guard is handled by the layout (useRoleGuard). No redirect needed here.

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

  const statsData = stats.data;
  const statsCards = useMemo(() => {
    const s = statsData ?? {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalLeads: 0,
      totalInterested: 0,
      conversionPct: 0,
    };
    return [
      {
        title: "Total Campaigns",
        value: String(s.totalCampaigns),
        change: "All time",
        trend: "neutral" as const,
        icon: <FundProjectionScreenOutlined />,
        color: "#1890ff",
        bgColor: "#e6f4ff",
      },
      {
        title: "Active Campaigns",
        value: String(s.activeCampaigns),
        change: "Running now",
        trend: "up" as const,
        icon: <RiseOutlined />,
        color: "#52c41a",
        bgColor: "#f6ffed",
      },
      {
        title: "Total Leads",
        value: String(s.totalLeads),
        change: "Across campaigns",
        trend: "neutral" as const,
        icon: <TeamOutlined />,
        color: "#722ed1",
        bgColor: "#f9f0ff",
      },
      {
        title: "Conversion",
        value: `${s.conversionPct}%`,
        change: s.totalInterested != null ? `${s.totalInterested} interested` : "—",
        trend: "up" as const,
        icon: <PercentageOutlined />,
        color: "#faad14",
        bgColor: "#fffbe6",
      },
    ];
  }, [statsData]);

  const recentCampaigns = useMemo(() => {
    const list = campaigns.data?.campaigns ?? [];
    return list.slice(0, 5);
  }, [campaigns.data?.campaigns]);

  const campaignPerformanceData = useMemo(() => {
    const list = campaigns.data?.campaigns ?? [];
    if (list.length === 0) return [];

    return [...list]
      .sort((a, b) => (b.total_leads ?? 0) - (a.total_leads ?? 0))
      .slice(0, 5)
      .map((c) => {
        const shortName =
          c.name.length > 16 ? `${c.name.slice(0, 15)}…` : c.name;
        return {
          name: shortName,
          leads: c.total_leads ?? 0,
          qualified: c.qualified_leads ?? 0,
        };
      });
  }, [campaigns.data?.campaigns]);

  const campaignStatusPie = useMemo(() => {
    const s = statsData;
    const total = s?.totalCampaigns ?? 0;
    const active = s?.activeCampaigns ?? 0;
    return [
      { name: "Active", value: active, color: "#52c41a" },
      { name: "Paused", value: Math.max(0, total - active - 1), color: "#faad14" },
      { name: "Draft", value: 1, color: "#8c8c8c" },
      { name: "Completed", value: 0, color: "#1890ff" },
    ].filter((d) => d.value > 0);
  }, [statsData]);

  if (!isInitialized || (!hasRole("team_leader") && !hasRole("tl"))) {
    return null;
  }

  const statsReady = Boolean(statsData);
  const campaignsReady = campaigns.isSuccess;

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <DashboardGreeting />
        <DateFilter
          filterState={filterState}
          label={dateRange.label}
          onPresetChange={setPreset}
          onCustomMonthChange={setCustomMonth}
          onCustomYearChange={setCustomYear}
        />
      </div>


      {isOffline && (
        <div style={{ marginBottom: 24 }}>
          <Text type="danger" style={{ fontSize: 14 }}>
            You appear to be offline. Data will reload when back online, or{" "}
            <a onClick={(e) => { e.preventDefault(); refetch(); }}>retry now</a>.
          </Text>
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
          <TLLeadTrendChart
            data={statsData?.leadTrend ?? []}
            dayBuckets={dateRange.granularity === "day" ? dateRange.dayBuckets : undefined}
            monthBuckets={dateRange.granularity === "month" ? dateRange.monthBuckets : undefined}
          />
        </Col>
        <Col xs={24} xl={8}>
          <TLCampaignPerformanceChart data={campaignPerformanceData} />
        </Col>
        <Col xs={24} xl={8}>
          <TLCampaignStatusPieChart data={campaignStatusPie} />
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
              title={
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text strong style={{ fontSize: 16 }}>
                    Recent Campaigns
                  </Text>
                  {recentCampaigns.length > 0 ? <Link href="/tl/campaigns">View all</Link> : null}
                </div>
              }
              bordered={false}
              style={cardStyle}
            >
              {recentCampaigns.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No campaigns yet">
                  <Button type="primary" onClick={() => router.push("/tl/campaigns/create")}>
                    Create Campaign
                  </Button>
                </Empty>
              ) : (
                <Table
                  dataSource={recentCampaigns}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                  columns={[
                    {
                      title: "Sr. No",
                      key: "srno",
                      width: 70,
                      render: (_: unknown, __: unknown, index: number) => index + 1,
                    },
                    {
                      title: "Campaign",
                      key: "name",
                      render: (_, r) => (
                        <Link href={`/tl/campaigns/${r.id}`} style={{ fontWeight: 600, fontSize: 14 }}>
                          {r.name}
                        </Link>
                      ),
                    },
                    {
                      title: "Status",
                      dataIndex: "status",
                      key: "status",
                      render: (s: string) => <Tag color={statusColors[s] ?? "default"}>{s}</Tag>,
                    },
                    { title: "Leads", dataIndex: "total_leads", key: "total_leads", width: 90 },
                    { title: "Agents", dataIndex: "total_agents", key: "total_agents", width: 90 },
                    {
                      title: "",
                      key: "action",
                      render: (_, r) => (
                        <Link href={`/tl/campaigns/${r.id}`}>
                          <Button type="link" icon={<RightOutlined />}>
                            View
                          </Button>
                        </Link>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
