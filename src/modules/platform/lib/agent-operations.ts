import type {
  PlatformCommandRecord,
  PlatformEventRecord,
  PlatformOutboxEventRecord,
} from "@/modules/platform/lib/repository";

export type AgentTraceSummary = {
  trace_id: string | null;
  runtime_version: string | null;
  agent_role: string | null;
  stage: string | null;
  intent: string | null;
  confidence: number | null;
  verifier_verdict: string | null;
  repair_summary: string | null;
  policy_version: string | null;
  warnings: string[];
  tool_calls: Array<{ name: string | null; result: string | null; duration_ms?: number | null }>;
  knowledge_sources: Array<{ id: string; label?: string | null; version?: string | null }>;
  goal_state: AgentGoalState | null;
  resource_usage: AgentResourceUsage | null;
  agent_id: string | null;
  agent_name: string | null;
  handoff_from: string | null;
  handoff_to: string | null;
  handoff_reason: string | null;
  parent_trace_id: string | null;
};

export type AgentGoalState = {
  objective: string | null;
  current_stage: string | null;
  required_fields: string[];
  completed_steps: string[];
  next_expected_action: string | null;
  attempts_in_stage: number | null;
  blocked_reason: string | null;
  last_progress_at: string | null;
};

export type AgentResourceUsage = {
  model: string | null;
  tokens_total: number | null;
  duration_ms: number | null;
  cost_estimate: number | null;
  timeout: boolean;
  fallback: boolean;
};

export type AgentReviewSignal = {
  needsReview: boolean;
  reasons: string[];
  riskLevel: "low" | "medium" | "high";
};

export type AgentQualityMetrics = {
  windowDays: number;
  totalEvents: number;
  bookingEvents: number;
  bookingSuccessRate: number | null;
  qualifiedLeadEvents: number;
  failedCommandRate: number | null;
  outboxBacklog: number;
  duplicatePreventionCount: number;
  lowConfidenceOrRepairedCount: number;
  reviewNeededCount: number;
  alerts: Array<{ level: "warning" | "critical"; message: string }>;
};

export type MemoryReuseClass = "reuse_without_confirmation" | "reuse_with_confirmation" | "never_reuse_automatically";

const LOW_CONFIDENCE_THRESHOLD = 0.65;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickString(...candidates: unknown[]) {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function pickNumber(...candidates: unknown[]) {
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}

function pickBoolean(...candidates: unknown[]) {
  for (const candidate of candidates) {
    if (candidate === true || candidate === "true" || candidate === 1 || candidate === "1") {
      return true;
    }
    if (candidate === false || candidate === "false" || candidate === 0 || candidate === "0") {
      return false;
    }
  }
  return false;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim())
    : [];
}

export function normalizeAgentTraceFromPayload(payload: Record<string, unknown>): AgentTraceSummary | null {
  const metadata = asRecord(payload.metadata);
  const trace = asRecord(payload.agent_trace ?? metadata.agent_trace);
  if (Object.keys(trace).length === 0) {
    return null;
  }

  const goalState = asRecord(trace.goal_state ?? payload.goal_state ?? metadata.goal_state);
  const resourceUsage = asRecord(trace.resource_usage ?? trace.usage ?? payload.resource_usage ?? metadata.resource_usage);
  const toolCalls = Array.isArray(trace.tool_calls)
    ? trace.tool_calls.map((value) => {
        const call = asRecord(value);
        return {
          name: pickString(call.name),
          result: pickString(call.result, call.result_kind, call.status),
          duration_ms: pickNumber(call.duration_ms),
        };
      })
    : [];
  const knowledgeSources = Array.isArray(trace.knowledge_sources)
    ? trace.knowledge_sources.flatMap((value) => {
        const source = asRecord(value);
        const id = pickString(source.id, source.source_id);
        return id
          ? [{
              id,
              label: pickString(source.label, source.title),
              version: pickString(source.version, source.source_version),
            }]
          : [];
      })
    : [];

  return {
    trace_id: pickString(trace.trace_id),
    runtime_version: pickString(trace.runtime_version),
    agent_role: pickString(trace.agent_role),
    stage: pickString(trace.stage),
    intent: pickString(trace.intent),
    confidence: pickNumber(trace.confidence),
    verifier_verdict: pickString(trace.verifier_verdict),
    repair_summary: pickString(trace.repair_summary),
    policy_version: pickString(trace.policy_version),
    warnings: stringArray(trace.warnings),
    tool_calls: toolCalls,
    knowledge_sources: knowledgeSources,
    goal_state: Object.keys(goalState).length > 0
      ? {
          objective: pickString(goalState.objective),
          current_stage: pickString(goalState.current_stage, goalState.currentStage),
          required_fields: stringArray(goalState.required_fields ?? goalState.requiredFields),
          completed_steps: stringArray(goalState.completed_steps ?? goalState.completedSteps),
          next_expected_action: pickString(goalState.next_expected_action, goalState.nextExpectedAction),
          attempts_in_stage: pickNumber(goalState.attempts_in_stage, goalState.attemptsInStage),
          blocked_reason: pickString(goalState.blocked_reason, goalState.blockedReason),
          last_progress_at: pickString(goalState.last_progress_at, goalState.lastProgressAt),
        }
      : null,
    resource_usage: Object.keys(resourceUsage).length > 0
      ? {
          model: pickString(resourceUsage.model),
          tokens_total: pickNumber(resourceUsage.tokens_total, resourceUsage.totalTokens),
          duration_ms: pickNumber(resourceUsage.duration_ms, resourceUsage.durationMs),
          cost_estimate: pickNumber(resourceUsage.cost_estimate, resourceUsage.costEstimate),
          timeout: pickBoolean(resourceUsage.timeout),
          fallback: pickBoolean(resourceUsage.fallback),
        }
      : null,
    agent_id: pickString(trace.agent_id),
    agent_name: pickString(trace.agent_name),
    handoff_from: pickString(trace.handoff_from),
    handoff_to: pickString(trace.handoff_to),
    handoff_reason: pickString(trace.handoff_reason),
    parent_trace_id: pickString(trace.parent_trace_id),
  };
}

