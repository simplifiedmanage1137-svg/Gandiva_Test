import * as XLSX from "xlsx";
import type { Lead } from "@/types/lead.types";

/**
 * All lead fields in export order (matches database / Lead type).
 * Header = column name in CSV/Excel; key = property on Lead.
*/
const CSV_COLUMNS: { key: keyof Lead | string; header: string }[] = [
  { key: "created_at", header: "created_at" },
  { key: "audit_date", header: "audit_date" },
  { key: "created_by_name", header: "Agent_Name" },
  { key: "updated_at", header: "updated_at" },
  { key: "campaign_id", header: "campaign_id" },
  { key: "campaign_name", header: "campaign_name" },
  { key: "asset_title", header: "asset_title" },
  { key: "salutation", header: "salutation" },
  { key: "first_name", header: "first_name" },
  { key: "last_name", header: "last_name" },
  { key: "email", header: "email" },
  { key: "domain", header: "domain" },
  { key: "company_name", header: "company_name" },
  { key: "address", header: "address" },
  { key: "city", header: "city" },
  { key: "state", header: "state" },
  { key: "country", header: "country" },
  { key: "zip_code", header: "zip_code" },
   { key: "company_number", header: "company_number" },
  { key: "direct_number", header: "direct_number" },
  { key: "phone_number_link", header: "phone_number_link" },
  { key: "job_title", header: "job_title" },
  { key: "job_level", header: "job_level" },
  { key: "department", header: "department" },
  { key: "job_title_link", header: "job_title_link" },
  { key: "employee_size", header: "employee_size" },
  { key: "see_all_employees", header: "see_all_employees" },
  { key: "industry", header: "industry" },
  { key: "employee_size_link", header: "employee_size_link" },
  { key: "company_website_link", header: "company_website_link" },
  { key: "revenue_range", header: "revenue_range" },
  { key: "revenue_link", header: "revenue_link" },
  { key: "sic_code", header: "sic_code" },
  { key: "sic_code_link", header: "sic_code_link" },
  { key: "naics_code", header: "naics_code" },
  { key: "naics_code_link", header: "naics_code_link" },
  { key: "ra_comment", header: "ra_comment" },
  { key: "special_comments", header: "special_comments" },
  { key: "call_back", header: "call_back" },
  { key: "call_notes", header: "call_notes" },
  { key: "qa_status", header: "qa_status" },
  { key: "primary_reason", header: "primary_reason" },
  { key: "secondary_reason", header: "secondary_reason" },
  { key: "qa_comments", header: "qa_comments" },
  { key: "cq1", header: "cq1" },
  { key: "cq2", header: "cq2" },
  { key: "cq3", header: "cq3" },
  { key: "cq4", header: "cq4" },
  { key: "cq5", header: "cq5" },
  { key: "tenurity", header: "tenurity" },
  { key: "vv_status", header: "vv_status" },
  { key: "email_status", header: "email_status" },
  { key: "ev_tool", header: "ev_tool" },
  { key: "id", header: "id" },
  { key: "lead_id", header: "lead_id" },
  { key: "name", header: "name" },
  { key: "phone", header: "phone" },
  { key: "job_function", header: "job_function" },
  { key: "founded_years", header: "founded_years" },
  { key: "founded_years_link", header: "founded_years_link" },
  { key: "contact_linkedin_url", header: "contact_linkedin_url" },
  { key: "company_linkedin_url", header: "company_linkedin_url" },
  { key: "scored", header: "scored" },
  { key: "appointment", header: "appointment" },
  { key: "lead_tagging", header: "lead_tagging" },
  { key: "status", header: "status" },
  { key: "disqualification_reasons", header: "disqualification_reasons" },
  { key: "disqualification_reason", header: "disqualification_reason" },
  { key: "rectified_reason", header: "rectified_reason" },
  { key: "lead_disposition", header: "lead_disposition" },
  { key: "followup_date", header: "followup_date" },
  { key: "notes", header: "notes" },
  { key: "created_by", header: "created_by" },
];

