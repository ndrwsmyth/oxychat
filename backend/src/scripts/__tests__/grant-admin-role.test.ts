import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAdminRoleBootstrapArgs, toLookupTarget } from "../lib/admin-role-bootstrap.js";

describe("grant-admin-role script contracts", () => {
  it("parses email lookup args", () => {
    const args = parseAdminRoleBootstrapArgs(["--email", "Admin@Oxy.so"]);
    expect(args).toEqual({ email: "admin@oxy.so" });
    expect(toLookupTarget(args)).toEqual({
      column: "email",
      value: "admin@oxy.so",
    });
  });

  it("parses clerk-id lookup args", () => {
    const args = parseAdminRoleBootstrapArgs(["--clerk-id", "user_abc123"]);
    expect(args).toEqual({ clerkId: "user_abc123" });
    expect(toLookupTarget(args)).toEqual({
      column: "clerk_id",
      value: "user_abc123",
    });
  });

  it("rejects missing and ambiguous args", () => {
    expect(() => parseAdminRoleBootstrapArgs([])).toThrow("Usage: --email <email> or --clerk-id <clerk_id>");
    expect(() => parseAdminRoleBootstrapArgs(["--email", "admin@oxy.so", "--clerk-id", "user_abc123"])).toThrow(
      "Provide only one lookup option: --email or --clerk-id"
    );
  });

  it("registers grant:admin package script", async () => {
    const packagePath = path.resolve(process.cwd(), "package.json");
    const rawPackage = await fs.readFile(packagePath, "utf-8");
    const packageJson = JSON.parse(rawPackage) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["grant:admin"]).toBe("tsx src/scripts/grant-admin-role.ts");
  });
});
