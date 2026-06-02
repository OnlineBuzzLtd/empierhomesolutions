import type { ParsedWebchatMessage } from "@/modules/crm/demo-console/parse-webchat-session";
import {
  getDemoWebchatScenario,
  renderDemoWebchatScenarioFacts,
  type DemoWebchatScenarioKey,
} from "@/modules/crm/demo-console/webchat-scenarios";

export const demoCustomerMaxTurns = 8;

export type DemoCustomerTurnStatus = "message" | "complete" | "blocked";

export type DemoCustomerTurn = {
  status: DemoCustomerTurnStatus;
  message: string | null;
  reason: string;
  stopCode:
    | "next_message"
    | "booking_confirmed"
    | "max_turns"
    | "repeated_question"
    | "llm_not_configured"
    | "unsafe_llm_output"
    | "llm_failed";
};

export type DemoCustomerTurnInput = {
  scenarioKey: DemoWebchatScenarioKey;
  prospectName: string;
  prospectPhone: string;
  transcript: ParsedWebchatMessage[];
  turnIndex: number;
};

type DemoCustomerAgentEnv = {
  providerGenerateTurn?: (input: DemoCustomerTurnInput) => Promise<DemoCustomerTurn | null>;
};

type QuestionKind =
  | "identity"
  | "phone"
  | "postcode"
  | "address"
  | "email"
  | "time"
  | "confirmation"
  | "service";

function latestAiReply(transcript: ParsedWebchatMessage[]) {
  return [...transcript].reverse().find((message) => message.direction === "outbound") ?? null;
}

function inboundMessages(transcript: ParsedWebchatMessage[]) {
  return transcript.filter((message) => message.direction === "inbound");
}

function outboundMessages(transcript: ParsedWebchatMessage[]) {
  return transcript.filter((message) => message.direction === "outbound");
}

export function classifyDemoCustomerQuestion(text: string): QuestionKind | null {
  const lowered = text.toLowerCase();
  if (/\b(confirm|book that|go ahead|shall i|should i|works? for you|is that ok)\b/.test(lowered)) {
    return "confirmation";
  }
  if (/\b(email|e-mail|mail address)\b/.test(lowered)) return "email";
  if (/\b(phone|mobile|number|contact)\b/.test(lowered)) return "phone";
  if (/\b(postcode|post code|zip)\b/.test(lowered)) return "postcode";
  if (/\b(address|where|property|location)\b/.test(lowered)) return "address";
  if (/\b(name|who is this|your details)\b/.test(lowered)) return "identity";
  if (/\b(when|date|time|slot|today|tomorrow|morning|afternoon|availability)\b/.test(lowered)) {
    return "time";
  }
  if (/\b(service|problem|issue|boiler|heating|hot water|install|survey)\b/.test(lowered)) {
    return "service";
  }
  return null;
}

function normaliseSlotRange(start: string, end: string, endMeridiem?: string) {
  const trimmedStart = start.replace(/\s+/g, " ").trim();
  const trimmedEnd = end.replace(/\s+/g, " ").trim();
  const meridiem = endMeridiem?.toLowerCase();
  const startWithMeridiem = /\b(?:am|pm)\b/i.test(trimmedStart) || !meridiem
    ? trimmedStart
    : `${trimmedStart} ${meridiem}`;
  const endWithMeridiem = /\b(?:am|pm)\b/i.test(trimmedEnd) || !meridiem
    ? trimmedEnd
    : `${trimmedEnd} ${meridiem}`;

  return `${startWithMeridiem} to ${endWithMeridiem}`;
}