/**
 * Columns that should be hidden from Agent Excel format downloads.
 *
 * - Lead ID, internal row id, and campaign id are system-managed identifiers
 * - QA-only fields are not relevant for Agent uploads
 * - Created By is auto-assigned from the authenticated Agent
 */
const AGENT_HIDDEN_COLUMNS = new Set<string>([
  "id",
  "campaign_id",
  "lead_id",
  "asset_title",
  "qa_status",
  "audit_date",
  "qa_name",
  "tenurity",
  "vv_status",
  "email_status",
  "ev_tool",
  "primary_reason",
  "secondary_reason",
  "qa_comments",
  "disqualification_reasons",
  "disqualification_reason",
  "rectified_reason",
  "lead_disposition",
  "created_by",
  "created_by_name",
]);

const AGENT_EXCEL_COLUMNS = CSV_COLUMNS.filter(
  (c) => !AGENT_HIDDEN_COLUMNS.has(String(c.key))
);

function escapeCsvValue(val: string | number | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function leadsToCsv(leads: Lead[]): string {
  const headers = CSV_COLUMNS.map((c) => c.header).join(",");
  const rows = leads.map((lead) => {
    const record = lead as Record<string, unknown>;
    return CSV_COLUMNS.map((c) =>
      escapeCsvValue(record[c.key] as string | number | null | undefined)
    ).join(",");
  });
  return [headers, ...rows].join("\n");
}

export function downloadCsv(leads: Lead[], filename?: string): void {
  const csv = leadsToCsv(leads);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ?? `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build array of arrays for Excel: first row = headers, then one row per lead.
 * Same columns as CSV so re-upload matches by id and updates correctly.
 */
function leadsToSheetData(leads: Lead[]): unknown[][] {
  const headers = CSV_COLUMNS.map((c) => c.header);
  const rows = leads.map((lead) => {
    const record = lead as Record<string, unknown>;
    return CSV_COLUMNS.map((c) => {
      const v = record[c.key];
      if (v == null) return "";
      return typeof v === "object" ? JSON.stringify(v) : v;
    });
  });
  return [headers, ...rows];
}

/**
 * Download leads as an Excel file (.xlsx). Same columns as CSV including id
 * so that re-upload can match by id and update existing leads.
 */
export function downloadExcel(leads: Lead[], filename?: string): void {
  const data = leadsToSheetData(leads);
  const ws = XLSX.utils.aoa_to_sheet(data);
  const colWidths = CSV_COLUMNS.map((_, i) => {
  const maxLen = Math.max(
      ...data.map((row) => String(row[i] ?? "").length),
      (CSV_COLUMNS[i]?.header ?? "").length,
      10
    );
    return { wch: Math.min(maxLen, 50) };
  });
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ?? `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function leadsToAgentSheetData(leads: Lead[]): unknown[][] {
  const headers = AGENT_EXCEL_COLUMNS.map((c) => c.header);
  const rows = leads.map((lead) => {
    const record = lead as Record<string, unknown>;
    return AGENT_EXCEL_COLUMNS.map((c) => {
      const v = record[c.key];
      if (v == null) return "";
      return typeof v === "object" ? JSON.stringify(v) : v;
    });
  });
  return [headers, ...rows];
}

/**
 * Download Agent-safe Excel: hides Lead ID, QA fields, and Created By so that
 * uploaded files only contain fields Agents are allowed to see/edit.
 */
export function downloadAgentExcel(
  leads: Lead[],
  filename?: string
): void {
  const data = leadsToAgentSheetData(leads);
  const ws = XLSX.utils.aoa_to_sheet(data);
  const colWidths = AGENT_EXCEL_COLUMNS.map((_, i) => {
    const maxLen = Math.max(
      ...data.map((row) => String(row[i] ?? "").length),
      (AGENT_EXCEL_COLUMNS[i]?.header ?? "").length,
      10
    );
    return { wch: Math.min(maxLen, 50) };
  });
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ??
    `agent-leads-format-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
