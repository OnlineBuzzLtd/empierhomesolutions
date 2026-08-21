import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as validation from "@/modules/crm/lib/validation";

// Guard against the "Unexpected response." class of bug (2026-08-19).
//
// zod 4 throws at runtime — not at compile time — when `.partial()` is called on
// an object schema carrying a refinement:
//
//   Error: .partial() cannot be used on object schemas containing refinements
//
// `src/app/api/crm/customers/[id]/route.ts` did exactly that, so every customer
// edit was an unhandled 500 that the UI rendered as "Unexpected response."
// TypeScript cannot catch it: `.partial()` still type-checks on the ZodObject.
//
// This test walks every `<schema>.partial()` call site under src/ and proves the
// call actually succeeds, so adding a refinement to a schema that some route
// partials will fail here rather than in production.

const SRC = path.join(process.cwd(), "src");
const PARTIAL_CALL = /\b([A-Za-z_$][\w$]*)\s*\.partial\(\)/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

// Comments routinely mention `foo.partial()` when documenting this very bug, so
// strip them before scanning or the test flags its own prose.
function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function findPartialCallSites() {
  const sites = new Map<string, string[]>();
  for (const file of walk(SRC)) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const match of source.matchAll(PARTIAL_CALL)) {
      const identifier = match[1];
      const existing = sites.get(identifier) ?? [];
      existing.push(path.relative(process.cwd(), file));
      sites.set(identifier, existing);
    }
  }
  return sites;
}

describe("zod .partial() call sites", () => {
  const sites = findPartialCallSites();

  it("finds the call sites it is meant to protect", () => {
    // Sanity check on the scanner itself — if this drops to zero the test below
    // would pass vacuously.
    expect(sites.size).toBeGreaterThan(0);
  });

  it("never partials a schema exported from validation.ts that carries a refinement", () => {
    const exported = validation as Record<string, unknown>;
    const failures: string[] = [];

    for (const [identifier, files] of sites) {
      const schema = exported[identifier];
      if (!schema || typeof (schema as { partial?: unknown }).partial !== "function") {
        // Not a validation.ts schema (locally-declared inline schemas are
        // checked by their own route tests).
        continue;
      }
      try {
        (schema as { partial: () => unknown }).partial();
      } catch (error) {
        failures.push(
          `${identifier} (used in ${files.join(", ")}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    expect(failures).toEqual([]);
  });
});
