import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize barrel imports for better tree-shaking
  // lucide-react has 1500+ icons, this ensures only used icons are bundled
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
