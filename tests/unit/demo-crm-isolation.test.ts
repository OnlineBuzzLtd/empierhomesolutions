import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Isolation guard. The Try Empire CRM demo MUST stay self-contained: no real
 * CRM data layer, no Supabase, no platform-event posting, no Twilio. This is
 * the safety net against the May-incident class of bug (demo writes polluting
 * the shared CRM / firing real provider traffic). If this fails, a real
 * dependency has leaked into the demo — remove it.
 */

const ROOT = process.cwd();
const SCAN_DIRS = ["src/modules/demo-crm", "src/app/try", "src/app/api/try"];

// Forbidden module specifiers in import/from statements.
const FORBIDDEN = /from\s+["'][^"']*(supabase|twilio|modules\/crm|platform-api|platform\/events|post-platform-event)[^"']*["']/;
const FORBIDDEN_DYNAMIC = /import\(\s*["'][^"']*(supabase|twilio|modules\/crm|platform-api|platform\/events)[^"']*["']\s*\)/;

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("demo-crm isolation", () => {
  it("scans a non-empty set of demo files", () => {
    const files = SCAN_DIRS.flatMap((d) => collectFiles(join(ROOT, d)));
    expect(files.length).toBeGreaterThan(5);
  });

  it("does not import Supabase, the real CRM data layer, platform events, or Twilio", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of collectFiles(join(ROOT, dir))) {
        const contents = readFileSync(file, "utf8");
        if (FORBIDDEN.test(contents) || FORBIDDEN_DYNAMIC.test(contents)) {
          offenders.push(file.replace(ROOT + "/", ""));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
