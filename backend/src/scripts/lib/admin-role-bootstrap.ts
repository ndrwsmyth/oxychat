export interface AdminRoleBootstrapArgs {
  email?: string;
  clerkId?: string;
}

interface LookupTarget {
  column: "email" | "clerk_id";
  value: string;
}

function normalizeValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseAdminRoleBootstrapArgs(argv: string[]): AdminRoleBootstrapArgs {
  const parsed: AdminRoleBootstrapArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--email") {
      parsed.email = normalizeValue(argv[index + 1])?.toLowerCase();
      index += 1;
      continue;
    }

    if (token === "--clerk-id") {
      parsed.clerkId = normalizeValue(argv[index + 1]);
      index += 1;
      continue;
    }
  }

  if (!parsed.email && !parsed.clerkId) {
    throw new Error("Usage: --email <email> or --clerk-id <clerk_id>");
  }
  if (parsed.email && parsed.clerkId) {
    throw new Error("Provide only one lookup option: --email or --clerk-id");
  }

  return parsed;
}

export function toLookupTarget(args: AdminRoleBootstrapArgs): LookupTarget {
  if (args.email) {
    return {
      column: "email",
      value: args.email,
    };
  }

  if (args.clerkId) {
    return {
      column: "clerk_id",
      value: args.clerkId,
    };
  }

  throw new Error("Lookup target is required");
}
