import { NextResponse } from "next/server";
import { createCrmServiceRoleClient } from "@/modules/crm/lib/supabase-server";
import { rescheduleSelfServiceAppointment } from "@/modules/crm/lib/self-service-booking";

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => ({}))) as Record<string, unknown>;
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

function resolveTimes(body: Record<string, unknown>) {
  const startsAt = typeof body.starts_at === "string" ? body.starts_at : null;
  const endsAt = typeof body.ends_at === "string" ? body.ends_at : null;
  if (startsAt && endsAt) {
    return { startsAt, endsAt };
  }
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const durationMinutes = Number(body.duration_minutes ?? 60);
  const start = new Date(`${date}T${time}:00`);
  if (Number.isNaN(start.getTime())) {
    return { startsAt: "invalid", endsAt: "invalid" };
  }
  const end = new Date(start.getTime() + (Number.isFinite(durationMinutes) ? durationMinutes : 60) * 60_000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await readBody(request);
  const times = resolveTimes(body);
  const result = await rescheduleSelfServiceAppointment(createCrmServiceRoleClient(), {
    token,
    startsAt: times.startsAt,
    endsAt: times.endsAt,
  });
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  if (!result.ok) {
    const status = result.error === "slot_unavailable" || result.error === "invalid_time" ? 409 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }
  if (wantsJson) {
    return NextResponse.json(result);
  }
  return NextResponse.redirect(new URL(`/booking/${encodeURIComponent(token)}?status=rescheduled`, request.url), 303);
}
