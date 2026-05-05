"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Button,
  Table,
  Tag,
  Input,
  message,
  Spin,
  Typography,
  Row,
  Col,
  Space,
  Drawer,
  Form,
  Segmented,
  Tooltip,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  LeftOutlined,
  SaveOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { downloadExcel } from "@/lib/leadsExport";
import { LeadDrawerContent, LEAD_DRAWER_WIDTH, LEAD_DRAWER_BODY_STYLE } from "@/components/Leads/LeadDrawerContent";
import { getLeadTableColumns } from "@/components/Leads/LeadTableColumns";
import { buildLeadPayload, leadToFormValues } from "@/lib/leadPayload";
import type { Lead } from "@/types/lead.types";
import { ExpandableText } from "@/components/ExpandableText";

type Campaign = {
  id: string;
  campaign_id?: string | null;
  name: string;
  client_id?: string | null;
  client_name?: string | null;
  description: string | null;
  industry: string | null;
  geography: string | null;
  target_designation?: string | null;
  lead_type?: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
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
  created_at?: string;
};

const overviewRowStyle = {
  display: "grid",
  gridTemplateColumns: "160px 1fr",
  gap: 16,
  padding: "10px 0",
  borderBottom: "1px solid #f0f0f0",
  alignItems: "start",
} as const;
const overviewLabelStyle = { fontSize: 13, color: "#8c8c8c", fontWeight: 500 } as const;
const overviewValueStyle = { fontSize: 14, whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const };

function OverviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div style={overviewRowStyle}>
      <span style={overviewLabelStyle}>{label}</span>
      <span style={overviewValueStyle}>{value}</span>
    </div>
  );
}

