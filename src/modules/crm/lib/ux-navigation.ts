import type { CrmNavGroup, CrmNavItem } from "@/modules/crm/components/layout/CrmNav";

const aiReceptionistRoutes: Record<string, string> = {
  "/inbox": "/ai-hub?tab=conversations",
  "/calls": "/ai-hub?tab=missed-calls",
  "/automations": "/ai-hub?tab=follow-ups",
  "/ai-settings": "/ai-hub?tab=settings",
};

const engineerBlockedPrefixes = [
  "/leads",
  "/customers",
  "/quotes",
  "/invoices",
  "/staff",
  "/reports",
  "/settings",
  "/ai-hub",
  "/inbox",
  "/calls",
  "/automations",
  "/ai-settings",
];

export const adminPrimaryNavItems: CrmNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/leads", label: "Enquiries", icon: "leads" },
  { href: "/jobs", label: "Jobs", icon: "jobs" },
  { href: "/calendar", label: "Scheduler", icon: "calendar" },
  { href: "/customers", label: "Customers", icon: "customers" },
  { href: "/quotes", label: "Quotes", icon: "quotes" },
  { href: "/invoices", label: "Invoices", icon: "invoices" },
  { href: "/ai-hub", label: "AI Receptionist", icon: "ai-hub" },
];

export const adminMoreNavItems: CrmNavItem[] = [
  { href: "/staff", label: "Team", icon: "staff" },
  { href: "/reports", label: "Reports", icon: "reports" },
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "/settings?section=advanced#suppliers", label: "Suppliers", icon: "suppliers" },
  { href: "/settings?section=advanced#products", label: "Products", icon: "products" },
  { href: "/settings/packages", label: "Packages", icon: "packages" },
  { href: "/settings/templates", label: "Templates", icon: "templates" },
  { href: "/settings?section=advanced#integrations", label: "Integrations", icon: "integrations" },
];

export const adminDemoNavItem: CrmNavItem = { href: "/demo", label: "Demo AI UI", icon: "demo" };

export const engineerClassicNavItems: CrmNavItem[] = [
  { href: "/dashboard", label: "Today", icon: "dashboard" },
  { href: "/diary", label: "Diary", icon: "calendar" },
  { href: "/jobs", label: "Jobs", icon: "jobs" },
  { href: "/preferences", label: "Profile", icon: "settings" },
];

export function getCrmNavGroups(canManageSettings: boolean, isEngineer: boolean, showDemoAiUi = false): CrmNavGroup[] {
  if (isEngineer) {
    return [{ label: "Field", items: engineerClassicNavItems }];
  }

  const visibleMoreItems = canManageSettings
    ? adminMoreNavItems
    : adminMoreNavItems.filter((item) => !["/reports", "/settings"].includes(item.href));
  const moreItems = showDemoAiUi && canManageSettings ? [...visibleMoreItems, adminDemoNavItem] : visibleMoreItems;

  return [
    {
      label: "Work",
      items: [
        ...adminPrimaryNavItems,
        {
          href: "/settings",
          label: "More",
          icon: "more",
          children: moreItems,
        },
      ],
    },
  ];
}

export function getEngineerRedirect(pathname: string): string | null {
  if (pathname === "/calendar" || pathname.startsWith("/calendar/availability") || pathname.startsWith("/calendar/schedule")) {
    return "/diary";
  }

  return engineerBlockedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ? "/dashboard"
    : null;
}

export function getAiReceptionistRedirect(pathname: string): string | null {
  for (const [prefix, target] of Object.entries(aiReceptionistRoutes)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return target;
    }
  }
  return null;
}
