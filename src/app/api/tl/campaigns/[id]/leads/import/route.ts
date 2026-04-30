import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClientSafe, ADMIN_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LEAD_FIELDS = [
  "name", "first_name", "last_name", "salutation", "company_name", "phone", "email", "domain",
  "direct_number", "company_number", "phone_number_link", "job_title", "job_level", "department",
  "job_function", "job_title_link", "tenurity", "vv_status", "email_status", "ev_tool",
  "address", "city", "state", "country", "zip_code", "employee_size", "see_all_employees",
  "industry", "channel", "employee_size_link", "company_website_link", "revenue_range", "revenue_link",
  "sic_code", "sic_code_link", "naics_code", "naics_code_link", "founded_years", "founded_years_link",
  "contact_linkedin_url", "company_linkedin_url", "scored", "appointment", "lead_tagging", "ra_comment", "special_comments", "call_back",
  "call_notes", "primary_reason", "secondary_reason", "qa_comments", "cq1", "cq2", "cq3", "cq4", "cq5",
  "audit_date", "qa_name", "asset_title", "status", "qa_status", "disqualification_reasons",
  "disqualification_reason", "rectified_reason", "lead_disposition", "followup_date", "notes", "delivery_status",
] as const;

function pickLeadFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of LEAD_FIELDS) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") {
      out[k] = typeof v === "string" ? v.trim() : v;
    }
  }
  return out;
}

