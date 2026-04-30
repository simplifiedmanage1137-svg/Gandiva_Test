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
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useRoleGuard } from "@/hooks/useRoleGuard";

type Campaign = {
  id: string;
  campaign_id?: string | null;
  name: string;
  client_name?: string | null;
  description: string | null;
  industry: string | null;
  geography: string | null;
  target_designation?: string | null;
  lead_type?: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
  cpl?: number | null;
  revenue?: number | null;
  booked?: number | null;
  total_allocation?: number | null;
  post_qa?: number | null;
  achieved?: number | null;
  pending_allocation?: number | null;
  region?: string | null;
  weekly_call?: string | null;
  weekly_report?: string | null;
  additional_comments?: string | null;
  assigned_team_leader_id?: string | null;
  assigned_team_leader_name?: string | null;
  employee_size?: string[] | null;
  abm?: boolean | null;
  seniority?: string | null;
  job_function?: string | null;
  creatives_url?: string[] | null;
  leads?: unknown[];
};

export default function MISCampaignsPage() {
  const router = useRouter();
  const { status } = useRoleGuard(["mis", "admin"]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const fetchDashboard = useCallback(async () => {
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
    if (status !== "authorized") return;
    fetchDashboard();
  }, [fetchDashboard, status]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchDashboard();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

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
  }, [fetchDashboard]);

  const filteredCampaigns = useCallback(() => {
    let result = campaigns;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          (c.name ?? "").toLowerCase().includes(q) ||
          (c.lead_type ?? "").toLowerCase().includes(q) ||
          (c.industry ?? "").toLowerCase().includes(q) ||
          (c.geography ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }
    return result;
  }, [campaigns, search, statusFilter]);

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (status === "redirecting") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const list = filteredCampaigns();
  const campaignStatusColors: Record<string, string> = {
    draft: "default",
    active: "green",
    paused: "orange",
    completed: "blue",
  };

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
            You appear to be offline. Check your internet connection. Data will reload
            automatically once you are back online, or{" "}
            <a
              onClick={(e) => {
                e.preventDefault();
                fetchDashboard();
              }}
            >
              click here to retry now
            </a>
            .
          </Typography.Text>
        </div>
      )}

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="Search campaigns (name, lead type, industry, geography)"
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
          ]}
          style={{ width: 160 }}
        />
        <Button icon={<ReloadOutlined />} onClick={fetchDashboard} loading={loading}>
          Refresh
        </Button>
      </Space>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : list.length === 0 ? (
        <Empty description="No campaigns" style={{ marginTop: 48 }} />
      ) : (
        <Card
          bodyStyle={{ padding: 0 }}
          style={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
        >
          <Table
            size="middle"
            rowKey="id"
            dataSource={list}
            pagination={{
              defaultPageSize: 15,
              showSizeChanger: true,
              pageSizeOptions: ["10", "15", "25", "50"],
              showTotal: (t) => `${t} campaigns`,
            }}
            onRow={(record) => ({
              onClick: () => router.push(`/mis/campaigns/${record.id}`),
              style: { cursor: "pointer" },
              onMouseEnter: (e) => {
                e.currentTarget.style.backgroundColor = "#fafafa";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.backgroundColor = "";
              },
            })}
            columns={[
              {
                title: "Sr. No.",
                key: "sr",
                width: 72,
                align: "center" as const,
                render: (_: unknown, __: Campaign, index: number) => (
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {index + 1}
                  </Typography.Text>
                ),
              },
              {
                title: "Campaign",
                dataIndex: "name",
                key: "name",
                ellipsis: true,
                render: (v: string | null) => (
                  <Typography.Text strong style={{ fontSize: 14 }}>
                    {v || "—"}
                  </Typography.Text>
                ),
              },
              {
                title: "Lead Type",
                dataIndex: "lead_type",
                key: "lead_type",
                width: 120,
                ellipsis: true,
                render: (v: string | null) => (
                  <Typography.Text style={{ fontSize: 13 }}>{v || "—"}</Typography.Text>
                ),
              },
              {
                title: "Industry",
                dataIndex: "industry",
                key: "industry",
                width: 130,
                ellipsis: true,
                render: (v: string | null) => (
                  <Typography.Text style={{ fontSize: 13 }}>{v || "—"}</Typography.Text>
                ),
              },
              {
                title: "Geography",
                dataIndex: "geography",
                key: "geography",
                width: 120,
                ellipsis: true,
                render: (v: string | null) => (
                  <Typography.Text style={{ fontSize: 13 }}>{v || "—"}</Typography.Text>
                ),
              },
              {
                title: "Start Date",
                dataIndex: "start_date",
                key: "start_date",
                width: 120,
                render: (v: string | null) => (
                  <Typography.Text style={{ fontSize: 13 }}>
                    {v ? new Date(v).toLocaleDateString() : "—"}
                  </Typography.Text>
                ),
              },
              {
                title: "End Date",
                dataIndex: "end_date",
                key: "end_date",
                width: 120,
                render: (v: string | null) => (
                  <Typography.Text style={{ fontSize: 13 }}>
                    {v ? new Date(v).toLocaleDateString() : "—"}
                  </Typography.Text>
                ),
              },
              {
                title: "Status",
                dataIndex: "status",
                key: "status",
                width: 100,
                align: "center" as const,
                render: (v: string) => (
                  <Tag color={campaignStatusColors[v] ?? "default"} style={{ textTransform: "capitalize", margin: 0 }}>
                    {v}
                  </Tag>
                ),
              },
              {
                title: "Leads",
                key: "leads_count",
                width: 80,
                align: "center" as const,
                render: (_: unknown, rec: Campaign) => (
                  <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
                    {rec.leads?.length ?? 0}
                  </Typography.Text>
                ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}

