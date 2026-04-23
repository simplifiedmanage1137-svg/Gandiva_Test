"use client";

import React, { useMemo } from "react";
import { Card, Row, Col, Typography, Table, Tag, Avatar, Progress } from "antd";
import DashboardGreeting from "@/components/Dashboard/DashboardGreeting";
import {
  TeamOutlined,
  TrophyOutlined,
  DollarOutlined,
  RiseOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
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
} from "recharts";
import { useAuth } from "@/context/AuthContext";

const { Text, Title } = Typography;

const teamMembers = [
  { key: "1", name: "Sarah Johnson", deals: 28, revenue: "$142,000", conversion: 38, trend: "up", status: "active" },
  { key: "2", name: "Michael Chen", deals: 24, revenue: "$118,500", conversion: 34, trend: "up", status: "active" },
  { key: "3", name: "Emma Davis", deals: 21, revenue: "$97,800", conversion: 31, trend: "down", status: "active" },
  { key: "4", name: "James Wilson", deals: 19, revenue: "$89,200", conversion: 29, trend: "up", status: "active" },
  { key: "5", name: "Lisa Thompson", deals: 15, revenue: "$72,400", conversion: 24, trend: "down", status: "active" },
  { key: "6", name: "Rahul Sharma", deals: 12, revenue: "$58,100", conversion: 21, trend: "up", status: "active" },
];

const monthlyTeamData = [
  { month: "Oct", revenue: 182000, deals: 87 },
  { month: "Nov", revenue: 198000, deals: 94 },
  { month: "Dec", revenue: 175000, deals: 79 },
  { month: "Jan", revenue: 212000, deals: 103 },
  { month: "Feb", revenue: 228000, deals: 108 },
  { month: "Mar", revenue: 245000, deals: 117 },
];

const repPerformanceData = [
  { name: "Sarah J.", deals: 28, revenue: 142 },
  { name: "Michael C.", deals: 24, revenue: 118 },
  { name: "Emma D.", deals: 21, revenue: 98 },
  { name: "James W.", deals: 19, revenue: 89 },
  { name: "Lisa T.", deals: 15, revenue: 72 },
  { name: "Rahul S.", deals: 12, revenue: 58 },
];

const pipelineStages = [
  { stage: "New", count: 342, color: "#1890ff", max: 342 },
  { stage: "Contacted", count: 248, color: "#40a9ff", max: 342 },
  { stage: "Qualified", count: 189, color: "#52c41a", max: 342 },
  { stage: "Proposal", count: 124, color: "#faad14", max: 342 },
  { stage: "Negotiation", count: 87, color: "#fa8c16", max: 342 },
  { stage: "Closed Won", count: 56, color: "#389e0d", max: 342 },
];

const recentActivities = [
  { id: 1, user: "Sarah J.", action: "closed deal with", target: "TechCorp Ltd", value: "$42,000", time: "5 mins ago", type: "success" },
  { id: 2, user: "Michael C.", action: "sent proposal to", target: "InnovateCo", value: "$18,500", time: "18 mins ago", type: "info" },
  { id: 3, user: "Emma D.", action: "qualified lead at", target: "Global Systems", value: "$24,000", time: "35 mins ago", type: "info" },
  { id: 4, user: "James W.", action: "added new lead from", target: "StartupXYZ", value: "$15,800", time: "1 hr ago", type: "default" },
  { id: 5, user: "Rahul S.", action: "scheduled demo for", target: "DataFlow Inc", value: "$31,200", time: "2 hrs ago", type: "default" },
];

const cardStyle = {
  borderRadius: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  border: "1px solid #f0f0f0",
  transition: "all 0.3s ease",
  cursor: "pointer" as const,
};

