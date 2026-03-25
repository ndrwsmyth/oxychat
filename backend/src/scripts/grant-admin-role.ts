import "dotenv/config";
import { assertRequiredEnvVars } from "./lib/preflight.js";
import { getSupabase } from "../lib/supabase.js";
import { parseAdminRoleBootstrapArgs, toLookupTarget } from "./lib/admin-role-bootstrap.js";

interface UserLookupRow {
  id: string;
  email: string;
  clerk_id: string | null;
}

async function main() {
  assertRequiredEnvVars("grant:admin", ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]);

  const args = parseAdminRoleBootstrapArgs(process.argv.slice(2));
  const target = toLookupTarget(args);
  const supabase = getSupabase();

  const { data: user, error: userError } = await supabase
    .from("user_profiles")
    .select("id, email, clerk_id")
    .eq(target.column, target.value)
    .maybeSingle();

  if (userError) {
    throw new Error(`Failed to lookup user: ${userError.message}`);
  }
  if (!user) {
    throw new Error(`No user profile found for ${target.column}=${target.value}`);
  }

  const now = new Date().toISOString();
  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert(
      {
        user_id: (user as UserLookupRow).id,
        role: "admin",
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

  if (roleError) {
    throw new Error(`Failed to grant admin role: ${roleError.message}`);
  }

  console.log(
    `[grant:admin] Granted admin role to ${(user as UserLookupRow).email} (${(user as UserLookupRow).id})`
  );
}

main().catch((error) => {
  console.error("[grant:admin] Failed:", error);
  process.exitCode = 1;
});
