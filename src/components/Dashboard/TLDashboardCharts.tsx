"use client";

import { useMemo } from "react";
import { Card, Typography } from "antd";
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
import type { MonthBucket, DayBucket } from "@/hooks/useDateFilter";

const { Text } = Typography;

const cardStyle = {
  borderRadius: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  border: "1px solid #f0f0f0",
  transition: "all 0.3s ease",
  cursor: "pointer" as const,
};

type TLLeadTrendPoint = {
  date: string;
  leads: number;
  campaigns: number;
};

const leadTrendSample: TLLeadTrendPoint[] = [
  { date: "Mon", leads: 28, campaigns: 3 },
  { date: "Tue", leads: 35, campaigns: 4 },
  { date: "Wed", leads: 42, campaigns: 4 },
  { date: "Thu", leads: 38, campaigns: 5 },
  { date: "Fri", leads: 45, campaigns: 6 },
  { date: "Sat", leads: 32, campaigns: 4 },
  { date: "Sun", leads: 29, campaigns: 3 },
];

type CampaignPerformancePoint = {
  name: string;
  leads: number;
  qualified: number;
};

const campaignPerformanceSample: CampaignPerformancePoint[] = [
  { name: "Campaign A", leads: 142, qualified: 48 },
  { name: "Campaign B", leads: 98, qualified: 32 },
  { name: "Campaign C", leads: 76, qualified: 28 },
  { name: "Campaign D", leads: 65, qualified: 18 },
  { name: "Campaign E", leads: 54, qualified: 15 },
];

type PieSlice = { name: string; value: number; color: string };

export function TLLeadTrendChart({
  data,
  dayBuckets,
  monthBuckets,
}: {
  data?: TLLeadTrendPoint[];
  dayBuckets?: DayBucket[];
  monthBuckets?: MonthBucket[];
}) {
  const chartData = useMemo(() => {
    // Build a lookup from API response keyed by label
    const apiByLabel: Record<string, TLLeadTrendPoint> = {};
    (data ?? []).forEach((p) => { apiByLabel[p.date] = p; });

    if (dayBuckets && dayBuckets.length > 0) {
      return dayBuckets.map((b) => ({
        date:      b.label,
        leads:     apiByLabel[b.label]?.leads     ?? 0,
        campaigns: apiByLabel[b.label]?.campaigns ?? 0,
      }));
    }
    if (monthBuckets && monthBuckets.length > 0) {
      return monthBuckets.map((b) => ({
        date:      b.label,
        leads:     apiByLabel[b.label]?.leads     ?? 0,
        campaigns: apiByLabel[b.label]?.campaigns ?? 0,
      }));
    }
    // Fallback: use raw API data or sample
    return data && data.length > 0 ? data : leadTrendSample;
  }, [data, dayBuckets, monthBuckets]);

  return (
    <Card
      title={<Text strong style={{ fontSize: 16 }}>Lead Trend</Text>}
      bordered={false}
      style={{ ...cardStyle, height: "100%" }}
      styles={{ body: { padding: "24px 24px 16px" } }}
    >
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
          <defs>
            <linearGradient id="colorTLLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorTLConv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#52c41a" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" stroke="#8c8c8c" fontSize={11} />
          <YAxis stroke="#8c8c8c" fontSize={11} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="leads"
            stroke="#1890ff"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorTLLeads)"
            name="Leads"
          />
          <Area
            type="monotone"
            dataKey="campaigns"
            stroke="#52c41a"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorTLConv)"
            name="Campaigns"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function TLCampaignPerformanceChart({ data }: { data?: CampaignPerformancePoint[] }) {
  const chartData = data && data.length > 0 ? data : campaignPerformanceSample;

  return (
    <Card
      title={<Text strong style={{ fontSize: 16 }}>Campaign Performance</Text>}
      bordered={false}
      style={{ ...cardStyle, height: "100%" }}
      styles={{ body: { padding: "24px 24px 16px" } }}
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="name" stroke="#8c8c8c" fontSize={11} />
          <YAxis stroke="#8c8c8c" fontSize={11} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="leads" fill="#1890ff" radius={[8, 8, 0, 0]} name="Leads" />
          <Bar dataKey="qualified" fill="#52c41a" radius={[8, 8, 0, 0]} name="Qualified" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function TLCampaignStatusPieChart({ data }: { data: PieSlice[] }) {
  const pieData = data.length > 0 ? data : [{ name: "No data", value: 1, color: "#d9d9d9" }];
  return (
    <Card
      title={<Text strong style={{ fontSize: 16 }}>Campaign Status</Text>}
      bordered={false}
      style={{ ...cardStyle, height: "100%" }}
      styles={{ body: { padding: "24px 24px 16px" } }}
    >
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: "#d9d9d9", strokeWidth: 1 }}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
