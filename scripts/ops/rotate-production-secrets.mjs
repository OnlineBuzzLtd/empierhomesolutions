#!/usr/bin/env node
/**
 * Rotates high-risk Vercel production secrets to freshly-generated random
 * values.
 *
 * Usage:
 *   VERCEL_TOKEN=... VERCEL_PROJECT_ID=... node scripts/ops/rotate-production-secrets.mjs
 *
 * Flags:
 *   --dry        Print what would change without touching Vercel.
 *   --include    Comma-separated allowlist of secret names to rotate.
 *                Default: CONVERSION_API_SECRET, SIGNUP_INVITE_CODE, PLATFORM_WEBHOOK_SECRET
 *
 * Secrets that are NOT auto-rotated here (they need to be regenerated out-of-band
 * in the upstream service before being mirrored into Vercel):
 *   - SUPABASE_SERVICE_ROLE_KEY   (rotate in Supabase dashboard -> API settings)
 *   - TWILIO_AUTH_TOKEN           (rotate in Twilio console)
 *   - ELEVENLABS_API_KEY          (rotate in ElevenLabs settings)
 *   - CRONOFY_CLIENT_SECRET       (rotate in Cronofy oauth settings)
 *
 * After rotation this script prints the new values on stdout exactly once;
 * capture them and mirror into any downstream configuration (eg the
 * customerjourneys-platform-api .env).
 */

import { randomBytes } from "node:crypto";
import { argv, env, exit } from "node:process";

const ROTATABLE = {
  CONVERSION_API_SECRET: () => randomBytes(32).toString("hex"),
  SIGNUP_INVITE_CODE: () => randomBytes(8).toString("base64url"),
  PLATFORM_WEBHOOK_SECRET: () => randomBytes(48).toString("hex"),
};

function parseArgs() {
  const args = { dry: false, include: Object.keys(ROTATABLE) };
  for (const a of argv.slice(2)) {
    if (a === "--dry") args.dry = true;
    else if (a.startsWith("--include=")) {
      args.include = a.split("=", 2)[1].split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return args;
}

async function vercelFetch(path, init = {}) {
  const token = env.VERCEL_TOKEN;
  const project = env.VERCEL_PROJECT_ID;
  if (!token || !project) {
    throw new Error("VERCEL_TOKEN and VERCEL_PROJECT_ID must be set.");
  }
  const url = new URL(`https://api.vercel.com${path}`);
  if (env.VERCEL_TEAM_ID) url.searchParams.set("teamId", env.VERCEL_TEAM_ID);
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API ${init.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

async function listEnv() {
  const project = env.VERCEL_PROJECT_ID;
  return vercelFetch(`/v10/projects/${project}/env?decrypt=false`);
}

async function deleteEnv(id) {
  const project = env.VERCEL_PROJECT_ID;
  return vercelFetch(`/v10/projects/${project}/env/${id}`, { method: "DELETE" });
}

async function createEnv(key, value) {
  const project = env.VERCEL_PROJECT_ID;
  return vercelFetch(`/v10/projects/${project}/env`, {
    method: "POST",
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: ["production"],
    }),
  });
}

async function rotate({ dry, include }) {
  const existing = await listEnv();
  const envs = existing.envs ?? [];
  const results = [];

  for (const name of include) {
    const gen = ROTATABLE[name];
    if (!gen) {
      console.warn(`- ${name}: unknown secret (skipping)`);
      continue;
    }
    const newValue = gen();
    const matches = envs.filter((e) => e.key === name && e.target?.includes("production"));

    if (dry) {
      console.log(`[dry] would rotate ${name} (${matches.length} existing prod entries) to ${newValue}`);
      continue;
    }

    for (const m of matches) {
      await deleteEnv(m.id);
    }
    await createEnv(name, newValue);
    console.log(`- ${name} rotated OK`);
    results.push({ name, value: newValue });
  }

  if (!dry && results.length > 0) {
    console.log("\n=== New values (store in your secret manager now) ===");
    for (const { name, value } of results) {
      console.log(`${name}=${value}`);
    }
  }
}

rotate(parseArgs()).catch((err) => {
  console.error(err);
  exit(1);
});
