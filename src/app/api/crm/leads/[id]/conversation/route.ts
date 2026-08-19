import { jsonError, jsonSuccess, requireCrmApiUser } from "@/modules/crm/lib/api";
import {
  fetchCustomerJourneysConversation,
  getCustomerJourneysRuntimeLink,
} from "@/modules/crm/lib/customerjourneys";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Returns the AI conversation transcript behind an enquiry.
//
// Empire stores no message bodies of its own — the transcript lives in the
// CustomerJourneys runtime. This route is the CRM's read path for it, and it
// exists so the browser never sees the runtime service token: the client asks
// Empire for a lead it is already allowed to see, and Empire makes the
// authenticated upstream call.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return jsonError("Invalid enquiry id.");
  }

  const auth = await requireCrmApiUser();
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, tenant } = auth.session;

  // Resolve lead -> conversation through the user-scoped client so RLS proves
  // the caller may see this enquiry before we fetch anything upstream.
  const { data: link, error } = await supabase
    .schema("crm")
    .from("platform_conversation_links")
    .select("conversation_id, latest_channel")
    .eq("tenant_id", tenant.id)
    .eq("lead_id", id)
    .order("latest_event_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ conversation_id: string | null; latest_channel: string | null }>();

  if (error) {
    return jsonError(error.message, 500);
  }
  if (!link?.conversation_id) {
    return jsonSuccess({ conversation: null, reason: "no_linked_conversation" });
  }

  const admin = createCrmServiceRoleClient();
  const runtimeLink = await getCustomerJourneysRuntimeLink(admin, tenant.id);

  try {
    const conversation = await fetchCustomerJourneysConversation(runtimeLink, link.conversation_id);
    if (!conversation) {
      return jsonSuccess({ conversation: null, reason: "runtime_unavailable" });
    }
    return jsonSuccess({ conversation: { ...conversation, channel: link.latest_channel } });
  } catch (err) {
    // The transcript is supporting detail on an enquiry the office can still
    // action. A runtime outage should degrade the panel, not break the drawer.
    console.warn(
      JSON.stringify({
        event: "crm_lead_conversation_fetch_failed",
        leadId: id,
        conversationId: link.conversation_id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return jsonSuccess({ conversation: null, reason: "runtime_error" });
  }
}