function extractOfferedSlot(text: string) {
  const compacted = text.replace(/\s+/g, " ");
  const fullRange = compacted.match(
    /(\d{1,2}:\d{2}\s*(?:am|pm))\s*(?:to|–|-)\s*(\d{1,2}:\d{2}\s*(?:am|pm))/i,
  );
  if (fullRange?.[1] && fullRange[2]) {
    return normaliseSlotRange(fullRange[1], fullRange[2]);
  }

  const sharedMeridiemRange = compacted.match(
    /(\d{1,2}:\d{2})\s*(?:to|–|-)\s*(\d{1,2}:\d{2})\s*(am|pm)/i,
  );
  if (sharedMeridiemRange?.[1] && sharedMeridiemRange[2]) {
    return normaliseSlotRange(
      sharedMeridiemRange[1],
      sharedMeridiemRange[2],
      sharedMeridiemRange[3],
    );
  }

  return null;
}

function requiresLiteralYesConfirmation(text: string) {
  return /\b(?:reply|send)\s+yes\b|\byes\s+to\s+confirm\b|\bif\s+that\s+slot\s+works,\s*reply\s+yes\b/i.test(
    text,
  );
}

export function demoCustomerReplyLooksComplete(text: string) {
  return /\b(you(?:'re| are)\s+booked|booking\s+(?:is\s+)?confirmed|appointment\s+(?:is\s+)?confirmed|survey\s+(?:is\s+)?(?:booked|confirmed)|confirmed\s+(?:for|the)\s+(?:appointment|booking|survey)|we(?:'re| are)\s+all\s+set)\b/i.test(
    text,
  );
}

function makeTurn(
  status: DemoCustomerTurnStatus,
  stopCode: DemoCustomerTurn["stopCode"],
  reason: string,
  message: string | null = null,
): DemoCustomerTurn {
  return { status, message, reason, stopCode };
}

function hasConsolidatedDetailsAlready(input: DemoCustomerTurnInput) {
  const scenario = getDemoWebchatScenario(input.scenarioKey);
  const facts = renderDemoWebchatScenarioFacts(scenario, {
    prospectName: input.prospectName,
    prospectPhone: input.prospectPhone,
  });
  return inboundMessages(input.transcript).some((message) => {
    const body = message.body.toLowerCase();
    return (
      body.includes(facts.prospectPhone.toLowerCase()) &&
      body.includes(facts.postcode.toLowerCase()) &&
      body.includes(facts.addressLine.toLowerCase().slice(0, 12))
    );
  });
}

function firstConsolidatedDetailsInboundIndex(input: DemoCustomerTurnInput) {
  const scenario = getDemoWebchatScenario(input.scenarioKey);
  const facts = renderDemoWebchatScenarioFacts(scenario, {
    prospectName: input.prospectName,
    prospectPhone: input.prospectPhone,
  });
  return input.transcript.findIndex((message) => {
    if (message.direction !== "inbound") return false;
    const body = message.body.toLowerCase();
    return (
      body.includes(facts.prospectPhone.toLowerCase()) &&
      body.includes(facts.postcode.toLowerCase()) &&
      body.includes(facts.addressLine.toLowerCase().slice(0, 12))
    );
  });
}

