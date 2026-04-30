import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LEADS_SELECT_BASE =
  "id, lead_id, campaign_id, name, company_name, phone, email, city, status, followup_date, notes, assigned_agent_id, created_by, created_at, updated_at, job_title, job_function, job_level, direct_number, industry, company_number, employee_size, address, state, country, zip_code, founded_years, founded_years_link, revenue_range, revenue_link, contact_linkedin_url, company_linkedin_url, scored, appointment, lead_tagging, lead_disposition";
const LEADS_SELECT_EXTENDED =
  LEADS_SELECT_BASE +
  ", salutation, first_name, last_name, domain, phone_number_link, department, job_title_link, tenurity, vv_status, email_status, ev_tool, see_all_employees, employee_size_link, company_website_link, sic_code, sic_code_link, naics_code, naics_code_link, ra_comment, special_comments, call_back, call_notes, primary_reason, secondary_reason, qa_comments, cq1, cq2, cq3, cq4, cq5, audit_date, qa_name, asset_title";

export async function GET() {
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

    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("assigned_team_leader_id", user.id);

    if (campaignsError) {
      return NextResponse.json({ error: campaignsError.message }, { status: 500 });
    }

    const campaignList = (campaigns ?? []) as { id: string; name: string }[];
    if (campaignList.length === 0) {
      return NextResponse.json({ leads: [] });
    }

    const campaignIds = campaignList.map((c) => c.id);
    const campaignNames = campaignList.reduce<Record<string, string>>((acc, c) => {
      acc[c.id] = c.name ?? "—";
      return acc;
    }, {});

    let leadsRes = await supabase
      .from("leads")
      .select(LEADS_SELECT_EXTENDED + ", qa_status, disqualification_reasons, disqualification_reason, rectified_reason")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false });

    if (
      leadsRes.error &&
      (leadsRes.error.message?.includes("column") || leadsRes.error.message?.includes("qa_status"))
    ) {
      leadsRes = await supabase
        .from("leads")
        .select(LEADS_SELECT_BASE + ", qa_status, disqualification_reasons, disqualification_reason, rectified_reason")
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false });
    }

    if (leadsRes.error) {
      return NextResponse.json({ error: leadsRes.error.message }, { status: 500 });
    }

    const rawLeads = (leadsRes.data ?? []) as (Record<string, unknown> & {
      campaign_id?: string;
      assigned_agent_id?: string;
      created_by?: string;
    })[];

    const userIds = [
      ...new Set(
        rawLeads
          .flatMap((lead) => [lead.assigned_agent_id, lead.created_by])
          .filter(Boolean)
      ),
    ] as string[];

    let userNames: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", userIds);
      ((users ?? []) as { id: string; full_name: string | null; email: string | null }[]).forEach((u) => {
        userNames[u.id] = u.full_name || u.email || "Unknown";
      });
    }

    const leads = rawLeads.map((row) => ({
      ...row,
      campaign_name: row.campaign_id ? campaignNames[row.campaign_id] ?? "—" : "—",
      assigned_agent_name: row.assigned_agent_id ? userNames[row.assigned_agent_id] ?? "—" : "—",
      created_by_name: row.created_by ? userNames[row.created_by] ?? "—" : "—",
      qa_status: (row.qa_status as string | null) ?? null,
      disqualification_reasons: (row.disqualification_reasons as string | null) ?? null,
      disqualification_reason: (row.disqualification_reason as string | null) ?? null,
      rectified_reason: (row.rectified_reason as string | null) ?? null,
    }));

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("TL leads (all) error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
