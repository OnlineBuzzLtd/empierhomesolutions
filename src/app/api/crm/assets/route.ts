import { z } from "zod";
import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";

const assetSchema = z.object({
  customer_id: z.string().uuid(),
  service_id: z.string().uuid().optional().or(z.literal("")).nullable(),
  asset_type: z.string().min(2),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  install_date: z.string().optional().nullable(),
  service_due_date: z.string().optional().nullable(),
  warranty_end_date: z.string().optional().nullable(),
  cylinder_type: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = assetSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid asset payload.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase } = auth.session;
  const { data, error } = await supabase.schema("crm").from("customer_assets").insert(parsed.data).select("*").single();
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonSuccess({ asset: data });
}
