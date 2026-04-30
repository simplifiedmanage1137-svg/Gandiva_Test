import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClientSafe, ADMIN_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LEADS_SELECT =
  "id, lead_id, name, company_name, phone, email, city, status, qa_status, delivery_status, disqualification_reasons, disqualification_reason, rectified_reason, followup_date, notes, assigned_agent_id, created_by, created_at, updated_at, campaign_id, job_title, job_function, job_level, direct_number, industry, channel, company_number, employee_size, address, state, country, zip_code, founded_years, founded_years_link, revenue_range, revenue_link, contact_linkedin_url, company_linkedin_url, scored, appointment, lead_tagging, lead_disposition, salutation, first_name, last_name, domain, phone_number_link, department, job_title_link, tenurity, vv_status, email_status, ev_tool, see_all_employees, employee_size_link, company_website_link, sic_code, sic_code_link, naics_code, naics_code_link, ra_comment, special_comments, call_back, call_notes, primary_reason, secondary_reason, qa_comments, cq1, cq2, cq3, cq4, cq5, audit_date, qa_name, asset_title";
const LEADS_SELECT_NO_DELIVERY =
  "id, lead_id, name, company_name, phone, email, city, status, qa_status, disqualification_reasons, disqualification_reason, rectified_reason, followup_date, notes, assigned_agent_id, created_by, created_at, updated_at, campaign_id, job_title, job_function, job_level, direct_number, industry, channel, company_number, employee_size, address, state, country, zip_code, founded_years, founded_years_link, revenue_range, revenue_link, contact_linkedin_url, company_linkedin_url, scored, appointment, lead_tagging, lead_disposition, salutation, first_name, last_name, domain, phone_number_link, department, job_title_link, tenurity, vv_status, email_status, ev_tool, see_all_employees, employee_size_link, company_website_link, sic_code, sic_code_link, naics_code, naics_code_link, ra_comment, special_comments, call_back, call_notes, primary_reason, secondary_reason, qa_comments, cq1, cq2, cq3, cq4, cq5, audit_date, qa_name, asset_title";
const LEADS_SELECT_NO_DELIVERY_NO_CHANNEL =
  "id, lead_id, name, company_name, phone, email, city, status, qa_status, disqualification_reasons, disqualification_reason, rectified_reason, followup_date, notes, assigned_agent_id, created_by, created_at, updated_at, campaign_id, job_title, job_function, job_level, direct_number, industry, company_number, employee_size, address, state, country, zip_code, founded_years, founded_years_link, revenue_range, revenue_link, contact_linkedin_url, company_linkedin_url, scored, appointment, lead_tagging, lead_disposition, salutation, first_name, last_name, domain, phone_number_link, department, job_title_link, tenurity, vv_status, email_status, ev_tool, see_all_employees, employee_size_link, company_website_link, sic_code, sic_code_link, naics_code, naics_code_link, ra_comment, special_comments, call_back, call_notes, primary_reason, secondary_reason, qa_comments, cq1, cq2, cq3, cq4, cq5, audit_date, qa_name, asset_title";

