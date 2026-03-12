import { z } from "zod";
import { createCrmServerClient } from "@/modules/crm/lib/supabase-server";
import { jsonError, jsonSuccess } from "@/modules/crm/lib/api";

const assetSchema = z.object({
  service_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  asset_type: z.string().min(2).optional(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  install_date: z.string().optional().nullable(),
  service_due_date: z.string().optional().nullable(),
  warranty_end_date: z.string().optional().nullable(),
  cylinder_type: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = assetSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid asset payload.");
  }

  const supabase = await createCrmServerClient();
  const { data, error } = await supabase.schema("crm").from("customer_assets").update(parsed.data).eq("id", id).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ asset: data });
}