function messageAnswersQuestionKind(
  body: string,
  kind: QuestionKind,
  facts: ReturnType<typeof renderDemoWebchatScenarioFacts>,
) {
  const lowered = body.toLowerCase();
  switch (kind) {
    case "phone":
      return lowered.includes(facts.prospectPhone.toLowerCase());
    case "postcode":
      return lowered.includes(facts.postcode.toLowerCase());
    case "address":
      return (
        lowered.includes(facts.addressLine.toLowerCase().slice(0, 12)) ||
        lowered.includes(facts.postcode.toLowerCase())
      );
    case "email":
      return (
        lowered.includes(facts.prospectPhone.toLowerCase()) &&
        /\b(phone|number|call|text|confirmation)\b/.test(lowered)
      );
    case "identity":
      return lowered.includes(facts.prospectName.toLowerCase().split(/\s+/)[0] ?? "");
    case "time":
      return /\b(tomorrow|morning|afternoon|evening|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/.test(
        lowered,
      );
    case "confirmation":
      return /\b(yes|please|book|confirm|works|slot)\b/.test(lowered);
    case "service":
      return (
        lowered.includes(facts.service.toLowerCase().slice(0, 8)) ||
        lowered.includes(facts.problem.toLowerCase().slice(0, 12)) ||
        /\b(boiler|repair|service|install|survey|heating|hot water)\b/.test(lowered)
      );
  }
}

function hasDirectRetryAfterConsolidatedDetails(
  input: DemoCustomerTurnInput,
  questionKind: QuestionKind,
) {
  const consolidatedIndex = firstConsolidatedDetailsInboundIndex(input);
  if (consolidatedIndex < 0) return false;
  const scenario = getDemoWebchatScenario(input.scenarioKey);
  const facts = renderDemoWebchatScenarioFacts(scenario, {
    prospectName: input.prospectName,
    prospectPhone: input.prospectPhone,
  });
  return input.transcript.slice(consolidatedIndex + 1).some((message) => {
    return (
      message.direction === "inbound" &&
      messageAnswersQuestionKind(message.body, questionKind, facts)
    );
  });
}

function buildFirstPassDeterministicReply(
  input: DemoCustomerTurnInput,
  latestQuestion: QuestionKind,
  latestReplyBody: string,
) {
  const scenario = getDemoWebchatScenario(input.scenarioKey);
  const facts = renderDemoWebchatScenarioFacts(scenario, {
    prospectName: input.prospectName,
    prospectPhone: input.prospectPhone,
  });
  const lowered = latestReplyBody.toLowerCase();
  const asksPhone = /\b(phone|mobile|number|contact)\b/.test(lowered);
  const asksPostcode = /\b(postcode|post code|zip)\b/.test(lowered);
  const asksAddress =
    /\b(address|where|property|location)\b/.test(lowered) &&
    !/\b(?:e-?mail|mail)\s+address\b/.test(lowered);
  const asksName = /\b(name|who is this|your details)\b/.test(lowered);
  const asksEmail = /\b(email|e-mail|mail address)\b/.test(lowered);
  const offeredSlot = extractOfferedSlot(latestReplyBody);

  if (requiresLiteralYesConfirmation(latestReplyBody)) {
    return "YES";
  }

  if (
    offeredSlot &&
    (latestQuestion === "time" ||
      latestQuestion === "confirmation" ||
      /\b(which works best|would .*work for you|slot work)\b/i.test(latestReplyBody))
  ) {
    return `The ${offeredSlot} slot works. Please book that.`;
  }

  if (asksName && asksPhone && (asksPostcode || asksAddress)) {
    return `My name is ${facts.prospectName}, my phone is ${facts.prospectPhone}, and the address is ${facts.addressLine} ${facts.postcode}.`;
  }
  if (asksEmail && (asksPhone || asksPostcode || asksAddress || asksName)) {
    return `Please use my phone number ${facts.prospectPhone} for the booking confirmation. My name is ${facts.prospectName}, and the address is ${facts.addressLine} ${facts.postcode}.`;
  }
  if (asksEmail) {
    return `Please use my phone number ${facts.prospectPhone} for the booking confirmation.`;
  }
  if (asksPhone && asksPostcode) {
    return `My phone is ${facts.prospectPhone} and the postcode is ${facts.postcode}.`;
  }
  if (asksPhone) return `My phone number is ${facts.prospectPhone}.`;
  if (asksPostcode && asksAddress) return `The address is ${facts.addressLine} ${facts.postcode}.`;
  if (asksPostcode) return `The postcode is ${facts.postcode}.`;
  if (asksAddress) return `The address is ${facts.addressLine} ${facts.postcode}.`;
  if (asksName) return `My name is ${facts.prospectName}.`;

  if (latestQuestion === "time") return facts.preferredTime;
  if (latestQuestion === "confirmation") return facts.acceptancePhrase;
  if (latestQuestion === "service") return `${facts.service}. ${facts.problem}`;
  if (latestQuestion === "email") {
    return `Please use my phone number ${facts.prospectPhone} for the booking confirmation.`;
  }
  if (latestQuestion === "identity") {
    return `My name is ${facts.prospectName} and my phone is ${facts.prospectPhone}.`;
  }
  return null;
}

export function resolveDeterministicDemoCustomerTurn(
  input: DemoCustomerTurnInput,
): DemoCustomerTurn | null {
  if (input.turnIndex >= demoCustomerMaxTurns) {
    return makeTurn(
      "blocked",
      "max_turns",
      `Stopped after ${demoCustomerMaxTurns} adaptive customer turns.`,
    );
  }

  const latestReply = latestAiReply(input.transcript);
  if (!latestReply) {
    return makeTurn("blocked", "llm_failed", "No AI reply was available to answer.");
  }
  if (demoCustomerReplyLooksComplete(latestReply.body)) {
    return makeTurn("complete", "booking_confirmed", "The AI confirmed the booking or survey.");
  }

  const latestQuestion = classifyDemoCustomerQuestion(latestReply.body);
  if (!latestQuestion) return null;

  if (requiresLiteralYesConfirmation(latestReply.body)) {
    return makeTurn(
      "message",
      "next_message",
      "The AI asked for a literal YES confirmation.",
      "YES",
    );
  }

  const offeredSlot = extractOfferedSlot(latestReply.body);
  if (
    offeredSlot &&
    (latestQuestion === "time" ||
      latestQuestion === "confirmation" ||
      /\b(which works best|would .*work for you|slot work)\b/i.test(latestReply.body))
  ) {
    return makeTurn(
      "message",
      "next_message",
      "Accepting one of the AI's offered appointment slots.",
      `The ${offeredSlot} slot works. Please book that.`,
    );
  }

  const firstPassReply = buildFirstPassDeterministicReply(
    input,
    latestQuestion,
    latestReply.body,
  );

  const sameQuestionCount = outboundMessages(input.transcript).filter((message) => {
    return classifyDemoCustomerQuestion(message.body) === latestQuestion;
  }).length;

  if (sameQuestionCount >= 2) {
    if (hasConsolidatedDetailsAlready(input)) {
      if (
        firstPassReply &&
        !hasDirectRetryAfterConsolidatedDetails(input, latestQuestion)
      ) {
        return makeTurn(
          "message",
          "next_message",
          "Retrying the repeated missing-info prompt with the exact scenario detail requested.",
          firstPassReply,
        );
      }
      return makeTurn(
        "blocked",
        "repeated_question",
        "The AI repeated the same question after the consolidated details and a direct retry were already sent.",
      );
    }
    const scenario = getDemoWebchatScenario(input.scenarioKey);
    const facts = renderDemoWebchatScenarioFacts(scenario, {
      prospectName: input.prospectName,
      prospectPhone: input.prospectPhone,
    });
    return makeTurn(
      "message",
      "next_message",
      "Answering repeated missing-info prompt with all scenario details.",
      facts.consolidatedDetailsMessage,
    );
  }

  if (firstPassReply) {
    return makeTurn(
      "message",
      "next_message",
      "Answering the AI's structured booking question from scenario facts.",
      firstPassReply,
    );
  }

  return null;
}

function buildNoProviderFallbackTurn(input: DemoCustomerTurnInput) {
  if (hasConsolidatedDetailsAlready(input)) return null;

  const scenario = getDemoWebchatScenario(input.scenarioKey);
  const facts = renderDemoWebchatScenarioFacts(scenario, {
    prospectName: input.prospectName,
    prospectPhone: input.prospectPhone,
  });

  return makeTurn(
    "message",
    "next_message",
    "Platform AI provider is unavailable; sending all scenario details as fallback.",
    facts.consolidatedDetailsMessage,
  );
}

export function buildDemoCustomerPromptMessages(input: DemoCustomerTurnInput) {
  const scenario = getDemoWebchatScenario(input.scenarioKey);
  const facts = renderDemoWebchatScenarioFacts(scenario, {
    prospectName: input.prospectName,
    prospectPhone: input.prospectPhone,
  });
  const latestReply = latestAiReply(input.transcript);
  return [
    {
      role: "system",
      content: [
        "You are the demo customer in a plumbing CRM sales demo.",
        "Reply only as the customer, in one short natural message.",
        "Use only the provided scenario facts. Do not invent prices, emails, payment details, card details, or extra personal data.",
        "If the AI has confirmed the booking, return JSON status complete.",
        "Return strict JSON only: {\"status\":\"message|complete|blocked\",\"message\":\"...\",\"reason\":\"...\"}.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        scenario: {
          key: scenario.key,
          label: scenario.label,
          facts,
        },
        turnIndex: input.turnIndex,
        latestAiReply: latestReply?.body ?? null,
        transcript: input.transcript.slice(-12).map((message) => ({
          direction: message.direction,
          body: message.body,
        })),
      }),
    },
  ];
}

