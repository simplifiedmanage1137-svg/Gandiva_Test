"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  Table,
  Button,
  Spin,
  Typography,
  message,
  Row,
  Col,
  DatePicker,
  Input,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { ArrowLeftOutlined, DownloadOutlined } from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";
import { downloadCsv } from "@/lib/leadsExport";
import { getLeadTableColumns } from "@/components/Leads/LeadTableColumns";
import type { Lead } from "@/types/lead.types";

type LeadWithCampaign = Lead & { campaign_id?: string; campaign_name?: string | null };

export default function AgentMyLeadsPage() {
  const { hasRole, isInitialized } = useAuth();
  const [leads, setLeads] = useState<LeadWithCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      setLoading(false);
      return;
    }

    setIsOffline(false);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/leads", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load leads");
      setLeads(data.leads ?? []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (!hasRole("agent")) return;
    fetchLeads();
  }, [isInitialized, hasRole, fetchLeads]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchLeads();
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
  }, [fetchLeads]);

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
          (l.campaign_name ?? "").toLowerCase().includes(q) ||
          ([l.first_name, l.last_name].filter(Boolean).join(" ") ?? "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (!dateRange?.[0] || !dateRange?.[1]) return true;
      const leadDate = dayjs(l.created_at).startOf("day");
      const start = dateRange[0].startOf("day");
      const end = dateRange[1].endOf("day");
      return !leadDate.isBefore(start) && !leadDate.isAfter(end);
    });
  }, [leads, leadSearch, dateRange]);

  const baseColumns = getLeadTableColumns({ showActions: false });
  const campaignColumn = {
    title: "Campaign",
    key: "campaign_name",
    width: 180,
    fixed: "left" as const,
    ellipsis: true,
    render: (_: unknown, r: LeadWithCampaign) =>
      r.campaign_id ? (
        <Link href={`/agent/campaigns/${r.campaign_id}`} style={{ fontWeight: 500 }} onClick={(e) => e.stopPropagation()}>
          {r.campaign_name ?? "—"}
        </Link>
      ) : (
        (r.campaign_name as string) ?? "—"
      ),
  };
  const columns = [baseColumns[0], campaignColumn, ...baseColumns.slice(1)];

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spin size="large" />
      </div>
    );
  }

  if (!hasRole("agent")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/agent/dashboard"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#1677ff", textDecoration: "none", marginBottom: 16 }}
          >
            <ArrowLeftOutlined /> Back to Dashboard
          </Link>
          <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>
            Leads
          </Typography.Title>
          <Typography.Text type="secondary">
            All leads assigned to you across campaigns.
          </Typography.Text>
        </div>

        {isOffline && (
          <div style={{ marginBottom: 16 }}>
            <Typography.Text type="danger" style={{ fontSize: 14 }}>
              You appear to be offline. Check your internet connection. Data will reload
              automatically once you are back online, or{" "}
              <Button type="link" onClick={fetchLeads} style={{ padding: 0 }}>
                click here to retry now
              </Button>
              .
            </Typography.Text>
          </div>
        )}

        <Card
          title={`Leads (${filteredLeads.length}${filteredLeads.length !== leads.length ? ` of ${leads.length}` : ""})`}
          extra={
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                const toExport = filteredLeads.length > 0 ? filteredLeads : leads;
                if (toExport.length === 0) message.warning("No leads to export");
                else {
                  downloadCsv(toExport, `my-leads-${new Date().toISOString().slice(0, 10)}.csv`);
                  message.success(`Exported ${toExport.length} leads`);
                }
              }}
              disabled={leads.length === 0}
            >
              Export
            </Button>
          }
          style={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
          bodyStyle={{ padding: "24px 28px" }}
        >
          <Row gutter={12} wrap align="middle" style={{ marginBottom: 16 }}>
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
                placeholder="Search (campaign, Lead ID, name, company, email, phone)..."
                allowClear
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                style={{ width: "100%", maxWidth: 360 }}
              />
            </Col>
          </Row>
          <Typography.Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 12 }}>
            {filteredLeads.length !== leads.length
              ? `Showing ${filteredLeads.length} of ${leads.length} leads. Click a campaign to open it.`
              : "Click a campaign name to open that campaign."}
          </Typography.Text>
          <Table
            className="table-single-line"
            columns={columns}
            dataSource={filteredLeads}
            rowKey="id"
            loading={loading}
            scroll={{ x: 2800 }}
            pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} leads` }}
            locale={{
              emptyText: leadSearch || dateRange?.[0] || dateRange?.[1]
                ? "No leads match the filter."
                : "No leads assigned yet. Your Team Leader can assign you to campaigns.",
            }}
            size="middle"
          />
        </Card>
      </div>
    </div>
  );
}
