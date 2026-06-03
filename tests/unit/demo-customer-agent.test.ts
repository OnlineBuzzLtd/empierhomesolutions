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
    expect(classifyDemoCustomerQuestion("I have your phone and address. When would you like us to visit?")).toBe(
      "time",
    );
    expect(classifyDemoCustomerQuestion("I have 188 Hello Lane on file. What's your full name?")).toBe(
      "identity",
    );
    expect(classifyDemoCustomerQuestion("Would the 9:00–10:00 am slot work for you?")).toBe(
      "confirmation",
    );
  });

  it("detects booking and survey completion replies", () => {
    expect(demoCustomerReplyLooksComplete("You're booked for tomorrow at 8am.")).toBe(true);
    expect(demoCustomerReplyLooksComplete("You’re booked for Thu 4 Jun, 3:00 pm to 4:00 pm.")).toBe(true);
    expect(demoCustomerReplyLooksComplete("Your survey is confirmed for Tuesday.")).toBe(true);
    expect(
      demoCustomerReplyLooksComplete(
        "Perfect! Your emergency boiler repair is confirmed for Thu 4 Jun, 4:00 pm to 5:00 pm at 188 Hello Lane.",
      ),
    ).toBe(true);
    expect(
      demoCustomerReplyLooksComplete(
        "Thanks for confirming your number. Your emergency boiler repair is all set for Thu 4 Jun, 2:00 pm to 3:00 pm.",
      ),
    ).toBe(true);
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

  it("answers full-address prompts with the address even when the AI mentions the saved number", async () => {
    const providerGenerateTurn = vi.fn();
    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [
          {
            id: "m1",
            direction: "outbound",
            body: "Thanks. I have your number. What's your postcode or full address so the engineer knows where to go?",
          },
        ],
      },
      { providerGenerateTurn },
    );

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "My phone is +447779305853, and the address is 188 Hello Lane, Uxbridge UB8 1AA.",
    });
    expect(providerGenerateTurn).not.toHaveBeenCalled();
  });

  it("answers time prompts when the AI repeats already-collected phone/address context", async () => {
    const providerGenerateTurn = vi.fn();
    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [
          {
            id: "m1",
            direction: "outbound",
            body: "Thanks for confirming. I have your phone and address. When would you like the engineer to visit—today or tomorrow?",
          },
        ],
      },
      { providerGenerateTurn },
    );

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "Tomorrow morning, preferably from 8am.",
    });
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

  it("answers service confirmation prompts with service details before moving to time", async () => {
    await expect(
      generateDemoCustomerTurn(
        {
          ...baseInput,
          scenarioKey: "boiler_install_survey",
          transcript: [
            {
              id: "m1",
              direction: "outbound",
              body: "Great, I can help you book a boiler install survey. Just to confirm, is this for a survey for a new combi boiler install?",
            },
          ],
        },
        { providerGenerateTurn: vi.fn() },
      ),
    ).resolves.toMatchObject({
      status: "message",
      message:
        "Yes, Boiler install survey. Customer wants a quote for a new combi boiler installation.",
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

  it("accepts boiler install survey slots before asking the platform AI", async () => {
    const providerGenerateTurn = vi.fn().mockResolvedValue({
      status: "blocked",
      stopCode: "unsafe_llm_output",
      message: null,
      reason: "Customer requested tomorrow morning but offered slots are afternoon.",
    });

    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        scenarioKey: "boiler_install_survey",
        prospectName: "mike",
        transcript: [
          {
            id: "m1",
            direction: "inbound",
            body: "Hi, I need to book a boiler install survey for a new combi boiler. Tomorrow morning would work best for me if that's possible.",
          },
          { id: "m2", direction: "outbound", body: "What date and time would you like?" },
          { id: "m3", direction: "inbound", body: "Tomorrow morning if available." },
          {
            id: "m4",
            direction: "outbound",
            body: "I can do Wed 3 Jun, 12:00 pm to 1:00 pm, Wed 3 Jun, 12:30 pm to 1:30 pm, Wed 3 Jun, 1:00 pm to 2:00 pm. Which works best?",
          },
        ],
      },
      { providerGenerateTurn },
    );

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "The 12:00 pm to 1:00 pm slot works. Please book that.",
    });
    expect(providerGenerateTurn).not.toHaveBeenCalled();
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
    expect(turn?.reason).toContain("structured booking question");
  });

  it("keeps answering after the AI repeats the same field after a direct retry", () => {
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

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "My phone is +447779305853 and the postcode is UB8 1AA.",
    });
    expect(turn?.reason).toContain("Continuing the booking");
  });

  it("answers the first emergency service question with the required service details", async () => {
    const providerGenerateTurn = vi.fn();
    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [
          {
            id: "m1",
            direction: "outbound",
            body: "I can help with that. No heating or hot water sounds like a boiler issue. Is it a boiler repair you need, or could it be something else like a cylinder or plumbing problem?",
          },
        ],
      },
      { providerGenerateTurn },
    );

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "Emergency boiler repair callout. No heating or hot water. The boiler is making a loud noise.",
    });
    expect(providerGenerateTurn).not.toHaveBeenCalled();
  });

  it("continues booking when a teammate handoff is followed by another booking question", async () => {
    const providerGenerateTurn = vi.fn();
    const turn = await generateDemoCustomerTurn(
      {
        ...baseInput,
        transcript: [
          { id: "m1", direction: "outbound", body: "I need a teammate to take this over and they'll follow up shortly." },
          { id: "m2", direction: "inbound", body: "Okay, thanks. I'll wait to hear from your team." },
          { id: "m3", direction: "outbound", body: "What date and time would you like?" },
        ],
      },
      { providerGenerateTurn },
    );

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "Tomorrow morning, preferably from 8am.",
    });
    expect(providerGenerateTurn).not.toHaveBeenCalled();
  });

  it("screenshot regression: repeated date/time prompt after details still gets answered", async () => {
    const providerGenerateTurn = vi.fn();
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
            body: "I can help with that. No heating or hot water sounds like a boiler issue. Is it a boiler repair you need, or could it be something else like a cylinder or plumbing problem?",
          },
          {
            id: "m3",
            direction: "inbound",
            body: "Emergency boiler repair callout. No heating or hot water. The boiler is making a loud noise.",
          },
          { id: "m4", direction: "outbound", body: "What is the best phone number for the booking?" },
          { id: "m5", direction: "inbound", body: "My phone number is +447779305853." },
          {
            id: "m6",
            direction: "outbound",
            body: "Thanks. I have your number. For the emergency repair, I need your postcode and street address so the engineer knows where to go.",
          },
          {
            id: "m7",
            direction: "inbound",
            body: "My name is Shaz Iqbal, my phone is +447779305853, and the address is 188 Hello Lane, Uxbridge UB8 1AA. The boiler is making a loud noise and tomorrow morning from 8am works. Yes, please book the slot.",
          },
          { id: "m8", direction: "outbound", body: "What date and time would you like?" },
        ],
      },
      { providerGenerateTurn },
    );

    expect(turn).toMatchObject({
      status: "message",
      stopCode: "next_message",
      message: "Tomorrow morning, preferably from 8am.",
    });
    expect(providerGenerateTurn).not.toHaveBeenCalled();
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
