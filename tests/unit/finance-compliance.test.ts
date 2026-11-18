import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phoenix Financial Consultants (EHS's finance broker) only permits the IAR
 * status disclosure, the finance banner linked to their calculator, and a
 * simple "finance available through Phoenix" phrase. Their compliance email
 * (15 Jun 2026) names wording that must never appear on the site, on pain of
 * the finance account being suspended. This guard fails if any of it ships.
 */
const PROHIBITED_FINANCE_PHRASES = [
  "spread the cost",
  "discuss your finance options",
  "flexible finance options",
  "free finance quote",
  "affordable monthly",
  "flexible monthly",
  "representative example",
];

const SOURCE_ROOT = path.resolve(__dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

describe("Phoenix finance marketing compliance", () => {
  it("never uses wording Phoenix has prohibited", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(SOURCE_ROOT)) {
      const text = readFileSync(file, "utf8").toLowerCase().replace(/\s+/g, " ");
      for (const phrase of PROHIBITED_FINANCE_PHRASES) {
        if (text.includes(phrase)) {
          violations.push(`${path.relative(SOURCE_ROOT, file)}: "${phrase}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
