import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCampaignId } from "@/lib/campaigns";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const MAX_CAMPAIGN_ID_RETRIES = 10;

export async function POST(request: Request) {
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

    const body = await request.json();
    const {
      name,
      client_id: clientIdParam,
      client_name,
      description,
      industry,
      geography,
      target_designation,
      lead_type,
      start_date,
      end_date,
      status = "draft",
      cpl,
      revenue,
      booked,
      total_allocation,
      post_qa,
      achieved,
      pending_allocation,
      region,
      weekly_call,
      weekly_report,
      additional_comments,
      assigned_team_leader_id,
      employee_size,
      abm,
      seniority,
      job_function,
      creatives_url,
    } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Campaign Name is required" }, { status: 400 });
    }

    // Enforce unique campaign name per organization (case-insensitive)
    const trimmedName = name.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: "Campaign Name is required" }, { status: 400 });
    }

    const { data: existingByName, error: existingNameError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("name", trimmedName)
      .maybeSingle();

    if (existingNameError) {
      return NextResponse.json(
        { error: "Failed to validate campaign name uniqueness" },
        { status: 500 }
      );
    }

    if (existingByName) {
      return NextResponse.json(
        { error: "A campaign with this name already exists. Please choose a different name." },
        { status: 409 }
      );
    }

   let clientNameStr = "";

if (Array.isArray(client_name)) {
  clientNameStr = client_name.find((v) => typeof v === "string" && v.trim())?.trim() || "";
} else if (typeof client_name === "string") {
  clientNameStr = client_name.trim();
}
    let clientId: string | null = null;

    if (clientIdParam && typeof clientIdParam === "string" && clientIdParam.trim()) {
      const { data: clientRow, error: clientErr } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("id", clientIdParam.trim())
        .eq("organization_id", orgId)
        .single();
      if (clientErr || !clientRow) {
        return NextResponse.json(
          { error: "Invalid or unauthorized client selection" },
          { status: 400 }
        );
      }
      const row = clientRow as unknown as { id: string; company_name: string };
      clientId = row.id;
      clientNameStr = row.company_name?.trim() || clientNameStr || "";
    }

    if (!clientNameStr) {
      return NextResponse.json(
        { error: "Client Name is required to create a campaign. Select a client or enter a name." },
        { status: 400 }
      );
    }

    const validStatus = ["draft", "active", "paused", "completed"].includes(status)
      ? status
      : "draft";

    const leadTypeStr =
      Array.isArray(lead_type) && lead_type.length
        ? lead_type
            .map((v: unknown) => (typeof v === "string" ? v.trim() : String(v).trim()))
            .filter(Boolean)
            .join(", ")
        : typeof lead_type === "string"
        ? lead_type.trim() || null
        : null;

    let campaignId: string;
    let attempts = 0;
    do {
      campaignId = generateCampaignId({
        clientName: clientNameStr,
        campaignName: name.trim(),
      });
      const { data: existing } = await supabase
        .from("campaigns")
        .select("id")
        .eq("campaign_id", campaignId)
        .maybeSingle();
      if (!existing) break;
      attempts++;
      if (attempts >= MAX_CAMPAIGN_ID_RETRIES) {
        return NextResponse.json(
          { error: "Could not generate a unique Campaign ID. Please try again." },
          { status: 500 }
        );
      }
    } while (true);

    const { data: campaign, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        organization_id: orgId,
        campaign_id: campaignId,
        name: name.trim(),
        client_id: clientId,
        client_name: clientNameStr || null,
        description: description?.trim() || null,
        industry: industry?.trim() || null,
        geography: geography?.trim() || null,
        target_designation: target_designation?.trim() || null,
        lead_type: leadTypeStr,
        start_date: start_date || null,
        end_date: end_date || null,
        status: validStatus,
        cpl: cpl != null ? Number(cpl) : null,
        revenue: revenue != null ? Number(revenue) : null,
        booked: booked != null ? Number(booked) : null,
        total_allocation: total_allocation != null ? Number(total_allocation) : null,
        post_qa: post_qa != null ? Number(post_qa) : null,
        achieved: achieved != null ? Number(achieved) : null,
        pending_allocation: pending_allocation != null ? Number(pending_allocation) : null,
        region: region?.trim() || null,
        weekly_call: weekly_call?.trim() || null,
        weekly_report: weekly_report?.trim() || null,
        additional_comments: additional_comments?.trim() || null,
        assigned_team_leader_id: assigned_team_leader_id || null,
        employee_size: Array.isArray(employee_size) && employee_size.length > 0 ? employee_size.filter((v) => v && typeof v === "string").map((v) => String(v).trim()) : null,
        abm: abm === true || abm === "true" || abm === "yes" ? true : abm === false || abm === "false" || abm === "no" ? false : null,
        seniority: seniority != null && typeof seniority === "string" ? seniority.trim() || null : null,
        job_function: job_function != null && typeof job_function === "string" ? job_function.trim() || null : null,
        creatives_url: Array.isArray(creatives_url) && creatives_url.length > 0 ? creatives_url.filter((v) => v && typeof v === "string").map((v) => String(v).trim()).filter(Boolean) : null,
        created_by: user.id,
      } as never)
      .select("id, campaign_id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "A campaign with this ID already exists. Please try again." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const row = campaign as { id: string; campaign_id: string } | null;

    // Notify the assigned TL (if different from creator)
    if (assigned_team_leader_id && assigned_team_leader_id !== user.id && row?.id) {
      void createNotification({
        title: "New Campaign Assigned",
        message: `Campaign "${name.trim()}" has been created and assigned to you.`,
        type: "campaign",
        sender_id: user.id,
        receiver_id: assigned_team_leader_id,
        reference_type: "campaign",
        reference_id: row.id,
        organization_id: orgId,
      });
    }

    return NextResponse.json({
      campaign_id: row?.id,
      campaign_display_id: row?.campaign_id,
    });
  } catch (err) {
    console.error("Create campaign error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
