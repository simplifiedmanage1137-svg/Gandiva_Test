"use client";

import React from "react";
import { Table, Tag, Button, message, Select } from "antd";
import type { TableProps } from "antd";
import { EditOutlined, CopyOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Lead } from "@/types/lead.types";

const STATUS_COLORS: Record<string, string> = {
  new: "default",
  contacted: "processing",
  interested: "green",
  followup: "gold",
  closed_won: "blue",
  closed_lost: "red",
};

type ColumnConfig = {
  showActions?: boolean;
  onEdit?: (lead: Lead) => void;
  showDeliveryStatus?: boolean;
  onMarkDelivered?: (lead: Lead) => void;
  markingDeliveredLeadId?: string | null;
};

export function getLeadTableColumns(config: ColumnConfig = {}) {
  const {
    showActions = true,
    onEdit,
    showDeliveryStatus = false,
    onMarkDelivered,
    markingDeliveredLeadId,
  } = config;

  const baseColumns: NonNullable<TableProps<Lead>["columns"]> = [
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
    {
      title: "Name",
      key: "name",
      width: 160,
      ellipsis: true,
      render: (_: unknown, r: Lead) =>
        [r.first_name, r.last_name].filter(Boolean).join(" ") || r.name || "—",
    },
    {
      title: "Company",
      dataIndex: "company_name",
      key: "company_name",
      width: 160,
      ellipsis: true,
      render: (v: string | null) => v || "—",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 180,
      ellipsis: true,
      render: (v: string | null) => v || "—",
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
      width: 120,
      render: (v: string | null) => (
        <span className="lead-phone-cell" data-no-dialer="true">{v || "—"}</span>
      ),
    },
    {
      title: "Job Title",
      dataIndex: "job_title",
      key: "job_title",
      width: 140,
      ellipsis: true,
      render: (v: string | null) => v || "—",
    },
    {
      title: "Industry",
      dataIndex: "industry",
      key: "industry",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => v || "—",
    },
    {
      title: "Channel",
      dataIndex: "channel",
      key: "channel",
      width: 190,
      ellipsis: true,
      render: (v: string | null | undefined) => v || "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: string) => (
        <Tag color={STATUS_COLORS[v] ?? "default"} style={{ textTransform: "capitalize" }}>
          {v?.replace("_", " ")}
        </Tag>
      ),
    },
    ...(showDeliveryStatus
      ? [
          {
            title: "Delivery",
            dataIndex: "delivery_status",
            key: "delivery_status",
            width: 220,
            fixed: "right" as const,
            filters: [
              { text: "Delivered", value: "delivered" },
              { text: "Not Delivered", value: "not_delivered" },
            ],
            onFilter: (value, record) =>
              (record.delivery_status ?? "not_delivered") === String(value),
            render: (v: Lead["delivery_status"], record: Lead) => {
              const status = (v ?? "not_delivered") as "not_delivered" | "delivered";
              const delivered = status === "delivered";
              return (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Tag color={delivered ? "green" : "default"} style={{ margin: 0 }}>
                    {delivered ? "Delivered" : "Not Delivered"}
                  </Tag>
                  {!delivered && onMarkDelivered ? (
                    <Button
                      type="link"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkDelivered(record);
                      }}
                      loading={markingDeliveredLeadId === record.id}
                      style={{ paddingInline: 0, height: "auto" }}
                    >
                      Mark as Delivered
                    </Button>
                  ) : null}
                </span>
              );
            },
          } as NonNullable<TableProps<Lead>["columns"]>[number],
        ]
      : []),
    {
      title: "QA Status",
      dataIndex: "qa_status",
      key: "qa_status",
      width: 110,
      fixed: "right" as const,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Select
            mode="multiple"
            allowClear
            placeholder="Filter QA status"
            style={{ width: 180, marginBottom: 8, display: "block" }}
            value={(selectedKeys as string[]) ?? []}
            options={[
              { value: "qualified", label: "Qualified" },
              { value: "disqualified", label: "Disqualified" },
              { value: "rectified", label: "Rectified" },
            ]}
            onChange={(values) => {
              if (values && values.length > 0) {
                setSelectedKeys(values);
              } else {
                setSelectedKeys([]);
              }
              confirm({ closeDropdown: false });
            }}
          />
          {clearFilters && (
            <Button
              onClick={() => {
                clearFilters();
                confirm({ closeDropdown: false });
              }}
              size="small"
              style={{ width: "100%" }}
            >
              Reset
            </Button>
          )}
        </div>
      ),
      onFilter: (value, record) =>
        (record.qa_status ?? "").toLowerCase() === String(value).toLowerCase(),
      render: (v: string | null | undefined) =>
        v ? (
          <Tag
            color={
              v === "qualified" ? "green" : v === "disqualified" ? "red" : "blue"
            }
          >
            {v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()}
          </Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "Follow-up",
      dataIndex: "followup_date",
      key: "followup_date",
      width: 110,
      render: (v: string | null) =>
        v ? new Date(v).toLocaleDateString() : "—",
    },
    {
      title: "Created By",
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
      width: 140,
      filters: [
        { text: "Today", value: "today" },
        { text: "Last 7 days", value: "last7" },
        { text: "Last 30 days", value: "last30" },
        { text: "This month", value: "month" },
        { text: "This quarter", value: "quarter" },
      ],
      onFilter: (value, record) => {
        const created = record.created_at ? dayjs(record.created_at) : null;
        if (!created) return false;
        const now = dayjs();
        switch (value) {
          case "today":
            return created.isSame(now, "day");
          case "last7":
            return created.isAfter(now.subtract(7, "day"));
          case "last30":
            return created.isAfter(now.subtract(30, "day"));
          case "month":
            return created.isSame(now, "month");
          case "quarter":
            return created.year() === now.year() && Math.floor(created.month() / 3) === Math.floor(now.month() / 3);
          default:
            return true;
        }
      },
      render: (v: string) =>
        v
          ? new Date(v).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—",
    },
  ];

  const extendedColumns = [
    ...baseColumns.slice(0, 4),
    {
      title: "Direct Number",
      dataIndex: "direct_number",
      key: "direct_number",
      width: 120,
      render: (v: string | null) => (
        <span className="lead-phone-cell" data-no-dialer="true">{v || "—"}</span>
      ),
    },
    ...baseColumns.slice(4, 6),
    {
      title: "Corporate Number",
      dataIndex: "company_number",
      key: "company_number",
      width: 120,
      render: (v: string | null) => (
        <span className="lead-phone-cell" data-no-dialer="true">{v || "—"}</span>
      ),
    },
    ...baseColumns.slice(6, 8),
    {
      title: "Employee Size",
      dataIndex: "employee_size",
      key: "employee_size",
      width: 150,
      ellipsis: true,
      render: (v: string | null) => (
        <span className="table-text-ellipsis" title={v || "—"}>
          {v || "—"}
        </span>
      ),
    },
    {
      title: "Address",
      dataIndex: "address",
      key: "address",
      width: 240,
      ellipsis: true,
      render: (v: string | null) => (
        <span className="table-text-ellipsis" title={v || "—"}>
          {v || "—"}
        </span>
      ),
    },
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
      title: "State",
      dataIndex: "state",
      key: "state",
      width: 100,
      ellipsis: true,
      render: (v: string | null) => (
        <span className="table-text-ellipsis" title={v || "—"}>
          {v || "—"}
        </span>
      ),
    },
    {
      title: "Country",
      dataIndex: "country",
      key: "country",
      width: 100,
      ellipsis: true,
      render: (v: string | null) => (
        <span className="table-text-ellipsis" title={v || "—"}>
          {v || "—"}
        </span>
      ),
    },
    {
      title: "Zip",
      dataIndex: "zip_code",
      key: "zip_code",
      width: 90,
      ellipsis: true,
      render: (v: string | null) => (
        <span className="table-text-ellipsis" title={v || "—"}>
          {v || "—"}
        </span>
      ),
    },
    ...baseColumns.slice(8),
  ];

  if (showActions && onEdit) {
    extendedColumns.push({
      title: "",
      key: "actions",
      width: 60,
      fixed: "right" as const,
      render: (_: unknown, record: Lead) => (
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(record);
          }}
        />
      ),
    } as never);
  }

  return extendedColumns;
}