export function validateDemoCustomerMessage(message: unknown) {
  if (typeof message !== "string") {
    return { ok: false as const, reason: "LLM did not return a message." };
  }
  const trimmed = message.trim();
  if (!trimmed) return { ok: false as const, reason: "LLM returned an empty message." };
  if (trimmed.length > 500) return { ok: false as const, reason: "LLM message was too long." };
  if (/^\s*(assistant|ai|agent|system)\s*:/i.test(trimmed)) {
    return { ok: false as const, reason: "LLM tried to speak as a non-customer role." };
  }
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(trimmed)) {
    return { ok: false as const, reason: "LLM invented or exposed an email address." };
  }
  if (/[£$]\s?\d|\b\d+(?:\.\d{2})?\s?(?:gbp|pounds)\b/i.test(trimmed)) {
    return { ok: false as const, reason: "LLM invented pricing." };
  }
  if (/\b(card number|sort code|bank account|stripe|payment link|pay now|invoice)\b/i.test(trimmed)) {
    return { ok: false as const, reason: "LLM mentioned payment details." };
  }
  if (/<script\b/i.test(trimmed)) {
    return { ok: false as const, reason: "LLM returned unsafe markup." };
  }
  return { ok: true as const, message: trimmed };
}

function shouldUseDeterministicFallback(turn: DemoCustomerTurn | null) {
  return (
    !turn ||
    (turn.status === "blocked" &&
      (turn.stopCode === "llm_failed" || turn.stopCode === "llm_not_configured"))
  );
}