export default function SalesManagerDashboard({ filterBar, startDate, endDate }: { filterBar?: React.ReactNode; startDate?: string; endDate?: string } = {}) {
  const { profile } = useAuth();

  const statsCards = useMemo(
    () => [
      {
        title: "Team Members",
        value: "12",
        change: "+2 this month",
        trend: "up",
        icon: <TeamOutlined />,
        color: "#1890ff",
        bgColor: "#e6f4ff",
      },
      {
        title: "Team Deals Closed",
        value: "107",
        change: "+14.3% vs last month",
        trend: "up",
        icon: <TrophyOutlined />,
        color: "#52c41a",
        bgColor: "#f6ffed",
      },
      {
        title: "Team Revenue",
        value: "$519K",
        change: "+12.8% vs last month",
        trend: "up",
        icon: <DollarOutlined />,
        color: "#722ed1",
        bgColor: "#f9f0ff",
      },
      {
        title: "Avg. Conversion",
        value: "31.2%",
        change: "+3.1% vs last month",
        trend: "up",
        icon: <RiseOutlined />,
        color: "#faad14",
        bgColor: "#fffbe6",
      },
    ],
    []
  );

  const teamColumns = [
    {
      title: "Sales Rep",
      key: "name",
      render: (record: (typeof teamMembers)[number]) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar style={{ backgroundColor: "#1890ff", flexShrink: 0 }}>{record.name[0]}</Avatar>
          <Text strong style={{ fontSize: 14 }}>
            {record.name}
          </Text>
        </div>
      ),
    },
    {
      title: "Deals Closed",
      dataIndex: "deals",
      key: "deals",
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: "Revenue",
      dataIndex: "revenue",
      key: "revenue",
      render: (v: string) => (
        <Text strong style={{ color: "#52c41a" }}>
          {v}
        </Text>
      ),
    },
    {
      title: "Conversion Rate",
      dataIndex: "conversion",
      key: "conversion",
      render: (v: number) => (
        <div style={{ minWidth: 150 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ fontSize: 12 }}>{v}%</Text>
          </div>
          <Progress
            percent={v}
            size="small"
            showInfo={false}
            strokeColor={v >= 35 ? "#52c41a" : v >= 28 ? "#faad14" : "#ff4d4f"}
          />
        </div>
      ),
    },
    {
      title: "Trend",
      dataIndex: "trend",
      key: "trend",
      render: (trend: string) =>
        trend === "up" ? (
          <Tag color="success" icon={<ArrowUpOutlined />}>
            Up
          </Tag>
        ) : (
          <Tag color="error" icon={<ArrowDownOutlined />}>
            Down
          </Tag>
        ),
    },
  ];

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <DashboardGreeting />
        {filterBar}
      </div>

      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {statsCards.map((stat, index) => (
          <Col xs={24} sm={12} xl={6} key={index}>
            <Card
              bordered={false}
              style={cardStyle}
              styles={{ body: { padding: "24px" } }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
                    {stat.title}
                  </Text>
                  <div
                    style={{ fontSize: 32, fontWeight: 700, color: "#1f1f1f", lineHeight: 1, marginBottom: 12 }}
                  >
                    {stat.value}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {stat.trend === "up" && <ArrowUpOutlined style={{ color: "#52c41a", fontSize: 12 }} />}
                    {stat.trend === "down" && <ArrowDownOutlined style={{ color: "#ff4d4f", fontSize: 12 }} />}
                    <Text
                      style={{
                        fontSize: 12,
                        color:
                          stat.trend === "up" ? "#52c41a" : stat.trend === "down" ? "#ff4d4f" : "#8c8c8c",
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
        <Col xs={24} xl={14}>
          <Card
            title={<Text strong style={{ fontSize: 16 }}>Team Revenue Trend</Text>}
            bordered={false}
            style={cardStyle}
            styles={{ body: { padding: "24px 24px 16px" } }}
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyTeamData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRevSM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#8c8c8c" fontSize={11} />
                <YAxis
                  stroke="#8c8c8c"
                  fontSize={11}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                  formatter={(v: number) => [`$${(v / 1000).toFixed(0)}k`, "Revenue"]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1890ff"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevSM)"
                  name="Revenue"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card
            title={<Text strong style={{ fontSize: 16 }}>Pipeline Overview</Text>}
            bordered={false}
            style={{ ...cardStyle, height: "100%" }}
            styles={{ body: { padding: "24px" } }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {pipelineStages.map((stage) => (
                <div key={stage.stage}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 13 }}>{stage.stage}</Text>
                    <Text strong style={{ fontSize: 13 }}>
                      {stage.count}
                    </Text>
                  </div>
                  <Progress
                    percent={Math.round((stage.count / stage.max) * 100)}
                    showInfo={false}
                    strokeColor={stage.color}
                    size="small"
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} xl={14}>
          <Card
            title={<Text strong style={{ fontSize: 16 }}>Rep Performance (This Month)</Text>}
            bordered={false}
            style={cardStyle}
            styles={{ body: { padding: "24px 24px 16px" } }}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={repPerformanceData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" stroke="#8c8c8c" fontSize={11} />
                <YAxis stroke="#8c8c8c" fontSize={11} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                  formatter={(v: number, name: string) => [
                    name === "revenue" ? `$${v}k` : v,
                    name === "revenue" ? "Revenue" : "Deals",
                  ]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="deals" fill="#1890ff" radius={[6, 6, 0, 0]} name="Deals" />
                <Bar dataKey="revenue" fill="#52c41a" radius={[6, 6, 0, 0]} name="Revenue ($k)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card
            title={<Text strong style={{ fontSize: 16 }}>Recent Team Activity</Text>}
            bordered={false}
            style={{ ...cardStyle, height: "100%" }}
            styles={{ body: { padding: "20px 24px" } }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {recentActivities.map((activity) => (
                <div key={activity.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Avatar
                    size={34}
                    style={{
                      backgroundColor: activity.type === "success" ? "#52c41a" : "#1890ff",
                      flexShrink: 0,
                      fontSize: 13,
                    }}
                  >
                    {activity.user[0]}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: "#1f1f1f" }}>
                      <Text strong style={{ fontSize: 13 }}>
                        {activity.user}
                      </Text>{" "}
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {activity.action}
                      </Text>{" "}
                      <Text strong style={{ fontSize: 13 }}>
                        {activity.target}
                      </Text>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 3 }}>
                      <Text strong style={{ fontSize: 12, color: "#52c41a" }}>
                        {activity.value}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {activity.time}
                      </Text>
                    </div>
                  </div>
                  {activity.type === "success" && (
                    <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 15, marginTop: 3 }} />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24}>
          <Card
            title={<Text strong style={{ fontSize: 16 }}>Team Leaderboard</Text>}
            bordered={false}
            style={cardStyle}
          >
            <Table
              columns={teamColumns}
              dataSource={teamMembers}
              pagination={false}
              rowKey="key"
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
