"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Table,
  Tag,
  Button,
  Drawer,
  Form,
  Spin,
  Typography,
  message,
  Row,
  Col,
  Divider,
  Space,
  DatePicker,
  Input,
  Select,
  Modal,
  Upload,
  Dropdown,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  FileOutlined,
  DownloadOutlined,
  UploadOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { downloadAgentExcel } from "@/lib/leadsExport";
import { LeadDrawerContent, LEAD_DRAWER_WIDTH, LEAD_DRAWER_BODY_STYLE } from "@/components/Leads/LeadDrawerContent";
import { getLeadTableColumns } from "@/components/Leads/LeadTableColumns";
import { buildLeadPayload, leadToFormValues } from "@/lib/leadPayload";
import type { Lead } from "@/types/lead.types";
import { LEAD_TAGGING_OPTIONS } from "@/types/lead.types";
import { ExpandableText } from "@/components/ExpandableText";
import { parseLeadsCsv, parseLeadsExcel } from "@/lib/leadsImport";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  geography: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  lead_type: string | null;
  total_allocation: number | null;
  post_qa: number | null;
  achieved: number | null;
  pending_allocation: number | null;
  region: string | null;
  additional_comments: string | null;
  employee_size: string[] | null;
  abm: boolean | null;
  seniority: string | null;
  job_function: string | null;
  creatives_url: string[] | null;
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

