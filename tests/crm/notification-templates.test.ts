import { describe, expect, it, vi } from "vitest";

describe("notification templates", () => {
  it("renders template variables and fails loudly on missing variables", async () => {
    const { renderTemplateString } = await import("@/modules/crm/notifications/render");

    expect(
      renderTemplateString("Hi {{ customer_name }}, your visit is {{appointment_time}}.", {
        customer_name: "Aisha",
        appointment_time: "tomorrow",
      }),
    ).toBe("Hi Aisha, your visit is tomorrow.");

    expect(() => renderTemplateString("Hi {{customer_name}}", {})).toThrow(
      "Missing notification template variables: customer_name",
    );
  });

  it("prefers tenant overrides over default templates", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      or: vi.fn().mockResolvedValue({
        data: [
          {
            id: "default-template",
            tenant_id: null,
            key: "confirmation_sms",
            channel: "sms",
            locale: "en-GB",
            subject: null,
            body: "Default {{customer_name}}",
            variables: ["customer_name"],
            active: true,
          },
          {
            id: "tenant-template",
            tenant_id: tenantId,
            key: "confirmation_sms",
            channel: "sms",
            locale: "en-GB",
            subject: null,
            body: "Tenant {{customer_name}}",
            variables: ["customer_name"],
            active: true,
          },
        ],
        error: null,
      }),
    };
    const supabase = {
      schema: vi.fn(() => ({
        from: vi.fn(() => query),
      })),
    } as never;

    const { renderNotificationTemplate } = await import("@/modules/crm/notifications/render");
    const rendered = await renderNotificationTemplate(supabase, {
      tenantId,
      key: "confirmation_sms",
      channel: "sms",
      variables: { customer_name: "Aisha" },
    });

    expect(rendered.template.id).toBe("tenant-template");
    expect(rendered.body).toBe("Tenant Aisha");
  });
});
