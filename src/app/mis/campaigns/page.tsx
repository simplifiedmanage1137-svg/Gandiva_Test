"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Input,
  Select,
  Table,
  Tag,
  Typography,
  Spin,
  Empty,
  Space,
  message,
  Tooltip,
} from "antd";
import { ReloadOutlined, CheckCircleOutlined, SendOutlined } from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";

type MisCampaign = {
  id: string;
  campaign_id: string;
  name: string;
  client_id: string | null;
  client_name: string;
  status: string;
  created_at: string;
  lead_type: string | null;
  industry: string | null;
  geography: string | null;
  start_date: string | null;
  end_date: string | null;
  assigned_team_leader_name: string | null;
  leadCount: number;
  agentNames: string[];
  qaQualified: number;
  qaDisqualified: number;
  qaRectified: number;
  qaPending: number;
  isDelivered: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "default",
  active: "green",
  paused: "orange",
  completed: "blue",
  delivered: "cyan",
};

export default function MISCampaignsPage() {
  const router = useRouter();
  const { hasRole, isInitialized } = useAuth();
  const [campaigns, setCampaigns] = useState<MisCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [delivering, setDelivering] = useState<Set<string>>(new Set());
  const [isOffline, setIsOffline] = useState(false);

  const isMisOrAdmin = isInitialized && (hasRole("mis") || hasRole("admin"));

  const fetchCampaigns = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      setLoading(false);
      return;
    }
    setIsOffline(false);
    setLoading(true);
    try {
      const res = await fetch("/api/mis/campaigns", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCampaigns(data.campaigns ?? []);
    } catch {
      message.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized || !isMisOrAdmin) return;
    fetchCampaigns();
  }, [isInitialized, isMisOrAdmin, fetchCampaigns]);

  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); fetchCampaigns(); };
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
  }, [fetchCampaigns]);

  const handleDeliver = async (e: React.MouseEvent, campaign: MisCampaign) => {
    e.stopPropagation();
    if (campaign.isDelivered) return;
    if (!campaign.client_id) {
      message.warning("Cannot deliver: campaign has no client assigned.");
      return;
    }
    setDelivering((prev) => new Set(prev).add(campaign.id));
    // Optimistic update
    setCampaigns((prev) =>
      prev.map((c) => c.id === campaign.id ? { ...c, status: "delivered", isDelivered: true } : c)
    );
    try {
      const res = await fetch(`/api/mis/campaigns/${campaign.id}/deliver`, {
        method: "PATCH",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      message.success(`"${campaign.name}" marked as delivered`);
    } catch (err) {
      // Rollback
      setCampaigns((prev) =>
        prev.map((c) => c.id === campaign.id ? { ...c, status: campaign.status, isDelivered: campaign.isDelivered } : c)
      );
      message.error(err instanceof Error ? err.message : "Failed to mark as delivered");
    } finally {
      setDelivering((prev) => { const n = new Set(prev); n.delete(campaign.id); return n; });
    }
  };

  const filtered = campaigns.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      (c.client_name ?? "").toLowerCase().includes(q) ||
      (c.lead_type ?? "").toLowerCase().includes(q) ||
      (c.industry ?? "").toLowerCase().includes(q) ||
      (c.geography ?? "").toLowerCase().includes(q) ||
      c.agentNames.some((a) => a.toLowerCase().includes(q));
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!isInitialized || !isMisOrAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", padding: "0 24px 32px" }}>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>
          Campaigns
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 14, display: "block", marginTop: 4 }}>
          Click a campaign to view details and leads.
        </Typography.Text>
      </div>

      {isOffline && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="danger" style={{ fontSize: 14 }}>
            You appear to be offline.{" "}
            <a onClick={(e) => { e.preventDefault(); fetchCampaigns(); }}>Retry now</a>.
          </Typography.Text>
        </div>
      )}

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="Search by name, client, agent, industry, geography…"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 360 }}
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
            { value: "delivered", label: "Delivered" },
          ]}
          style={{ width: 160 }}
        />
        <Button icon={<ReloadOutlined />} onClick={fetchCampaigns} loading={loading}>
          Refresh
        </Button>
      </Space>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : filtered.length === 0 ? (
        <Empty description="No campaigns" style={{ marginTop: 48 }} />
      ) : (
        <Card
          styles={{ body: { padding: 0 } }}
          style={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
        >
          <Table
            size="middle"
            rowKey="id"
            dataSource={filtered}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              pageSizeOptions: ["10", "15", "25", "50"],
              showTotal: (t) => `${t} campaigns`,
            }}
            onRow={(record) => ({
              onClick: () => router.push(`/mis/campaigns/${record.id}`),
              style: { cursor: "pointer" },
              onMouseEnter: (e) => { e.currentTarget.style.backgroundColor = "#fafafa"; },
              onMouseLeave: (e) => { e.currentTarget.style.backgroundColor = ""; },
            })}
            columns={[
              {
                title: "Sr. No.",
                key: "sr",
                width: 72,
                align: "center" as const,
                render: (_: unknown, __: MisCampaign, index: number) => (
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>{index + 1}</Typography.Text>
                ),
              },
              {
                title: "Campaign",
                dataIndex: "name",
                key: "name",
                ellipsis: true,
                render: (v: string) => (
                  <Typography.Text strong style={{ fontSize: 14 }}>{v || "—"}</Typography.Text>
                ),
              },
              {
                title: "Client",
                dataIndex: "client_name",
                key: "client_name",
                width: 150,
                ellipsis: true,
                render: (v: string) => (
                  <Typography.Text style={{ fontSize: 13 }}>{v || "—"}</Typography.Text>
                ),
              },
              {
                title: "Agent(s)",
                key: "agents",
                width: 180,
                ellipsis: true,
                render: (_: unknown, rec: MisCampaign) => {
                  if (!rec.agentNames.length) return <Typography.Text type="secondary" style={{ fontSize: 13 }}>—</Typography.Text>;
                  const display = rec.agentNames.slice(0, 2).join(", ");
                  const extra = rec.agentNames.length > 2 ? ` +${rec.agentNames.length - 2} more` : "";
                  return (
                    <Tooltip title={rec.agentNames.join(", ")}>
                      <Typography.Text style={{ fontSize: 13 }}>{display}{extra}</Typography.Text>
                    </Tooltip>
                  );
                },
              },
              {
                title: "Leads",
                key: "leadCount",
                width: 80,
                align: "center" as const,
                sorter: (a: MisCampaign, b: MisCampaign) => a.leadCount - b.leadCount,
                render: (_: unknown, rec: MisCampaign) => (
                  <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>{rec.leadCount}</Typography.Text>
                ),
              },
              {
                title: "QA Verified",
                key: "qa",
                width: 200,
                render: (_: unknown, rec: MisCampaign) => (
                  <Space size={4} wrap>
                    {rec.qaQualified > 0 && <Tag color="green" style={{ margin: 0 }}>✓ {rec.qaQualified} Qualified</Tag>}
                    {rec.qaDisqualified > 0 && <Tag color="red" style={{ margin: 0 }}>✗ {rec.qaDisqualified} DQ</Tag>}
                    {rec.qaRectified > 0 && <Tag color="blue" style={{ margin: 0 }}>↺ {rec.qaRectified} Rectified</Tag>}
                    {rec.qaQualified === 0 && rec.qaDisqualified === 0 && rec.qaRectified === 0 && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>
                    )}
                  </Space>
                ),
              },
              {
                title: "Status",
                dataIndex: "status",
                key: "status",
                width: 110,
                align: "center" as const,
                render: (v: string) => (
                  <Tag color={STATUS_COLORS[v] ?? "default"} style={{ textTransform: "capitalize", margin: 0 }}>
                    {v}
                  </Tag>
                ),
              },
              {
                title: "Delivered",
                key: "deliver",
                width: 150,
                align: "center" as const,
                render: (_: unknown, rec: MisCampaign) => {
                  if (rec.isDelivered) {
                    return (
                      <Tag icon={<CheckCircleOutlined />} color="cyan" style={{ margin: 0 }}>
                        Delivered
                      </Tag>
                    );
                  }
                  const isProcessing = delivering.has(rec.id);
                  return (
                    <Tooltip title={!rec.client_id ? "Assign a client first" : "Mark as delivered to client"}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<SendOutlined />}
                        loading={isProcessing}
                        disabled={!rec.client_id || isProcessing}
                        onClick={(e) => handleDeliver(e, rec)}
                        style={{ fontSize: 12 }}
                      >
                        Mark Delivered
                      </Button>
                    </Tooltip>
                  );
                },
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
