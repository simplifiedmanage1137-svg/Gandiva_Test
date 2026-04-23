import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    // ✅ Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Get org
    const { data: profile } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId =
      (profile as { organization_id: string | null } | null)
        ?.organization_id;

    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    // ✅ Fetch clients
    const { data, error } = await supabase
      .from("clients")
      .select("company_name")
      .eq("organization_id", orgId)
      .order("company_name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch clients" },
        { status: 500 }
      );
    }

    // ✅ Fix TypeScript here
    type ClientRow = { company_name: string | null };

    return NextResponse.json({
      clients:
        (data as ClientRow[] | null)?.map((c) => c.company_name).filter(Boolean) ||
        [],
    });
  } catch (err) {
    console.error("Clients fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}