type LeadRow = {
  assigned_agent_id: string | null;
  created_by: string | null;
  disqualification_reasons: string | null;
  disqualification_reason: string | null;
  rectified_reason: string | null;
  [key: string]: unknown;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId = (profile as { organization_id: string | null } | null)?.organization_id;
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id);
    const roleNames = ((roleRows ?? []) as { roles: { name: string } | null }[]).map((r) =>
      r.roles?.name?.toLowerCase().trim().replace(/\s+/g, "_")
    );
    const canView = roleNames.includes("mis") || roleNames.includes("admin");
    if (!canView) {
      return NextResponse.json({ error: "Forbidden: MIS or Admin role required" }, { status: 403 });
    }

    const admin = getAdminClientSafe();
    if (!admin) {
      return NextResponse.json({ error: ADMIN_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }

    const { id: campaignId } = await params;
    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
    }

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .select(`
        id, campaign_id, name, client_name, description, industry, geography, target_designation, lead_type, status,
        start_date, end_date, created_at, cpl, revenue, booked, total_allocation, post_qa, achieved, pending_allocation,
        region, weekly_call, weekly_report, additional_comments, assigned_team_leader_id,
        employee_size, abm, seniority, job_function, creatives_url
      `)
      .eq("id", campaignId)
      .eq("organization_id", orgId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const camp = campaign as { assigned_team_leader_id?: string | null; [k: string]: unknown };
    let assigned_team_leader_name: string | null = null;
    if (camp.assigned_team_leader_id) {
      const { data: tlUser } = await admin
        .from("users")
        .select("full_name, email")
        .eq("id", camp.assigned_team_leader_id)
        .single();
      const u = tlUser as { full_name: string | null; email: string | null } | null;
      assigned_team_leader_name = u ? (u.full_name || u.email || null) : null;
    }
    const campaignWithTlName = { ...(campaign as Record<string, unknown>), assigned_team_leader_name };

    let { data: leadsData, error: leadsError } = await admin
      .from("leads")
      .select(LEADS_SELECT + ", disqualification_reasons, disqualification_reason, rectified_reason")
      .eq("campaign_id", campaignId)
      .eq("lead_tagging", "Scored")
      .order("delivery_status", { ascending: true })
      .order("created_at", { ascending: false });

    if (leadsError && (leadsError.message?.includes("column") || leadsError.message?.includes("disqualification"))) {
      leadsError = null;
      const fallback = await admin
        .from("leads")
        .select(
          "id, lead_id, name, company_name, phone, email, city, status, qa_status, delivery_status, followup_date, notes, assigned_agent_id, created_by, created_at, updated_at, campaign_id, job_title, job_function, job_level, direct_number, industry, company_number, employee_size, address, state, country, zip_code, founded_years, founded_years_link, revenue_range, revenue_link, contact_linkedin_url, company_linkedin_url, scored, appointment, lead_tagging, lead_disposition, disqualification_reasons, disqualification_reason, rectified_reason"
        )
        .eq("campaign_id", campaignId)
        .eq("lead_tagging", "Scored")
        .order("delivery_status", { ascending: true })
        .order("created_at", { ascending: false });
      leadsData = fallback.data;
      leadsError = fallback.error;
    }
    if (leadsError && leadsError.message?.toLowerCase().includes("delivery_status")) {
      leadsError = null;
      const fallbackNoDelivery = await admin
        .from("leads")
        .select(LEADS_SELECT_NO_DELIVERY)
        .eq("campaign_id", campaignId)
        .eq("lead_tagging", "Scored")
        .order("created_at", { ascending: false });
      const fallbackRows = (fallbackNoDelivery.data ?? []) as Record<string, unknown>[];
      leadsData = fallbackRows.map((r) => ({
        ...r,
        delivery_status: "not_delivered",
      })) as unknown as typeof leadsData;
      leadsError = fallbackNoDelivery.error;
    }
    if (leadsError && leadsError.message?.toLowerCase().includes("channel")) {
      leadsError = null;
      const fallbackNoChannel = await admin
        .from("leads")
        .select(LEADS_SELECT_NO_DELIVERY_NO_CHANNEL)
        .eq("campaign_id", campaignId)
        .eq("lead_tagging", "Scored")
        .order("created_at", { ascending: false });
      const fallbackRows = (fallbackNoChannel.data ?? []) as Record<string, unknown>[];
      leadsData = fallbackRows.map((r) => ({
        ...r,
        delivery_status: "not_delivered",
        channel: null,
      })) as unknown as typeof leadsData;
      leadsError = fallbackNoChannel.error;
    }

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    const rawList = (leadsData ?? []) as LeadRow[];
    const leadsList: LeadRow[] = rawList.map((row) => ({
      ...row,
      disqualification_reasons: row.disqualification_reasons ?? null,
      disqualification_reason: row.disqualification_reason ?? null,
      rectified_reason: row.rectified_reason ?? null,
    }));

    const userIds = [...new Set(leadsList.flatMap((l) => [l.assigned_agent_id, l.created_by].filter(Boolean)))] as string[];
    let userNames: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: usersData } = await admin.from("users").select("id, full_name, email").in("id", userIds);
      ((usersData ?? []) as { id: string; full_name: string | null; email: string | null }[]).forEach((u) => {
        userNames[u.id] = u.full_name || u.email || "Unknown";
      });
    }

    const leadsWithNames = leadsList.map((l: Record<string, unknown>) => ({
      ...l,
      assigned_agent_name: l.assigned_agent_id ? userNames[l.assigned_agent_id as string] ?? "—" : null,
      created_by_name: l.created_by ? userNames[l.created_by as string] ?? "—" : null,
    }));

    return NextResponse.json({
      campaign: campaignWithTlName,
      leads: leadsWithNames,
    });
  } catch (err) {
    console.error("MIS campaign detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
