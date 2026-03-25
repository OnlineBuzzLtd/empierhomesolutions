import { beforeEach, describe, expect, it, vi } from "vitest";

describe("crm api helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("allocates quote and invoice numbers through the crm schema RPC", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: 12, error: null })
      .mockResolvedValueOnce({ data: 8, error: null });
    const schema = vi.fn().mockReturnValue({ rpc });

    vi.doMock("@/modules/crm/lib/supabase-server", () => ({
      createCrmServerClient: vi.fn().mockResolvedValue({ schema }),
    }));

    const { nextInvoiceNumber, nextQuoteNumber } = await import("@/modules/crm/lib/api");

    expect(await nextQuoteNumber()).toBe(`Q-${new Date().getUTCFullYear()}-0012`);
    expect(await nextInvoiceNumber()).toBe(`INV-${new Date().getUTCFullYear()}-0008`);
    expect(schema).toHaveBeenNthCalledWith(1, "crm");
    expect(schema).toHaveBeenNthCalledWith(2, "crm");
    expect(rpc).toHaveBeenNthCalledWith(1, "next_sequence", { p_sequence_key: "quote" });
    expect(rpc).toHaveBeenNthCalledWith(2, "next_sequence", { p_sequence_key: "invoice" });
  });
});
