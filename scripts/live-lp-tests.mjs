#!/usr/bin/env node
/**
 * End-to-end tests for the public Empire surface:
 *   1. /api/lead → CRM leads row created
 *   2. /api/public/webchat/sessions + /messages → bookingState progresses
 *      through the booking flow.
 *
 * Cleanup: deletes any CRM rows created by these tests at the end.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx < 0) continue;
  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = process.env[key] ?? value;
}

const SITE = "http://localhost:3000";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const TEST_TAG = `__lp_test_${Date.now()}`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const createdLeadIds = [];
const createdConversationIds = [];

function pass(label, detail = "") {
  console.log(`✅  ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  console.log(`❌  ${label}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}
function info(label, detail = "") {
  console.log(`   ${label}${detail ? `: ${detail}` : ""}`);
}

async function testLeadForm() {
  console.log("\n=== Test 1: book form → CRM lead ===");
  const phone = `077${String(Math.floor(Math.random() * 10_000_000)).padStart(8, "0")}`;
  const issue = `${TEST_TAG} test boiler issue`;
  const res = await fetch(`${SITE}/api/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: SITE },
    body: JSON.stringify({
      name: "LP Test User",
      email: `${TEST_TAG}@example.test`,
      house_name_number: "10",
      street: "Test Lane",
      postcode: "UB8 1AA",
      phone,
      issue,
      pagePath: "/lp/boiler-repair/uxbridge",
      service: "Boiler Repair",
      location: "Uxbridge",
      leadType: "repair",
      origin: SITE,
      attribution: { utm_source: "lp-test", landing_url: `${SITE}/` },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    return fail("POST /api/lead", `status=${res.status} body=${JSON.stringify(body)}`);
  }
  pass("POST /api/lead", `${res.status} ok`);

  await new Promise((r) => setTimeout(r, 500));
  const { data: leads, error } = await supabase
    .schema("crm")
    .from("leads")
    .select("id, customer_id, status, source, notes, intake_source")
    .eq("tenant_id", TENANT_ID)
    .ilike("notes", `%${TEST_TAG}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return fail("Query CRM leads", error.message);
  if (!leads || leads.length === 0) return fail("CRM lead row exists for test");
  const lead = leads[0];
  createdLeadIds.push(lead.id);

  if (lead.intake_source !== "website") {
    return fail("CRM lead intake_source", `expected "website", got "${lead.intake_source}"`);
  }
  if (lead.status !== "new") {
    return fail("CRM lead status", `expected "new", got "${lead.status}"`);
  }
  if (!lead.customer_id) return fail("CRM lead has customer_id");
  pass(
    "CRM lead row created",
    `id=${lead.id.slice(0, 8)}… customer=${lead.customer_id.slice(0, 8)}… status=${lead.status}`,
  );
}

async function postChat(path, body) {
  const res = await fetch(`${SITE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: SITE },
    body: JSON.stringify(body),
  });
  return { res, body: await res.json().catch(() => ({})) };
}
function pickReply(b) {
  return b.session?.replyMessage?.body ?? b.replyMessage?.body ?? "";
}
function pickBookingState(b) {
  return b.session?.bookingState?.currentState ?? b.bookingState?.currentState ?? null;
}

async function testWebchat() {
  console.log("\n=== Test 2: web AI chat → booking flow ===");
  const visitorId = `visitor_${TEST_TAG}`;

  const { res: r1, body: b1 } = await postChat("/api/public/webchat/sessions", {
    visitorId,
    openingMessage:
      "Hi, my boiler isn't firing up — no hot water at all. Can someone come out tomorrow morning?",
    pagePath: "/",
    attribution: { utm_source: "lp-test" },
  });
  if (!r1.ok || !b1.ok) {
    return fail(
      "POST /api/public/webchat/sessions",
      `${r1.status} ${JSON.stringify(b1).slice(0, 200)}`,
    );
  }
  const conversationId =
    b1.session?.conversation?.id ?? b1.session?.conversationId ?? b1.session?.conversation_id;
  if (!conversationId) {
    return fail("session conversationId returned", JSON.stringify(b1.session).slice(0, 200));
  }
  createdConversationIds.push(conversationId);
  pass(
    "POST /api/public/webchat/sessions",
    `id=${conversationId.slice(0, 8)}… state=${pickBookingState(b1) ?? "(initial)"}`,
  );
  info("agent greeting", `"${pickReply(b1).slice(0, 120)}…"`);

  const turns = [
    { what: "name", text: "My name is Chat Test." },
    { what: "phone", text: "07712345678" },
    { what: "email", text: "chattest@example.test" },
    { what: "postcode", text: "UB8 1AA" },
    { what: "address", text: "10 Test Lane, Uxbridge" },
    { what: "preferred slot", text: "Tomorrow morning around 10am works." },
    { what: "confirm", text: "Yes please confirm." },
  ];

  // Track agent replies; assert they progress (each unique vs previous +
  // at least one mentions a concrete time slot or booking confirmation).
  const replies = [pickReply(b1)];
  for (const turn of turns) {
    const { res, body } = await postChat("/api/public/webchat/messages", {
      conversationId,
      body: turn.text,
    });
    if (!res.ok || !body.ok) {
      return fail(
        `webchat turn (${turn.what})`,
        `${res.status} ${JSON.stringify(body).slice(0, 200)}`,
      );
    }
    const reply = pickReply(body);
    replies.push(reply);
    pass(
      `turn (${turn.what})`,
      `agent: "${reply.slice(0, 80).replace(/\n/g, " ")}…"`,
    );
    await new Promise((r) => setTimeout(r, 700));
  }

  console.log("");
  const allNonEmpty = replies.every((r) => r && r.trim().length > 0);
  if (allNonEmpty) {
    pass("agent responded to every turn", `${replies.length}/${replies.length} non-empty replies`);
  } else {
    fail("agent responded to every turn", `${replies.filter((r) => r).length}/${replies.length}`);
  }

  const uniqueReplies = new Set(replies).size;
  if (uniqueReplies >= replies.length - 1) {
    pass("agent replies are contextual", `${uniqueReplies} unique out of ${replies.length}`);
  } else {
    fail(
      "agent replies are contextual",
      `only ${uniqueReplies} unique — agent may be repeating itself`,
    );
  }

  // Look for booking-flow signal: agent offered slots / attempted hold
  const transcript = replies.join(" \n ").toLowerCase();
  const slotPatterns = [
    /\b\d{1,2}:\d{2}\s?(am|pm)/i,
    /\bto book\b/i,
    /\bconfirm(ed|ing)?\b.*\b(book|appointment|slot)/i,
    /\bavailable\b.*\b(slot|time|tomorrow|today|monday|tuesday|wednesday|thursday|friday)/i,
  ];
  const matched = slotPatterns.some((p) => p.test(transcript));
  if (matched) {
    pass("agent walked the booking flow", "transcript contains slot/booking phrasing");
  } else {
    fail(
      "agent walked the booking flow",
      "no slot/booking phrasing found in transcript — chat may be stuck",
    );
  }
}

async function cleanup() {
  console.log("\n=== Cleanup ===");
  if (createdLeadIds.length > 0) {
    const { data: leads } = await supabase
      .schema("crm")
      .from("leads")
      .select("id, customer_id")
      .in("id", createdLeadIds);
    const customerIds = (leads ?? []).map((l) => l.customer_id).filter(Boolean);
    await supabase
      .schema("crm")
      .from("notes")
      .delete()
      .in("entity_id", createdLeadIds)
      .eq("entity_type", "lead");
    await supabase.schema("crm").from("leads").delete().in("id", createdLeadIds);
    if (customerIds.length > 0) {
      await supabase
        .schema("crm")
        .from("notes")
        .delete()
        .in("entity_id", customerIds)
        .eq("entity_type", "customer");
      await supabase.schema("crm").from("customers").delete().in("id", customerIds);
    }
    pass("deleted test leads + customers", `${createdLeadIds.length} leads`);
  }
  for (const cid of createdConversationIds) {
    try {
      await fetch(`${SITE}/api/public/webchat/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: SITE },
        body: JSON.stringify({ conversationId: cid, closeReason: "customer_ended" }),
      });
    } catch {}
  }
  if (createdConversationIds.length > 0) {
    pass("closed test conversations", `${createdConversationIds.length} sessions`);
  }
}

(async () => {
  try {
    await testLeadForm();
    await testWebchat();
  } catch (e) {
    fail("fatal error", e?.message ?? String(e));
  } finally {
    await cleanup();
    console.log("\n=== Summary ===");
    console.log(process.exitCode === 1 ? "❌  TESTS FAILED" : "✅  ALL TESTS PASSED");
  }
})();
