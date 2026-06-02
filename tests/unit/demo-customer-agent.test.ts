import { describe, expect, it, vi } from "vitest";
import {
  buildDemoCustomerPromptMessages,
  classifyDemoCustomerQuestion,
  demoCustomerReplyLooksComplete,
  generateDemoCustomerTurn,
  resolveDeterministicDemoCustomerTurn,
  validateDemoCustomerMessage,
} from "@/modules/crm/demo-console/server/demo-customer-agent";

const baseInput = {
  scenarioKey: "emergency_repair_booking" as const,
  prospectName: "Shaz Iqbal",
  prospectPhone: "+447779305853",
  turnIndex: 1,
  transcript: [
    {
      id: "m1",
      direction: "inbound" as const,
      body: "Hi, I have no heating or hot water and need someone urgently.",
    },
    {
      id: "m2",
      direction: "outbound" as const,
      body: "Can I get your phone number and postcode?",
    },
  ],
};

describe("demo customer agent guardrails", () => {
  it("classifies the AI's latest missing-info question", () => {
    expect(classifyDemoCustomerQuestion("Can I get your phone number?")).toBe("phone");
    expect(classifyDemoCustomerQuestion("What postcode is the property?")).toBe("postcode");
    expect(classifyDemoCustomerQuestion("What is the best email for the booking?")).toBe("email");
    expect(classifyDemoCustomerQuestion("Shall I book that slot?")).toBe("confirmation");
    expect(classifyDemoCustomerQuestion("Would the 9:00–10:00 am slot work for you?")).toBe(
      "confirmation",
    );
  });

  it("detects booking and survey completion replies", () => {
    expect(demoCustomerReplyLooksComplete("You're booked for tomorrow at 8am.")).toBe(true);
    expect(demoCustomerReplyLooksComplete("Your survey is confirmed for Tuesday.")).toBe(true);
  });

  it("sends consolidated details when the AI repeats a missing-info question", () => {
    const turn = resolveDeterministicDemoCustomerTurn({
      ...baseInput,
      transcript: [
        ...baseInput.transcript,
        { id: "m3", direction: "inbound", body: "My number is +447779305853." },
        { id: "m4", direction: "outbound", body: "Can I get your phone number and postcode?" },
      ],
    });

    expect(turn).toMatchObject({ status: "message", stopCode: "next_message" });
    expect(turn?.message).toContain("+447779305853");
    expect(turn?.message).toContain("UB8 1AA");
  });

  it("answers common booking questions without any LLM provider", async () => {
    const providerGenerateTurn = vi.fn();
    const turn = await generateDemoCustomerTurn(baseInput, { providerGenerateTurn });

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "My phone is +447779305853 and the postcode is UB8 1AA.",
    });
    expect(turn.reason).toContain("structured booking question");
    expect(providerGenerateTurn).not.toHaveBeenCalled();
  });

  it("answers confirmation and time questions from scenario facts without a provider", async () => {
    await expect(
      generateDemoCustomerTurn(
        {
          ...baseInput,
          transcript: [{ id: "m1", direction: "outbound", body: "When would you like us to visit?" }],
        },
      ),
    ).resolves.toMatchObject({
      status: "message",
      message: "Tomorrow morning, preferably from 8am.",
    });

    await expect(
      generateDemoCustomerTurn(
        {
          ...baseInput,
          transcript: [{ id: "m1", direction: "outbound", body: "Shall I book that slot?" }],
        },
      ),
    ).resolves.toMatchObject({
      status: "message",
      message: "Yes, please book that.",
    });
  });

  it("accepts the first offered slot instead of repeating the preferred time", async () => {
    await expect(
      generateDemoCustomerTurn(
        {
          ...baseInput,
          transcript: [
            {
              id: "m1",
              direction: "outbound",
              body: "That time is gone. I can do Tue 2 Jun, 9:00 am to 10:00 am, Tue 2 Jun, 9:30 am to 10:30 am, Tue 2 Jun, 10:00 am to 11:00 am. Which works best?",
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "The 9:00 am to 10:00 am slot works. Please book that.",
    });
  });

  it("sends literal YES when the booking AI explicitly asks for YES confirmation", async () => {
    await expect(
      generateDemoCustomerTurn(
        {
          ...baseInput,
          transcript: [
            {
              id: "m1",
              direction: "outbound",
              body: "I can do Wed 3 Jun, 8:00 am to 9:00 am. Reply YES to confirm it or send another time.",
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "YES",
    });
  });

  it("sends literal YES before the repeated-question guard can block confirmation", async () => {
    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [
          ...baseInput.transcript,
          {
            id: "m3",
            direction: "inbound",
            body: "My name is shaz, my phone is +447779305853, and the address is 188 Hello Lane, Uxbridge UB8 1AA. The boiler is making a loud noise and tomorrow morning from 8am works. Yes, please book the slot.",
          },
          {
            id: "m4",
            direction: "outbound",
            body: "I can do Wed 3 Jun, 8:00 am to 9:00 am. Reply YES to confirm it or send another time.",
          },
          {
            id: "m5",
            direction: "inbound",
            body: "The 8:00 am to 9:00 am slot works. Please book that.",
          },
          {
            id: "m6",
            direction: "outbound",
            body: "If that slot works, reply YES to confirm it, or send another time.",
          },
        ],
      },
    );

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "YES",
    });
  });

  it("accepts an offered slot before the repeated-question guard blocks the run", async () => {
    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [
          ...baseInput.transcript,
          {
            id: "m3",
            direction: "inbound",
            body: "My name is shaz, my phone is +447779305853, and the address is 188 Hello Lane, Uxbridge UB8 1AA. The boiler is making a loud noise and tomorrow morning from 8am works. Yes, please book the slot.",
          },
          {
            id: "m4",
            direction: "outbound",
            body: "That time is gone. I can do Tue 2 Jun, 9:00 am to 10:00 am, Tue 2 Jun, 9:30 am to 10:30 am. Which works best?",
          },
          {
            id: "m5",
            direction: "inbound",
            body: "Tomorrow morning, preferably from 8am.",
          },
          {
            id: "m6",
            direction: "outbound",
            body: "I understand you'd prefer 8am, but that slot isn't available tomorrow. The earliest I can offer is 9:00 am. Would the 9:00–10:00 am slot work for you?",
          },
        ],
      },
    );

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "The 9:00 am to 10:00 am slot works. Please book that.",
    });
  });

  it("retries the exact requested field when the AI repeats after consolidated details were sent", () => {
    const turn = resolveDeterministicDemoCustomerTurn({
      ...baseInput,
      transcript: [
        ...baseInput.transcript,
        {
          id: "m3",
          direction: "inbound",
          body: "My name is Shaz Iqbal, my phone is +447779305853, and the address is 188 Hello Lane, Uxbridge UB8 1AA.",
        },
        { id: "m4", direction: "outbound", body: "Can I get your phone number and postcode?" },
      ],
    });

    expect(turn).toMatchObject({ status: "message", stopCode: "next_message" });
    expect(turn?.message).toBe("My phone is +447779305853 and the postcode is UB8 1AA.");
    expect(turn?.reason).toContain("exact scenario detail");
  });

  it("blocks only after the AI repeats the same field after a direct retry", () => {
    const turn = resolveDeterministicDemoCustomerTurn({
      ...baseInput,
      transcript: [
        ...baseInput.transcript,
        {
          id: "m3",
          direction: "inbound",
          body: "My name is Shaz Iqbal, my phone is +447779305853, and the address is 188 Hello Lane, Uxbridge UB8 1AA.",
        },
        { id: "m4", direction: "outbound", body: "Can I get your phone number and postcode?" },
        { id: "m5", direction: "inbound", body: "My phone is +447779305853 and the postcode is UB8 1AA." },
        { id: "m6", direction: "outbound", body: "Can I get your phone number and postcode?" },
      ],
    });

    expect(turn).toMatchObject({ status: "blocked", stopCode: "repeated_question" });
    expect(turn?.reason).toContain("direct retry");
  });

  it("answers email prompts without inventing an email address", async () => {
    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [{ id: "m1", direction: "outbound", body: "What is the best email address for the booking?" }],
      },
    );

    expect(turn).toMatchObject({
      status: "message",
      message: "Please use my phone number +447779305853 for the booking confirmation.",
    });
    expect(turn.message ?? "").not.toContain("@");
  });

  it("builds prompt input from safe scenario facts and transcript only", () => {
    const messages = buildDemoCustomerPromptMessages(baseInput);
    const serialised = JSON.stringify(messages);

    expect(serialised).toContain("Emergency repair booking");
    expect(serialised).toContain("+447779305853");
    expect(serialised).toContain("Can I get your phone number and postcode?");
    expect(serialised).not.toContain("OPENAI_API_KEY");
    expect(serialised).not.toContain("sk-live");
  });

  it("rejects unsafe or empty generated customer messages", () => {
    expect(validateDemoCustomerMessage("")).toMatchObject({ ok: false });
    expect(validateDemoCustomerMessage("Assistant: I can help.")).toMatchObject({ ok: false });
    expect(validateDemoCustomerMessage("My email is test@example.com")).toMatchObject({ ok: false });
    expect(validateDemoCustomerMessage("It costs £100")).toMatchObject({ ok: false });
    expect(validateDemoCustomerMessage("Tomorrow morning works.")).toMatchObject({
      ok: true,
      message: "Tomorrow morning works.",
    });
  });

  it("sends consolidated scenario details when platform AI is unavailable and the AI asks an unstructured follow-up", async () => {
    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [{ id: "m1", direction: "outbound", body: "Please provide your reference code." }],
      },
    );

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
    });
    expect(turn.message).toContain("+447779305853");
    expect(turn.message).toContain("UB8 1AA");
    expect(turn.reason).toContain("Platform AI provider is unavailable");
  });

  it("returns a blocker when platform AI is unavailable after consolidated details were already sent", async () => {
    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [
          {
            id: "m1",
            direction: "inbound",
            body: "My name is Shaz Iqbal, my phone is +447779305853, and the address is 188 Hello Lane, Uxbridge UB8 1AA.",
          },
          { id: "m2", direction: "outbound", body: "Please provide your reference code." },
        ],
      },
    );

    expect(turn).toMatchObject({ status: "blocked", stopCode: "llm_not_configured" });
    expect(turn.reason).toContain("Platform AI unavailable");
  });

  it("uses a mocked platform response for a safe next turn", async () => {
    const providerGenerateTurn = vi.fn().mockResolvedValue({
      status: "message",
      stopCode: "next_message",
      message: "My phone is +447779305853 and the postcode is UB8 1AA.",
      reason: "Answering requested contact details.",
    });

    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [
          {
            id: "m1",
            direction: "inbound",
            body: "Hi, I have no heating or hot water and need someone urgently.",
          },
          {
            id: "m2",
            direction: "outbound",
            body: "Please provide any extra context for the office.",
          },
        ],
      },
      { providerGenerateTurn },
    );

    expect(turn).toMatchObject({
      status: "message",
      message: "My phone is +447779305853 and the postcode is UB8 1AA.",
    });
    expect(providerGenerateTurn).toHaveBeenCalledWith(expect.objectContaining({ scenarioKey: baseInput.scenarioKey }));
  });

  it("falls back to deterministic scenario details when the platform provider is unavailable", async () => {
    const providerGenerateTurn = vi.fn().mockResolvedValue({
      status: "blocked",
      stopCode: "llm_failed",
      message: null,
      reason: "Platform AI unavailable for demo customer turns.",
    });

    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [
          {
            id: "m1",
            direction: "inbound",
            body: "Hi, I have no heating or hot water and need someone urgently.",
          },
          {
            id: "m2",
            direction: "outbound",
            body: "Please provide any extra context for the office.",
          },
        ],
      },
      { providerGenerateTurn },
    );

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
    });
    expect(turn.reason).toContain("Platform AI unavailable");
    expect(turn.reason).toContain("deterministic scenario fallback");
    expect(turn.message).toContain("+447779305853");
    expect(turn.message).toContain("UB8 1AA");
  });

  it("preserves unsafe platform blockers instead of falling back", async () => {
    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [
          {
            id: "m1",
            direction: "outbound",
            body: "Please provide any extra context for the office.",
          },
        ],
      },
      {
        providerGenerateTurn: vi.fn().mockResolvedValue({
          status: "blocked",
          stopCode: "unsafe_llm_output",
          message: null,
          reason: "Platform AI invented pricing.",
        }),
      },
    );

    expect(turn).toMatchObject({
      status: "blocked",
      stopCode: "unsafe_llm_output",
    });
  });
});
