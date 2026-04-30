import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClientSafe, ADMIN_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function getUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const orgId = (profile as { organization_id: string | null } | null)?.organization_id;
  if (!orgId) {
    return { error: NextResponse.json({ error: "No organization" }, { status: 400 }) };
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id);
  const roleNames = ((roleRows ?? []) as { roles: { name: string } | null }[])
    .map((r) => r.roles?.name?.toLowerCase().trim().replace(/\s+/g, "_"))
    .filter(Boolean) as string[];

  if (!roleNames.includes("sales_manager")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, orgId };
}

function str(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

function num(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getUserContext();
    if ("error" in ctx) return ctx.error;
    const { orgId } = ctx;

    const clientId = params.id;
    if (!clientId) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
    }

    const body = await request.json();

    const company_name = str(body.company_name);
    if (!company_name) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const contact_person = str(body.contact_person);
    if (!contact_person) {
      return NextResponse.json({ error: "Contact person is required" }, { status: 400 });
    }

    const contact_full_name = str(body.contact_full_name);
    if (!contact_full_name) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    const country = str(body.country);
    if (!country) {
      return NextResponse.json({ error: "Country is required" }, { status: 400 });
    }

    const admin = getAdminClientSafe();
    if (!admin) {
      return NextResponse.json({ error: ADMIN_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }

    const payload = {
      company_name,
      company_website: str(body.company_website),
      industry_type: str(body.industry_type),
      company_size: str(body.company_size),
      year_established: num(body.year_established),
      company_address: str(body.company_address),
      city: str(body.city),
      state: str(body.state),
      country,
      contact_person,
      contact_full_name,
      contact_designation: str(body.contact_designation),
      contact_work_email: str(body.contact_work_email),
      contact_mobile: str(body.contact_mobile),
      contact_linkedin: str(body.contact_linkedin),
    };

    const { error } = await admin
      .from("clients")
      .update(payload as never)
      .eq("id", clientId)
      .eq("organization_id", orgId);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update client" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update client error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getUserContext();
    if ("error" in ctx) return ctx.error;
    const { orgId } = ctx;

    const clientId = params.id;
    if (!clientId) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
    }

    const admin = getAdminClientSafe();
    if (!admin) {
      return NextResponse.json({ error: ADMIN_NOT_CONFIGURED_MESSAGE }, { status: 503 });
    }

    const { error } = await admin
      .from("clients")
      .delete()
      .eq("id", clientId)
      .eq("organization_id", orgId);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to delete client" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete client error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