function OverviewRowOrEmpty({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={overviewRowStyle}>
      <span style={overviewLabelStyle}>{label}</span>
      <span style={overviewValueStyle}>{value ?? "—"}</span>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: "default", active: "green", paused: "orange", completed: "blue", delivered: "cyan",
};

type QaFilter = "all" | "qualified" | "disqualified" | "rectified" | "pending";

export default function MISCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const { hasRole, isInitialized } = useAuth();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [delivering, setDelivering] = useState(false);

  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [savingDrawer, setSavingDrawer] = useState(false);
  const [form] = Form.useForm();

  const [leadSearch, setLeadSearch] = useState("");
  const [qaFilter, setQaFilter] = useState<QaFilter>("all");

  const isMisOrAdmin = isInitialized && (hasRole("mis") || hasRole("admin"));

  const fetchCampaign = useCallback(async (campaignId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mis/campaigns/${campaignId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCampaign(data.campaign);
      setLeads(data.leads ?? []);
    } catch {
      message.error("Failed to load campaign");
      router.replace("/mis/campaigns");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!id) { router.replace("/mis/campaigns"); return; }
    if (!isInitialized) return;
    if (!isMisOrAdmin) { router.replace("/login"); return; }
    fetchCampaign(id);
  }, [id, isInitialized, isMisOrAdmin, router, fetchCampaign]);

  const filteredLeads = leads.filter((l) => {
    const matchSearch = !leadSearch.trim()
      ? true
      : (l.name ?? "").toLowerCase().includes(leadSearch.trim().toLowerCase()) ||
        (l.company_name ?? "").toLowerCase().includes(leadSearch.trim().toLowerCase()) ||
        (l.email ?? "").toLowerCase().includes(leadSearch.trim().toLowerCase()) ||
        (l.phone ?? "").toLowerCase().includes(leadSearch.trim().toLowerCase()) ||
        ((l as unknown as Record<string, unknown>).assigned_agent_name as string ?? "").toLowerCase().includes(leadSearch.trim().toLowerCase());

    if (!matchSearch) return false;

    if (qaFilter === "all") return true;
    const qa = (l.qa_status ?? "").toLowerCase().trim();
    if (qaFilter === "qualified") return qa === "qualified";
    if (qaFilter === "disqualified") return qa === "disqualified";
    if (qaFilter === "rectified") return qa === "rectified";
    if (qaFilter === "pending") return !qa;
    return true;
  });

  const openEditLeadDrawer = (lead: Lead) => {
    setEditingLead(lead);
    form.setFieldsValue(leadToFormValues(lead as unknown as Record<string, unknown>));
    setLeadDrawerOpen(true);
  };

  const closeLeadDrawer = () => {
    setLeadDrawerOpen(false);
    setEditingLead(null);
    form.resetFields();
  };

  function getDrawerLeadContext() {
    if (!editingLead) return { prevLead: null as Lead | null, nextLead: null as Lead | null };
    const idx = filteredLeads.findIndex((l) => l.id === editingLead.id);
    return {
      prevLead: idx > 0 ? filteredLeads[idx - 1] : null,
      nextLead: idx < filteredLeads.length - 1 ? filteredLeads[idx + 1] : null,
    };
  }

  const handleDrawerSave = async (saveAndContinue?: boolean) => {
    if (!id || !editingLead) return;
    try {
      const values = await form.validateFields();
      setSavingDrawer(true);
      const payload = { ...buildLeadPayload(values), id: editingLead.id };
      const res = await fetch(`/api/tl/campaigns/${id}/leads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update lead");
      message.success("Lead updated");
      await fetchCampaign(id);
      if (saveAndContinue) {
        const { nextLead } = getDrawerLeadContext();
        if (nextLead) openEditLeadDrawer(nextLead);
        else closeLeadDrawer();
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Failed to update lead");
    } finally {
      setSavingDrawer(false);
    }
  };

  const handleDeliver = async () => {
    if (!campaign || campaign.isDelivered) return;
    if (!campaign.client_id) { message.warning("No client assigned to this campaign."); return; }
    setDelivering(true);
    try {
      const res = await fetch(`/api/mis/campaigns/${campaign.id}/deliver`, {
        method: "PATCH",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      message.success("Campaign marked as delivered");
      setCampaign((prev) => prev ? { ...prev, status: "delivered" } : prev);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to mark as delivered");
    } finally {
      setDelivering(false);
    }
  };

  const handleExport = () => {
    if (filteredLeads.length === 0) { message.warning("No leads to export"); return; }
    downloadExcel(filteredLeads, `leads-${campaign?.name?.replace(/\s+/g, "-") ?? "export"}-${dayjs().format("YYYY-MM-DD")}.xlsx`);
    message.success(`Exported ${filteredLeads.length} leads`);
  };

  // QA counts for segmented control labels
  const qaAll = leads.length;
  const qaQualified = leads.filter((l) => (l.qa_status ?? "").toLowerCase() === "qualified").length;
  const qaDisqualified = leads.filter((l) => (l.qa_status ?? "").toLowerCase() === "disqualified").length;
  const qaRectified = leads.filter((l) => (l.qa_status ?? "").toLowerCase() === "rectified").length;
  const qaPending = leads.filter((l) => !(l.qa_status ?? "").trim()).length;

  const isDelivered = campaign?.status?.toLowerCase() === "delivered";

  if (!isInitialized || !isMisOrAdmin) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Spin size="large" /></div>;
  }

  if (loading && !campaign) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Spin size="large" /></div>;
  }

  if (!campaign) return null;

  const leadColumns = getLeadTableColumns({ showActions: true, onEdit: openEditLeadDrawer });

  return (
    <div style={{ width: "100%", padding: "0 24px 32px" }}>
      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/mis/campaigns"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#1677ff", textDecoration: "none", marginBottom: 16 }}
        >
          <ArrowLeftOutlined /> Back to Campaigns
        </Link>
      </div>

      {/* Header card */}
      <Card
        style={{ marginBottom: 24, borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
        styles={{ body: { padding: "24px 28px" } }}
      >
        <Row gutter={24} align="middle" justify="space-between" wrap>
          <Col flex="1" style={{ minWidth: 0 }}>
            <Typography.Title level={3} style={{ margin: 0, marginBottom: 6, fontWeight: 600 }}>
              {campaign.name}
            </Typography.Title>
            <Space size="small" wrap>
              {campaign.campaign_id && (
                <Tag style={{ fontFamily: "monospace", fontSize: 12, margin: 0 }}>{campaign.campaign_id}</Tag>
              )}
              <Tag color={STATUS_COLORS[campaign.status] ?? "default"} style={{ textTransform: "capitalize", margin: 0 }}>
                {campaign.status}
              </Tag>
              {campaign.lead_type && <Tag style={{ margin: 0 }}>{campaign.lead_type}</Tag>}
              {campaign.client_name && (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Client: {campaign.client_name}
                </Typography.Text>
              )}
              {(campaign.industry || campaign.geography) && (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {[campaign.industry, campaign.geography].filter(Boolean).join(" · ")}
                </Typography.Text>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => fetchCampaign(id!)} loading={loading}>
                Refresh
              </Button>
              {!isDelivered ? (
                <Tooltip title={!campaign.client_id ? "Assign a client first" : "Mark as delivered to client"}>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={delivering}
                    disabled={!campaign.client_id || delivering}
                    onClick={handleDeliver}
                  >
                    Mark Delivered
                  </Button>
                </Tooltip>
              ) : (
                <Tag icon={<CheckCircleOutlined />} color="cyan" style={{ fontSize: 13, padding: "4px 10px" }}>
                  Delivered
                </Tag>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Overview card */}
      <Card
        title="Overview"
        style={{ marginBottom: 24, borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
        styles={{ body: { padding: "24px 28px" } }}
      >
        {(campaign.description || campaign.target_designation) && (
          <div style={{ marginBottom: 20 }}>
            {campaign.description && <OverviewRow label="Description" value={campaign.description} />}
            {campaign.target_designation && <OverviewRow label="Target Designation" value={campaign.target_designation} />}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0 32px" }}>
          <div>
            <OverviewRowOrEmpty label="Client" value={campaign.client_name} />
            <OverviewRowOrEmpty label="Lead Type" value={campaign.lead_type} />
            <OverviewRowOrEmpty label="Start Date" value={campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : null} />
            <OverviewRowOrEmpty label="End Date" value={campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : null} />
            <OverviewRowOrEmpty label="Region" value={campaign.region} />
            <OverviewRowOrEmpty label="Assigned TL" value={campaign.assigned_team_leader_name} />
            <OverviewRowOrEmpty label="Weekly Call" value={campaign.weekly_call} />
            <OverviewRowOrEmpty label="Weekly Report" value={campaign.weekly_report} />
          </div>
          <div>
            <OverviewRowOrEmpty label="Total Allocation" value={campaign.total_allocation} />
            <OverviewRowOrEmpty label="Post QA" value={campaign.post_qa} />
            <OverviewRowOrEmpty label="Achieved" value={campaign.achieved} />
            <OverviewRowOrEmpty label="Pending Allocation" value={campaign.pending_allocation} />
            <OverviewRowOrEmpty label="Industry" value={campaign.industry} />
            <OverviewRowOrEmpty label="Geography" value={campaign.geography} />
            <OverviewRowOrEmpty label="CPL" value={campaign.cpl} />
            <OverviewRowOrEmpty label="Revenue" value={campaign.revenue} />
          </div>
        </div>
        {campaign.additional_comments && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #f0f0f0" }}>
            <div style={overviewRowStyle}>
              <span style={overviewLabelStyle}>Additional Comments</span>
              <span style={overviewValueStyle}><ExpandableText text={campaign.additional_comments} /></span>
            </div>
          </div>
        )}
      </Card>

      {/* Leads card */}
      <Card
        title={`Leads (${leads.length})`}
        style={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
        styles={{ body: { padding: "24px 28px" } }}
      >
        <Row gutter={12} wrap align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Segmented
              value={qaFilter}
              onChange={(v) => setQaFilter(v as QaFilter)}
              options={[
                { label: `All (${qaAll})`, value: "all" },
                { label: `Qualified (${qaQualified})`, value: "qualified" },
                { label: `Disqualified (${qaDisqualified})`, value: "disqualified" },
                { label: `Rectified (${qaRectified})`, value: "rectified" },
                { label: `Pending (${qaPending})`, value: "pending" },
              ]}
            />
          </Col>
          <Col flex="auto" />
          <Col>
            <Input.Search
              placeholder="Search leads (name, company, email, phone, agent)…"
              allowClear
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              style={{ width: 300 }}
            />
          </Col>
          <Col>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={filteredLeads.length === 0}
            >
              Export
            </Button>
          </Col>
        </Row>

        <Typography.Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 12 }}>
          Click a lead row to edit. Showing {filteredLeads.length} of {leads.length} leads.
        </Typography.Text>

        <Table
          className="table-single-line"
          columns={leadColumns}
          dataSource={filteredLeads}
          rowKey="id"
          scroll={{ x: 2600 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} leads` }}
          locale={{ emptyText: "No leads found" }}
          size="middle"
          onRow={(record) => ({
            onClick: () => openEditLeadDrawer(record as Lead),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      {/* Edit Lead Drawer */}
      <Drawer
        title="Edit Lead"
        placement="right"
        width={LEAD_DRAWER_WIDTH}
        open={leadDrawerOpen}
        onClose={closeLeadDrawer}
        destroyOnClose={false}
        styles={{ body: LEAD_DRAWER_BODY_STYLE }}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Button
              icon={<LeftOutlined />}
              onClick={() => { const { prevLead } = getDrawerLeadContext(); if (prevLead) openEditLeadDrawer(prevLead); }}
              disabled={!getDrawerLeadContext().prevLead}
            >
              Previous
            </Button>
            <Space size="middle">
              <Button onClick={closeLeadDrawer}>Cancel</Button>
              <Button type="primary" icon={<SaveOutlined />} loading={savingDrawer} onClick={() => handleDrawerSave(false)}>
                Save
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={savingDrawer} onClick={() => handleDrawerSave(true)}>
                Save & Continue
              </Button>
            </Space>
          </div>
        }
      >
        <LeadDrawerContent
          form={form}
          mode="edit"
          lead={editingLead ?? undefined}
          canEditQaAudit={isMisOrAdmin}
        />
      </Drawer>
    </div>
  );
}
