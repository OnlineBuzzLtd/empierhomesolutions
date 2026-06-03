import { describe, expect, it } from "vitest";
import {
  buildAgentConversationMetadata,
  buildDiscoveryCandidates,
  classifyMemoryFact,
  computeAgentQualityMetrics,
  deriveAgentReviewSignal,
  normalizeAgentTraceFromPayload,
  redactAgentEvalSnapshot,
  scoreAgentWorkItem,
} from "@/modules/platform/lib/agent-operations";

describe("agent operations", () => {
  it("normalizes trace, goal, knowledge, resource, and handoff metadata", () => {
    const trace = normalizeAgentTraceFromPayload({
      agent_trace: {
        trace_id: "trace-1",
        runtime_version: "2026.06.03",
        agent_role: "front_desk",
        stage: "checking_availability",
        intent: "book",
        confidence: 0.42,
        verifier_verdict: "REPAIR",
        repair_summary: "Asked for postcode confirmation.",
        warnings: ["postcode_uncertain"],
        tool_calls: [{ name: "check_availability", result: "timeout", duration_ms: 1200 }],
        knowledge_sources: [{ id: "ks-1", label: "Cancellation policy", version: "v2" }],
        goal_state: {
          objective: "book_visit",
          current_stage: "checking_availability",
          required_fields: ["postcode"],
          completed_steps: ["captured_phone"],
          next_expected_action: "confirm_postcode",
          attempts_in_stage: 3,
          blocked_reason: "availability_tool_timeout",
          last_progress_at: "2026-06-03T10:00:00.000Z",
        },
        resource_usage: {
          model: "gpt-test",
          tokens_total: 1200,
          duration_ms: 1400,
          cost_estimate: 0.012,
          timeout: true,
        },
        agent_id: "availability-agent",
        handoff_from: "router",
        handoff_to: "booking",
        handoff_reason: "customer_requested_booking",
      },
    });

    expect(trace).toMatchObject({
      trace_id: "trace-1",
      confidence: 0.42,
      verifier_verdict: "REPAIR",
      knowledge_sources: [{ id: "ks-1", label: "Cancellation policy", version: "v2" }],
      goal_state: { attempts_in_stage: 3, blocked_reason: "availability_tool_timeout" },
      resource_usage: { model: "gpt-test", timeout: true },
      handoff_from: "router",
      handoff_to: "booking",
    });
  });

  it("derives review signals and conversation metadata from risky traces", () => {
    const metadata = buildAgentConversationMetadata({
      agent_trace: {
        trace_id: "trace-2",
        confidence: 0.5,
        verifier_verdict: "REPAIR",
        repair_summary: "Corrected unsafe reply.",
      },
    });

    expect(metadata).toMatchObject({
      latest_agent_confidence: 0.5,
      latest_agent_risk_level: "high",
      needs_review: true,
    });
    expect(metadata.latest_agent_risk_reasons).toEqual(
      expect.arrayContaining(["Low confidence", "Verifier REPAIR", "Verifier repaired reply"]),
    );
  });

  it("classifies reusable memory by confirmation requirement", () => {
    expect(classifyMemoryFact("preferred_channel")).toBe("reuse_without_confirmation");
    expect(classifyMemoryFact("postcode")).toBe("reuse_with_confirmation");
    expect(classifyMemoryFact("payment_card")).toBe("never_reuse_automatically");
  });

  it("scores urgent and repeated recovery work above low-risk work", () => {
    const high = scoreAgentWorkItem({
      occurredAt: "2026-06-01T10:00:00.000Z",
      eventType: "EscalationRaised",
      lastError: "gas leak tool failure",
      attempts: 4,
      trace: normalizeAgentTraceFromPayload({ agent_trace: { tool_calls: [{ name: "handoff", result: "failed" }] } }),
    });
    const low = scoreAgentWorkItem({
      occurredAt: new Date().toISOString(),
      eventType: "ConversationQualified",
    });

    expect(high.score).toBeGreaterThan(low.score);
    expect(high.reasons).toEqual(expect.arrayContaining(["Emergency/risk terms", "Repeated failures", "Tool failure"]));
  });

  it("computes quality metrics and alerts from event/command/outbox records", () => {
    const metrics = computeAgentQualityMetrics({
      events: [
        {
          tenant_id: "tenant-1",
          processing_status: "processed",
          received_at: "2026-06-03T10:00:00.000Z",
          processed_at: "2026-06-03T10:00:01.000Z",
          last_error: null,
          dead_letter_reason: null,
          envelope: {
            event_id: "11111111-1111-4111-8111-111111111111",
            event_type: "BookingConfirmed",
            event_version: 1,
            workspace_id: "22222222-2222-4222-8222-222222222222",
            occurred_at: "2026-06-03T10:00:00.000Z",
            source_system: "agentic_runtime",
            idempotency_key: "booking-1",
            correlation_id: null,
            causation_id: null,
            aggregate: { type: "conversation", id: "33333333-3333-4333-8333-333333333333" },
            payload: { agent_trace: { confidence: 0.5 } },
          },
        },
      ],
      commands: [
        {
          tenant_id: "tenant-1",
          delivery_status: "failed",
          requested_by_user_id: null,
          sent_at: null,
          acknowledged_at: null,
          last_error: "failed",
          attempt_count: 1,
          envelope: {
            command_id: "44444444-4444-4444-8444-444444444444",
            command_type: "CreateOrUpdateAppointment",
            command_version: 1,
            workspace_id: "22222222-2222-4222-8222-222222222222",
            issued_at: "2026-06-03T10:00:00.000Z",
            source_system: "crm",
            target_system: "crm",
            idempotency_key: "booking-1:cmd",
            correlation_id: null,
            causation_id: null,
            aggregate: { type: "conversation", id: "33333333-3333-4333-8333-333333333333" },
            payload: {},
          },
        },
      ],
      outboxEvents: [],
    });

    expect(metrics.bookingSuccessRate).toBe(1);
    expect(metrics.failedCommandRate).toBe(1);
    expect(metrics.reviewNeededCount).toBe(1);
    expect(metrics.alerts[0]?.level).toBe("critical");
  });

  it("redacts PII for eval fixture snapshots", () => {
    expect(redactAgentEvalSnapshot({
      text: "Email shaz@example.com, phone +447700900111, postcode SW1A 1AA, 10 Downing Street",
    })).toEqual({
      text: "Email [email], phone [phone], postcode [postcode], [address]",
    });
  });

  it("builds discovery candidates from repeated risk traces", () => {
    const traces = [
      normalizeAgentTraceFromPayload({ agent_trace: { trace_id: "t1", confidence: 0.4 } }),
      normalizeAgentTraceFromPayload({ agent_trace: { trace_id: "t2", confidence: 0.3 } }),
    ].filter((trace): trace is NonNullable<typeof trace> => Boolean(trace));

    const [candidate] = buildDiscoveryCandidates({ traces });
    expect(candidate).toMatchObject({
      cluster_type: "low_confidence",
      title: "Low confidence",
      priority_score: 20,
      sample_refs: ["t1", "t2"],
    });
  });

  it("keeps clean traces out of review", () => {
    const signal = deriveAgentReviewSignal(normalizeAgentTraceFromPayload({
      agent_trace: {
        confidence: 0.91,
        verifier_verdict: "APPROVE",
      },
    }));

    expect(signal).toEqual({ needsReview: false, reasons: [], riskLevel: "low" });
  });
});
