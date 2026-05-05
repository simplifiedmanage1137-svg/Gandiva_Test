import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClientSafe, ADMIN_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LEADS_SELECT =
  "id, lead_id, name, company_name, phone, email, city, status, qa_status, disqualification_reasons, disqualification_reason, rectified_reason, followup_date, notes, assigned_agent_id, created_by, created_at, updated_at, campaign_id, job_title, job_function, job_level, direct_number, industry, company_number, employee_size, address, state, country, zip_code, founded_years, founded_years_link, revenue_range, revenue_link, contact_linkedin_url, company_linkedin_url, scored, appointment, lead_tagging, lead_disposition, salutation, first_name, last_name, domain, phone_number_link, department, job_title_link, tenurity, vv_status, email_status, ev_tool, see_all_employees, employee_size_link, company_website_link, sic_code, sic_code_link, naics_code, naics_code_link, ra_comment, special_comments, call_back, call_notes, primary_reason, secondary_reason, qa_comments, cq1, cq2, cq3, cq4, cq5, audit_date, qa_name, asset_title";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId = (profile as { organization_id: string | null } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id);

    const roleNames = ((roleRows ?? []) as { roles: { name: string } | null }[])
      .map((r) => r.roles?.name?.toLowerCase().trim().replace(/\s+/g, "_"));

    if (!roleNames.includes("mis") && !roleNames.includes("admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getAdminClientSafe();
    if (!admin) return NextResponse.json({ error: ADMIN_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    const campaignId = params.id;

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .select("id, campaign_id, name, client_id, client_name, description, industry, geography, target_designation, lead_type, status, start_date, end_date, created_at, cpl, revenue, booked, total_allocation, post_qa, achieved, pending_allocation, region, weekly_call, weekly_report, additional_comments, assigned_team_leader_id, employee_size, abm, seniority, job_function, creatives_url")
      .eq("id", campaignId)
      .eq("organization_id", orgId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const camp = campaign as { assigned_team_leader_id?: string | null; [k: string]: unknown };
    let assigned_team_leader_name: string | null = null;
    if (camp.assigned_team_leader_id) {
      const { data: tlUser } = await supabase
        .from("users")
        .select("full_name, email")
        .eq("id", camp.assigned_team_leader_id)
        .single();
      const u = tlUser as { full_name: string | null; email: string | null } | null;
      assigned_team_leader_name = u ? (u.full_name || u.email || null) : null;
    }

    // Fetch ALL leads for this campaign (no lead_tagging filter — MIS sees everything)
    const { data: leadsData, error: leadsError } = await admin
      .from("leads")
      .select(LEADS_SELECT)
      .eq("campaign_id", campaignId)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 });

    const rawLeads = (leadsData ?? []) as Record<string, unknown>[];

    // Resolve user names
    const userIds = [...new Set(
      rawLeads.flatMap((l) => [l.assigned_agent_id, l.created_by].filter(Boolean))
    )] as string[];

    let userNames: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", userIds);
      ((usersData ?? []) as { id: string; full_name: string | null; email: string | null }[]).forEach((u) => {
        userNames[u.id] = u.full_name || u.email || "Unknown";
      });
    }

    const leads = rawLeads.map((l) => ({
      ...l,
      assigned_agent_name: l.assigned_agent_id ? (userNames[l.assigned_agent_id as string] ?? "—") : null,
      created_by_name: l.created_by ? (userNames[l.created_by as string] ?? "—") : null,
    }));

    return NextResponse.json({
      campaign: { ...campaign, assigned_team_leader_name },
      leads,
    });
  } catch (err) {
    console.error("MIS campaign detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
