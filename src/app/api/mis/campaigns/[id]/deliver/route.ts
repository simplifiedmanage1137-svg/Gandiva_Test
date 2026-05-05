import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClientSafe, ADMIN_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
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
      return NextResponse.json({ error: "Forbidden: Only MIS or Admin can mark as delivered" }, { status: 403 });
    }

    const admin = getAdminClientSafe();
    if (!admin) return NextResponse.json({ error: ADMIN_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    const { data: existing, error: fetchError } = await admin
      .from("campaigns")
      .select("id, status, client_id")
      .eq("id", params.id)
      .eq("organization_id", orgId)
      .single();

    if (fetchError || !existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    if (!existing.client_id) {
      return NextResponse.json({ error: "Cannot deliver: campaign has no client assigned" }, { status: 422 });
    }

    if (String(existing.status).toLowerCase() === "delivered") {
      return NextResponse.json({ message: "Already delivered", alreadyDelivered: true });
    }

    const { error: updateError } = await admin
      .from("campaigns")
      .update({ status: "delivered", updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("organization_id", orgId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("MIS deliver error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
