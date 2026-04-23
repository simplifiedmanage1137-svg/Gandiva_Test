"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Form,
  Input,
  DatePicker,
  Select,
  Button,
  message,
  InputNumber,
  Row,
  Col,
  Upload,
  Space,
} from "antd";
import { InboxOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { Spin } from "antd";
import type { UploadFile } from "antd";

const { TextArea } = Input;
const { Dragger } = Upload;

const ACCEPT_FILE_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.gif,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,image/*";

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

const DEFAULT_LEAD_TYPES = [
  { value: "AG", label: "AG" },
  { value: "CD", label: "CD" },
  { value: "CDQA", label: "CDQA" },
  { value: "Double Touch - Whitepaper", label: "Double Touch - Whitepaper" },
  { value: "HQL / BANT", label: "HQL / BANT" },
  { value: "Tele", label: "Tele" },
  { value: "Webinar", label: "Webinar" },
  { value: "Whitepaper", label: "Whitepaper" },
];

export default function TLCampaignCreatePage() {
  const router = useRouter();
  const { hasRole, isInitialized } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leadTypeOptions, setLeadTypeOptions] = useState(DEFAULT_LEAD_TYPES);
  const [teamLeaders, setTeamLeaders] = useState<
    { id: string; full_name: string | null; email: string | null }[]
  >([]);
  const [clients, setClients] = useState<string[]>([]); 
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!isInitialized) return;
    if (!hasRole("team_leader") && !hasRole("tl")) {
      router.replace("/login");
      return;
    }
  }, [isInitialized, hasRole, router]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!hasRole("team_leader") && !hasRole("tl")) return;
    fetch("/api/tl/team-leaders", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          message.warning(
            "Could not load Team Leaders: " + (data.error || "Unknown error")
          );
          return;
        }
        setTeamLeaders(data.team_leaders ?? []);
      })
      .catch(() => message.warning("Could not load Team Leaders"));
  }, [isInitialized, hasRole]);

  useEffect(() => {
    if (!isInitialized) return;
    fetch("/api/tl/clients", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setClients(data.clients || []);
      })
      .catch(() => message.warning("Could not load clients"));
  }, [isInitialized]);

  const cpl = Form.useWatch("cpl", form);
  const totalAllocation = Form.useWatch("total_allocation", form);
  const calculatedRevenue =
    cpl != null &&
      totalAllocation != null &&
      Number(cpl) >= 0 &&
      Number(totalAllocation) >= 0
      ? Number(cpl) * Number(totalAllocation)
      : null;

  const submit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const revenueBooked =
        values.cpl != null && values.total_allocation != null
          ? Number(values.cpl) * Number(values.total_allocation)
          : null;

      const leadTypeValue = Array.isArray(values.lead_type)
        ? values.lead_type.join(", ")
        : values.lead_type;

      const res = await fetch("/api/tl/campaigns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          client_name: values.client_name,
          name: values.name,
          lead_type: leadTypeValue,
          start_date: values.start_date?.format?.("YYYY-MM-DD") ?? null,
          end_date: values.end_date?.format?.("YYYY-MM-DD") ?? null,
          status: values.status ?? "draft",
          cpl: values.cpl,
          total_allocation: values.total_allocation,
          revenue: revenueBooked,
          booked: revenueBooked,
          region: values.region,
          employee_size: values.employee_size,
          industry: values.industry?.trim() || null,
          abm: values.abm,
          seniority: values.seniority?.trim() || null,
          job_function: values.job_function?.trim() || null,
          creatives_url:
            values.creatives_url?.filter((u: string) => u?.trim()) || null,
          weekly_call: values.weekly_call,
          weekly_report: values.weekly_report,
          additional_comments: values.additional_comments,
          assigned_team_leader_id: values.assigned_team_leader_id || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create campaign");

      const campaignId = data.campaign_id as string;
      const filesToUpload = fileList.filter((f) => f.originFileObj);

      if (filesToUpload.length > 0) {
        const formData = new FormData();
        filesToUpload.forEach((f) => {
          if (f.originFileObj) formData.append("files", f.originFileObj);
        });
        const uploadRes = await fetch(`/api/tl/campaigns/${campaignId}/files`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          message.warning(
            uploadData.error ||
            "Campaign created but some files failed to upload."
          );
        } else if (uploadData.errors?.length) {
          message.warning(`Campaign created. ${uploadData.errors.join(" ")}`);
        }
      }

      message.success("Campaign created");
      router.replace(`/tl/campaigns/${campaignId}`);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Failed to create campaign"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 24px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <Card title="Create Campaign" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" initialValues={{ status: "draft" }}>
          <Row gutter={24}>
            <Col xs={24} md={12} lg={8}>
              <Form.Item
  name="client_name"
  label="Client Name"
  rules={[{ required: true, message: "Client Name is required" }]}
>
 <Select
  mode="tags"
  showSearch
  placeholder="Select or type client name"
  allowClear
  options={clients.map((c) => ({ value: c, label: c }))}
  notFoundContent={clients.length === 0 ? "No clients found" : null}
  filterOption={(input, option) =>
    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
  }
/>
</Form.Item>
              <Form.Item
                name="name"
                label="Campaign Name"
                rules={[{ required: true, message: "Campaign Name is required" }]}
              >
                <Input placeholder="Enter campaign name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Form.Item name="lead_type" label="Lead Type">
                <Select
                  mode="tags"
                  maxTagCount="responsive"
                  placeholder="Select or type lead types"
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
            </Col>
            <Col xs={24} md={12} lg={8}>
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
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12} lg={8}>
              <Form.Item name="start_date" label="Start Date">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Form.Item name="end_date" label="End Date">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="cpl" label="CPL (Cost Per Lead)">
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="e.g. 25.00"
                  min={0}
                  step={0.01}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item name="total_allocation" label="Total Allocation">
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="e.g. 1000"
                  min={0}
                  precision={0}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item label="Revenue / Booked (auto)">
                <div
                  style={{
                    padding: "4px 11px",
                    minHeight: 32,
                    lineHeight: "22px",
                    background: "#fafafa",
                    borderRadius: 6,
                    border: "1px solid #d9d9d9",
                    color: calculatedRevenue != null ? "inherit" : "#999",
                  }}
                >
                  {calculatedRevenue != null
                    ? `$${Number(calculatedRevenue).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                    : "—"}
                </div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                  CPL × Total Allocation
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: "#262626",
                }}
              >
                Targeting
              </div>
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Form.Item name="employee_size" label="Employee Size">
                <Select
                  mode="multiple"
                  placeholder="Select employee size ranges"
                  allowClear
                  options={EMPLOYEE_SIZE_OPTIONS}
                  style={{ width: "100%" }}
                  maxTagCount="responsive"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Form.Item name="industry" label="Industry">
                <Input placeholder="e.g. Technology, Healthcare, Finance" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Form.Item name="abm" label="ABM">
                <Select
                  placeholder="Yes / No"
                  allowClear
                  options={[
                    { value: true, label: "Yes" },
                    { value: false, label: "No" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Form.Item name="seniority" label="Seniority">
                <Input placeholder="e.g. C-Level, VP, Director, Manager" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Form.Item name="job_function" label="Job Function">
                <Input placeholder="e.g. Sales, Marketing, Engineering" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24}>
              <Form.Item label="Creatives URL">
                <Form.List name="creatives_url">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <Space
                          key={key}
                          style={{ display: "flex", marginBottom: 8 }}
                          align="baseline"
                        >
                          <Form.Item
                            {...restField}
                            name={[name]}
                            rules={[{ type: "url", message: "Enter a valid URL" }]}
                            style={{
                              flex: 1,
                              marginBottom: 0,
                              minWidth: 200,
                            }}
                          >
                            <Input placeholder="https://..." />
                          </Form.Item>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          />
                        </Space>
                      ))}
                      <Form.Item style={{ marginBottom: 0 }}>
                        <Button
                          type="dashed"
                          onClick={() => add()}
                          block
                          icon={<PlusOutlined />}
                        >
                          Add URL
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12} lg={8}>
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
                  notFoundContent={
                    teamLeaders.length === 0 ? "No Team Leaders found" : undefined
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Form.Item name="region" label="Region">
                <Input placeholder="e.g. North America, APAC, EMEA" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item name="weekly_call" label="Weekly Call">
                <Input placeholder="e.g. Monday 10:00 AM" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="weekly_report" label="Weekly Report">
                <Input placeholder="e.g. Friday EOD" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                label="Upload Files"
                tooltip="PDF, Word, Excel, PowerPoint, CSV, images, ZIP, etc. Max 50MB per file."
              >
                <Dragger
                  multiple
                  fileList={fileList}
                  accept={ACCEPT_FILE_TYPES}
                  beforeUpload={() => false}
                  onRemove={(file) =>
                    setFileList((prev) => prev.filter((f) => f.uid !== file.uid))
                  }
                  onChange={({ fileList: next }) => setFileList(next)}
                  maxCount={20}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ fontSize: 48, color: "#1677ff" }} />
                  </p>
                  <p className="ant-upload-text">Click or drag files to upload</p>
                  <p className="ant-upload-hint">
                    PDF, Word (.doc, .docx), Excel (.xls, .xlsx), CSV, PowerPoint
                    (.ppt, .pptx), text, images, ZIP. Multiple files allowed.
                  </p>
                </Dragger>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={24}>
              <Form.Item name="additional_comments" label="Additional Comments">
                <TextArea rows={4} placeholder="Any additional notes or comments" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
            <Button type="primary" size="large" loading={loading} onClick={submit}>
              Create Campaign
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
