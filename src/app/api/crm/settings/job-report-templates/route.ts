import { z } from "zod";
import { jsonError, jsonSuccess, requireCrmApiUser, requireManagerCrmApiUser } from "@/modules/crm/lib/api";

const createSchema = z.object({
  title: z.string().min(1, "Question title is required").max(500),
});

const updateSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(500).optional(),
  is_active: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, profile } = auth.session;

  const { data, error } = await supabase
    .schema("crm")
    .from("job_report_templates")
    .select("id, title, position, is_active, created_at")
    .eq("tenant_id", profile!.tenant_id)
    .eq("is_demo", false)
    .order("position", { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ templates: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const { supabase, profile } = auth.session;

  // auto-assign next position
  const { data: existing } = await supabase
    .schema("crm")
    .from("job_report_templates")
    .select("position")
    .eq("tenant_id", profile!.tenant_id)
    .eq("is_demo", false)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = ((existing?.position as number) ?? 0) + 1;

  const { data, error } = await supabase
    .schema("crm")
    .from("job_report_templates")
    .insert({
      tenant_id: profile!.tenant_id,
      title: parsed.data.title,
      position: nextPosition,
      is_active: true,
      is_demo: false,
    })
    .select("id, title, position, is_active, created_at")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ template: data });
}

export async function PATCH(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const { supabase, profile } = auth.session;
  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active;

  if (Object.keys(patch).length === 0) {
    return jsonError("Nothing to update.");
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("job_report_templates")
    .update({ ...patch, tenant_id: profile!.tenant_id })
    .eq("id", parsed.data.id)
    .eq("tenant_id", profile!.tenant_id)
    .select("id, title, position, is_active, created_at")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ template: data });
}

export async function DELETE(request: Request) {
  const auth = await requireManagerCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return jsonError("Missing id parameter.");
  }

  const { supabase, profile } = auth.session;

  const { error } = await supabase
    .schema("crm")
    .from("job_report_templates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile!.tenant_id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ deleted: id });
}
