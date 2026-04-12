export type WorkspaceId = string;

export type WorkspaceModuleCard = {
  title: string;
  href: string;
  summary: string;
  bullets: string[];
};

export function toWorkspaceId(tenantId: string): WorkspaceId {
  return tenantId.trim();
}

export function buildWorkspaceModuleCards(): WorkspaceModuleCard[] {
  return [
    {
      title: "Inbox",
      href: "/inbox",
      summary: "Workspace-scoped conversation operations across SMS, WhatsApp, web chat, and missed-call recovery.",
      bullets: [
        "one queue for comms activity",
        "link conversation to customer and job",
        "surface next action and handoff state",
      ],
    },
    {
      title: "Calls & Recovery",
      href: "/calls",
      summary: "Operational view for missed-call capture, recovery flows, and callback tasks.",
      bullets: [
        "track missed-call recovery",
        "monitor callback creation",
        "keep revenue-risk enquiries visible",
      ],
    },
    {
      title: "Automations",
      href: "/automations",
      summary: "Workspace-safe view of outbound follow-ups, reminders, escalations, and durable event delivery.",
      bullets: [
        "see what AI sent or queued",
        "review retries and failures",
        "keep automations auditable",
      ],
    },
    {
      title: "AI Settings",
      href: "/ai-settings",
      summary: "Workspace-owned controls for prompts, channel policy, escalation, booking, and quiet hours.",
      bullets: [
        "workspace-owned policy",
        "no hidden cross-tenant defaults",
        "clear operator control surface",
      ],
    },
  ];
}
