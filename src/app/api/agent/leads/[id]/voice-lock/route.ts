import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClientSafe, ADMIN_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Reuse the existing Supabase bucket used for campaign files
const VOICE_BUCKET = "campaign-files";
const MAX_RECORDINGS_PER_LEAD = 4;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
];

type LeadRecord = {
  id: string;
  campaign_id: string;
  organization_id: string;
};

type VoiceObject = {
  name: string;
  id: string;
  path: string;
  size: number | null;
  created_at: string | null;
  url: string | null;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

async function getAuthContext() {
  const supabase = await createClient();
  const admin = getAdminClientSafe();

  if (!admin) {
    return {
      error: NextResponse.json(
        { error: ADMIN_NOT_CONFIGURED_MESSAGE },
        { status: 503 }
      ),
    };
  }
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

  return { supabase, admin, userId: user.id, orgId };
}

async function getLeadForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string,
  leadId: string
) {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, campaign_id, organization_id")
    .eq("id", leadId)
    .single();

  if (leadError || !lead || (lead as LeadRecord).organization_id !== orgId) {
    return { error: NextResponse.json({ error: "Lead not found" }, { status: 404 }) };
  }

  const l = lead as LeadRecord;

  // Determine user roles to decide how strictly to enforce campaign assignment.
  // Agents must be explicitly assigned; TL/QA/Admin/Sales can access any lead in their organization.
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId);
  const roleNames = ((roleRows ?? []) as { roles: { name: string } | null }[])
    .map((r) => r.roles?.name?.toLowerCase().trim().replace(/\s+/g, "_"))
    .filter((n): n is string => !!n);

  const isAgent = roleNames.includes("agent");
  const isPrivileged =
    roleNames.includes("team_leader") ||
    roleNames.includes("tl") ||
    roleNames.includes("qa") ||
    roleNames.includes("admin") ||
    roleNames.includes("sales");

  if (isAgent && !isPrivileged) {
    // For pure Agent users, require an active campaign assignment
    const { data: assignment } = await supabase
      .from("campaign_assignments")
      .select("id")
      .eq("campaign_id", l.campaign_id)
      .eq("agent_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!assignment) {
      return {
        error: NextResponse.json(
          { error: "You are not assigned to this campaign" },
          { status: 403 }
        ),
      };
    }
  }

  return { lead: l };
}

async function listVoiceObjects(
  storageClient: { storage: NonNullable<ReturnType<typeof getAdminClientSafe>>["storage"] },
  orgId: string,
  lead: LeadRecord
): Promise<{ recordings: VoiceObject[]; error?: NextResponse }> {
  const prefix = `${orgId}/${lead.campaign_id}/${lead.id}`;

  const { data: files, error: listError } = await storageClient.storage
    .from(VOICE_BUCKET)
    .list(prefix, {
      limit: 10,
      sortBy: { column: "created_at", order: "desc" } as never,
    });

  if (listError) {
    return {
      recordings: [],
      error: NextResponse.json(
        { error: listError.message ?? "Failed to list voice recordings" },
        { status: 500 }
      ),
    };
  }

  const entries = files ?? [];
  const recordings: VoiceObject[] = [];

  for (const f of entries) {
    // Skip logical subfolders like the LHO directory so they don't appear as recordings
    if (!f.name || f.name === "lho") continue;

    const objectPath = `${prefix}/${f.name}`;
    const { data: signed, error: urlError } = await storageClient.storage
      .from(VOICE_BUCKET)
      .createSignedUrl(objectPath, 60 * 60);

    recordings.push({
      name: f.name,
      id: objectPath,
      path: objectPath,
      size: (f as { size?: number }).size ?? null,
      created_at: (f as { created_at?: string }).created_at ?? null,
      url: urlError ? null : signed?.signedUrl ?? null,
    });
  }

  return { recordings };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if ("error" in auth) return auth.error;
    const { supabase, admin, orgId, userId } = auth;

    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json({ error: "Lead ID required" }, { status: 400 });
    }

    const leadResult = await getLeadForUser(supabase, orgId, userId, leadId);
    if ("error" in leadResult) return leadResult.error;
    const { lead } = leadResult;

    const { recordings, error } = await listVoiceObjects(admin, orgId, lead);
    if (error) return error;

    return NextResponse.json({ recordings });
  } catch (err) {
    console.error("Voice Log GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if ("error" in auth) return auth.error;
    const { supabase, admin, orgId, userId } = auth;

    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json({ error: "Lead ID required" }, { status: 400 });
    }

    const leadResult = await getLeadForUser(supabase, orgId, userId, leadId);
    if ("error" in leadResult) return leadResult.error;
    const { lead } = leadResult;

    const { recordings: existing } = await listVoiceObjects(admin, orgId, lead);
    if (existing.length >= MAX_RECORDINGS_PER_LEAD) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_RECORDINGS_PER_LEAD} recordings reached for this lead` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const fileName = body?.fileName as string | undefined;
    const fileSize = body?.fileSize as number | undefined;
    const fileType = body?.fileType as string | undefined;

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    if (typeof fileSize !== "number" || fileSize <= 0) {
      return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 20MB." },
        { status: 400 }
      );
    }

    const mime = typeof fileType === "string" && fileType.length > 0 ? fileType : "application/octet-stream";
    const isAudio =
      ALLOWED_AUDIO_TYPES.includes(mime) || mime.startsWith("audio/");
    if (!isAudio) {
      return NextResponse.json(
        { error: "Only audio files are allowed for Voice Log" },
        { status: 400 }
      );
    }

    const safeName = sanitizeFileName(fileName || "recording");
    const objectPath = `${orgId}/${lead.campaign_id}/${lead.id}/${crypto.randomUUID()}_${safeName}`;

    const { data: signedUpload, error: signError } = await admin.storage
      .from(VOICE_BUCKET)
      .createSignedUploadUrl(objectPath);

    if (signError || !signedUpload?.token) {
      return NextResponse.json(
        { error: signError?.message ?? "Failed to prepare recording upload" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      upload: {
        path: objectPath,
        token: signedUpload.token,
        bucket: VOICE_BUCKET,
        contentType: mime,
      },
    });
  } catch (err) {
    console.error("Voice Log POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if ("error" in auth) return auth.error;
    const { supabase, admin, orgId, userId } = auth;

    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json({ error: "Lead ID required" }, { status: 400 });
    }

    const leadResult = await getLeadForUser(supabase, orgId, userId, leadId);
    if ("error" in leadResult) return leadResult.error;
    const { lead } = leadResult;

    const body = await request.json().catch(() => null);
    const path = body?.path as string | undefined;

    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Recording path is required" }, { status: 400 });
    }

    const expectedPrefix = `${orgId}/${lead.campaign_id}/${lead.id}/`;
    if (!path.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "Invalid recording path" }, { status: 400 });
    }

    const { error: removeError } = await admin.storage
      .from(VOICE_BUCKET)
      .remove([path]);

    if (removeError) {
      return NextResponse.json(
        { error: removeError.message ?? "Failed to delete recording" },
        { status: 500 }
      );
    }

    const { recordings, error } = await listVoiceObjects(admin, orgId, lead);
    if (error) return error;

    return NextResponse.json({ recordings });
  } catch (err) {
    console.error("Voice Log DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

