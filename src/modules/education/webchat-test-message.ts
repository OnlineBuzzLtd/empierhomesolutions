// A public webchat message is only treated as test traffic when the customer
// says so unambiguously. The previous rule was `/\btest\b/i` over the whole
// message, which flagged genuine customers writing things like "the boiler
// failed its test" or "I need a gas safety test" — those rows then got excluded
// from availability checks and swept up by test-data cleanup.
const EXPLICIT_TEST_MESSAGE =
  /^\s*(?:this\s+is\s+(?:a|just\s+a)\s+test|test\s+message|testing\s+the\s+(?:chat|bot|system)|ignore[\s,-]+test)\b/i;

export function isTestConversation(inboundText: string) {
  return EXPLICIT_TEST_MESSAGE.test(inboundText);
}
