"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import DashboardGreeting from "@/components/Dashboard/DashboardGreeting";
import {
  Card,
  Row,
  Col,
  Typography,
  Spin,
  Tag,
  Table,
  Button,
  message,
} from "antd";
import {
  FundProjectionScreenOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  PieChartOutlined,
  BarChartOutlined,
  DownloadOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
} from "@ant-design/icons";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuth } from "@/context/AuthContext";

const { Text, Title } = Typography;

type MisStats = {
  totalCampaigns: number;
  totalLeadsUploaded: number;
  leadsAssignedToAgents: number;
  pendingLeads: number;
  completedLeads: number;
  qaApprovedLeads: number;
  qaRejectedLeads: number;
  callBackLeads: number;
};

type DailyUploadPoint = {
  date: string;
  count: number;
};

type CampaignPerformanceRow = {
  name: string;
  totalLeads: number;
  closedWonLeads: number;
};

type LeadStatusSlice = {
  status: string;
  count: number;
};

type AgentDistributionRow = {
  agent_id: string | null;
  agent_name: string;
  totalLeads: number;
  assignedLeads: number;
  pendingLeads: number;
  completedLeads: number;
  qaApprovedLeads: number;
  qaRejectedLeads: number;
  callBackLeads: number;
};

type MisDashboardResponse = {
  stats: MisStats;
  dailyUploads: DailyUploadPoint[];
  campaignPerformance: CampaignPerformanceRow[];
  leadStatus: LeadStatusSlice[];
  agentDistribution: AgentDistributionRow[];
};

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

const STATUS_COLORS: Record<string, string> = {
  new: "blue",
  open: "cyan",
  interested: "green",
  followup: "gold",
  closed_won: "success",
  closed_lost: "volcano",
};