export function deriveAgentReviewSignal(trace: AgentTraceSummary | null): AgentReviewSignal {
  const reasons: string[] = [];
  if (!trace) {
    return { needsReview: false, reasons, riskLevel: "low" };
  }

  if (typeof trace.confidence === "number" && trace.confidence < LOW_CONFIDENCE_THRESHOLD) {
    reasons.push("Low confidence");
  }
  if (trace.verifier_verdict && !["approve", "approved", "pass", "ok"].includes(trace.verifier_verdict.toLowerCase())) {
    reasons.push(`Verifier ${trace.verifier_verdict}`);
  }
  if (trace.repair_summary) {
    reasons.push("Verifier repaired reply");
  }
  if (trace.warnings.length > 0) {
    reasons.push(...trace.warnings.map((warning) => `Warning: ${warning}`));
  }
  if (trace.tool_calls.some((call) => ["failed", "error", "timeout"].includes(String(call.result).toLowerCase()))) {
    reasons.push("Tool failure");
  }
  if (trace.goal_state?.blocked_reason) {
    reasons.push(`Blocked: ${trace.goal_state.blocked_reason}`);
  }
  if ((trace.goal_state?.attempts_in_stage ?? 0) >= 3) {
    reasons.push("Repeated stage attempts");
  }
  if (trace.resource_usage?.timeout || trace.resource_usage?.fallback) {
    reasons.push(trace.resource_usage.timeout ? "Runtime timeout" : "Runtime fallback");
  }

  const uniqueReasons = [...new Set(reasons)];
  return {
    needsReview: uniqueReasons.length > 0,
    reasons: uniqueReasons,
    riskLevel: uniqueReasons.length >= 3 || uniqueReasons.some((reason) => /blocked|tool failure|timeout/i.test(reason))
      ? "high"
      : uniqueReasons.length > 0
        ? "medium"
        : "low",
  };
}

export function buildAgentConversationMetadata(payload: Record<string, unknown>) {
  const trace = normalizeAgentTraceFromPayload(payload);
  const signal = deriveAgentReviewSignal(trace);
  const memoryApplied = asRecord(payload.memory_applied);

  return {
    session_id: pickString(payload.session_id),
    prior_session_id: pickString(payload.prior_session_id),
    restart_reason: pickString(payload.restart_reason),
    session_origin: pickString(payload.session_origin),
    returning_customer: payload.returning_customer === true,
    memory_applied: memoryApplied,
    ...(trace
      ? {
          agent_trace: trace,
          latest_agent_stage: trace.stage,
          latest_agent_intent: trace.intent,
          latest_agent_confidence: trace.confidence,
          latest_verifier_verdict: trace.verifier_verdict,
          latest_agent_risk_level: signal.riskLevel,
          latest_agent_risk_reasons: signal.reasons,
          needs_review: signal.needsReview || undefined,
          review_reason: signal.reasons.join("; ") || undefined,
          goal_state: trace.goal_state,
          knowledge_sources: trace.knowledge_sources,
          resource_usage: trace.resource_usage,
        }
      : {}),
  };
}

export function classifyMemoryFact(key: string): MemoryReuseClass {
  const normalized = key.trim().toLowerCase();
  if (["customer_name", "full_name", "preferred_channel", "preferred_contact_method", "known_service_history"].includes(normalized)) {
    return "reuse_without_confirmation";
  }
  if (["address", "postcode", "boiler_model", "service_preference", "availability_preference"].includes(normalized)) {
    return "reuse_with_confirmation";
  }
  return "never_reuse_automatically";
}

