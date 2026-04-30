"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Button,
  Table,
  Tag,
  Modal,
  Transfer,
  Input,
  message,
  Spin,
  Typography,
  Empty,
  Row,
  Col,
  Divider,
  Space,
  Drawer,
  Form,
  Upload,
  DatePicker,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  ArrowLeftOutlined,
  UserAddOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  TeamOutlined,
  FileOutlined,
  DownloadOutlined,
  UploadOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { downloadExcel } from "@/lib/leadsExport";
import { parseLeadsCsv, parseLeadsExcel } from "@/lib/leadsImport";
import { getLeadTableColumns } from "@/components/Leads/LeadTableColumns";
import { LeadDrawerContent, LEAD_DRAWER_WIDTH, LEAD_DRAWER_BODY_STYLE } from "@/components/Leads/LeadDrawerContent";
import { buildLeadPayload, leadToFormValues } from "@/lib/leadPayload";
import type { Lead } from "@/types/lead.types";
import { ExpandableText } from "@/components/ExpandableText";

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

type Agent = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CampaignFile = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  download_url: string | null;
};

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;
  const { hasRole, isInitialized } = useAuth();
  const canEditQaAudit = hasRole("qa") || hasRole("admin");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assignments, setAssignments] = useState<{ agent_id: string; agent_name?: string }[]>([]);
  const [files, setFiles] = useState<CampaignFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [updatingLead, setUpdatingLead] = useState(false);
  const [form] = Form.useForm();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedLeads, setParsedLeads] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const fetchCampaign = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tl/campaigns/${id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCampaign(data.campaign);
      setLeads(data.leads ?? []);
      setAssignments(data.assignments ?? []);
      setFiles(data.files ?? []);
      setCampaignId(id);
    } catch {
      message.error("Failed to load campaign");
      router.replace("/tl/dashboard");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!id) {
      router.replace("/tl/dashboard");
      return;
    }
    if (!isInitialized) return;
    if (!hasRole("team_leader") && !hasRole("tl")) {
      router.replace("/login");
      return;
    }
    fetchCampaign(id);
  }, [id, isInitialized, hasRole, router, fetchCampaign]);

  useEffect(() => {
    if (searchParams.get("assign") === "1" && campaignId) {
      setAssignModalOpen(true);
    }
  }, [searchParams, campaignId]);

  useEffect(() => {
    if (assignModalOpen) {
      setSelectedAgentIds(assignments.map((a) => a.agent_id));
      setAgentsLoading(true);
      fetch("/api/tl/agents", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          setAgents(data.agents ?? []);
          if (data.error) message.warning(data.error);
        })
        .catch(() => message.error("Failed to load agents"))
        .finally(() => setAgentsLoading(false));
    }
  }, [assignModalOpen, assignments]);

  const openAssignModal = () => setAssignModalOpen(true);

  const transferData = useMemo(
    () =>
      agents.map((a) => ({
        key: a.id,
        title: a.full_name || a.email || "Unknown",
        description: a.email || "",
      })),
    [agents]
  );

  const handleAssign = async () => {
    if (!campaignId) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/tl/campaigns/${campaignId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agent_ids: selectedAgentIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign");
      message.success("Agents assigned");
      setAssignModalOpen(false);
      fetchCampaign(campaignId);
    } catch {
      message.error("Failed to assign agents");
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!campaignId) return;
    try {
      const res = await fetch(`/api/tl/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      message.success("Campaign updated");
      fetchCampaign(campaignId);
    } catch {
      message.error("Failed to update campaign");
    }
  };

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

  const handleUpdateLead = async () => {
    if (!campaignId || !editingLead) return;
    try {
      const values = await form.validateFields();
      setUpdatingLead(true);
      const payload = { ...buildLeadPayload(values), id: editingLead.id };
      const res = await fetch(`/api/tl/campaigns/${campaignId}/leads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update lead");
      message.success("Lead updated");
      fetchCampaign(campaignId);
      closeLeadDrawer();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update lead");
    } finally {
      setUpdatingLead(false);
    }
  };

  const handleExport = () => {
    if (leads.length === 0) {
      message.warning("No leads to export");
      return;
    }
    downloadExcel(
      leads,
      `leads-${campaign?.name?.replace(/\s+/g, "-") ?? "export"}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    message.success(`Exported ${leads.length} leads`);
  };

  const handleUploadFile = (file: File) => {
    const name = file.name.toLowerCase();
    const isCsv = name.endsWith(".csv");
    const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!isCsv && !isExcel) {
      message.error("Please upload a CSV or Excel (.xlsx) file");
      return false;
    }
    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = (e.target?.result as string) ?? "";
          const leads = parseLeadsCsv(text);
          setParsedLeads(leads);
          setUploadFile(file);
        } catch {
          message.error("Failed to parse CSV");
        }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer) {
            message.error("Failed to read file");
            return;
          }
          const leads = parseLeadsExcel(buffer);
          setParsedLeads(leads);
          setUploadFile(file);
        } catch {
          message.error("Failed to parse Excel file");
        }
      };
      reader.readAsArrayBuffer(file);
    }
    return false;
  };

  const handleImport = async () => {
    if (!campaignId || parsedLeads.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/tl/campaigns/${campaignId}/leads/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leads: parsedLeads }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      const created = data.created ?? 0;
      const updated = data.updated ?? 0;
      const total = data.total ?? created + updated;
      message.success(`Processed ${total} leads (${created} new, ${updated} updated)`);
      if (data.errors?.length) {
        message.warning(data.errors.slice(0, 3).join("; ") + (data.errors.length > 3 ? "..." : ""));
      }
      setUploadModalOpen(false);
      setUploadFile(null);
      setParsedLeads([]);
      fetchCampaign(campaignId);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const filteredLeads = leads.filter((l) => {
    const matchesSearch = !leadSearch.trim()
      ? true
      : (l.name ?? "").toLowerCase().includes(leadSearch.trim().toLowerCase()) ||
        (l.company_name ?? "").toLowerCase().includes(leadSearch.trim().toLowerCase()) ||
        (l.email ?? "").toLowerCase().includes(leadSearch.trim().toLowerCase()) ||
        (l.phone ?? "").toLowerCase().includes(leadSearch.trim().toLowerCase()) ||
        ([l.first_name, l.last_name].filter(Boolean).join(" ") ?? "").toLowerCase().includes(leadSearch.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (!dateRange || !dateRange[0] || !dateRange[1]) return true;
    const leadDate = dayjs(l.created_at).startOf("day");
    const start = dateRange[0].startOf("day");
    const end = dateRange[1].endOf("day");
    return !leadDate.isBefore(start) && !leadDate.isAfter(end);
  });

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spin size="large" />
      </div>
    );
  }

  if (loading && !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spin size="large" />
      </div>
    );
  }

  if (!campaign) return null;

  const statusColors: Record<string, string> = {
    draft: "default",
    active: "green",
    paused: "orange",
    completed: "blue",
  };

  const leadColumns = getLeadTableColumns({
    showActions: true,
    onEdit: openEditLeadDrawer,
  });

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

  const OverviewRow = ({ label, value }: { label: string; value: React.ReactNode }) => {
    if (value == null || value === "") return null;
    return (
      <div style={overviewRowStyle}>
        <span style={overviewLabelStyle}>{label}</span>
        <span style={overviewValueStyle}>{value}</span>
      </div>
    );
  };
  const OverviewRowOrEmpty = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={overviewRowStyle}>
      <span style={overviewLabelStyle}>{label}</span>
      <span style={overviewValueStyle}>{value ?? "—"}</span>
    </div>
  );

  return (
    <div style={{ width: "100%", padding: "0 24px 32px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/tl/dashboard"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#1677ff", textDecoration: "none", marginBottom: 16 }}
        >
          <ArrowLeftOutlined /> Back to Dashboard
        </Link>
      </div>

      <Card
        style={{ marginBottom: 24, borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
        bodyStyle={{ padding: "24px 28px" }}
      >
        <Row gutter={24} align="middle" justify="space-between" wrap>
          <Col flex="1" style={{ minWidth: 0 }}>
            <Typography.Title level={3} style={{ margin: 0, marginBottom: 6, fontWeight: 600 }}>
              {campaign.name}
            </Typography.Title>
            <Space size="small" wrap>
              {campaign.campaign_id && <Tag style={{ fontFamily: "monospace", fontSize: 12, margin: 0 }}>{campaign.campaign_id}</Tag>}
              <Tag color={statusColors[campaign.status] ?? "default"} style={{ textTransform: "capitalize", margin: 0 }}>
                {campaign.status}
              </Tag>
              {campaign.lead_type && <Tag style={{ margin: 0 }}>{campaign.lead_type}</Tag>}
              {(campaign.industry || campaign.geography) && (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {[campaign.industry, campaign.geography].filter(Boolean).join(" · ")}
                </Typography.Text>
              )}
            </Space>
          </Col>
          <Col>
            <Space size="small" wrap>
              <Button icon={<UserAddOutlined />} onClick={openAssignModal}>
                Assign Agents
              </Button>
              {(campaign.status === "draft" || campaign.status === "paused") && (
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStatusChange("active")}>
                  Activate
                </Button>
              )}
              {campaign.status === "active" && (
                <Button icon={<PauseCircleOutlined />} onClick={() => handleStatusChange("paused")}>
                  Pause
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={24}>
        <Col xs={24} lg={14}>
          <Card
            title="Overview"
            style={{ marginBottom: 24, borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
            bodyStyle={{ padding: "24px 28px" }}
          >
            {(campaign.description || campaign.target_designation) && (
              <div style={{ marginBottom: 20 }}>
                {campaign.description && <OverviewRow label="Description" value={campaign.description} />}
                {campaign.target_designation && <OverviewRow label="Target Designation" value={campaign.target_designation} />}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0 32px" }}>
              <div>
                <OverviewRowOrEmpty label="Lead Type" value={campaign.lead_type} />
                <OverviewRowOrEmpty label="Start Date" value={campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : null} />
                <OverviewRowOrEmpty label="End Date" value={campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : null} />
                <OverviewRowOrEmpty label="Region" value={campaign.region} />
                <OverviewRowOrEmpty label="Assigned Team Leader" value={campaign.assigned_team_leader_name} />
                <OverviewRowOrEmpty label="Weekly Call" value={campaign.weekly_call} />
                <OverviewRowOrEmpty label="Weekly Report" value={campaign.weekly_report} />
              </div>
              <div>
                <OverviewRowOrEmpty label="Total Allocation" value={campaign.total_allocation} />
                <OverviewRowOrEmpty label="Post QA" value={campaign.post_qa} />
                <OverviewRowOrEmpty label="Achieved" value={campaign.achieved} />
                <OverviewRowOrEmpty label="Pending Allocation" value={campaign.pending_allocation} />
              </div>
            </div>
            {(campaign.employee_size?.length || campaign.industry || campaign.abm != null || campaign.seniority || campaign.job_function || campaign.creatives_url?.length) ? (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #f0f0f0" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#595959", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Targeting</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0 32px" }}>
                  <div>
                    <OverviewRowOrEmpty label="Employee Size" value={campaign.employee_size?.length ? campaign.employee_size.join(", ") : null} />
                    <OverviewRowOrEmpty label="Industry" value={campaign.industry} />
                    <OverviewRowOrEmpty label="ABM" value={campaign.abm === true ? "Yes" : campaign.abm === false ? "No" : null} />
                  </div>
                  <div>
                    <OverviewRowOrEmpty label="Seniority" value={campaign.seniority} />
                    <OverviewRowOrEmpty label="Job Function" value={campaign.job_function} />
                    {campaign.creatives_url?.length ? (
                      <div style={overviewRowStyle}>
                        <span style={overviewLabelStyle}>Creatives URL</span>
                        <span style={{ ...overviewValueStyle, minWidth: 0, overflow: "hidden" }}>
                          {campaign.creatives_url.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={url}
                              style={{
                                display: "block",
                                marginBottom: 4,
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: "#1677ff",
                              }}
                            >
                              {url}
                            </a>
                          ))}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            {campaign.additional_comments ? (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #f0f0f0" }}>
                <div style={overviewRowStyle}>
                  <span style={overviewLabelStyle}>Additional Comments</span>
                  <span style={overviewValueStyle}>
                    <ExpandableText text={campaign.additional_comments} />
                  </span>
                </div>
              </div>
            ) : null}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <FileOutlined />
                <span>Files</span>
                <Tag style={{ marginLeft: 4 }}>{files.length}</Tag>
              </Space>
            }
            style={{ marginBottom: 24, borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
            bodyStyle={{ padding: "24px 28px" }}
          >
            {files.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "#8c8c8c", fontSize: 14 }}>
                <FileOutlined style={{ fontSize: 40, marginBottom: 12, display: "block", color: "#d9d9d9" }} />
                No files uploaded for this campaign.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {files.map((f, idx) => (
                  <div
                    key={f.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderBottom: idx < files.length - 1 ? "1px solid #f5f5f5" : "none",
                      gap: 12,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      <FileOutlined style={{ color: "#8c8c8c", flexShrink: 0 }} />
                      <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</span>
                      {f.file_size != null && (
                        <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                          {(f.file_size / 1024).toFixed(1)} KB
                        </Typography.Text>
                      )}
                    </span>
                    {f.download_url && (
                      <Button type="link" size="small" icon={<DownloadOutlined />} href={f.download_url} target="_blank" rel="noopener noreferrer" style={{ padding: "0 4px", flexShrink: 0 }}>
                        Download
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title={
              <span>
                <TeamOutlined style={{ marginRight: 8 }} />
                Assigned Agents ({assignments.length})
              </span>
            }
            extra={
              <Button type="link" icon={<UserAddOutlined />} onClick={openAssignModal} style={{ padding: 0 }}>
                {assignments.length > 0 ? "Edit" : "Assign"}
              </Button>
            }
            style={{ marginBottom: 24, borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
            bodyStyle={{ padding: "24px 28px" }}
          >
            {assignments.length === 0 ? (
              <p style={{ color: "#8c8c8c", margin: 0 }}>
                No agents assigned.{" "}
                <Button type="link" onClick={openAssignModal} style={{ padding: 0 }}>
                  Assign agents
                </Button>
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {assignments.map((a) => (
                  <Tag key={a.agent_id} color="blue">
                    {a.agent_name ?? a.agent_id}
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={`Leads (${leads.length})`}
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={leads.length === 0}>
              Export
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => { setUploadModalOpen(true); setUploadFile(null); setParsedLeads([]); }}>
              Upload
            </Button>
          </Space>
        }
        style={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
        bodyStyle={{ padding: "24px 28px" }}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%", marginBottom: 16 }}>
          <Row gutter={12} wrap align="middle">
            <Col>
              <Typography.Text type="secondary" style={{ marginRight: 8 }}>Date range (created):</Typography.Text>
            </Col>
            <Col>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
                allowClear
                style={{ width: 260 }}
              />
            </Col>
            <Col>
              <Button
                size="middle"
                onClick={() => setDateRange(null)}
                disabled={!dateRange?.[0] && !dateRange?.[1]}
              >
                Clear dates
              </Button>
            </Col>
            <Col flex="auto" style={{ minWidth: 200 }}>
              <Input.Search
                placeholder="Search leads (name, company, email, phone)..."
                allowClear
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                style={{ width: "100%", maxWidth: 280 }}
              />
            </Col>
          </Row>
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 12 }}>
          Showing {filteredLeads.length} of {leads.length} leads. Click a row to edit.
        </Typography.Text>
        <Table
          className="table-single-line"
          columns={leadColumns}
          dataSource={filteredLeads}
          rowKey="id"
          scroll={{ x: 2600 }}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} leads` }}
          locale={{ emptyText: "No leads yet" }}
          size="middle"
          onRow={(record) => ({
            onClick: () => openEditLeadDrawer(record as Lead),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      <Modal
        title="Upload Leads (CSV or Excel)"
        open={uploadModalOpen}
        onCancel={() => { setUploadModalOpen(false); setUploadFile(null); setParsedLeads([]); }}
        onOk={handleImport}
        okText={parsedLeads.length > 0 ? `Import ${parsedLeads.length} leads` : "Import"}
        okButtonProps={{ disabled: parsedLeads.length === 0, loading: importing }}
        cancelButtonProps={{ disabled: importing }}
        width={520}
      >
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          Upload a CSV or Excel (.xlsx) file. Include the <strong>id</strong> column to update existing leads; rows without id will be created as new.
        </Typography.Text>
        <Upload.Dragger
          accept=".csv,.xlsx,.xls"
          multiple={false}
          beforeUpload={(file) => { handleUploadFile(file); return false; }}
          fileList={uploadFile ? [{ uid: "1", name: uploadFile.name, status: "done" }] : []}
          onRemove={() => { setUploadFile(null); setParsedLeads([]); }}
          maxCount={1}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: "#1677ff" }} />
          </p>
          <p className="ant-upload-text">Click or drag CSV or Excel file here</p>
          <p className="ant-upload-hint">Export as Excel from this page, edit, then re-upload to update by id. Or use CSV with First Name, Last Name, Company, Email, Phone, etc.</p>
        </Upload.Dragger>
        {parsedLeads.length > 0 && (
          <Typography.Text style={{ display: "block", marginTop: 12, color: "#52c41a" }}>
            {parsedLeads.length} leads parsed and ready to import
          </Typography.Text>
        )}
      </Modal>

      <Modal
        title={
          <span>
            <TeamOutlined style={{ marginRight: 8 }} />
            Assign Agents to Campaign
          </span>
        }
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        onOk={handleAssign}
        confirmLoading={assigning}
        okText={selectedAgentIds.length > 0 ? `Assign ${selectedAgentIds.length} agent${selectedAgentIds.length === 1 ? "" : "s"}` : "Save (no agents)"}
        width={560}
      >
        <p style={{ marginBottom: 16, color: "#595959" }}>
          Move agents between lists to assign or unassign them from this campaign. Assigned agents can view and manage leads.
        </p>
        {agentsLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Spin size="large" tip="Loading agents..." />
          </div>
        ) : agents.length === 0 ? (
          <Empty
            image={<TeamOutlined style={{ fontSize: 48, color: "#d9d9d9" }} />}
            description={
              <div>
                <p style={{ marginBottom: 8 }}>No agents in your organization.</p>
                <p style={{ fontSize: 13, color: "#8c8c8c", marginBottom: 16 }}>
                  Create Agent users from the Team → Users page, then assign them here.
                </p>
                <Button type="primary" onClick={() => { setAssignModalOpen(false); router.push("/tl/users"); }}>
                  Go to Users
                </Button>
              </div>
            }
          />
        ) : (
          <Transfer
            dataSource={transferData}
            titles={["Available", "Assigned"]}
            targetKeys={selectedAgentIds}
            onChange={(targetKeys) => setSelectedAgentIds(targetKeys.map(String))}
            render={(item) => (
              <span>
                <strong>{item.title}</strong>
                {item.description && <span style={{ color: "#8c8c8c", marginLeft: 8 }}>({item.description})</span>}
              </span>
            )}
            showSearch
            filterOption={(inputValue, item) =>
              (item.title?.toLowerCase() ?? "").includes(inputValue.toLowerCase()) ||
              (item.description?.toLowerCase() ?? "").includes(inputValue.toLowerCase())
            }
            listStyle={{ width: 240, height: 320 }}
            oneWay={false}
            pagination
          />
        )}
      </Modal>

      <Drawer
        title="Edit Lead"
        placement="right"
        width={LEAD_DRAWER_WIDTH}
        open={leadDrawerOpen}
        onClose={closeLeadDrawer}
        destroyOnClose
        styles={{ body: LEAD_DRAWER_BODY_STYLE }}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Button onClick={closeLeadDrawer}>Cancel</Button>
            <Button type="primary" loading={updatingLead} onClick={handleUpdateLead}>
              Save Changes
            </Button>
          </div>
        }
      >
        <LeadDrawerContent
          form={form}
          mode="edit"
          lead={editingLead ?? undefined}
          canEditQaAudit={canEditQaAudit}
        />
      </Drawer>
    </div>
  );
}
