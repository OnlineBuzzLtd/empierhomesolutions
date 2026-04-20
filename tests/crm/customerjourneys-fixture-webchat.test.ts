import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Replays the exact screenshot transcript that surfaced the webchat
// hallucination regression so we catch any future shortcut that confirms a
// booking before service / postcode / name / time are all captured.

const previousFlag = process.env.CRM_E2E_PLATFORM_FIXTURES;

beforeAll(() => {
  process.env.CRM_E2E_PLATFORM_FIXTURES = "1";
});

afterAll(() => {
  if (previousFlag === undefined) {
    delete process.env.CRM_E2E_PLATFORM_FIXTURES;
  } else {
    process.env.CRM_E2E_PLATFORM_FIXTURES = previousFlag;
  }
});

async function loadModule() {
  return import("@/modules/crm/lib/customerjourneys");
}

// Matches a "booking confirmed" phrasing (not any mention of "booking").
const bookedPattern = /\bbooked\s+for\b|\bvisit\s+is\s+already\s+booked\b/i;

describe("fixture webchat bot", () => {
  it("never confirms a booking until service, postcode, name and time are all captured", async () => {
    const {
      createCustomerJourneysWebchatSession,
      appendCustomerJourneysWebchatMessage,
    } = await loadModule();

    // Opening message with no captured slots (like the screenshot where the
    // first inbound was a bare "hello" and no form name was supplied).
    const session = await createCustomerJourneysWebchatSession(null, {
      identifierValue: "anon@example.com",
      openingMessage: "hello",
    });

    const conversationId = (session as { conversation: { id: string } }).conversation.id;
    const initialReply = (session as { replyMessage: { body: string } | null }).replyMessage;
    expect(initialReply?.body ?? "").not.toMatch(bookedPattern);

    const transcript = [
      "boilder service", // typo for boiler - must still capture the service
      "178 wansted lane", // street address (no postcode) - must NOT book
      "whats avaiable", // availability ask with no postcode - must NOT invent slots
      "check next options", // same
      "ig1 3sw", // valid UK postcode - still missing name/time, must NOT book
    ];

    const replies: string[] = [];
    for (const body of transcript) {
      const turn = (await appendCustomerJourneysWebchatMessage(null, {
        conversationId,
        body,
      })) as { replyMessage: { body: string } | null };
      replies.push(turn.replyMessage?.body ?? "");
    }

    for (const reply of replies) {
      expect(reply, `fixture should never confirm a booking yet: ${reply}`).not.toMatch(bookedPattern);
    }

    const serviceAck = replies.some((body) => /postcode/i.test(body));
    expect(
      serviceAck,
      "after 'boilder service' the bot should move on to asking for the postcode",
    ).toBe(true);

    const availabilityReplies = replies.slice(2, 4);
    for (const reply of availabilityReplies) {
      expect(/\b\d{1,2}:\d{2}\b/.test(reply)).toBe(false);
      expect(/\bthursday\b/i.test(reply)).toBe(false);
    }
  });

  it("books the visit only after all four fields are captured", async () => {
    const {
      createCustomerJourneysWebchatSession,
      appendCustomerJourneysWebchatMessage,
    } = await loadModule();

    // Form provides the customer name. Opening message contains service + a
    // day preference, leaving postcode as the only missing slot for the
    // first turn and an explicit confirmation for the time slot at the end.
    const session = await createCustomerJourneysWebchatSession(null, {
      identifierValue: "jane@example.com",
      fullName: "Jane Smith",
      email: "jane@example.com",
      openingMessage: "Need a boiler service this Thursday morning.",
    });

    const conversationId = (session as { conversation: { id: string } }).conversation.id;
    const openingReply = (session as { replyMessage: { body: string } | null }).replyMessage;
    expect(openingReply?.body ?? "").toMatch(/postcode/i);

    const postcodeTurn = (await appendCustomerJourneysWebchatMessage(null, {
      conversationId,
      body: "UB8 1AA",
    })) as { replyMessage: { body: string } | null };

    expect(postcodeTurn.replyMessage?.body ?? "").toMatch(bookedPattern);
  });

  it("asks for the postcode when given only a street address (no hallucinated capture)", async () => {
    const {
      createCustomerJourneysWebchatSession,
      appendCustomerJourneysWebchatMessage,
    } = await loadModule();

    const session = await createCustomerJourneysWebchatSession(null, {
      identifierValue: "caller@example.com",
      openingMessage: "boiler service please",
    });
    const conversationId = (session as { conversation: { id: string } }).conversation.id;

    const turn = (await appendCustomerJourneysWebchatMessage(null, {
      conversationId,
      body: "178 wansted lane",
    })) as { replyMessage: { body: string } | null };

    expect(turn.replyMessage?.body ?? "").toMatch(/postcode/i);
    expect(turn.replyMessage?.body ?? "").not.toMatch(bookedPattern);
  });
});
