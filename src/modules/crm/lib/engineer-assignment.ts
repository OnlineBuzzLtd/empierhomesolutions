import type { SupabaseClient } from "@supabase/supabase-js";

type EngineerCandidate = {
  id: string;
  full_name: string | null;
  service_skill_tags?: string[] | null;
  postcode_areas?: string[] | null;
  daily_job_capacity?: number | null;
};

type JobAssigneeLoadRow = {
  user_profile_id: string;
};

function normalizeTag(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || null;
}

function postcodeTokens(postcode: string | null | undefined) {
  const compact = postcode?.replace(/\s+/g, "").toUpperCase();
  if (!compact) {
    return [];
  }
  const outward = compact.match(/^[A-Z]{1,2}\d[A-Z\d]?/)?.[0] ?? compact;
  const area = outward.match(/^[A-Z]{1,2}/)?.[0] ?? outward;
  return [outward, area];
}

function candidateMatches(candidateValues: string[] | null | undefined, requiredValues: string[]) {
  const configured = (candidateValues ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (configured.length === 0 || requiredValues.length === 0) {
    return true;
  }
  return requiredValues.some((value) => configured.includes(value.toLowerCase()));
}

async function getServiceSkillTags(
  supabase: SupabaseClient,
  input: { serviceId?: string | null; jobTypeId?: string | null },
) {
  const tags: string[] = [];
  if (input.serviceId) {
    const { data, error } = await supabase
      .schema("crm")
      .from("services")
      .select("name, slug")
      .eq("id", input.serviceId)
      .maybeSingle<{ name: string | null; slug: string | null }>();
    if (error) throw error;
    for (const tag of [normalizeTag(data?.name), normalizeTag(data?.slug)]) {
      if (tag) tags.push(tag);
    }
  }
  if (input.jobTypeId) {
    const { data, error } = await supabase
      .schema("crm")
      .from("job_types")
      .select("name, slug")
      .eq("id", input.jobTypeId)
      .maybeSingle<{ name: string | null; slug: string | null }>();
    if (error) throw error;
    for (const tag of [normalizeTag(data?.name), normalizeTag(data?.slug)]) {
      if (tag) tags.push(tag);
    }
  }
  return [...new Set(tags)];
}

async function getCustomerPostcode(supabase: SupabaseClient, customerId: string | null | undefined) {
  if (!customerId) {
    return null;
  }
  const { data, error } = await supabase
    .schema("crm")
    .from("customers")
    .select("postcode")
    .eq("id", customerId)
    .maybeSingle<{ postcode: string | null }>();
  if (error) throw error;
  return data?.postcode ?? null;
}

async function getDailyLoads(
  supabase: SupabaseClient,
  input: { tenantId: string; scheduledDate: string; userProfileIds: string[] },
) {
  if (input.userProfileIds.length === 0) {
    return new Map<string, number>();
  }
  const { data, error } = await supabase
    .schema("crm")
    .from("job_assignees")
    .select("user_profile_id, jobs!inner(scheduled_date,status)")
    .eq("tenant_id", input.tenantId)
    .in("user_profile_id", input.userProfileIds)
    .eq("jobs.scheduled_date", input.scheduledDate)
    .not("jobs.status", "in", "(cancelled,no_access,aborted)");
  if (error) throw error;
  const loads = new Map<string, number>();
  for (const row of (data ?? []) as JobAssigneeLoadRow[]) {
    loads.set(row.user_profile_id, (loads.get(row.user_profile_id) ?? 0) + 1);
  }
  return loads;
}

export async function findBestEngineerAssignment(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    scheduledDate?: string | null;
    customerId?: string | null;
    serviceId?: string | null;
    jobTypeId?: string | null;
  },
) {
  if (!input.scheduledDate) {
    return null;
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("user_profiles")
    .select("id, full_name, service_skill_tags, postcode_areas, daily_job_capacity")
    .eq("tenant_id", input.tenantId)
    .eq("role", "engineer")
    .eq("active", true)
    .returns<EngineerCandidate[]>();
  if (error) throw error;

  const candidates = (data ?? []).filter((candidate) => candidate.full_name?.trim());
  if (candidates.length === 0) {
    return null;
  }

  const [skillTags, postcode] = await Promise.all([
    getServiceSkillTags(supabase, input),
    getCustomerPostcode(supabase, input.customerId),
  ]);
  const postcodes = postcodeTokens(postcode);
  const loads = await getDailyLoads(supabase, {
    tenantId: input.tenantId,
    scheduledDate: input.scheduledDate,
    userProfileIds: candidates.map((candidate) => candidate.id),
  });

  const ranked = candidates
    .filter((candidate) => candidateMatches(candidate.service_skill_tags, skillTags))
    .filter((candidate) => candidateMatches(candidate.postcode_areas, postcodes))
    .map((candidate) => ({
      candidate,
      load: loads.get(candidate.id) ?? 0,
      capacity: candidate.daily_job_capacity ?? 8,
    }))
    .filter((entry) => entry.load < entry.capacity)
    .sort((left, right) => {
      if (left.load !== right.load) return left.load - right.load;
      return String(left.candidate.full_name).localeCompare(String(right.candidate.full_name));
    });

  const winner = ranked[0]?.candidate;
  return winner ? { id: winner.id, full_name: winner.full_name?.trim() ?? "" } : null;
}
