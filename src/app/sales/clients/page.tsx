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
  Drawer,
  Input,
  Tag,
  Typography,
  Spin,
  message,
  Modal,
  Popconfirm,
  Space,
} from "antd";
import {
  UserOutlined,
  TeamOutlined,
  FundProjectionScreenOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { AddClientForm } from "@/components/Sales/AddClientForm";
import { Form } from "antd";

type CampaignBrief = { id: string; campaign_id: string; name: string; status: string; start_date: string | null };

type ClientRow = {
  id: string;
  company_name: string;
  company_website: string | null;
  industry_type: string | null;
  company_size: string | null;
  year_established: number | null;
  company_address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  contact_person: string | null;
  contact_full_name: string | null;
  contact_designation: string | null;
  contact_work_email: string | null;
  contact_mobile: string | null;
  contact_linkedin: string | null;
  created_at: string;
  campaigns?: CampaignBrief[];
};

export default function SalesClientsPage() {
  const router = useRouter();
  const { hasRole, isInitialized } = useAuth();
  const hasSalesAccess = hasRole("sales_manager");
  const canManageClients = hasRole("sales_manager");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/clients?withCampaigns=1", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setClients(data.clients ?? []);
      else message.error(data.error || "Failed to load clients");
    } catch {
      message.error("Failed to load clients");
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

  const handleAddSuccess = () => {
    setDrawerOpen(false);
    form.resetFields();
    fetchData();
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    form.resetFields();
  };

  const openEditModal = (record: ClientRow) => {
    setEditingClient(record);
    editForm.setFieldsValue({
      company_name: record.company_name,
      company_website: record.company_website,
      industry_type: record.industry_type,
      company_size: record.company_size,
      year_established: record.year_established,
      company_address: record.company_address,
      city: record.city,
      state: record.state,
      country: record.country,
      contact_person: record.contact_person,
      contact_full_name: record.contact_full_name,
      contact_designation: record.contact_designation,
      contact_work_email: record.contact_work_email,
      contact_mobile: record.contact_mobile,
      contact_linkedin: record.contact_linkedin,
    });
    setEditOpen(true);
  };

  const closeEditModal = () => {
    setEditOpen(false);
    setEditingClient(null);
    editForm.resetFields();
  };

  const handleSaveEdit = async () => {
    if (!editingClient) return;
    try {
      const values = await editForm.validateFields();
      setSavingEdit(true);
      const res = await fetch(`/api/sales/clients/${editingClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update client");
      }
      message.success("Client updated successfully");
      closeEditModal();
      fetchData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteClient = async (record: ClientRow) => {
    try {
      setDeletingClientId(record.id);
      const res = await fetch(`/api/sales/clients/${record.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete client");
      }
      message.success("Client deleted successfully");
      fetchData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to delete client");
    } finally {
      setDeletingClientId(null);
    }
  };

  if (!isInitialized) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!hasSalesAccess) {
    return null;
  }

  const totalCampaigns = clients.reduce((sum, c) => sum + (c.campaigns?.length ?? 0), 0);

  const renderText = (v: string | null | number | undefined) => (v != null && v !== "" ? String(v) : "—");

  const columns = [
    {
      title: "Sr. No.",
      key: "sr",
      width: 72,
      fixed: "left" as const,
      render: (_: unknown, __: ClientRow, index: number) => index + 1,
    },
    {
      title: "Company Name",
      dataIndex: "company_name",
      key: "company_name",
      width: 160,
      ellipsis: true,
      fixed: "left" as const,
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "Company Website",
      dataIndex: "company_website",
      key: "company_website",
      width: 140,
      ellipsis: true,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "Industry Type",
      dataIndex: "industry_type",
      key: "industry_type",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "Company Size",
      dataIndex: "company_size",
      key: "company_size",
      width: 100,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "Year Est.",
      dataIndex: "year_established",
      key: "year_established",
      width: 88,
      render: (v: number | null) => renderText(v),
    },
    {
      title: "Company Address",
      dataIndex: "company_address",
      key: "company_address",
      width: 160,
      ellipsis: true,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "City",
      dataIndex: "city",
      key: "city",
      width: 100,
      ellipsis: true,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "State",
      dataIndex: "state",
      key: "state",
      width: 100,
      ellipsis: true,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "Country",
      dataIndex: "country",
      key: "country",
      width: 110,
      ellipsis: true,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "Contact Person",
      dataIndex: "contact_person",
      key: "contact_person",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "Full Name",
      dataIndex: "contact_full_name",
      key: "contact_full_name",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "Designation",
      dataIndex: "contact_designation",
      key: "contact_designation",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "Work Email",
      dataIndex: "contact_work_email",
      key: "contact_work_email",
      width: 160,
      ellipsis: true,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "Mobile",
      dataIndex: "contact_mobile",
      key: "contact_mobile",
      width: 120,
      render: (v: string | null) => renderText(v),
    },
    {
      title: "LinkedIn",
      dataIndex: "contact_linkedin",
      key: "contact_linkedin",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => v ? <a href={v} target="_blank" rel="noopener noreferrer">Link</a> : "—",
    },
    {
      title: "Campaigns",
      key: "campaigns_count",
      width: 96,
      render: (_: unknown, r: ClientRow) => <Tag color="blue">{r.campaigns?.length ?? 0}</Tag>,
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
      fixed: "right" as const,
      width: 100,
      render: (_: unknown, record: ClientRow) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
            disabled={!canManageClients}
          />
          <Popconfirm
            title="Delete client"
            description={`Delete ${record.company_name}? This cannot be undone.`}
            okText="Delete"
            okButtonProps={{ danger: true, loading: deletingClientId === record.id }}
            onConfirm={() => handleDeleteClient(record)}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={!canManageClients}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Clients
          </Typography.Title>
          <Typography.Text type="secondary">
            Manage clients and their campaigns
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setDrawerOpen(true)}
          disabled={!canManageClients}
        >
          Add Client
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
                  title="Total Clients"
                  value={clients.length}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Total Campaigns (linked)"
                  value={totalCampaigns}
                  prefix={<FundProjectionScreenOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card>
                <Statistic
                  title="Avg Campaigns / Client"
                  value={clients.length ? (totalCampaigns / clients.length).toFixed(1) : 0}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card title="All Clients" bodyStyle={{ overflowX: "auto" }}>
            <Table
              className="table-single-line"
              columns={columns}
              dataSource={clients}
              rowKey="id"
              scroll={{ x: 2350 }}
              pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} clients` }}
              locale={{ emptyText: "No clients yet. Click Add Client to create one." }}
              expandable={{
                expandedRowRender: (record: ClientRow) => {
                  const list = record.campaigns ?? [];
                  if (list.length === 0) {
                    return <div style={{ padding: "8px 0", color: "#999" }}>No campaigns linked yet.</div>;
                  }
                  return (
                    <div style={{ padding: "8px 0" }}>
                      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 12, color: "#666" }}>Campaigns</div>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {list.map((c) => (
                          <li key={c.id} style={{ marginBottom: 4 }}>
                            <Link href={`/sales/campaigns/${c.id}`}>{c.name}</Link>
                            <Tag color={c.status === "active" ? "green" : c.status === "draft" ? "default" : "orange"} style={{ marginLeft: 8 }}>
                              {c.status}
                            </Tag>
                            {c.start_date && (
                              <span style={{ marginLeft: 8, fontSize: 12, color: "#999" }}>
                                Started {new Date(c.start_date).toLocaleDateString()}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                },
                rowExpandable: () => true,
              }}
            />
          </Card>
        </>
      )}

      <Drawer
        title="Add Client"
        placement="right"
        width={800}
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnClose
        styles={{ body: { paddingTop: 8 } }}
      >
        <AddClientForm
          form={form}
          onSuccess={handleAddSuccess}
          onCancel={closeDrawer}
          showCancel={true}
        />
      </Drawer>

      <Modal
        title="Edit Client"
        open={editOpen}
        onCancel={closeEditModal}
        onOk={handleSaveEdit}
        okText="Save"
        confirmLoading={savingEdit}
        destroyOnClose
        width={820}
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="company_name"
                label="Company Name"
                rules={[{ required: true, message: "Company name is required" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company_website" label="Company Website">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="industry_type" label="Industry Type">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company_size" label="Company Size">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="year_established" label="Year Established">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company_address" label="Company Address">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="city" label="City">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="state" label="State">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="country"
                label="Country"
                rules={[{ required: true, message: "Country is required" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="contact_person"
                label="Contact Person"
                rules={[{ required: true, message: "Contact person is required" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="contact_full_name"
                label="Contact Full Name"
                rules={[{ required: true, message: "Full name is required" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contact_designation" label="Designation">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contact_work_email" label="Work Email">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contact_mobile" label="Mobile">
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="contact_linkedin" label="LinkedIn">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