export default function AgentCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const { hasRole, isInitialized } = useAuth();
  const canEditQaAudit = hasRole("qa") || hasRole("admin");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [files, setFiles] = useState<CampaignFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [updatingLead, setUpdatingLead] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form] = Form.useForm();
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadTaggingFilter, setLeadTaggingFilter] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedLeads, setParsedLeads] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      setLoading(false);
      return;
    }

    setIsOffline(false);
    setLoading(true);
    try {
      // Reuse TL campaign API for metadata (RLS ensures only assigned campaigns are visible)
      const [campaignRes, leadsRes] = await Promise.all([
        fetch(`/api/tl/campaigns/${id}`, { credentials: "include" }),
        fetch(`/api/agent/campaigns/${id}/leads`, { credentials: "include" }),
      ]);

      const campaignJson = await campaignRes.json();
      const leadsJson = await leadsRes.json();

      if (!campaignRes.ok) throw new Error(campaignJson.error || "Failed to load campaign");
      if (!leadsRes.ok) throw new Error(leadsJson.error || "Failed to load leads");

      setCampaign({
        id: campaignJson.campaign.id,
        name: campaignJson.campaign.name,
        description: campaignJson.campaign.description,
        industry: campaignJson.campaign.industry,
        geography: campaignJson.campaign.geography,
        status: campaignJson.campaign.status,
        start_date: campaignJson.campaign.start_date,
        end_date: campaignJson.campaign.end_date,
        lead_type: campaignJson.campaign.lead_type ?? null,
        total_allocation: campaignJson.campaign.total_allocation ?? null,
        post_qa: campaignJson.campaign.post_qa ?? null,
        achieved: campaignJson.campaign.achieved ?? null,
        pending_allocation: campaignJson.campaign.pending_allocation ?? null,
        region: campaignJson.campaign.region ?? null,
        additional_comments: campaignJson.campaign.additional_comments ?? null,
        employee_size: campaignJson.campaign.employee_size ?? null,
        abm: campaignJson.campaign.abm ?? null,
        seniority: campaignJson.campaign.seniority ?? null,
        job_function: campaignJson.campaign.job_function ?? null,
        creatives_url: campaignJson.campaign.creatives_url ?? null,
      });
      setLeads(leadsJson.leads ?? []);
      setFiles(campaignJson.files ?? []);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Failed to load campaign details"
      );
      router.replace("/agent/dashboard");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!id) {
      router.replace("/agent/dashboard");
      return;
    }
    if (!isInitialized) return;
    if (!hasRole("agent")) {
      router.replace("/login");
      return;
    }

    fetchData();
  }, [id, isInitialized, hasRole, router, fetchData]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchData();
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
  }, [fetchData]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const q = leadSearch.trim().toLowerCase();
      const matchesSearch = !q
        ? true
        : (l.lead_id ?? "").toLowerCase().includes(q) ||
          (l.name ?? "").toLowerCase().includes(q) ||
          (l.company_name ?? "").toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.phone ?? "").toLowerCase().includes(q) ||
          ([l.first_name, l.last_name].filter(Boolean).join(" ") ?? "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (leadTaggingFilter != null && leadTaggingFilter !== "") {
        if ((l.lead_tagging ?? "").trim() !== leadTaggingFilter) return false;
      }
      if (!dateRange?.[0] || !dateRange?.[1]) return true;
      const leadDate = dayjs(l.created_at).startOf("day");
      const start = dateRange[0].startOf("day");
      const end = dateRange[1].endOf("day");
      return !leadDate.isBefore(start) && !leadDate.isAfter(end);
    });
  }, [leads, leadSearch, dateRange, leadTaggingFilter]);

  const openLeadDrawer = () => {
    setDrawerMode("create");
    setEditingLead(null);
    form.resetFields();
    setLeadDrawerOpen(true);
  };

  const openEditLeadDrawer = (lead: Lead) => {
    setDrawerMode("edit");
    setEditingLead(lead);
    form.setFieldsValue(leadToFormValues(lead as unknown as Record<string, unknown>));
    setLeadDrawerOpen(true);
  };

  const closeLeadDrawer = () => {
    setLeadDrawerOpen(false);
    setEditingLead(null);
    form.resetFields();
  };

  const handleCreateLead = async () => {
    if (!id) return;
    try {
      const values = await form.validateFields();
      setCreatingLead(true);
      const payload = buildLeadPayload(values);
      const res = await fetch(`/api/agent/campaigns/${id}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create lead");

      message.success("Lead added. Add another below or close when done.");
      form.resetFields();

      const leadsRes = await fetch(`/api/agent/campaigns/${id}/leads`, {
        credentials: "include",
      });
      const leadsJson = await leadsRes.json();
      if (leadsRes.ok) setLeads(leadsJson.leads ?? []);
    } catch (err) {
      const isValidationError = err && typeof err === "object" && "errorFields" in err && Array.isArray((err as { errorFields?: unknown }).errorFields);
      if (isValidationError) {
        message.warning("Please fill all required fields");
      } else {
        message.error(err instanceof Error ? err.message : "Failed to create lead");
      }
    } finally {
      setCreatingLead(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!id || !editingLead) return;
    try {
      const values = await form.validateFields();
      setUpdatingLead(true);
      const payload = { ...buildLeadPayload(values), id: editingLead.id };
      const res = await fetch(`/api/agent/campaigns/${id}/leads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update lead");

      message.success("Lead updated.");

      const leadsRes = await fetch(`/api/agent/campaigns/${id}/leads`, {
        credentials: "include",
      });
      const leadsJson = await leadsRes.json();
      if (leadsRes.ok) setLeads(leadsJson.leads ?? []);
      closeLeadDrawer();
    } catch (err) {
      const isValidationError = err && typeof err === "object" && "errorFields" in err && Array.isArray((err as { errorFields?: unknown }).errorFields);
      if (isValidationError) {
        message.warning("Please fill all required fields");
      } else {
        message.error(err instanceof Error ? err.message : "Failed to update lead");
      }
    } finally {
      setUpdatingLead(false);
    }
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
    if (!id || parsedLeads.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/agent/campaigns/${id}/leads/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leads: parsedLeads }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      const created = data.created ?? 0;
      const total = data.total ?? created;
      message.success(`Imported ${created} of ${total} leads`);
      if (data.errors?.length) {
        message.warning(
          data.errors.slice(0, 3).join("; ") +
            (data.errors.length > 3 ? "..." : "")
        );
      }
      setUploadModalOpen(false);
      setUploadFile(null);
      setParsedLeads([]);

      const leadsRes = await fetch(`/api/agent/campaigns/${id}/leads`, {
        credentials: "include",
      });
      const leadsJson = await leadsRes.json();
      if (leadsRes.ok) setLeads(leadsJson.leads ?? []);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadAgentFormat = () => {
    const toExport = filteredLeads.length > 0 ? filteredLeads : leads;
    downloadAgentExcel(
      toExport,
      `agent-leads-format-${
        campaign?.name?.replace(/\s+/g, "-") ?? "export"
      }-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    if (toExport.length === 0) {
      message.success("Downloaded blank Excel format template");
    } else {
      message.success(
        `Downloaded Excel format with ${toExport.length} leads`
      );
    }
  };

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

  if (!campaign) {
    return null;
  }

  const statusColors: Record<string, string> = {
    new: "default",
    contacted: "processing",
    interested: "green",
    followup: "gold",
    closed_won: "blue",
    closed_lost: "red",
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
          href="/agent/dashboard"
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
            <Typography.Title level={3} style={{ margin: 0, marginBottom: 8, fontWeight: 600 }}>
              {campaign.name}
            </Typography.Title>
            <Space size="small" wrap>
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openLeadDrawer}>
              Add Lead
            </Button>
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
            {(campaign.description || campaign.additional_comments) && (
              <div style={{ marginBottom: 20 }}>
                {campaign.description && <OverviewRow label="Description" value={campaign.description} />}
                {campaign.additional_comments && (
                  <div style={overviewRowStyle}>
                    <span style={overviewLabelStyle}>Additional Comments</span>
                    <span style={overviewValueStyle}>
                      <ExpandableText text={campaign.additional_comments} />
                    </span>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0 32px" }}>
              <div>
                <OverviewRowOrEmpty label="Lead Type" value={campaign.lead_type} />
                <OverviewRowOrEmpty label="Start Date" value={campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : null} />
                <OverviewRowOrEmpty label="End Date" value={campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : null} />
                <OverviewRowOrEmpty label="Region" value={campaign.region} />
                <OverviewRowOrEmpty label="Total Allocation" value={campaign.total_allocation} />
              </div>
              <div>
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
        </Col>
      </Row>

      <Card
        title={`Leads (${filteredLeads.length}${
          filteredLeads.length !== leads.length ? ` of ${leads.length}` : ""
        })`}
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openLeadDrawer}>
              Add Lead
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                const toExport = filteredLeads.length > 0 ? filteredLeads : leads;
                if (toExport.length === 0) message.warning("No leads to export");
                else {
                  downloadAgentExcel(
                    toExport,
                    `leads-${
                      campaign?.name?.replace(/\s+/g, "-") ?? "export"
                    }-${new Date().toISOString().slice(0, 10)}.xlsx`
                  );
                  message.success(`Exported ${toExport.length} leads`);
                }
              }}
              disabled={leads.length === 0}
            >
              Export
            </Button>
            <Dropdown
              trigger={["hover"]}
              menu={{
                items: [
                  {
                    key: "download-format",
                    label: "Download Excel format",
                  },
                ],
                onClick: ({ key }) => {
                  if (key === "download-format") {
                    handleDownloadAgentFormat();
                  }
                },
              }}
            >
              <Button
                icon={<UploadOutlined />}
                onClick={() => {
                  setUploadModalOpen(true);
                  setUploadFile(null);
                  setParsedLeads([]);
                }}
              >
                Upload
              </Button>
            </Dropdown>
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
            <Col>
              <Typography.Text type="secondary" style={{ marginRight: 8 }}>Lead Tagging:</Typography.Text>
            </Col>
            <Col>
              <Select
                placeholder="All"
                allowClear
                style={{ width: 180 }}
                value={leadTaggingFilter ?? undefined}
                options={LEAD_TAGGING_OPTIONS}
                onChange={(v) => setLeadTaggingFilter(v ?? null)}
              />
            </Col>
            <Col flex="auto" style={{ minWidth: 200 }}>
              <Input.Search
                placeholder="Search leads (Lead ID, name, company, email, phone)..."
                allowClear
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                style={{ width: "100%", maxWidth: 320 }}
              />
            </Col>
          </Row>
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 12 }}>
          {filteredLeads.length !== leads.length
            ? `Showing ${filteredLeads.length} of ${leads.length} leads. Click a row to edit.`
            : "Click a row to edit."}
        </Typography.Text>
        <Table
          className="table-single-line"
          columns={leadColumns}
          dataSource={filteredLeads}
          rowKey="id"
          scroll={{ x: 2600 }}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} leads` }}
          locale={{ emptyText: leadSearch || dateRange?.[0] || dateRange?.[1] || leadTaggingFilter ? "No leads match the filter." : "No leads yet. Use 'Add Lead' to create one." }}
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
        onCancel={() => {
          setUploadModalOpen(false);
          setUploadFile(null);
          setParsedLeads([]);
        }}
        onOk={handleImport}
        okText={
          parsedLeads.length > 0
            ? `Import ${parsedLeads.length} leads`
            : "Import"
        }
        okButtonProps={{ disabled: parsedLeads.length === 0, loading: importing }}
        cancelButtonProps={{ disabled: importing }}
        width={520}
      >
        <Typography.Paragraph type="secondary">
          You can either{" "}
          <Typography.Link
            onClick={() => {
              const toExport =
                filteredLeads.length > 0 ? filteredLeads : leads;
              downloadAgentExcel(
                toExport,
                `agent-leads-format-${
                  campaign?.name?.replace(/\s+/g, "-") ?? "export"
                }-${new Date().toISOString().slice(0, 10)}.xlsx`
              );
              if (toExport.length === 0) {
                message.success("Downloaded blank Excel format template");
              } else {
                message.success(
                  `Downloaded Excel format with ${toExport.length} leads`
                );
              }
            }}
          >
            download the Excel format
          </Typography.Link>{" "}
          (Lead ID, QA fields, and Created By are hidden and managed by the
          system) or upload your own CSV/Excel with matching columns.
        </Typography.Paragraph>
        <Upload.Dragger
          accept=".csv,.xlsx,.xls"
          multiple={false}
          beforeUpload={(file) => {
            handleUploadFile(file);
            return false;
          }}
          fileList={
            uploadFile
              ? [{ uid: "1", name: uploadFile.name, status: "done" }]
              : []
          }
          onRemove={() => {
            setUploadFile(null);
            setParsedLeads([]);
          }}
          maxCount={1}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: "#1677ff" }} />
          </p>
          <p className="ant-upload-text">
            Click or drag CSV or Excel file here
          </p>
          <p className="ant-upload-hint">
            Excel format hides Lead ID, QA fields, and Created By. These will be
            generated and validated automatically after upload.
          </p>
        </Upload.Dragger>
        {parsedLeads.length > 0 && (
          <Typography.Text
            style={{ display: "block", marginTop: 12, color: "#52c41a" }}
          >
            {parsedLeads.length} leads parsed and ready to import
          </Typography.Text>
        )}
      </Modal>

      <Drawer
        title={drawerMode === "edit" ? "Edit Lead" : "Add Lead"}
        placement="right"
        width={LEAD_DRAWER_WIDTH}
        open={leadDrawerOpen}
        onClose={closeLeadDrawer}
        destroyOnClose
        styles={{ body: LEAD_DRAWER_BODY_STYLE }}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Button onClick={closeLeadDrawer}>
              {drawerMode === "edit" ? "Cancel" : "Done"}
            </Button>
            {drawerMode === "edit" ? (
              <Button
                type="primary"
                loading={updatingLead}
                onClick={handleUpdateLead}
              >
                Save Changes
              </Button>
            ) : (
              <Button
                type="primary"
                loading={creatingLead}
                onClick={handleCreateLead}
                icon={<PlusOutlined />}
              >
                Create Lead
              </Button>
            )}
          </div>
        }
      >
        <LeadDrawerContent
          form={form}
          mode={drawerMode}
          lead={editingLead ?? undefined}
          canEditQaAudit={canEditQaAudit}
          introText={
            drawerMode === "create"
              ? "Add a new lead to this campaign. After saving, the form will reset so you can add another. Close when finished."
              : undefined
          }
        />
      </Drawer>
    </div>
  );
}

