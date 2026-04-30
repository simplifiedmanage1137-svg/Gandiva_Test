"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, DatePicker, Input, Space, Table, Tag, Typography, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";

function escapeCsvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const { Title, Text, Link } = Typography;
const { RangePicker } = DatePicker;

interface LeadRow {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  consent_status: string | null;
  created_at: string;
  /** When the lead registered on the client landing page (Supabase `registered_at`). */
  registered_at: string | null;
  campaign_id: string;
  campaigns?: {
    id?: string;
    name?: string;
    campaign_id?: string;
  } | null;
}

export default function DashboardLeadsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const campaignFilter = sp.get("campaign_id");

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "100" });
      if (campaignFilter) qs.set("campaign_id", campaignFilter);
      if (dateRange?.[0] && dateRange[1]) {
        qs.set("date_from", dateRange[0].format("YYYY-MM-DD"));
        qs.set("date_to", dateRange[1].format("YYYY-MM-DD"));
      }
      const res = await fetch(`/api/command/leads?${qs.toString()}`);
      const data = (await res.json()) as { leads?: LeadRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch leads");
      setRows(data.leads ?? []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  }, [campaignFilter, dateRange]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.company_name ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.campaigns?.name ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const handleExportCsv = useCallback(() => {
    if (filtered.length === 0) {
      message.warning("No leads match the current filters to export.");
      return;
    }
    setExporting(true);
    try {
      const header = [
        "Lead Name",
        "Company",
        "Email",
        "Phone",
        "City",
        "Client LP Reg Timestamp",
        "Campaign",
        "Campaign Ref",
        "Status",
        "Consent",
        "Created At",
      ];
      const lines = [header.map(escapeCsvCell).join(",")];
      for (const r of filtered) {
        const lp = r.registered_at ? new Date(r.registered_at).toISOString() : "";
        const campaignName = r.campaigns?.name ?? "";
        const campaignRef = r.campaigns?.campaign_id ?? "";
        lines.push(
          [
            r.name ?? "",
            r.company_name ?? "",
            r.email ?? "",
            r.phone ?? "",
            r.city ?? "",
            lp,
            campaignName,
            campaignRef,
            r.status ?? "",
            r.consent_status ?? "",
            r.created_at ?? "",
          ]
            .map(escapeCsvCell)
            .join(",")
        );
      }
      const csv = `\uFEFF${lines.join("\n")}\n`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = dayjs().format("YYYY-MM-DD_HHmm");
      a.href = url;
      a.download = `leads-export_${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`Exported ${filtered.length} lead(s).`);
    } finally {
      setExporting(false);
    }
  }, [filtered]);

  const columns: ColumnsType<LeadRow> = [
    {
      title: "Lead",
      key: "lead",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name ?? "—"}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.company_name ?? "—"}</div>
        </div>
      ),
    },
    { title: "Email", dataIndex: "email", key: "email", render: (v) => v ?? "—" },
    { title: "Phone", dataIndex: "phone", key: "phone", render: (v) => v ?? "—" },
    { title: "City", dataIndex: "city", key: "city", render: (v) => v ?? "—" },
    {
      title: "Client LP Reg Timestamp",
      dataIndex: "registered_at",
      key: "registered_at",
      width: 200,
      render: (v: string | null) =>
        v ? (
          <Text style={{ fontSize: 13 }}>
            {new Date(v).toLocaleString(undefined, {
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Campaign",
      key: "campaign",
      render: (_, r) =>
        r.campaigns?.id ? (
          <Link onClick={() => router.push(`/dashboard/campaigns/${r.campaigns?.id}`)}>
            {r.campaigns?.name ?? r.campaigns?.campaign_id ?? "Campaign"}
          </Link>
        ) : (
          <Text type="secondary">{r.campaigns?.name ?? "—"}</Text>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag>{(v ?? "new").toUpperCase()}</Tag>,
    },
    {
      title: "Consent",
      dataIndex: "consent_status",
      key: "consent_status",
      render: (v: string | null) => <Tag color={v === "verified" ? "green" : "orange"}>{(v ?? "pending").toUpperCase()}</Tag>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Leads</Title>
        <Text type="secondary">
          {campaignFilter ? `Showing leads for campaign: ${campaignFilter}` : "All campaign leads"}
        </Text>
      </div>

      <Card>
        <Space style={{ marginBottom: 12, width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}>
          <Space wrap size="middle">
            <Input
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined />}
              placeholder="Search by lead/company/email/phone/campaign"
              style={{ width: 320, maxWidth: "100%" }}
            />
            <RangePicker
              value={dateRange}
              onChange={(v) => {
                if (!v || !v[0] || !v[1]) {
                  setDateRange(null);
                  return;
                }
                setDateRange([v[0], v[1]]);
              }}
              allowClear
              format="YYYY-MM-DD"
              placeholder={["Created from", "Created to"]}
            />
          </Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            disabled={loading}
            onClick={() => handleExportCsv()}
          >
            Export
          </Button>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
}
