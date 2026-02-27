import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Optimize barrel imports for better tree-shaking
  // lucide-react has 1500+ icons, this ensures only used icons are bundled
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Keep Turbopack's workspace root scoped to this app to avoid cross-workspace resolution issues.
  turbopack: {
    root: projectRoot,
  },
  // Ensure CSS/PostCSS module resolution always checks this app's node_modules first.
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.modules = [
      path.join(projectRoot, "node_modules"),
      ...(config.resolve.modules ?? []),
    ];
    return config;
  },
};

export default nextConfig;
