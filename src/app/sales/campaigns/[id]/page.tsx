"use client";

import React, { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  InputNumber,
  message,
  Spin,
  Typography,
  Popconfirm,
  Row,
  Col,
  Divider,
  Space,
  Upload,
} from "antd";
import type { UploadFile } from "antd";
import {
  ArrowLeftOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  FileOutlined,
  DownloadOutlined,
  InboxOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { ExpandableText } from "@/components/ExpandableText";

const { TextArea } = Input;
const { Dragger } = Upload;

const EMPLOYEE_SIZE_OPTIONS = [
  { value: "2-11", label: "2-11" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "200-500", label: "200-500" },
  { value: "500-1000", label: "500-1000" },
  { value: "1000-5000", label: "1000-5000" },
  { value: "5000-10000", label: "5000-10000" },
  { value: "10000+", label: "10000+" },
  { value: "All Emp", label: "All Emp" },
];

const ACCEPT_FILE_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.gif,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,image/*";

type Campaign = {
  id: string;
  campaign_id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  industry: string | null;
  geography: string | null;
  target_designation: string | null;
  lead_type: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  cpl: number | null;
  revenue: number | null;
  booked: number | null;
  total_allocation: number | null;
  post_qa: number | null;
  achieved: number | null;
  pending_allocation: number | null;
  region: string | null;
  weekly_call: string | null;
  weekly_report: string | null;
  additional_comments: string | null;
  assigned_team_leader_id: string | null;
  employee_size: string[] | null;
  abm: boolean | null;
  seniority: string | null;
  job_function: string | null;
  creatives_url: string[] | null;
};

type Lead = {
  id: string;
  name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  status: string;
  followup_date: string | null;
  notes: string | null;
  assigned_agent_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assigned_agent_name: string | null;
  created_by_name: string | null;
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

export default function SalesCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;
  const { hasRole, isInitialized } = useAuth();
  const hasSalesAccess =
    hasRole("sales") || hasRole("sales_manager") || hasRole("admin");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [files, setFiles] = useState<CampaignFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const [removingFileId, setRemovingFileId] = useState<string | null>(null);
  const [leadTypeOptions, setLeadTypeOptions] = useState([
    { value: "AG", label: "AG" },
    { value: "CD", label: "CD" },
    { value: "CDQA", label: "CDQA" },
    { value: "Double Touch - Whitepaper", label: "Double Touch - Whitepaper" },
    { value: "HQL / BANT", label: "HQL / BANT" },
    { value: "Tele", label: "Tele" },
    { value: "Webinar", label: "Webinar" },
    { value: "Whitepaper", label: "Whitepaper" },
  ]);
  const [teamLeaders, setTeamLeaders] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    if (id && hasSalesAccess) {
      fetch("/api/tl/team-leaders", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) return;
          setTeamLeaders(data.team_leaders ?? []);
        })
        .catch(() => {});
    }
  }, [id, hasSalesAccess]);

  const fetchCampaign = useCallback(async (campaignId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tl/campaigns/${campaignId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCampaign(data.campaign);
      setLeads(data.leads ?? []);
      setFiles(data.files ?? []);
    } catch {
      message.error("Failed to load campaign");
      router.replace("/sales/campaigns");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!id) {
      router.replace("/sales/campaigns");
      return;
    }
    if (!isInitialized) return;
    if (!hasSalesAccess) {
      router.replace("/login");
      return;
    }
    fetchCampaign(id);
  }, [id, isInitialized, hasSalesAccess, router, fetchCampaign]);

  useEffect(() => {
    if (searchParams.get("edit") === "1" && campaign) {
      setEditModalOpen(true);
    }
  }, [searchParams, campaign]);

  useEffect(() => {
    if (campaign && editModalOpen) {
      const leadTypesArray =
        typeof campaign.lead_type === "string"
          ? campaign.lead_type
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : [];

      if (leadTypesArray.length) {
        setLeadTypeOptions((prev) => {
          const existing = new Set(prev.map((o) => o.value));
          const extras = leadTypesArray
            .filter((v) => v && !existing.has(v))
            .map((v) => ({ value: v, label: v }));
          return extras.length ? [...prev, ...extras] : prev;
        });
      }

      form.setFieldsValue({
        client_name: campaign.client_name ?? "",
        name: campaign.name,
        lead_type: leadTypesArray.length ? leadTypesArray : undefined,
        description: campaign.description ?? "",
        industry: campaign.industry ?? "",
        geography: campaign.geography ?? "",
        target_designation: campaign.target_designation ?? "",
        start_date: campaign.start_date ? dayjs(campaign.start_date) : null,
        end_date: campaign.end_date ? dayjs(campaign.end_date) : null,
        status: campaign.status,
        cpl: campaign.cpl,
        revenue: campaign.revenue,
        booked: campaign.booked,
        total_allocation: campaign.total_allocation,
        post_qa: campaign.post_qa,
        achieved: campaign.achieved,
        pending_allocation: campaign.pending_allocation,
        region: campaign.region ?? "",
        weekly_call: campaign.weekly_call ?? "",
        weekly_report: campaign.weekly_report ?? "",
        additional_comments: campaign.additional_comments ?? "",
        assigned_team_leader_id: campaign.assigned_team_leader_id ?? undefined,
        employee_size: campaign.employee_size ?? undefined,
        abm: campaign.abm,
        seniority: campaign.seniority ?? "",
        job_function: campaign.job_function ?? "",
        creatives_url: campaign.creatives_url?.length ? campaign.creatives_url : undefined,
      });
    }
  }, [campaign, editModalOpen, form, id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/tl/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      message.success("Campaign updated");
      fetchCampaign(id);
    } catch {
      message.error("Failed to update campaign");
    }
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    try {
      const values = await form.validateFields();
      setSaving(true);

      const leadTypeValue = Array.isArray(values.lead_type)
        ? values.lead_type.join(", ")
        : values.lead_type;

      const res = await fetch(`/api/tl/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          client_name: values.client_name || null,
          name: values.name,
          lead_type: leadTypeValue || null,
          description: values.description || null,
          industry: values.industry || null,
          geography: values.geography || null,
          target_designation: values.target_designation || null,
          start_date: values.start_date?.format?.("YYYY-MM-DD") ?? null,
          end_date: values.end_date?.format?.("YYYY-MM-DD") ?? null,
          status: values.status,
          cpl: values.cpl,
          revenue: values.revenue,
          booked: values.booked,
          total_allocation: values.total_allocation,
          post_qa: values.post_qa,
          achieved: values.achieved,
          pending_allocation: values.pending_allocation,
          region: values.region || null,
          weekly_call: values.weekly_call || null,
          weekly_report: values.weekly_report || null,
          additional_comments: values.additional_comments || null,
          assigned_team_leader_id: values.assigned_team_leader_id || null,
          employee_size: values.employee_size,
          abm: values.abm,
          seniority: values.seniority?.trim() || null,
          job_function: values.job_function?.trim() || null,
          creatives_url: values.creatives_url?.filter((u: string) => u?.trim()) || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      const filesToUpload = uploadFileList.filter((f) => f.originFileObj);
      if (filesToUpload.length > 0) {
        const formData = new FormData();
        filesToUpload.forEach((f) => {
          if (f.originFileObj) formData.append("files", f.originFileObj);
        });
        const uploadRes = await fetch(`/api/tl/campaigns/${id}/files`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          message.warning(uploadData.error || "Campaign saved but some files failed to upload.");
        } else if (uploadData.errors?.length) {
          message.warning(`Campaign saved. ${uploadData.errors.join(" ")}`);
        }
      }

      message.success("Campaign updated");
      setUploadFileList([]);
      form.resetFields();
      setEditModalOpen(false);
      fetchCampaign(id);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update campaign");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
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
      router.replace("/sales/campaigns");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to delete campaign");
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    if (!id) return;
    setRemovingFileId(fileId);
    try {
      const res = await fetch(`/api/tl/campaigns/${id}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove file");
      }
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      message.success("File removed");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to remove file");
    } finally {
      setRemovingFileId(null);
    }
  };

  const handleCloseEditModal = () => {
    form.resetFields();
    setUploadFileList([]);
    setEditModalOpen(false);
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

  if (!campaign) return null;

  const statusColors: Record<string, string> = {
    draft: "default",
    active: "green",
    paused: "orange",
    completed: "blue",
  };

  const leadColumns = [
    {
      title: "Sr. No.",
      key: "sr",
      width: 72,
      fixed: "left" as const,
      render: (_: unknown, __: Lead, index: number) => index + 1,
    },
    {
      title: "Lead ID",
      dataIndex: "lead_id",
      key: "lead_id",
      width: 160,
      fixed: "left" as const,
      render: (v: string | null) => {
        const id = v || "";
        if (!id) return "—";
        const copy = (e: React.MouseEvent) => {
          e.stopPropagation();
          navigator.clipboard.writeText(id).then(
            () => message.success("Lead ID copied"),
            () => message.error("Failed to copy")
          );
        };
        return (
          <span
            className="lead-id-cell"
            style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", minWidth: 0 }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {id}
            </span>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined style={{ fontSize: 12 }} />}
              onClick={copy}
              className="lead-id-copy-btn"
              style={{ padding: "0 4px", minWidth: 24, height: 22, flexShrink: 0 }}
              title="Copy Lead ID"
            />
          </span>
        );
      },
    },
    { title: "Name", dataIndex: "name", key: "name", width: 120, ellipsis: true, render: (v: string | null) => v || "—" },
    { title: "Company", dataIndex: "company_name", key: "company_name", width: 140, ellipsis: true, render: (v: string | null) => v || "—" },
    { title: "Phone", dataIndex: "phone", key: "phone", width: 120, render: (v: string | null) => <span className="lead-phone-cell" data-no-dialer="true">{v || "—"}</span> },
    { title: "Email", dataIndex: "email", key: "email", width: 160, ellipsis: true, render: (v: string | null) => v || "—" },
    {
      title: "City",
      dataIndex: "city",
      key: "city",
      width: 100,
      ellipsis: true,
      render: (v: string | null) => (
        <span className="table-text-ellipsis" title={v || "—"}>
          {v || "—"}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: string) => <Tag style={{ textTransform: "capitalize" }}>{v?.replace("_", " ")}</Tag>,
    },
    {
      title: "Follow-up",
      dataIndex: "followup_date",
      key: "followup_date",
      width: 100,
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—"),
    },
    { title: "Notes", dataIndex: "notes", key: "notes", width: 140, ellipsis: true, render: (v: string | null) => v || "—" },
    {
      title: "Created By (Agent)",
      dataIndex: "created_by_name",
      key: "created_by_name",
      width: 140,
      ellipsis: true,
      render: (v: string | null) => v || "—",
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 110,
      render: (v: string) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—"),
    },
  ];

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
      {/* Breadcrumb & back */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/sales/campaigns"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            color: "#1677ff",
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          <ArrowLeftOutlined /> Back to Campaigns
        </Link>
      </div>

      {/* Hero header */}
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 8,
          border: "1px solid #f0f0f0",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
        bodyStyle={{ padding: "24px 28px" }}
      >
        <Row gutter={24} align="middle" justify="space-between" wrap>
          <Col flex="1" style={{ minWidth: 0 }}>
            <Typography.Title level={3} style={{ margin: 0, marginBottom: 6, fontWeight: 600 }}>
              {campaign.name}
            </Typography.Title>
            {campaign.client_name && (
              <Typography.Text type="secondary" style={{ fontSize: 15, display: "block", marginBottom: 8 }}>
                {campaign.client_name}
              </Typography.Text>
            )}
            <Space size="small" wrap>
              {campaign.campaign_id && (
                <Tag style={{ fontFamily: "monospace", fontSize: 12, margin: 0 }}>
                  {campaign.campaign_id}
                </Tag>
              )}
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
              <Button icon={<EditOutlined />} onClick={() => setEditModalOpen(true)}>
                Edit
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
              <Popconfirm
                title="Delete campaign?"
                description="This action cannot be undone."
                onConfirm={handleDelete}
                okText="Delete"
                okType="danger"
              >
                <Button danger icon={<DeleteOutlined />}>
                  Delete
                </Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Campaign details – grouped sections */}
      <Row gutter={24}>
        <Col xs={24} lg={14}>
          <Card
            title="Overview"
            style={{
              marginBottom: 24,
              borderRadius: 8,
              border: "1px solid #f0f0f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
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
                <OverviewRowOrEmpty label="Start Date" value={campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : null} />
                <OverviewRowOrEmpty label="End Date" value={campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : null} />
                <OverviewRowOrEmpty label="Region" value={campaign.region} />
                <OverviewRowOrEmpty
                  label="Assigned Team Leader"
                  value={
                    campaign.assigned_team_leader_id
                      ? teamLeaders.find((tl) => tl.id === campaign.assigned_team_leader_id)?.full_name ||
                        teamLeaders.find((tl) => tl.id === campaign.assigned_team_leader_id)?.email
                      : null
                  }
                />
                <OverviewRowOrEmpty label="Weekly Call" value={campaign.weekly_call} />
                <OverviewRowOrEmpty label="Weekly Report" value={campaign.weekly_report} />
              </div>
              <div>
                <OverviewRowOrEmpty label="CPL" value={campaign.cpl != null ? `$${Number(campaign.cpl).toLocaleString()}` : null} />
                <OverviewRowOrEmpty label="Revenue" value={campaign.revenue != null ? `$${Number(campaign.revenue).toLocaleString()}` : null} />
                <OverviewRowOrEmpty label="Booked" value={campaign.booked != null ? `$${Number(campaign.booked).toLocaleString()}` : null} />
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
            style={{
              marginBottom: 24,
              borderRadius: 8,
              border: "1px solid #f0f0f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
            bodyStyle={{ padding: "24px 28px" }}
          >
            {files.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 16px",
                  color: "#8c8c8c",
                  fontSize: 14,
                }}
              >
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
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <FileOutlined style={{ color: "#8c8c8c", flexShrink: 0 }} />
                      <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.file_name}
                      </span>
                      {f.file_size != null && (
                        <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                          {(f.file_size / 1024).toFixed(1)} KB
                        </Typography.Text>
                      )}
                    </span>
                    {f.download_url && (
                      <Button
                        type="link"
                        size="small"
                        icon={<DownloadOutlined />}
                        href={f.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: "0 4px", flexShrink: 0 }}
                      >
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

      {/* Leads table */}
      <Card
        title={`Leads (${leads.length})`}
        style={{
          borderRadius: 8,
          border: "1px solid #f0f0f0",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
        bodyStyle={{ padding: "24px 28px" }}
      >
        <Table
          className="table-single-line"
          columns={leadColumns}
          dataSource={leads}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} leads` }}
          locale={{ emptyText: "No leads yet" }}
          size="middle"
        />
      </Card>

      <Modal
        title="Edit Campaign"
        open={editModalOpen}
        onCancel={handleCloseEditModal}
        onOk={handleSaveEdit}
        confirmLoading={saving}
        okText="Save"
        width={640}
        style={{ top: 24 }}
      >
        <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 8 }}>
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item name="client_name" label="Client Name">
              <Input placeholder="Client name" />
            </Form.Item>
            <Form.Item name="name" label="Campaign Name" rules={[{ required: true }]}>
              <Input placeholder="Campaign name" />
            </Form.Item>
            <Form.Item name="lead_type" label="Lead Type">
              <Select
                mode="tags"
                maxTagCount="responsive"
                placeholder="Select or type lead types and press Enter"
                allowClear
                options={leadTypeOptions}
                tokenSeparators={[","]}
                onChange={(vals) => {
                  const arr = Array.isArray(vals) ? vals : [];
                  setLeadTypeOptions((prev) => {
                    const existing = new Set(prev.map((o) => o.value));
                    const extras = arr
                      .map((v) => String(v).trim())
                      .filter((v) => v && !existing.has(v))
                      .map((v) => ({ value: v, label: v }));
                    return extras.length ? [...prev, ...extras] : prev;
                  });
                }}
              />
            </Form.Item>
            <Form.Item name="start_date" label="Start Date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="end_date" label="End Date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "paused", label: "Paused" },
                  { value: "completed", label: "Completed" },
                ]}
              />
            </Form.Item>
            <Form.Item name="assigned_team_leader_id" label="Assign Team Leader">
              <Select
                placeholder="Select Team Leader"
                allowClear
                showSearch
                optionFilterProp="label"
                options={teamLeaders.map((tl) => ({
                  value: tl.id,
                  label: tl.full_name || tl.email || tl.id,
                }))}
                notFoundContent={teamLeaders.length === 0 ? "No Team Leaders found" : undefined}
              />
            </Form.Item>
            <Form.Item name="cpl" label="CPL">
              <InputNumber style={{ width: "100%" }} min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="revenue" label="Revenue">
              <InputNumber style={{ width: "100%" }} min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="booked" label="Booked">
              <InputNumber style={{ width: "100%" }} min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="total_allocation" label="Total Allocation">
              <InputNumber style={{ width: "100%" }} min={0} precision={0} />
            </Form.Item>
            <Form.Item name="post_qa" label="Post QA">
              <InputNumber style={{ width: "100%" }} min={0} precision={0} />
            </Form.Item>
            <Form.Item name="achieved" label="Achieved">
              <InputNumber style={{ width: "100%" }} min={0} precision={0} />
            </Form.Item>
            <Form.Item name="pending_allocation" label="Pending Allocation">
              <InputNumber style={{ width: "100%" }} min={0} precision={0} />
            </Form.Item>
            <Form.Item name="region" label="Region">
              <Input placeholder="e.g. North America, APAC" />
            </Form.Item>
            <Form.Item name="weekly_call" label="Weekly Call">
              <Input placeholder="e.g. Monday 10:00 AM" />
            </Form.Item>
            <Form.Item name="weekly_report" label="Weekly Report">
              <Input placeholder="e.g. Friday EOD" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <TextArea rows={2} placeholder="Campaign description" />
            </Form.Item>
            <Form.Item name="target_designation" label="Target Designation">
              <Input placeholder="e.g. CTO, Sales Manager" />
            </Form.Item>
            <Form.Item name="industry" label="Industry">
              <Input placeholder="e.g. Technology, Healthcare" />
            </Form.Item>
            <Form.Item name="geography" label="Geography">
              <Input placeholder="e.g. North America, APAC" />
            </Form.Item>
            <Form.Item name="employee_size" label="Employee Size">
              <Select mode="multiple" placeholder="Select ranges" allowClear options={EMPLOYEE_SIZE_OPTIONS} style={{ width: "100%" }} maxTagCount="responsive" />
            </Form.Item>
            <Form.Item name="abm" label="ABM">
              <Select placeholder="Yes / No" allowClear options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />
            </Form.Item>
            <Form.Item name="seniority" label="Seniority">
              <Input placeholder="e.g. C-Level, VP, Director" />
            </Form.Item>
            <Form.Item name="job_function" label="Job Function">
              <Input placeholder="e.g. Sales, Marketing, Engineering" />
            </Form.Item>
            <Form.Item label="Creatives URL">
              <Form.List name="creatives_url">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                        <Form.Item {...restField} name={[name]} rules={[{ type: "url", message: "Valid URL" }]} style={{ flex: 1, marginBottom: 0, minWidth: 180 }}>
                          <Input placeholder="https://..." />
                        </Form.Item>
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(name)} />
                      </Space>
                    ))}
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">
                      Add URL
                    </Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
            <Form.Item name="additional_comments" label="Additional Comments">
              <TextArea rows={3} placeholder="Additional notes" />
            </Form.Item>

            <Divider style={{ margin: "20px 0 12px" }} />

            <Form.Item label="Campaign Files">
              <div style={{ marginBottom: 12 }}>
                {files.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                      Existing files (click Remove to delete)
                    </Typography.Text>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {files.map((f) => (
                        <li
                          key={f.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 0",
                            borderBottom: "1px solid #f0f0f0",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                            <FileOutlined />
                            {f.file_name}
                            {f.file_size != null && (
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                ({(f.file_size / 1024).toFixed(1)} KB)
                              </Typography.Text>
                            )}
                          </span>
                          <Popconfirm
                            title="Remove this file?"
                            onConfirm={() => handleRemoveFile(f.id)}
                            okText="Remove"
                            okType="danger"
                          >
                            <Button
                              type="link"
                              size="small"
                              danger
                              loading={removingFileId === f.id}
                              disabled={!!removingFileId}
                            >
                              Remove
                            </Button>
                          </Popconfirm>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                  Add new files (saved when you click Save)
                </Typography.Text>
                <Dragger
                  multiple
                  fileList={uploadFileList}
                  accept={ACCEPT_FILE_TYPES}
                  beforeUpload={() => false}
                  onRemove={(file) => setUploadFileList((prev) => prev.filter((f) => f.uid !== file.uid))}
                  onChange={({ fileList: next }) => setUploadFileList(next)}
                  maxCount={20}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ fontSize: 32, color: "#1677ff" }} />
                  </p>
                  <p className="ant-upload-text">Click or drag files to add</p>
                  <p className="ant-upload-hint">PDF, Word, Excel, images, etc. Max 50MB per file.</p>
                </Dragger>
              </div>
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
