/**
 * One-shot bootstrap script for the GCIO Cal.com instance.
 *
 * Creates (idempotently):
 *   1. A first admin user with completedOnboarding=true so the setup
 *      wizard never runs.
 *   2. A long-lived API key for the GCIO backend to use when calling
 *      Cal.com's REST API for user provisioning.
 *
 * Run from the gcio-calcom repo root with the production DATABASE_URL
 * pointed at the Neon Postgres backing the deployed Railway instance:
 *
 *     DATABASE_URL='postgresql://...neon...' \
 *     DATABASE_DIRECT_URL='postgresql://...neon...' \
 *     yarn tsx scripts/seed-gcio-admin.ts
 *
 * The script prints the generated API key value ONCE on success — copy
 * it immediately into Railway as GCIO_CALCOM_API_KEY for the backend
 * service. The hashed form is what's stored in the database; the raw
 * value cannot be retrieved later, only regenerated.
 *
 * This script is intentionally idempotent: re-running it will upsert
 * the admin user (no-op if already present) and refuse to create a
 * duplicate API key with the same note.
 */

import prisma from "@calcom/prisma";
import { UserPermissionRole } from "@calcom/prisma/enums";

import { createUserAndEventType } from "./seed-utils";
import { generateUniqueAPIKey } from "../packages/features/ee/api-keys/lib/apiKeys";

const ADMIN_EMAIL = "info@globalciocircle.com";
const ADMIN_USERNAME = "gcio-admin";
const ADMIN_PASSWORD = process.env.GCIO_ADMIN_BOOTSTRAP_PASSWORD || "ChangeThisAfterFirstLogin!";
const API_KEY_NOTE = "GCIO Backend Provisioning";

async function main() {
  console.log("");
  console.log("=== GCIO Cal.com bootstrap ===");
  console.log("");

  // ---------- Step 1: admin user (idempotent upsert) ----------
  await createUserAndEventType({
    user: {
      email: ADMIN_EMAIL,
      username: ADMIN_USERNAME,
      name: "GCIO Admin",
      password: ADMIN_PASSWORD,
      role: UserPermissionRole.ADMIN,
      completedOnboarding: true,
      timeZone: "America/Los_Angeles",
    },
    eventTypes: [],
  });

  // Resolve the user we just created so we can attach the API key
  const adminUser = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL, username: ADMIN_USERNAME },
    select: { id: true, email: true, username: true, role: true },
  });
  if (!adminUser) {
    throw new Error(`Failed to resolve admin user after upsert (email=${ADMIN_EMAIL})`);
  }
  console.log(`✓ admin user id=${adminUser.id} role=${adminUser.role}`);

  // ---------- Step 2: API key (refuse duplicates) ----------
  const existing = await prisma.apiKey.findFirst({
    where: { userId: adminUser.id, note: API_KEY_NOTE },
    select: { id: true, createdAt: true },
  });

  if (existing) {
    console.log("");
    console.log(`✓ api key already exists (id=${existing.id} created=${existing.createdAt.toISOString()})`);
    console.log("  Skipping creation. To rotate, delete the existing key in the Cal.com");
    console.log("  admin UI (Settings → Developer → API keys) and re-run this script.");
    return;
  }

  const [hashedKey, apiKey] = generateUniqueAPIKey();
  await prisma.apiKey.create({
    data: {
      userId: adminUser.id,
      note: API_KEY_NOTE,
      hashedKey,
      // No expiry — this key is for backend M2M and rotates manually
      expiresAt: null,
    },
  });

  // The full API key Cal.com expects on incoming requests is:
  //     ${API_KEY_PREFIX}${apiKey}
  // where API_KEY_PREFIX is read from the env var of the same name on
  // the Cal.com server. If unset (the current state on Railway), the
  // prefix is empty and the bare apiKey value is what to send.
  const prefix = process.env.API_KEY_PREFIX || "";
  const fullKey = `${prefix}${apiKey}`;

  console.log("");
  console.log("=== API KEY CREATED — COPY IMMEDIATELY ===");
  console.log("");
  console.log(`  ${fullKey}`);
  console.log("");
  console.log("Set this on the gcio-backend Railway service as:");
  console.log("  GCIO_CALCOM_API_KEY=<the-value-above>");
  console.log("");
  console.log("Then redeploy the backend so the new env var is picked up.");
  console.log("This value is NOT recoverable from the database — only the SHA-256");
  console.log("hash is stored. If you lose it, delete this row in the Cal.com");
  console.log("admin UI and re-run this script to mint a new one.");
  console.log("");
}

main()
  .catch((err) => {
    console.error("");
    console.error("FATAL: bootstrap failed");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
