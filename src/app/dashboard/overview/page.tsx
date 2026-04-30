"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Col, DatePicker, Progress, Row, Select, Skeleton, Spin, Statistic, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
} from "recharts";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface OverviewResponse {
  campaigns: Array<{ id: string; name: string; campaign_id: string }>;
  selectedCampaignId: string | null;
  kpis: { totalCampaigns: number; totalLeads: number; qualified: number; registrations: number; attendees: number };
  metrics: {
    total_leads_allocated: number;
    total_campaign_spend: number;
    total_leads_delivered: number;
    deficit_leads: number;
    lead_increment: number;
    lead_replace: number;
  };
  funnel: { leads: number; qa: number; qualified: number; registered: number; attended: number };
  bar: { registrations: number; attendees: number };
  channelSplit: Array<{ name: string; value: number }>;
  channelSplitDaily: Array<{
    date: string;
    campaignName: string;
    email: number;
    telemarketing: number;
  }>;
  trendDaily: Array<{
    date: string;
    leads_delivered: number;
    spend: number;
    deficit: number;
  }>;
  performance: {
    deliveryRate: number;
    deficitRate: number;
    registrationRate: number;
    attendanceRate: number;
  };
}

export default function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [campaignId, setCampaignId] = useState<string | undefined>(undefined);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  // Independent state for the Performance Summary local campaign filter
  const [perfCampaignId, setPerfCampaignId] = useState<string | undefined>(undefined);
  const [perfData, setPerfData] = useState<OverviewResponse | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);

  const fetchData = async (id?: string) => {
    setLoading(true);
    try {
      const qs = id ? `?campaign_id=${id}` : "";
      const res = await fetch(`/api/command/overview${qs}`);
      const json = (await res.json()) as OverviewResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData(campaignId);
  }, [campaignId]);

  useEffect(() => {
    const fetchPerf = async () => {
      setPerfLoading(true);
      try {
        const qs = perfCampaignId ? `?campaign_id=${perfCampaignId}` : "";
        const res = await fetch(`/api/command/overview${qs}`);
        const json = (await res.json()) as OverviewResponse;
        setPerfData(json);
      } finally {
        setPerfLoading(false);
      }
    };
    void fetchPerf();
  }, [perfCampaignId]);

  const funnelData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Leads", value: data.funnel.leads },
      { name: "QA", value: data.funnel.qa },
      { name: "Qualified", value: data.funnel.qualified },
      { name: "Registered", value: data.funnel.registered },
      { name: "Attended", value: data.funnel.attended },
    ];
  }, [data]);

  const filteredTrendDaily = useMemo(() => {
    const rows = data?.trendDaily ?? [];
    if (!dateRange) return rows;
    return rows.filter((r) => {
      const d = dayjs(r.date);
      if (!d.isValid()) return false;
      return (
        d.isSame(dateRange[0], "day") ||
        d.isSame(dateRange[1], "day") ||
        (d.isAfter(dateRange[0], "day") && d.isBefore(dateRange[1], "day"))
      );
    });
  }, [data?.trendDaily, dateRange]);

  const filteredChannelSplitDaily = useMemo(() => {
    const rows = data?.channelSplitDaily ?? [];
    if (!dateRange) return rows;
    return rows.filter((r) => {
      const d = dayjs(r.date);
      if (!d.isValid()) return false;
      return (
        d.isSame(dateRange[0], "day") ||
        d.isSame(dateRange[1], "day") ||
        (d.isAfter(dateRange[0], "day") && d.isBefore(dateRange[1], "day"))
      );
    });
  }, [data?.channelSplitDaily, dateRange]);

  if (loading && !data) return <Skeleton active paragraph={{ rows: 12 }} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Overview (Webinar)</Title>
          <Text type="secondary">Client analytics across campaigns</Text>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RangePicker
            value={dateRange}
            onChange={(v) => {
              if (!v || !v[0] || !v[1]) {
                setDateRange(null);
                return;
              }
              setDateRange([v[0], v[1]]);
            }}
            allowClear
            format="YYYY-MM-DD"
            placeholder={["From", "To"]}
          />
          <Select
            style={{ width: 300 }}
            placeholder="All Campaigns"
            allowClear
            value={campaignId}
            onChange={(v) => setCampaignId(v)}
            options={[
              { label: "All Campaigns", value: undefined },
              ...((data?.campaigns ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.campaign_id})` }))),
            ]}
          />
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[
          { title: "Campaigns", value: data?.kpis.totalCampaigns ?? data?.campaigns.length ?? 0, color: "#1677ff" },
          { title: "Total Qualified Leads", value: data?.kpis.qualified ?? 0, color: "#52c41a" },
          { title: "Registrations on client in LP", value: data?.kpis.registrations ?? 0, color: "#faad14" },
          { title: "Attendees", value: data?.kpis.attendees ?? 0, color: "#722ed1" },
        ].map((k) => (
          <Col xs={12} md={6} key={k.title}>
            <Card bordered style={{ borderRadius: 12 }}>
              <Statistic title={k.title} value={k.value} valueStyle={{ color: k.color, fontWeight: 700 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Daily Trend (Leads Delivered · Spend · Deficit)" style={{ borderRadius: 12 }}>
            {filteredTrendDaily.length === 0 ? (
              <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Text type="secondary">No daily history data</Text>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart
                  data={filteredTrendDaily}
                  margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid stroke="#f0f0f0" strokeDasharray="4 4" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RTooltip
                    formatter={(value: number, name: string) => {
                      if (name === "Spend ($)") {
                        return [`$${Number(value).toLocaleString()}`, name];
                      }
                      return [Number(value).toLocaleString(), name];
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    name="Spend ($)"
                    stroke="#b37feb"
                    fill="#f9f0ff"
                    strokeWidth={2}
                  />
                  <Bar
                    dataKey="leads_delivered"
                    name="Leads Delivered"
                    fill="#69b1ff"
                    barSize={18}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="deficit"
                    name="Deficit"
                    stroke="#ff4d4f"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Channel Split (Daily, by Campaign)" style={{ borderRadius: 12 }}>
            {filteredChannelSplitDaily.length === 0 ? (
              <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Text type="secondary">No channel split data</Text>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={filteredChannelSplitDaily.map((r) => ({
                    ...r,
                    shortDate: (() => {
                      const d = new Date(r.date ?? "");
                      if (isNaN(d.getTime())) return r.date ?? "";
                      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                    })(),
                  }))}
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                >
                  <XAxis dataKey="shortDate" interval="preserveStartEnd" minTickGap={24} />
                  <YAxis />
                  <RTooltip
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | { date?: string; campaignName?: string }
                        | undefined;
                      if (!row) return "";
                      const d = new Date(row.date ?? "");
                      const label = isNaN(d.getTime())
                        ? (row.date ?? "")
                        : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                      return `${label} · ${row.campaignName ?? ""}`;
                    }}
                  />
                  <Bar dataKey="email" stackId="channels" fill="#1677ff" name="Email" />
                  <Bar dataKey="telemarketing" stackId="channels" fill="#52c41a" name="Telemarketing" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Leads Funnel" style={{ borderRadius: 12 }}>
            {funnelData.length === 0 || funnelData.every((d) => d.value === 0) ? (
              <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Text type="secondary">No funnel data</Text>
              </div>
            ) : (
              <div style={{ padding: "8px 0" }}>
                {funnelData.map((stage, i) => {
                  const max = funnelData[0]?.value || 1;
                  const widthPct = Math.max(30, Math.round((stage.value / max) * 100));
                  const prevValue = i === 0 ? null : funnelData[i - 1]?.value ?? 0;
                  const convRate =
                    prevValue && prevValue > 0
                      ? Math.round((stage.value / prevValue) * 100)
                      : null;

                  const COLORS = ["#1677ff", "#4096ff", "#36cfc9", "#52c41a", "#95de64"];
                  const color = COLORS[i] ?? "#1677ff";

                  return (
                    <div key={stage.name} style={{ marginBottom: i < funnelData.length - 1 ? 2 : 0 }}>
                      <div
                        style={{
                          width: `${widthPct}%`,
                          margin: "0 auto",
                          background: color,
                          borderRadius: 6,
                          padding: "10px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "width 0.4s ease",
                          position: "relative",
                        }}
                      >
                        <span style={{ color: "#fff", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
                          {stage.name}
                        </span>
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginLeft: 8 }}>
                          {stage.value.toLocaleString()}
                        </span>
                      </div>
                      {convRate !== null && (
                        <div style={{ textAlign: "center", padding: "2px 0" }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            ↓ {convRate}% conversion
                          </Text>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span>Performance Summary</span>
                <Select
                  size="small"
                  style={{ width: 220, fontWeight: 400 }}
                  placeholder="All Campaigns"
                  allowClear
                  value={perfCampaignId}
                  onChange={(v) => setPerfCampaignId(v)}
                  options={[
                    { label: "All Campaigns", value: undefined },
                    ...((data?.campaigns ?? []).map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.campaign_id})`,
                    }))),
                  ]}
                />
              </div>
            }
            style={{ borderRadius: 12 }}
          >
            <Spin spinning={perfLoading} size="small">
              {(() => {
                const perf = perfData ?? data;
                return (
                  <div style={{ display: "grid", gap: 12 }}>
                    {[
                      { label: "Delivery Rate", value: perf?.performance.deliveryRate ?? 0, color: "#1677ff" },
                      { label: "Registration Rate (client LP)", value: perf?.performance.registrationRate ?? 0, color: "#52c41a" },
                      { label: "Attendance Rate", value: perf?.performance.attendanceRate ?? 0, color: "#722ed1" },
                    ].map((p) => (
                      <div key={p.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <Text>{p.label}</Text>
                          <Text strong>{p.value}%</Text>
                        </div>
                        <Progress percent={p.value} showInfo={false} strokeColor={p.color} />
                      </div>
                    ))}
                    <Row gutter={12} style={{ marginTop: 4 }}>
                      <Col span={12}><Statistic title="Lead Increment" value={perf?.metrics.lead_increment ?? 0} /></Col>
                      <Col span={12}><Statistic title="Lead Replace" value={perf?.metrics.lead_replace ?? 0} /></Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={12}><Statistic title="Allocated" value={perf?.metrics.total_leads_allocated ?? 0} /></Col>
                      <Col span={12}><Statistic title="Delivered" value={perf?.metrics.total_leads_delivered ?? 0} /></Col>
                    </Row>
                    <Statistic title="Campaign Spend" value={perf?.metrics.total_campaign_spend ?? 0} prefix="$" />
                  </div>
                );
              })()}
            </Spin>
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Registrations vs Attendees" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[{ name: "Conversion", registrations: data?.bar.registrations ?? 0, attendees: data?.bar.attendees ?? 0 }]}>
                <XAxis dataKey="name" />
                <YAxis />
                <RTooltip />
                <Bar dataKey="registrations" fill="#1677ff" radius={[6, 6, 0, 0]} />
                <Bar dataKey="attendees" fill="#52c41a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

