"use client";

import { useEffect, useMemo, useState } from "react";
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
  Empty,
  message,
} from "antd";
import {
  FundProjectionScreenOutlined,
  RiseOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  AuditOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { useQADashboard } from "@/hooks/useQADashboard";
import { useDateFilter } from "@/hooks/useDateFilter";
import DateFilter from "@/components/Dashboard/DateFilter";
import {
  StatCardsRowSkeleton,
  TableSkeleton,
} from "@/components/Dashboard/DashboardSkeletons";
import {
  QAStatusPieChart,
  QAReviewTrendChart,
  QACampaignReviewChart,
} from "@/components/Dashboard/QADashboardCharts";
import { useRoleGuard } from "@/hooks/useRoleGuard";

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
  { id: 1, task: "Review Campaign A leads (12 pending)", dueTime: "10:00 AM", priority: "high", completed: false },
  { id: 2, task: "Approve quality scores for Campaign B", dueTime: "11:30 AM", priority: "high", completed: false },
  { id: 3, task: "Export QA report", dueTime: "02:00 PM", priority: "medium", completed: false },
  { id: 4, task: "Update QA guidelines", dueTime: "03:30 PM", priority: "medium", completed: true },
  { id: 5, task: "Sync with TL on rejections", dueTime: "04:00 PM", priority: "low", completed: false },
];

const activityFeedData = [
  { id: 1, user: "You", action: "approved", target: "24 leads", value: "Campaign A", time: "5 mins ago", type: "success" },
  { id: 2, user: "System", action: "Campaign B", target: "8 new leads", value: "need review", time: "12 mins ago", type: "info" },
  { id: 3, user: "You", action: "rejected", target: "3 leads", value: "Campaign C", time: "25 mins ago", type: "info" },
  { id: 4, user: "TL", action: "requested re-review", target: "Campaign D", value: "", time: "45 mins ago", type: "default" },
  { id: 5, user: "You", action: "exported", target: "QA report", value: "", time: "1 hour ago", type: "default" },
];

