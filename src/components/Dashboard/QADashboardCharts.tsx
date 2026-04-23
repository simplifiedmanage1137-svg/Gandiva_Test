"use client";

import { Card, Typography, Empty } from "antd";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const { Text } = Typography;

const cardStyle = {
  borderRadius: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  border: "1px solid #f0f0f0",
  transition: "all 0.3s ease",
  cursor: "pointer" as const,
};

const reviewTrendSample = [
  { day: "Mon", reviewed: 24, pending: 12 },
  { day: "Tue", reviewed: 32, pending: 8 },
  { day: "Wed", reviewed: 28, pending: 14 },
  { day: "Thu", reviewed: 41, pending: 6 },
  { day: "Fri", reviewed: 35, pending: 10 },
  { day: "Sat", reviewed: 18, pending: 16 },
  { day: "Sun", reviewed: 22, pending: 12 },
];

type PieSlice = { name: string; value: number; color: string };
type BarRow = { campaign: string; reviewed: number; pending: number };

export function QAStatusPieChart({ data }: { data: PieSlice[] }) {
  const pieData = data.length > 0 ? data : [{ name: "No data", value: 1, color: "#d9d9d9" }];
  return (
    <Card
      title={<Text strong style={{ fontSize: 16 }}>QA Status Distribution</Text>}
      bordered={false}
      style={{ ...cardStyle, height: "100%" }}
      styles={{ body: { padding: "24px 24px 16px", overflow: "visible" } }}
    >
      <div className="qa-status-pie-wrapper" style={{ overflow: "visible", minHeight: 320 }}>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <Pie
              data={pieData}
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
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
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
  );
}

type ReviewTrendPoint = { day: string; reviewed: number; pending: number };

export function QAReviewTrendChart({ data }: { data?: ReviewTrendPoint[] }) {
  const chartData = data && data.length > 0 ? data : reviewTrendSample;
  return (
    <Card
      title={<Text strong style={{ fontSize: 16 }}>Review Trend</Text>}
      bordered={false}
      style={{ ...cardStyle, height: "100%" }}
      styles={{ body: { padding: "24px 24px 16px" } }}
    >
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
          <defs>
            <linearGradient id="colorQAReviewed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#52c41a" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorQAPending" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#faad14" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#faad14" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" stroke="#8c8c8c" fontSize={11} />
          <YAxis stroke="#8c8c8c" fontSize={11} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #f0f0f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="reviewed"
            stroke="#52c41a"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorQAReviewed)"
            name="Reviewed"
          />
          <Area
            type="monotone"
            dataKey="pending"
            stroke="#faad14"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorQAPending)"
            name="Pending"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function QACampaignReviewChart({ data }: { data: BarRow[] }) {
  return (
    <Card
      title={<Text strong style={{ fontSize: 16 }}>Campaign Review Status</Text>}
      bordered={false}
      style={{ ...cardStyle, height: "100%" }}
      styles={{ body: { padding: "24px 24px 16px" } }}
    >
      {data.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No campaign data yet"
          style={{ margin: "48px 0" }}
        />
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="campaign"
              stroke="#8c8c8c"
              fontSize={11}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => (v && v.length > 18 ? `${v.slice(0, 18)}…` : v)}
            />
            <YAxis stroke="#8c8c8c" fontSize={11} />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #f0f0f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="reviewed" fill="#52c41a" radius={[8, 8, 0, 0]} name="Reviewed" />
            <Bar dataKey="pending" fill="#faad14" radius={[8, 8, 0, 0]} name="Pending" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
