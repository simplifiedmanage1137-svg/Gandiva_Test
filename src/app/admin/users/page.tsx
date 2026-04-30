"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  message,
  Spin,
  Typography,
} from "antd";
import {
  EditOutlined,
  StopOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import type { Tables } from "@/types/database.types";

type UserRow = Tables<"users"> & {
  roles: { name: string }[];
};
type ClientOption = { id: string; name: string };

export default function AdminUsersPage() {
  const router = useRouter();
  const { hasRole, profile, isInitialized } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Tables<"roles">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const currentPage = pagination.current;
  const pageSize = pagination.pageSize;
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [createSelectedRoleName, setCreateSelectedRoleName] = useState<string>("");
  const [editSelectedRoleName, setEditSelectedRoleName] = useState<string>("");

  // Redirect if not admin
  useEffect(() => {
    if (!isInitialized) return;
    if (!hasRole("admin")) {
      router.replace("/login");
    }
  }, [isInitialized, hasRole, router]);

  const fetchUsersAndRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load users");
      }

      setUsers(data.users ?? []);
      setRoles(data.roles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
      message.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients", { credentials: "include" });
      const data = (await res.json()) as { clients?: ClientOption[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load clients");
      setClients(data.clients ?? []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load clients");
    }
  }, []);

  useEffect(() => {
    if (isInitialized && hasRole("admin")) {
      fetchUsersAndRoles();
      fetchClients();
    }
  }, [isInitialized, hasRole, fetchUsersAndRoles, fetchClients]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return users;

    return users.filter((user) => {
      const searchableFields = [
        user.full_name ?? "",
        user.email ?? "",
        user.department ?? "",
        user.designation ?? "",
        user.status ?? "",
        ...(user.roles?.map((role) => role.name ?? "") ?? []),
      ];

      return searchableFields.some((field) =>
        field.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [users, normalizedQuery]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    if (currentPage > maxPage) {
      setPagination((prev) => ({ ...prev, current: maxPage }));
    }
  }, [filteredUsers.length, currentPage, pageSize]);

  const handleCreateUser = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          role_id: values.role_id || null,
          client_id:
            createSelectedRoleName === "client_viewer"
              ? (values.client_id || null)
              : null,
          department: values.department || null,
          designation: values.designation || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create user");
      }

      message.success("User created successfully. They can login with email and password.");
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchUsersAndRoles();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = (record: UserRow) => {
    setSelectedUser(record);
    const currentRoleName = record.roles?.[0]?.name || "";
    const currentRoleId = roles.find((r) => r.name === currentRoleName)?.id;
    setEditSelectedRoleName(currentRoleName.toLowerCase().replace(/\s+/g, "_"));
    editForm.setFieldsValue({
      full_name: record.full_name,
      department: record.department,
      designation: record.designation,
      role_id: currentRoleId,
      client_id: record.client_id ?? undefined,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          full_name: values.full_name || null,
          department: values.department || null,
          designation: values.designation || null,
          role_id: values.role_id || null,
          client_id:
            editSelectedRoleName === "client_viewer"
              ? (values.client_id || null)
              : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update user");

      message.success("User updated successfully");
      setEditModalOpen(false);
      setSelectedUser(null);
      editForm.resetFields();
      fetchUsersAndRoles();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = (record: UserRow) => {
    Modal.confirm({
      title: "Deactivate user?",
      content: `Are you sure you want to deactivate ${record.full_name || record.email}? They will no longer be able to sign in.`,
      okText: "Deactivate",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          const res = await fetch(`/api/admin/users/${record.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: "inactive" }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Failed to deactivate");
          message.success("User deactivated");
          fetchUsersAndRoles();
        } catch (err) {
          message.error(err instanceof Error ? err.message : "Failed to deactivate");
        }
      },
    });
  };

  const handleActivate = async (record: UserRow) => {
    try {
      const res = await fetch(`/api/admin/users/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "active" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to activate");
      message.success("User activated");
      fetchUsersAndRoles();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to activate");
    }
  };

  const handleDelete = (record: UserRow) => {
    Modal.confirm({
      title: "Delete user permanently?",
      content: `Are you sure you want to delete ${record.full_name || record.email}? This action cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          const res = await fetch(`/api/admin/users/${record.id}`, {
            method: "DELETE",
            credentials: "include",
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Failed to delete user");
          message.success("User deleted");
          fetchUsersAndRoles();
        } catch (err) {
          message.error(err instanceof Error ? err.message : "Failed to delete user");
        }
      },
    });
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spin size="large" />
      </div>
    );
  }

  if (!hasRole("admin")) {
    return null;
  }

  const columns = [
    {
      title: "Sr. No",
      key: "sr",
      width: 80,
      render: (_: unknown, __: UserRow, index: number) =>
        (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: "Name",
      dataIndex: "full_name",
      key: "full_name",
      render: (val: string | null, r: UserRow) => val || r.email || "—",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (val: string | null) => val || "—",
    },
    {
      title: "Role",
      key: "role",
      render: (_: unknown, r: UserRow) =>
        r.roles?.length ? (
          <Space size={[0, 4]} wrap>
            {r.roles.map((role) => (
              <Tag key={role.name}>{role.name}</Tag>
            ))}
          </Space>
        ) : (
          "—"
        ),
    },
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      render: (val: string | null) => val || "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (val: string) => (
        <Tag color={val === "active" ? "green" : "default"}>{val}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      render: (_: unknown, record: UserRow) => (
        <Space size="middle" style={{ transition: "opacity 0.2s ease" }}>
          <Tooltip title="Edit" placement="top" mouseEnterDelay={0.3}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
              style={{ transition: "color 0.2s ease, opacity 0.2s ease" }}
            />
          </Tooltip>
          {record.status === "active" ? (
            <Tooltip title="Deactivate" placement="top" mouseEnterDelay={0.3}>
              <Button
                type="text"
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => handleDeactivate(record)}
                style={{ transition: "color 0.2s ease, opacity 0.2s ease" }}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Activate" placement="top" mouseEnterDelay={0.3}>
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleActivate(record)}
                style={{ transition: "color 0.2s ease, opacity 0.2s ease" }}
              />
            </Tooltip>
          )}
          <Tooltip title="Delete" placement="top" mouseEnterDelay={0.3}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              style={{ transition: "color 0.2s ease, opacity 0.2s ease" }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Users
            </Typography.Title>
            <Typography.Text type="secondary">
              Manage users in {profile?.organization_id ? "your organization" : "organization"}
            </Typography.Text>
          </div>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => {
              setCreateSelectedRoleName("");
              createForm.resetFields();
              setCreateModalOpen(true);
            }}
          >
            Create User
          </Button>
        </div>
        <Input.Search
          allowClear
          placeholder="Search by name, email, role, department, or status"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setPagination((prev) => ({ ...prev, current: 1 }));
          }}
          style={{ marginTop: 16, maxWidth: 420 }}
        />
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden" style={{ minHeight: 200 }}>
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Spin size="large" tip="Loading users..." />
          </div>
        ) : (
          <Table
            className="table-single-line"
            columns={columns}
            dataSource={filteredUsers}
            rowKey="id"
            locale={{ emptyText: "No users found" }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} users`,
              onChange: (page, pageSize) =>
                setPagination({ current: page, pageSize: pageSize || 10 }),
            }}
          />
        )}
      </div>

      <Modal
        title="Create User"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          setCreateSelectedRoleName("");
          createForm.resetFields();
        }}
        onOk={handleCreateUser}
        confirmLoading={submitting}
        okText="Create User"
        destroyOnClose
        width={480}
      >
        <Form form={createForm} layout="vertical" className="mt-4">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Invalid email" },
            ]}
          >
            <Input placeholder="user@company.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: "Password is required" },
              { min: 6, message: "Password must be at least 6 characters" },
            ]}
          >
            <Input.Password placeholder="••••••••" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="full_name" label="Full Name">
            <Input placeholder="John Doe" />
          </Form.Item>
          <Form.Item name="role_id" label="Role">
            <Select
              placeholder="Select role"
              allowClear
              showSearch
              optionFilterProp="label"
              onChange={(roleId) => {
                const role = roles.find((r) => r.id === roleId);
                const normalized = (role?.name ?? "").toLowerCase().replace(/\s+/g, "_");
                setCreateSelectedRoleName(normalized);
                if (normalized !== "client_viewer") {
                  createForm.setFieldValue("client_id", undefined);
                }
              }}
              options={[...roles]
                .sort((a, b) => {
                  const order = ["admin", "Agent", "Team Leader", "HR"];
                  return order.indexOf(a.name) - order.indexOf(b.name) || a.name.localeCompare(b.name);
                })
                .map((r) => ({ label: r.name, value: r.id }))}
            />
          </Form.Item>
          {createSelectedRoleName === "client_viewer" && (
            <Form.Item
              name="client_id"
              label="Select Client"
              rules={[{ required: true, message: "Client selection is required for client users" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Search and select client"
                options={clients.map((c) => ({ label: c.name, value: c.id }))}
              />
            </Form.Item>
          )}
          <Form.Item name="department" label="Department">
            <Input placeholder="Sales, Marketing, etc." />
          </Form.Item>
          <Form.Item name="designation" label="Designation">
            <Input placeholder="e.g. Sales Representative" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Edit User"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditSelectedRoleName("");
          setSelectedUser(null);
          editForm.resetFields();
        }}
        onOk={handleSaveEdit}
        confirmLoading={submitting}
        okText="Save"
        destroyOnClose
        width={480}
      >
        {selectedUser && (
          <Form form={editForm} layout="vertical" className="mt-4">
            <Form.Item label="Email">
              <Input value={selectedUser.email ?? ""} disabled />
            </Form.Item>
            <Form.Item name="full_name" label="Full Name">
              <Input placeholder="John Doe" />
            </Form.Item>
            <Form.Item name="department" label="Department">
              <Input placeholder="Sales, Marketing, etc." />
            </Form.Item>
            <Form.Item name="designation" label="Designation">
              <Input placeholder="e.g. Sales Representative" />
            </Form.Item>
            <Form.Item name="role_id" label="Role">
              <Select
                placeholder="Select role"
                allowClear
                showSearch
                optionFilterProp="label"
                onChange={(roleId) => {
                  const role = roles.find((r) => r.id === roleId);
                  const normalized = (role?.name ?? "").toLowerCase().replace(/\s+/g, "_");
                  setEditSelectedRoleName(normalized);
                  if (normalized !== "client_viewer") {
                    editForm.setFieldValue("client_id", undefined);
                  }
                }}
                options={roles.map((r) => ({ label: r.name, value: r.id }))}
              />
            </Form.Item>
            {editSelectedRoleName === "client_viewer" && (
              <Form.Item
                name="client_id"
                label="Select Client"
                rules={[{ required: true, message: "Client selection is required for client users" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Search and select client"
                  options={clients.map((c) => ({ label: c.name, value: c.id }))}
                />
              </Form.Item>
            )}
          </Form>
        )}
      </Modal>
    </>
  );
}