export async function generateDemoCustomerTurn(
  input: DemoCustomerTurnInput,
  env: DemoCustomerAgentEnv = {},
): Promise<DemoCustomerTurn> {
  const deterministic = resolveDeterministicDemoCustomerTurn(input);
  if (deterministic) return deterministic;

  if (!env.providerGenerateTurn) {
    const fallback = buildNoProviderFallbackTurn(input);
    if (fallback) return fallback;

    return makeTurn(
      "blocked",
      "llm_not_configured",
      "Platform AI unavailable for demo customer turns; use Fixed script mode.",
    );
  }

  try {
    const providerTurn = await env.providerGenerateTurn(input);
    if (providerTurn && !shouldUseDeterministicFallback(providerTurn)) return providerTurn;

    const fallback = buildNoProviderFallbackTurn(input);
    if (fallback) {
      return makeTurn(
        "message",
        "next_message",
        providerTurn
          ? `${providerTurn.reason} Using deterministic scenario fallback.`
          : "Platform AI provider is unavailable; using deterministic scenario fallback.",
        fallback.message,
      );
    }

    return (
      providerTurn ??
      makeTurn(
        "blocked",
        "llm_not_configured",
        "Platform AI unavailable for demo customer turns; use Fixed script mode.",
      )
    );
  } catch (caught) {
    console.warn("[demo-customer-agent] Platform demo customer call threw", {
      message: caught instanceof Error ? caught.message.slice(0, 160) : "Unknown error",
    });
    const fallback = buildNoProviderFallbackTurn(input);
    if (fallback) {
      return makeTurn(
        "message",
        "next_message",
        "Platform AI call failed. Using deterministic scenario fallback.",
        fallback.message,
      );
    }
    return makeTurn("blocked", "llm_failed", "Platform AI unavailable for demo customer turns.");
  }
}