function getChannelCandidates(channel: string | null): (string | null)[] {
  if (!channel) return [null];
  const lower = channel.toLowerCase();
  if (lower === "email") return ["Email", "email"];
  if (lower === "telemarketing") return ["Telemarketing", "telemarketing"];
  return [channel];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

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
    const canImport =
      roleNames.includes("team_leader") ||
      roleNames.includes("tl") ||
      roleNames.includes("qa") ||
      roleNames.includes("mis") ||
      roleNames.includes("admin");
    if (!canImport) {
      return NextResponse.json({ error: "You do not have permission to import leads" }, { status: 403 });
    }
    const useAdminDataClient = roleNames.includes("mis") || roleNames.includes("admin");
    const admin = useAdminDataClient ? getAdminClientSafe() : null;
    if (useAdminDataClient && !admin) {
      return NextResponse.json({ error: ADMIN_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }
    const dataClient = admin ?? supabase;

    const { id: campaignId } = await params;
    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
    }

    const { data: campaign } = await dataClient
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("organization_id", orgId)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const rawLeads = Array.isArray(body?.leads) ? body.leads : [];
    if (rawLeads.length === 0) {
      return NextResponse.json({ error: "No leads to import" }, { status: 400 });
    }
    if (rawLeads.length > 500) {
      return NextResponse.json({ error: "Maximum 500 leads per import" }, { status: 400 });
    }

    const { data: assignments } = await dataClient
      .from("campaign_assignments")
      .select("agent_id")
      .eq("campaign_id", campaignId)
      .eq("is_active", true)
      .limit(1);
    const firstAgentId = (assignments?.[0] as { agent_id: string } | undefined)?.agent_id ?? null;

    const errors: string[] = [];
    let created = 0;
    let updated = 0;

    for (let i = 0; i < rawLeads.length; i++) {
      const row = rawLeads[i] as Record<string, unknown>;
      const rowIdRaw = row["id"] as string | number | undefined;
      const rowId = rowIdRaw != null ? String(rowIdRaw).trim() : "";
      const fields = pickLeadFields(row);
      const first_name = ((fields.first_name as string) ?? (fields.name as string)?.split(/\s+/)[0]) ?? null;
      const last_name = ((fields.last_name as string) ?? (fields.name as string)?.split(/\s+/).slice(1).join(" ")) || null;
      const derivedName = [first_name, last_name].filter(Boolean).join(" ").trim() || (fields.name as string) || null;

      const leadStatus = typeof fields.status === "string" && fields.status.length > 0 ? fields.status : "new";
      const deliveryStatusRaw = typeof fields.delivery_status === "string" ? fields.delivery_status.trim().toLowerCase() : "";
      const normalizedDeliveryStatus =
        deliveryStatusRaw === "delivered"
          ? "delivered"
          : deliveryStatusRaw === "not_delivered" || deliveryStatusRaw === "not delivered"
          ? "not_delivered"
          : null;
      const channelRaw = typeof fields.channel === "string" ? fields.channel.trim().toLowerCase() : "";
      const normalizedChannel =
        channelRaw === "email"
          ? "Email"
          : channelRaw === "telemarketing"
          ? "Telemarketing"
          : null;
      const channelCandidates = getChannelCandidates(normalizedChannel);

      const upsertPayload = {
        name: derivedName || null,
        first_name: first_name || null,
        last_name: last_name || null,
        salutation: fields.salutation || null,
        company_name: fields.company_name || null,
        phone: fields.phone || null,
        email: fields.email || null,
        domain: fields.domain || null,
        direct_number: fields.direct_number || null,
        company_number: fields.company_number || null,
        phone_number_link: fields.phone_number_link || null,
        job_title: fields.job_title || null,
        job_level: fields.job_level || null,
        department: fields.department || null,
        job_function: fields.job_function || null,
        job_title_link: fields.job_title_link || null,
        tenurity: fields.tenurity || null,
        vv_status: fields.vv_status || null,
        email_status: fields.email_status || null,
        ev_tool: fields.ev_tool || null,
        address: fields.address || null,
        city: fields.city || null,
        state: fields.state || null,
        country: fields.country || null,
        zip_code: fields.zip_code || null,
        employee_size: fields.employee_size || null,
        see_all_employees: fields.see_all_employees || null,
        industry: fields.industry || null,
        channel: normalizedChannel,
        employee_size_link: fields.employee_size_link || null,
        company_website_link: fields.company_website_link || null,
        revenue_range: fields.revenue_range || null,
        revenue_link: fields.revenue_link || null,
        sic_code: fields.sic_code || null,
        sic_code_link: fields.sic_code_link || null,
        naics_code: fields.naics_code || null,
        naics_code_link: fields.naics_code_link || null,
        founded_years: fields.founded_years != null ? Number(fields.founded_years) : null,
        founded_years_link: fields.founded_years_link || null,
        contact_linkedin_url: fields.contact_linkedin_url || null,
        company_linkedin_url: fields.company_linkedin_url || null,
        scored: fields.scored || null,
        appointment: fields.appointment || null,
        lead_tagging: fields.lead_tagging || null,
        ra_comment: fields.ra_comment || null,
        special_comments: fields.special_comments || null,
        call_back: fields.call_back || null,
        call_notes: fields.call_notes || null,
        primary_reason: fields.primary_reason || null,
        secondary_reason: fields.secondary_reason || null,
        qa_comments: fields.qa_comments || null,
        cq1: fields.cq1 || null,
        cq2: fields.cq2 || null,
        cq3: fields.cq3 || null,
        cq4: fields.cq4 || null,
        cq5: fields.cq5 || null,
        audit_date: fields.audit_date || null,
        qa_name: fields.qa_name || null,
        asset_title: fields.asset_title || null,
        status: leadStatus,
        qa_status: fields.qa_status && typeof fields.qa_status === "string" ? fields.qa_status.trim().toLowerCase() : null,
        disqualification_reasons: fields.disqualification_reasons && typeof fields.disqualification_reasons === "string" ? fields.disqualification_reasons.trim() : null,
        disqualification_reason: fields.disqualification_reason && typeof fields.disqualification_reason === "string" ? fields.disqualification_reason.trim() : null,
        rectified_reason: fields.rectified_reason && typeof fields.rectified_reason === "string" ? fields.rectified_reason.trim() : null,
        lead_disposition: fields.lead_disposition || null,
        followup_date: fields.followup_date || null,
        notes: fields.notes || null,
        delivery_status: normalizedDeliveryStatus ?? undefined,
      } as Record<string, unknown>;

      // If CSV has existing id, update that lead; otherwise create new one
      if (rowId) {
        if (!normalizedDeliveryStatus) {
          delete upsertPayload.delivery_status;
        }
        let updateError: { message: string } | null = null;
        for (const candidateChannel of channelCandidates) {
          const payload = { ...upsertPayload, channel: candidateChannel } as Record<string, unknown>;
          const { error } = await dataClient
            .from("leads")
            .update(payload as never)
            .eq("id", rowId)
            .eq("campaign_id", campaignId)
            .eq("organization_id", orgId);
          updateError = error as { message: string } | null;
          if (!updateError) break;
          if (!updateError.message?.includes("leads_channel_check")) break;
        }

        if (updateError) {
          errors.push(`Row ${i + 1}: ${updateError.message}`);
        } else {
          updated++;
        }
      } else {
        if (!derivedName && !fields.company_name && !fields.email && !fields.phone) {
          errors.push(`Row ${i + 1}: At least one of name, company, email, or phone is required`);
          continue;
        }

        let insertError: { message: string } | null = null;
        for (const candidateChannel of channelCandidates) {
          const { error } = await dataClient
            .from("leads")
            .insert({
              organization_id: orgId,
              campaign_id: campaignId,
              assigned_agent_id: firstAgentId,
              ...upsertPayload,
              delivery_status: normalizedDeliveryStatus ?? "not_delivered",
              channel: candidateChannel,
              created_by: user.id,
            } as never);
          insertError = error as { message: string } | null;
          if (!insertError) break;
          if (!insertError.message?.includes("leads_channel_check")) break;
        }

        if (insertError) {
          errors.push(`Row ${i + 1}: ${insertError.message}`);
        } else {
          created++;
        }
      }
    }

    return NextResponse.json({ created, updated, total: rawLeads.length, errors });
  } catch (err) {
    console.error("Leads import error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
