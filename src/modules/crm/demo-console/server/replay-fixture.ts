import { promises as fs } from "node:fs";
import path from "node:path";
import {
  postPlatformEventFromDemo,
  type PostPlatformEventResult,
} from "@/modules/crm/demo-console/server/post-platform-event";
import type { DemoSessionRow } from "@/modules/crm/demo-console/server/session-guard";
import { substitutePlaceholders } from "@/modules/crm/demo-console/server/substitute-placeholders";

// Load + substitute + fire a captured-payload fixture (ticket E-3).
//
// Fixtures live at src/modules/crm/demo-console/fixtures/<channel>-lead.json
// and contain placeholder values that get substituted with the
// consented prospect's name + phone before the payload is posted to
// /api/platform/events. The synthetic-number guard (A-1) on that
// endpoint enforces the phone is real-and-consented (not a synthetic
// pattern) — the consent step is the legal anchor, the guard is the
// technical anchor.

type FixtureFile = {
  payload: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

// Read fixtures from disk at runtime rather than import-time so a
// fixture swap (capturing a real webhook) doesn't require a redeploy.
async function loadFixture(channel: "google" | "meta"): Promise<FixtureFile> {
  const fixturePath = path.join(
    process.cwd(),
    "src",
    "modules",
    "crm",
    "demo-console",
    "fixtures",
    `${channel}-lead.json`,
  );
  const raw = await fs.readFile(fixturePath, "utf8");
  const parsed = JSON.parse(raw) as FixtureFile;
  if (!parsed || typeof parsed !== "object" || !parsed.payload) {
    throw new Error(`Fixture ${channel}-lead.json is malformed: missing 'payload'.`);
  }
  return parsed;
}

export type ReplayResult = {
  result: PostPlatformEventResult;
  channel: "google" | "meta";
};

export async function replayCapturedLeadFixture(args: {
  channel: "google" | "meta";
  workspaceId: string;
  session: DemoSessionRow;
}): Promise<ReplayResult> {
  const fixture = await loadFixture(args.channel);
  const payload = substitutePlaceholders(fixture.payload, {
    prospect_name: args.session.prospect_name,
    prospect_phone: args.session.prospect_phone,
  }) as Record<string, unknown>;

  const result = await postPlatformEventFromDemo({
    channel: args.channel,
    workspaceId: args.workspaceId,
    payload,
  });

  return { result, channel: args.channel };
}