export default function QADashboardPage() {
  const { profile } = useAuth();
  const { status } = useRoleGuard(["qa", "admin"]);
  const [isOffline, setIsOffline] = useState(false);

  const enabled = status === "authorized";
  const { filterState, dateRange, setPreset, setCustomMonth, setCustomYear } = useDateFilter();
  const { dashboard, stats, refetch } = useQADashboard(enabled, dateRange.startDate, dateRange.endDate);

  useEffect(() => {
    if (dashboard.error) {
      message.error("Failed to load dashboard");
    }
  }, [dashboard.error]);

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

  const campaigns = useMemo(() => dashboard.data?.campaigns ?? [], [dashboard.data?.campaigns]);
  const statsData = stats.data;

  const pendingQaCount = useMemo(
    () =>
      campaigns.reduce(
        (sum, c) =>
          sum + (c.leads?.filter((l) => !l.qa_status || String(l.qa_status).trim() === "").length ?? 0),
        0
      ),
    [campaigns]
  );

  const campaignsWithPending = useMemo(
    () =>
      campaigns
        .map((c) => ({
          id: c.id,
          name: (c as { name?: string }).name ?? `Campaign ${c.id.slice(0, 8)}`,
          pending: c.leads?.filter((l) => !l.qa_status || String(l.qa_status).trim() === "").length ?? 0,
          total: c.leads?.length ?? 0,
        }))
        .filter((c) => c.pending > 0),
    [campaigns]
  );

  const statsCards = useMemo(() => {
    const s = statsData ?? {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalLeads: 0,
      conversionPct: 0,
    };
    return [
      {
        title: "Total Campaigns",
        value: String(s.totalCampaigns),
        change: "All campaigns",
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
        title: "Total Leads",
        value: String(s.totalLeads),
        change: "Across campaigns",
        trend: "neutral" as const,
        icon: <TeamOutlined />,
        color: "#722ed1",
        bgColor: "#f9f0ff",
      },
      {
        title: "Pending QA Review",
        value: String(pendingQaCount),
        change: `${s.conversionPct ?? 0}% conversion`,
        trend: pendingQaCount > 0 ? ("up" as const) : ("neutral" as const),
        icon: <AuditOutlined />,
        color: "#eb2f96",
        bgColor: "#fff0f6",
      },
    ];
  }, [statsData, pendingQaCount]);

  const qaStatusFromCampaigns = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    campaigns.forEach((c) => {
      c.leads?.forEach((l) => {
        const s = String(l.qa_status ?? "").trim().toLowerCase();
        if (!s) pending++;
        else if (s === "approved" || s === "pass") approved++;
        else rejected++;
      });
    });
    const out: { name: string; value: number; color: string }[] = [];
    if (approved > 0) out.push({ name: "Approved", value: approved, color: "#52c41a" });
    if (rejected > 0) out.push({ name: "Rejected", value: rejected, color: "#ff4d4f" });
    if (pending > 0) out.push({ name: "Pending", value: pending, color: "#faad14" });
    return out.length > 0 ? out : [{ name: "No data", value: 1, color: "#d9d9d9" }];
  }, [campaigns]);

  const campaignReviewData = useMemo(
    () =>
      campaigns
        .map((c) => {
          const leads = c.leads ?? [];
          const reviewed = leads.filter((l) => {
            const s = String(l.qa_status ?? "").trim().toLowerCase();
            return s && s !== "";
          }).length;
          const pending = leads.filter((l) => {
            const s = String(l.qa_status ?? "").trim();
            return !s;
          }).length;
          return {
            campaign: (c as { name?: string }).name ?? `Campaign ${c.id.slice(0, 8)}`,
            reviewed,
            pending,
          };
        })
        .filter((r) => r.reviewed > 0 || r.pending > 0),
    [campaigns]
  );

  const reviewTrendData = useMemo(() => {
    const allLeads = campaigns.flatMap((c) => c.leads ?? []);
    if (dateRange.granularity === "day" && dateRange.dayBuckets.length > 0) {
      const byDay: Record<string, { reviewed: number; pending: number }> = {};
      dateRange.dayBuckets.forEach((b) => { byDay[b.key] = { reviewed: 0, pending: 0 }; });
      allLeads.forEach((l) => {
        const k = (l as { created_at?: string }).created_at?.slice(0, 10);
        if (!k || !(k in byDay)) return;
        const qa = String(l.qa_status ?? "").trim();
        if (qa) byDay[k].reviewed++; else byDay[k].pending++;
      });
      return dateRange.dayBuckets.map((b) => ({ day: b.label, ...byDay[b.key] }));
    }
    if (dateRange.granularity === "month" && dateRange.monthBuckets.length > 0) {
      const byMonth: Record<string, { reviewed: number; pending: number }> = {};
      dateRange.monthBuckets.forEach((b) => { byMonth[b.key] = { reviewed: 0, pending: 0 }; });
      allLeads.forEach((l) => {
        const k = (l as { created_at?: string }).created_at?.slice(0, 7);
        if (!k || !(k in byMonth)) return;
        const qa = String(l.qa_status ?? "").trim();
        if (qa) byMonth[k].reviewed++; else byMonth[k].pending++;
      });
      return dateRange.monthBuckets.map((b) => ({ day: b.label, ...byMonth[b.key] }));
    }
    return [];
  }, [campaigns, dateRange]);

  if (status !== "authorized") {
    return null;
  }

  const statsReady = Boolean(statsData);
  const dashboardReady = dashboard.isSuccess;

  return (
    <div style={{ padding: "0 4px", maxWidth: 1600, margin: "0 auto" }}>
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
          <QAStatusPieChart data={qaStatusFromCampaigns} />
        </Col>
        <Col xs={24} xl={8}>
          <QAReviewTrendChart data={reviewTrendData} />
        </Col>
        <Col xs={24} xl={8}>
          <QACampaignReviewChart data={campaignReviewData} />
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
                <Badge count={tasksData.filter((t) => !t.completed).length} style={{ backgroundColor: "#722ed1" }} />
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
                      backgroundColor: activity.type === "success" ? "#52c41a" : "#722ed1",
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

      {!dashboardReady ? (
        <TableSkeleton rows={5} />
      ) : (
        <Row gutter={[20, 20]}>
          <Col xs={24}>
            <Card
              title={
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text strong style={{ fontSize: 16 }}>
                    Campaigns with Pending QA
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Review these leads
                  </Text>
                </div>
              }
              bordered={false}
              style={cardStyle}
            >
              {campaignsWithPending.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No pending QA reviews. All leads are up to date."
                />
              ) : (
                <Table
                  dataSource={campaignsWithPending}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                  columns={[
                    {
                      title: "Campaign",
                      key: "name",
                      render: (_, r) => (
                        <Link href={`/qa/campaigns/${r.id}`} style={{ fontWeight: 600, fontSize: 14 }}>
                          {r.name}
                        </Link>
                      ),
                    },
                    {
                      title: "Pending",
                      dataIndex: "pending",
                      key: "pending",
                      width: 100,
                      render: (v: number) => (
                        <Tag color="orange">
                          {v} leads
                        </Tag>
                      ),
                    },
                    { title: "Total Leads", dataIndex: "total", key: "total", width: 110 },
                    {
                      title: "",
                      key: "action",
                      render: (_, r) => (
                        <Link href={`/qa/campaigns/${r.id}`}>
                          <Button type="primary" size="small" icon={<RightOutlined />}>
                            Review
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