export default function MISDashboardPage() {
  const { hasRole, isInitialized, profile } = useAuth();
  const [data, setData] = useState<MisDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Stable boolean — avoids re-triggering fetchData when the `hasRole` function
  // reference is replaced (which happens on any roles state update, even silent ones).
  const isMisAuthorized = isInitialized && (hasRole("mis") || hasRole("admin"));

  const fetchData = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      setLoading(false);
      return;
    }
    setIsOffline(false);
    setLoading(true);
    try {
      const res = await fetch("/api/mis/dashboard", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load MIS dashboard");
      }
      setData(json as MisDashboardResponse);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load MIS dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isMisAuthorized) return;
    fetchData();
  }, [isMisAuthorized, fetchData]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchData();
    };
    const handleOffline = () => setIsOffline(true);
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [fetchData]);

  const statsCards = useMemo(() => {
    const s = data?.stats;
    return [
      {
        title: "Total Campaigns",
        value: String(s?.totalCampaigns ?? 0),
        change: "All active & closed",
        icon: <FundProjectionScreenOutlined />,
        color: "#1890ff",
        bgColor: "#e6f4ff",
      },
      {
        title: "Total Leads Uploaded",
        value: String(s?.totalLeadsUploaded ?? 0),
        change: "All time",
        icon: <DatabaseOutlined />,
        color: "#722ed1",
        bgColor: "#f9f0ff",
      },
      {
        title: "Leads Assigned to Agents",
        value: String(s?.leadsAssignedToAgents ?? 0),
        change: "Currently assigned",
        icon: <TeamOutlined />,
        color: "#52c41a",
        bgColor: "#f6ffed",
      },
      {
        title: "Pending Leads",
        value: String(s?.pendingLeads ?? 0),
        change: "Not completed yet",
        icon: <ClockCircleOutlined />,
        color: "#faad14",
        bgColor: "#fffbe6",
      },
    ];
  }, [data]);

  const secondaryCards = useMemo(() => {
    const s = data?.stats;
    return [
      {
        title: "Completed Leads",
        value: String(s?.completedLeads ?? 0),
        subtitle: "Closed / completed",
        color: "#389e0d",
      },
      {
        title: "QA Approved Leads",
        value: String(s?.qaApprovedLeads ?? 0),
        subtitle: "Pass / approved",
        color: "#52c41a",
      },
      {
        title: "QA Rejected Leads",
        value: String(s?.qaRejectedLeads ?? 0),
        subtitle: "Failed QA",
        color: "#ff4d4f",
      },
      {
        title: "Call Back Leads",
        value: String(s?.callBackLeads ?? 0),
        subtitle: "Marked for call back",
        color: "#13c2c2",
      },
    ];
  }, [data]);

  const leadStatusPieData = useMemo(() => {
    const slices = data?.leadStatus ?? [];
    if (!slices.length) {
      return [{ name: "No data", value: 1, color: "#d9d9d9" }];
    }
    const palette = ["#1890ff", "#52c41a", "#faad14", "#722ed1", "#13c2c2", "#ff4d4f", "#8c8c8c"];
    return slices.map((s, idx) => ({
      name: s.status || "Unknown",
      value: s.count,
      color: palette[idx % palette.length],
    }));
  }, [data]);

  const campaignPerformanceData = useMemo(
    () => data?.campaignPerformance ?? [],
    [data]
  );

  const dailyUploadsData = useMemo(
    () => data?.dailyUploads ?? [],
    [data]
  );

  const handleExport = async (type: string, format: "csv" | "excel") => {
    try {
      const url = `/api/mis/export?type=${encodeURIComponent(type)}&format=${encodeURIComponent(format)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to export data");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const ext = format === "excel" ? "xlsx" : "csv";
      a.href = href;
      a.download = `mis-${type}-${ts}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      message.success("Export started");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to export data");
    }
  };

  if (!isMisAuthorized) {
    return null;
  }

  return (
    <div style={{ padding: "0 4px", maxWidth: 1600, margin: "0 auto" }}>
      <DashboardGreeting />

      {isOffline && (
        <div style={{ marginBottom: 24 }}>
          <Text type="danger" style={{ fontSize: 14 }}>
            You appear to be offline. Data will reload when back online, or{" "}
            <Button
              type="link"
              onClick={fetchData}
              style={{ padding: 0 }}
            >
              retry now
            </Button>
            .
          </Text>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <Text
                        type="secondary"
                        style={{
                          fontSize: 13,
                          display: "block",
                          marginBottom: 8,
                        }}
                      >
                        {stat.title}
                      </Text>
                      <div
                        style={{
                          fontSize: 32,
                          fontWeight: 700,
                          color: "#1f1f1f",
                          lineHeight: 1,
                          marginBottom: 12,
                        }}
                      >
                        {stat.value}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <ArrowUpOutlined
                          style={{ color: "#52c41a", fontSize: 12 }}
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#8c8c8c",
                            fontWeight: 500,
                          }}
                        >
                          {stat.change}
                        </Text>
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

          <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
            {secondaryCards.map((card, index) => (
              <Col xs={24} sm={12} xl={6} key={index}>
                <Card
                  bordered={false}
                  style={{ ...cardStyle, height: "100%" }}
                  styles={{ body: { padding: "20px 22px" } }}
                >
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 13,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    {card.title}
                  </Text>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: "#1f1f1f",
                      lineHeight: 1,
                      marginBottom: 6,
                    }}
                  >
                    {card.value}
                  </div>
                  <Text style={{ fontSize: 12, color: card.color }}>
                    {card.subtitle}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
            <Col xs={24} xl={8}>
              <Card
                title={
                  <Text strong style={{ fontSize: 16 }}>
                    Campaign Performance
                  </Text>
                }
                bordered={false}
                style={{ ...cardStyle, height: "100%" }}
                styles={{ body: { padding: "24px 24px 16px" } }}
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={
                      campaignPerformanceData.length
                        ? campaignPerformanceData
                        : [{ name: "—", totalLeads: 0, closedWonLeads: 0 }]
                    }
                    margin={{ top: 5, right: 5, left: -15, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#8c8c8c"
                      fontSize={11}
                      tickFormatter={(v) =>
                        v && v.length > 14 ? `${String(v).slice(0, 14)}…` : v
                      }
                    />
                    <YAxis stroke="#8c8c8c" fontSize={11} />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #f0f0f0",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="totalLeads"
                      fill="#1890ff"
                      radius={[8, 8, 0, 0]}
                      name="Total Leads"
                    />
                    <Bar
                      dataKey="closedWonLeads"
                      fill="#52c41a"
                      radius={[8, 8, 0, 0]}
                      name="Closed Won"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card
                title={
                  <Text strong style={{ fontSize: 16 }}>
                    Lead Status Distribution
                  </Text>
                }
                bordered={false}
                style={{ ...cardStyle, height: "100%" }}
                styles={{
                  body: { padding: "24px 24px 16px", overflow: "visible" },
                }}
              >
                <div
                  style={{ overflow: "visible", minHeight: 320 }}
                  className="mis-status-pie-wrapper"
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <Pie
                        data={leadStatusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent, cx, cy }) => {
                          const pct = (percent * 100).toFixed(0);
                          const isSingleSlice = percent >= 0.99;
                          if (isSingleSlice) {
                            return (
                              <text
                                x={cx}
                                y={cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                style={{ fontSize: 14, fontWeight: 500 }}
                              >
                                {name} {pct}%
                              </text>
                            );
                          }
                          return `${name} ${pct}%`;
                        }}
                        labelLine={{ stroke: "#d9d9d9", strokeWidth: 1 }}
                      >
                        {leadStatusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #f0f0f0",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card
                title={
                  <Text strong style={{ fontSize: 16 }}>
                    Daily Upload Count
                  </Text>
                }
                bordered={false}
                style={{ ...cardStyle, height: "100%" }}
                styles={{ body: { padding: "24px 24px 16px" } }}
              >
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart
                    data={
                      dailyUploadsData.length
                        ? dailyUploadsData
                        : [{ date: "—", count: 0 }]
                    }
                    margin={{ top: 5, right: 5, left: -15, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#8c8c8c" fontSize={11} />
                    <YAxis stroke="#8c8c8c" fontSize={11} />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #f0f0f0",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#1890ff"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorUploads)"
                      name="Leads Uploaded"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
            <Col xs={24}>
              <Card
                title={
                  <Text strong style={{ fontSize: 16 }}>
                    Campaigns with Leads
                  </Text>
                }
                bordered={false}
                style={cardStyle}
              >
                <Table
                  dataSource={campaignPerformanceData}
                  rowKey={(r) => r.name}
                  size="middle"
                  scroll={{ x: 700 }}
                  pagination={{
                    defaultPageSize: 10,
                    showSizeChanger: true,
                    showTotal: (t) => `Total ${t} campaigns`,
                  }}
                  columns={[
                    {
                      title: "Campaign",
                      dataIndex: "name",
                      key: "name",
                      render: (val: string) => (
                        <span style={{ fontWeight: 500 }}>{val}</span>
                      ),
                    },
                    {
                      title: "Total Leads",
                      dataIndex: "totalLeads",
                      key: "totalLeads",
                      width: 130,
                    },
                    {
                      title: "Closed Won",
                      dataIndex: "closedWonLeads",
                      key: "closedWonLeads",
                      width: 130,
                      render: (v: number) => <Tag color="green">{v}</Tag>,
                    },
                    {
                      title: "Conversion %",
                      key: "conversion",
                      width: 130,
                      render: (_: unknown, r: CampaignPerformanceRow) => {
                        const pct =
                          r.totalLeads > 0
                            ? Math.round((r.closedWonLeads / r.totalLeads) * 100)
                            : 0;
                        return <span>{pct}%</span>;
                      },
                    },
                  ]}
                  locale={{
                    emptyText: "No campaigns with leads yet.",
                  }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}

