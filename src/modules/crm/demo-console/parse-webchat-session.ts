// Parser for the CJ runtime webchat session response shape.
//
// The runtime returns:
//   { conversation: { id: "..." }, messages: [...], replyMessage: {...}, bookingState: { currentState: "..." } }
//
// Older shapes / fixture variants may instead use:
//   { conversationId: "..." }
//   { conversation_id: "..." }
//
// This helper accepts all three so the Demo Console WebchatTile and any
// future caller don't have to re-derive the lookup path. It's extracted
// from the tile so it can be unit-tested in isolation — the
// "session response missing conversationId" bug shipped because the tile
// looked at the wrong path and there was no test catching the shape
// drift.

export type ParsedWebchatSession = {
  conversationId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseWebchatSessionResponse(
  responseBody: unknown,
): ParsedWebchatSession | null {
  if (!isRecord(responseBody)) return null;

  // The session payload may be at top level or nested under `session`.
  const session = isRecord(responseBody.session) ? responseBody.session : responseBody;

  // CJ runtime canonical shape — { conversation: { id } }.
  const conversation = isRecord(session.conversation) ? session.conversation : null;
  const fromConversation = conversation ? pickString(conversation.id) : null;
  if (fromConversation) return { conversationId: fromConversation };

  // Legacy/fixture variants — flat conversationId or conversation_id.
  const flatCamel = pickString(session.conversationId);
  if (flatCamel) return { conversationId: flatCamel };
  const flatSnake = pickString(session.conversation_id);
  if (flatSnake) return { conversationId: flatSnake };

  return null;
}
