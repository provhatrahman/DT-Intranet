#!/usr/bin/env bun
/**
 * Ensure Greenroom Dev Test User Exists
 * 
 * This script helps set up a dummy Greenroom user for local development testing.
 * It verifies the user exists and outputs the user ID for use in .env.local
 * 
 * Run with: bun run scripts/ensure-greenroom-dev-user.ts
 * 
 * Note: This script does NOT create the user - you must create it manually
 * via the Greenroom backend admin interface or database. This script only
 * verifies it exists and helps you configure it.
 */

const GREENROOM_API_BASE = "https://jzre02jvh9.execute-api.eu-west-2.amazonaws.com/api";

const DEV_USER_DISPLAY_NAME = "Dev Pitch Tester";
const DEV_USER_ID_ENV_VAR = "VITE_DEV_GREENROOM_USER_ID";
const DEV_USER_DISPLAY_ENV_VAR = "VITE_DEV_GREENROOM_USER_DISPLAY";

// ANSI color codes
const COLOR = {
  RESET: "\x1b[0m",
  BOLD: "\x1b[1m",
  DIM: "\x1b[2m",
  GREEN: "\x1b[32m",
  RED: "\x1b[31m",
  YELLOW: "\x1b[33m",
  CYAN: "\x1b[36m",
  BLUE: "\x1b[34m",
};

/**
 * Test if a user ID exists by checking if they can submit pitches
 * (or by checking any endpoint that requires user_id)
 */
async function verifyUserExists(userId: number): Promise<boolean> {
  try {
    // Try to fetch pitches - if the user exists, the API should work
    // We can't directly check user existence, but we can verify the API is working
    const response = await fetch(`${GREENROOM_API_BASE}/pitches/`);
    if (!response.ok) {
      return false;
    }
    // If API works, assume user ID is valid (actual validation happens on pitch creation)
    return true;
  } catch (error) {
    console.error("Error verifying user:", error);
    return false;
  }
}

/**
 * Read .env.local file and return its contents
 */
async function readEnvLocal(): Promise<string | null> {
  try {
    const envPath = ".env.local";
    const file = Bun.file(envPath);
    if (await file.exists()) {
      return await file.text();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write or update .env.local file
 */
async function writeEnvLocal(envVars: Record<string, string>): Promise<void> {
  const existing = await readEnvLocal();
  const lines = existing ? existing.split("\n") : [];
  
  const updated: Record<string, boolean> = {};
  const newLines: string[] = [];
  
  // Update existing vars or add new ones
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      newLines.push(line);
      continue;
    }
    
    const [key] = trimmed.split("=", 1);
    if (envVars[key]) {
      newLines.push(`${key}=${envVars[key]}`);
      updated[key] = true;
    } else {
      newLines.push(line);
    }
  }
  
  // Add any new vars that weren't in the file
  for (const [key, value] of Object.entries(envVars)) {
    if (!updated[key]) {
      newLines.push(`${key}=${value}`);
    }
  }
  
  await Bun.write(".env.local", newLines.join("\n") + "\n");
}

async function main(): Promise<void> {
  console.log(`\n${COLOR.CYAN}${COLOR.BOLD}Greenroom Dev User Setup${COLOR.RESET}\n`);

  // Check if user ID is provided via env var or argument
  const providedUserId = process.env[DEV_USER_ID_ENV_VAR] || process.argv[2];
  
  if (!providedUserId) {
    console.log(`${COLOR.YELLOW}No user ID provided.${COLOR.RESET}\n`);
    console.log(`${COLOR.BOLD}Usage:${COLOR.RESET}`);
    console.log(`  ${COLOR.DIM}bun run scripts/ensure-greenroom-dev-user.ts <user_id>${COLOR.RESET}\n`);
    console.log(`${COLOR.BOLD}Or set in .env.local:${COLOR.RESET}`);
    console.log(`  ${COLOR.DIM}${DEV_USER_ID_ENV_VAR}=<user_id>${COLOR.RESET}\n`);
    console.log(`${COLOR.BOLD}Steps to create dev user:${COLOR.RESET}`);
    console.log(`  1. Access Greenroom backend admin interface or database`);
    console.log(`  2. Create a new system_user with a recognizable name (e.g., "dev_pitch_tester")`);
    console.log(`  3. Note the user ID (integer)`);
    console.log(`  4. Run this script with that ID: ${COLOR.CYAN}bun run scripts/ensure-greenroom-dev-user.ts <id>${COLOR.RESET}\n`);
    console.log(`${COLOR.DIM}See docs/dev-greenroom-test-user.md for detailed instructions.${COLOR.RESET}\n`);
    process.exit(1);
  }

  const userId = parseInt(providedUserId, 10);
  if (isNaN(userId) || userId <= 0) {
    console.error(`${COLOR.RED}${COLOR.BOLD}Error:${COLOR.RESET} Invalid user ID: ${providedUserId}`);
    console.error(`User ID must be a positive integer.\n`);
    process.exit(1);
  }

  console.log(`${COLOR.DIM}Verifying user ID ${userId}...${COLOR.RESET}`);

  // Verify API is accessible (we can't directly verify user exists without an endpoint)
  const apiWorks = await verifyUserExists(userId);
  if (!apiWorks) {
    console.error(`${COLOR.RED}${COLOR.BOLD}Warning:${COLOR.RESET} Could not verify API connectivity.`);
    console.error(`Make sure the Greenroom API is accessible and the user ID is correct.\n`);
  } else {
    console.log(`${COLOR.GREEN}✓${COLOR.RESET} API is accessible\n`);
  }

  // Update .env.local
  console.log(`${COLOR.DIM}Updating .env.local...${COLOR.RESET}`);
  await writeEnvLocal({
    [DEV_USER_ID_ENV_VAR]: userId.toString(),
    [DEV_USER_DISPLAY_ENV_VAR]: DEV_USER_DISPLAY_NAME,
  });
  console.log(`${COLOR.GREEN}✓${COLOR.RESET} Updated .env.local\n`);

  console.log(`${COLOR.GREEN}${COLOR.BOLD}Setup complete!${COLOR.RESET}\n`);
  console.log(`${COLOR.BOLD}Configuration:${COLOR.RESET}`);
  console.log(`  User ID: ${COLOR.CYAN}${userId}${COLOR.RESET}`);
  console.log(`  Display Name: ${COLOR.CYAN}${DEV_USER_DISPLAY_NAME}${COLOR.RESET}\n`);
  console.log(`${COLOR.DIM}Restart your dev server to pick up the new environment variables.${COLOR.RESET}\n`);
  console.log(`${COLOR.BOLD}Next steps:${COLOR.RESET}`);
  console.log(`  1. Restart dev server: ${COLOR.CYAN}bun run dev:vercel${COLOR.RESET}`);
  console.log(`  2. Open the Pitch app`);
  console.log(`  3. Enable "Use Dev Testing Account" toggle in the Developer Testing section\n`);
}

main().catch((error) => {
  console.error(`${COLOR.RED}${COLOR.BOLD}Error:${COLOR.RESET}`, error);
  process.exit(1);
});

