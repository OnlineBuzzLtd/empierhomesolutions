import type { UserProfile } from "@/modules/crm/types";

export function getAssignableEngineerNames(staff: Array<Pick<UserProfile, "full_name" | "role" | "active">>) {
  const seen = new Set<string>();

  return staff.flatMap((member) => {
    const fullName = member.full_name.trim();
    if (!member.active || member.role !== "engineer" || fullName.length === 0) {
      return [];
    }

    const normalizedName = fullName.toLowerCase();
    if (seen.has(normalizedName)) {
      return [];
    }

    seen.add(normalizedName);
    return [fullName];
  });
}
