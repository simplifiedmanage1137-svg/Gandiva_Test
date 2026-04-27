import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("users").select("organization_id").eq("id", user.id).single();
    const orgId = (profile as { organization_id: string | null } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    // Fetch unique lead_type values from campaigns table
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("lead_type")
      .eq("organization_id", orgId)
      .not("lead_type", "is", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const leadTypes = [
      ...new Set(
        (campaigns ?? [])
          .map((c: { lead_type: string | null }) => c.lead_type?.trim())
          .filter(Boolean) as string[]
      ),
    ].sort();

    return NextResponse.json({ leadTypes });
  } catch (err) {
    console.error("Lead types error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
