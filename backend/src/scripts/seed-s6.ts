import "dotenv/config";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getSupabase } from "../lib/supabase.js";
import { assertRequiredEnvVars } from "./lib/preflight.js";

interface DocumentFixture {
  id: string;
  project_id: string;
  title: string;
  content: string;
  visibility_scope: "project" | "client" | "global";
  size_bytes: number;
}

interface SeedFixture {
  documents: DocumentFixture[];
}

function runSeedS5(): void {
  const result = spawnSync("pnpm", ["run", "seed:s5"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("seed:s5 failed");
  }
}

async function loadFixture(): Promise<SeedFixture> {
  const fixturePath = path.resolve(process.cwd(), "seeds", "s6.fixture.json");
  const raw = await fs.readFile(fixturePath, "utf-8");
  return JSON.parse(raw) as SeedFixture;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function seedDocuments(fixture: SeedFixture, now: string): Promise<void> {
  const supabase = getSupabase();

  if (fixture.documents.length === 0) return;

  const rows = fixture.documents.map((doc) => ({
    id: doc.id,
    project_id: doc.project_id,
    title: doc.title,
    content: doc.content,
    content_hash: sha256(doc.content),
    visibility_scope: doc.visibility_scope,
    size_bytes: Buffer.byteLength(doc.content, "utf8"),
    updated_at: now,
  }));

  const { error } = await supabase
    .from("documents")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw new Error(`Failed to seed Sprint 6 documents: ${error.message}`);
  }
}

async function main() {
  assertRequiredEnvVars("seed:s6", ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]);
  runSeedS5();

  const fixture = await loadFixture();
  const now = new Date().toISOString();
  await seedDocuments(fixture, now);

  console.log(`[seed:s6] Seeded ${fixture.documents.length} documents successfully`);
}

main().catch((error) => {
  console.error("[seed:s6] Failed:", error);
  process.exit(1);
});