export function scoreAgentWorkItem(input: {
  occurredAt: string;
  eventType?: string | null;
  lastError?: string | null;
  trace?: AgentTraceSummary | null;
  attempts?: number | null;
}) {
  const reasons: string[] = [];
  let score = 0;
  const text = `${input.eventType ?? ""} ${input.lastError ?? ""} ${input.trace?.intent ?? ""}`.toLowerCase();
  if (/\b(gas|leak|carbon monoxide|no heat|emergency|vulnerable)\b/.test(text)) {
    score += 80;
    reasons.push("Emergency/risk terms");
  }
  if (input.trace) {
    const signal = deriveAgentReviewSignal(input.trace);
    if (signal.riskLevel === "high") score += 35;
    if (signal.riskLevel === "medium") score += 15;
    reasons.push(...signal.reasons);
  }
  if ((input.attempts ?? 0) >= 3) {
    score += 20;
    reasons.push("Repeated failures");
  }
  const ageHours = Math.max(0, (Date.now() - new Date(input.occurredAt).getTime()) / 3_600_000);
  if (ageHours >= 24) {
    score += 20;
    reasons.push("Older than 24h");
  } else if (ageHours >= 4) {
    score += 10;
    reasons.push("Older than 4h");
  }
  return { score, reasons: [...new Set(reasons)] };
}

export function computeAgentQualityMetrics(input: {
  events: PlatformEventRecord[];
  commands: PlatformCommandRecord[];
  outboxEvents: PlatformOutboxEventRecord[];
  windowDays?: number;
}): AgentQualityMetrics {
  const bookingEvents = input.events.filter((event) => event.envelope.event_type === "BookingConfirmed");
  const processedBookings = bookingEvents.filter((event) => event.processing_status === "processed").length;
  const failedCommands = input.commands.filter((command) => command.delivery_status === "failed").length;
  const traces = input.events.flatMap((event) => {
    const trace = normalizeAgentTraceFromPayload(event.envelope.payload);
    return trace ? [trace] : [];
  });
  const signals = traces.map(deriveAgentReviewSignal);
  const duplicatePreventionCount = input.events.filter((event) => {
    const metadata = asRecord(event.envelope.payload.metadata);
    return metadata.review_reason === "duplicate_booking_candidate" || asRecord(metadata.duplicate_booking_candidate).incoming_booking_id;
  }).length;
  const alerts: AgentQualityMetrics["alerts"] = [];
  const failedCommandRate = input.commands.length > 0 ? failedCommands / input.commands.length : null;
  const outboxBacklog = input.outboxEvents.filter((event) => event.publication_status === "failed").length;
  const reviewNeededCount = signals.filter((signal) => signal.needsReview).length;

  if ((failedCommandRate ?? 0) >= 0.1) alerts.push({ level: "critical", message: "Command failure rate is above 10%." });
  if (outboxBacklog >= 5) alerts.push({ level: "warning", message: "Outbox backlog needs operator review." });
  if (reviewNeededCount >= 5) alerts.push({ level: "warning", message: "Agent review queue is growing." });

  return {
    windowDays: input.windowDays ?? 7,
    totalEvents: input.events.length,
    bookingEvents: bookingEvents.length,
    bookingSuccessRate: bookingEvents.length > 0 ? processedBookings / bookingEvents.length : null,
    qualifiedLeadEvents: input.events.filter((event) => event.envelope.event_type === "ConversationQualified").length,
    failedCommandRate,
    outboxBacklog,
    duplicatePreventionCount,
    lowConfidenceOrRepairedCount: signals.filter((signal) => signal.reasons.some((reason) => /confidence|repaired/i.test(reason))).length,
    reviewNeededCount,
    alerts,
  };
}

export function redactAgentEvalText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+44|0)\s?7[\d\s-]{8,12}/g, "[phone]")
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "[postcode]")
    .replace(/\b\d{1,4}\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4}\s+(Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Way|Close|Drive|Dr)\b/g, "[address]");
}

export function redactAgentEvalSnapshot(value: unknown): unknown {
  if (typeof value === "string") return redactAgentEvalText(value);
  if (Array.isArray(value)) return value.map(redactAgentEvalSnapshot);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactAgentEvalSnapshot(entry)]));
  }
  return value;
}

export function buildDiscoveryCandidates(input: { traces: AgentTraceSummary[] }) {
  const groups = new Map<string, { title: string; count: number; refs: string[] }>();
  for (const trace of input.traces) {
    const signal = deriveAgentReviewSignal(trace);
    for (const reason of signal.reasons) {
      const key = reason.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const existing = groups.get(key) ?? { title: reason, count: 0, refs: [] };
      existing.count += 1;
      if (trace.trace_id && existing.refs.length < 5) existing.refs.push(trace.trace_id);
      groups.set(key, existing);
    }
  }
  return [...groups.entries()]
    .map(([key, value]) => ({
      cluster_type: key.includes("confidence") ? "low_confidence" : key.includes("tool") ? "tool_failure" : "unknown_intent",
      title: value.title,
      priority_score: value.count * 10,
      sample_refs: value.refs,
    }))
    .sort((left, right) => right.priority_score - left.priority_score);
}
