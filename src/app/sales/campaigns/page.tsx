"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Button,
  Tag,
  Tooltip,
  message,
  Spin,
  Typography,
  Popconfirm,
  Input,
  Select,
} from "antd";
import {
  FundProjectionScreenOutlined,
  RiseOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  PercentageOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SearchOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";

type CampaignRow = {
  id: string;
  campaign_id: string;
  name: string;
  client_name: string | null;
  lead_type: string | null;
  industry: string | null;
  geography: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  cpl: number | null;
  revenue: number | null;
  total_allocation: number | null;
  achieved: number | null;
  region: string | null;
  created_at: string;
  total_leads: number;
  assigned_team_leader_name: string | null;
};

type Stats = {
  totalCampaigns: number;
  activeCampaigns: number;
  totalLeads: number;
  totalInterested: number;
  conversionPct: number;
};

export default function SalesCampaignsPage() {
  const router = useRouter();
  const { hasRole, isInitialized } = useAuth();
  const hasSalesAccess =
    hasRole("sales") || hasRole("sales_manager") || hasRole("admin");
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, campaignsRes] = await Promise.all([
        fetch("/api/tl/campaigns/stats", { credentials: "include" }),
        fetch("/api/tl/campaigns", { credentials: "include" }),
      ]);
      const statsData = await statsRes.json();
      const campaignsData = await campaignsRes.json();
      if (statsRes.ok) setStats(statsData);
      if (campaignsRes.ok) setCampaigns(campaignsData.campaigns ?? []);
    } catch {
      message.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (!hasSalesAccess) {
      router.replace("/login");
      return;
    }
    fetchData();
  }, [isInitialized, hasSalesAccess, router, fetchData]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tl/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      message.success("Campaign updated");
      fetchData();
    } catch {
      message.error("Failed to update campaign");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tl/campaigns/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      message.success("Campaign deleted");
      fetchData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to delete campaign");
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spin size="large" />
      </div>
    );
  }

  if (!hasSalesAccess) {
    return null;
  }

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      !searchText ||
      (c.name?.toLowerCase().includes(searchText.toLowerCase())) ||
      (c.client_name?.toLowerCase().includes(searchText.toLowerCase())) ||
      (c.campaign_id?.toLowerCase().includes(searchText.toLowerCase())) ||
      (c.lead_type?.toLowerCase().includes(searchText.toLowerCase())) ||
      (c.industry?.toLowerCase().includes(searchText.toLowerCase())) ||
      (c.geography?.toLowerCase().includes(searchText.toLowerCase()));
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
    { value: "completed", label: "Completed" },
  ];

  const textCell = (v: string | null, fallback = "—") => {
    const t = (v ?? "").trim() || fallback;
    return (
      <Tooltip title={t}>
        <span className="table-text-ellipsis">{t}</span>
      </Tooltip>
    );
  };

  const columns = [
    {
      title: "Sr. No.",
      key: "sr",
      width: 72,
      fixed: "left" as const,
      render: (_: unknown, __: CampaignRow, index: number) => index + 1,
    },
    {
      title: "Campaign ID",
      dataIndex: "campaign_id",
      key: "campaign_id",
      width: 240,
      fixed: "left" as const,
      render: (val: string | undefined, r: CampaignRow) => {
        const id = (val ?? r?.campaign_id ?? "").toString().trim();
        const copy = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (!id) return;
          navigator.clipboard.writeText(id).then(
            () => message.success("Campaign ID copied"),
            () => message.error("Failed to copy")
          );
        };
        return (
          <span className="campaign-id-cell" style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, width: "100%" }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "1 1 0" }}>
              {id || "—"}
            </span>
            <Tooltip title={id ? "Copy Campaign ID" : "No ID to copy"}>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={copy}
                disabled={!id}
                style={{ flexShrink: 0, padding: "2px 6px" }}
              />
            </Tooltip>
          </span>
        );
      },
    },
    {
      title: "Client Name",
      dataIndex: "client_name",
      key: "client_name",
      width: 130,
      ellipsis: true,
      render: (v: string | null) => textCell(v),
    },
    {
      title: "Campaign Name",
      dataIndex: "name",
      key: "name",
      width: 160,
      ellipsis: true,
      render: (val: string, r: CampaignRow) => (
        <Tooltip title={val || "—"}>
          <span className="table-text-ellipsis">
            <Link href={`/sales/campaigns/${r.id}`} style={{ fontWeight: 600 }}>
              {val}
            </Link>
          </span>
        </Tooltip>
      ),
    },
    {
      title: "Lead Type",
      dataIndex: "lead_type",
      key: "lead_type",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => textCell(v),
    },
    {
      title: "Industry",
      dataIndex: "industry",
      key: "industry",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => textCell(v),
    },
    {
      title: "Geography",
      dataIndex: "geography",
      key: "geography",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => textCell(v),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      ellipsis: true,
      render: (val: string) => {
        const colors: Record<string, string> = {
          draft: "default",
          active: "green",
          paused: "orange",
          completed: "blue",
        };
        const label = val ? val.charAt(0).toUpperCase() + val.slice(1).toLowerCase() : val;
        return (
          <span className="table-text-ellipsis">
            <Tag color={colors[val] ?? "default"}>{label}</Tag>
          </span>
        );
      },
    },
    { title: "Total Leads", dataIndex: "total_leads", key: "total_leads", width: 100 },
    {
      title: "Team Leader",
      dataIndex: "assigned_team_leader_name",
      key: "assigned_team_leader_name",
      width: 130,
      ellipsis: true,
      render: (v: string | null) => textCell(v),
    },
    {
      title: "Start Date",
      dataIndex: "start_date",
      key: "start_date",
      width: 100,
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—"),
    },
    {
      title: "CPL",
      dataIndex: "cpl",
      key: "cpl",
      width: 80,
      render: (v: number | null) => (v != null ? `$${v}` : "—"),
    },
    {
      title: "Revenue",
      dataIndex: "revenue",
      key: "revenue",
      width: 100,
      render: (v: number | null) => (v != null ? `$${Number(v).toLocaleString()}` : "—"),
    },
    {
      title: "Region",
      dataIndex: "region",
      key: "region",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => textCell(v),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 110,
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      fixed: "right" as const,
      render: (_: unknown, r: CampaignRow) => (
        <div className="table-actions-cell" style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/sales/campaigns/${r.id}`)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => router.push(`/sales/campaigns/${r.id}?edit=1`)}
            />
          </Tooltip>
          {r.status === "draft" || r.status === "paused" ? (
            <Tooltip title="Activate">
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStatusChange(r.id, "active")}
              />
            </Tooltip>
          ) : r.status === "active" ? (
            <Tooltip title="Pause">
              <Button
                type="text"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handleStatusChange(r.id, "paused")}
              />
            </Tooltip>
          ) : null}
          <Popconfirm
            title="Delete campaign?"
            description="This action cannot be undone. Related leads and assignments may be affected."
            onConfirm={() => handleDelete(r.id)}
            okText="Delete"
            okType="danger"
          >
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Campaigns
          </Typography.Title>
          <Typography.Text type="secondary">
            Manage campaigns with full CRUD
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push("/sales/campaigns/create")}>
          Create Campaign
        </Button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Total Campaigns"
                  value={stats?.totalCampaigns ?? 0}
                  prefix={<FundProjectionScreenOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Active Campaigns"
                  value={stats?.activeCampaigns ?? 0}
                  prefix={<RiseOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Total Leads"
                  value={stats?.totalLeads ?? 0}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={12}>
              <Card>
                <Statistic
                  title="Total Interested"
                  value={stats?.totalInterested ?? 0}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={12}>
              <Card>
                <Statistic
                  title="Conversion %"
                  value={stats?.conversionPct ?? 0}
                  suffix="%"
                  prefix={<PercentageOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title="All Campaigns"
            bodyStyle={{ overflowX: "auto" }}
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
                  options={statusOptions}
                  style={{ width: 160 }}
                />
              </div>
            }
          >
            <Table
              className="table-single-line"
              columns={columns}
              dataSource={filteredCampaigns}
              rowKey="id"
              scroll={{ x: 1920 }}
              pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} campaigns` }}
              locale={{ emptyText: searchText || statusFilter ? "No campaigns match the filter." : "No campaigns yet. Create your first campaign." }}
              tableLayout="fixed"
            />
          </Card>
        </>
      )}
    </>
  );
}
