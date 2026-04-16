/**
 * Loads .env.local before integration tests run so Supabase credentials
 * are available in process.env without having to manually export them.
 */
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") }); // fallback
