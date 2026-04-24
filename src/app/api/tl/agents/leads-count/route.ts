import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
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

    // Fetch all leads with assigned_agent_id for this org
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("assigned_agent_id")
      .eq("organization_id", orgId)
      .not("assigned_agent_id", "is", null);

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    // Count leads per agent
    const countByAgent: Record<string, number> = {};
    ((leads ?? []) as { assigned_agent_id: string }[]).forEach((l) => {
      countByAgent[l.assigned_agent_id] = (countByAgent[l.assigned_agent_id] ?? 0) + 1;
    });

    return NextResponse.json({ countByAgent });
  } catch (err) {
    console.error("Agent leads count error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
