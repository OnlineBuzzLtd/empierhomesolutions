import fs from "node:fs";
import path from "node:path";

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const file = fs.readFileSync(filePath, "utf8");
  const entries = {};

  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    entries[key] = stripQuotes(value.trim());
  }

  return entries;
}

const rootDir = process.cwd();
const localEnv = parseEnvFile(path.join(rootDir, ".env.local"));
const exampleEnv = parseEnvFile(path.join(rootDir, ".env.example"));

export function getEnv(name) {
  return process.env[name] ?? localEnv[name] ?? exampleEnv[name] ?? null;
}

export function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getCrmScriptConfig() {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const baseUrl = (process.env.CRM_BASE_URL ?? getEnv("NEXT_PUBLIC_SITE_URL") ?? "http://127.0.0.1:3000").replace(/\/$/, "");

  return {
    baseUrl,
    supabaseUrl,
    publishableKey,
    serviceRoleKey,
  };
}

export function requireCrmScriptConfig(requireAdmin = false) {
  const config = getCrmScriptConfig();

  if (!config.supabaseUrl || !config.publishableKey) {
    throw new Error("Missing CRM Supabase browser credentials. Expected NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  if (requireAdmin && !config.serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for CRM admin smoke checks.");
  }

  return config;
}
