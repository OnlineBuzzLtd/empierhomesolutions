// Parsers for the CJ runtime webchat session + turn responses.
//
// Both /api/public/webchat/sessions and /api/public/webchat/messages
// return shape-shifting payloads that drift across runtime versions.
// We accept all observed shapes and pin them with unit tests so a
// regression surfaces immediately rather than as a silent "AI seems
// to have nothing to say" in front of a prospect.
//
// Session response (POST /sessions):
//   { ok: true, session: {
//       conversation: { id: "..." } | conversationId: "...",
//       messages: [ { id, body, direction, createdAt }, ... ],
//       replyMessage?: { id, body, direction, createdAt },
//       bookingState?: { currentState: "..." }
//   }}
//
// Turn response (POST /messages):
//   { ok: true, session: {
//       message?: { id, body, direction, createdAt },        // echoed prospect message
//       replyMessage?: { id, body, direction, createdAt },   // AI reply
//       bookingState?: { currentState: "..." }
//   }}
//
// In both, the AI's reply lives at `replyMessage` (and the initial
// reply may also appear inside `messages[]` on /sessions).

export type ParsedWebchatMessage = {
  id: string;
  body: string;
  direction: "inbound" | "outbound" | "system";
};

export type ParsedWebchatSession = {
  conversationId: string;
  // Includes both the prospect's opening message echoed back AND any
  // AI reply already present in the initial response. Caller is
  // responsible for dedup against optimistic local rendering.
  messages: ParsedWebchatMessage[];
  bookingState: string | null;
};

export type ParsedWebchatTurn = {
  // The echoed prospect message, if the server returned it. Caller
  // can use this to replace an optimistic local entry with the
  // persisted one.
  echoedMessage: ParsedWebchatMessage | null;
  // The AI's reply to this turn. This is the load-bearing field — if
  // the tile drops this, the prospect sees their message vanish into
  // the void.
  replyMessage: ParsedWebchatMessage | null;
  bookingState: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDirection(value: unknown): ParsedWebchatMessage["direction"] {
  if (value === "inbound" || value === "outbound" || value === "system") return value;
  // Default unknown to "system" so we never miscategorise a prospect
  // message as an AI reply or vice versa.
  return "system";
}

function parseMessage(value: unknown): ParsedWebchatMessage | null {
  if (!isRecord(value)) return null;
  const id = pickString(value.id);
  const body = pickString(value.body);
  if (!id || !body) return null;
  return { id, body, direction: parseDirection(value.direction) };
}

function unwrapSession(responseBody: unknown): Record<string, unknown> | null {
  if (!isRecord(responseBody)) return null;
  return isRecord(responseBody.session) ? responseBody.session : responseBody;
}

function extractConversationId(session: Record<string, unknown>): string | null {
  const conversation = isRecord(session.conversation) ? session.conversation : null;
  return (
    (conversation ? pickString(conversation.id) : null) ??
    pickString(session.conversationId) ??
    pickString(session.conversation_id)
  );
}

function extractBookingState(session: Record<string, unknown>): string | null {
  const state = isRecord(session.bookingState) ? session.bookingState : null;
  return state ? pickString(state.currentState) : null;
}

export function parseWebchatSessionResponse(
  responseBody: unknown,
): ParsedWebchatSession | null {
  const session = unwrapSession(responseBody);
  if (!session) return null;

  const conversationId = extractConversationId(session);
  if (!conversationId) return null;

  const arrayMessages = Array.isArray(session.messages)
    ? session.messages.map(parseMessage).filter((m): m is ParsedWebchatMessage => m !== null)
    : [];
  const reply = parseMessage(session.replyMessage);
  const seen = new Set(arrayMessages.map((m) => m.id));
  const merged = [...arrayMessages];
  if (reply && !seen.has(reply.id)) merged.push(reply);

  return {
    conversationId,
    messages: merged,
    bookingState: extractBookingState(session),
  };
}

export function parseWebchatTurnResponse(
  responseBody: unknown,
): ParsedWebchatTurn | null {
  const session = unwrapSession(responseBody);
  if (!session) return null;

  return {
    echoedMessage: parseMessage(session.message),
    replyMessage: parseMessage(session.replyMessage),
    bookingState: extractBookingState(session),
  };
}
