import { jsonError, requireCrmApiUser } from "@/modules/crm/lib/api";
import {
  customerExportFilename,
  customerExportHeader,
  customerExportLine,
  customerExportPageSize,
  customerExportSelect,
  type CustomerExportRow,
} from "@/modules/crm/lib/customer-export";

export const runtime = "nodejs";
// The file reflects live data and must never be served from a cache.
export const dynamic = "force-dynamic";

// Downloads the tenant's customer marketing list (name, phone, email) as CSV.
//
// Uses the request-scoped Supabase client, not the service-role client, so RLS
// enforces tenant isolation the same way the rest of the CRM does. Archived,
// deleted, test and demo rows are excluded — this list gets used for real
// marketing sends, so a "Deleted customer" row or a webchat test lead reaching
// it is a real-world problem, not just untidy.
export async function GET() {
  const auth = await requireCrmApiUser(["management", "admin"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, tenant } = auth.session;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(customerExportHeader()));

        // Chunked read rather than one unbounded select: a large tenant would
        // otherwise hit Supabase's row cap and silently truncate the list.
        for (let offset = 0; ; offset += customerExportPageSize) {
          const { data, error } = await supabase
            .schema("crm")
            .from("customers")
            .select(customerExportSelect)
            .eq("tenant_id", tenant.id)
            .eq("archived", false)
            .eq("is_test", false)
            .eq("is_demo", false)
            .is("record_deleted_at", null)
            .order("full_name", { ascending: true })
            .range(offset, offset + customerExportPageSize - 1);

          if (error) {
            throw new Error(error.message);
          }

          const rows = (data ?? []) as CustomerExportRow[];
          for (const row of rows) {
            controller.enqueue(encoder.encode(customerExportLine(row)));
          }

          if (rows.length < customerExportPageSize) {
            break;
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  const filename = customerExportFilename(tenant.slug, new Date());

  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export async function POST() {
  return jsonError("Use GET to download the customer export.", 405);
}
