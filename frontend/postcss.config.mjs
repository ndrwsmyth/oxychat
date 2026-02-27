import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const config = {
  plugins: {
    // Prevent workspace/root cwd drift from breaking Tailwind resolution in monorepo-like layouts.
    "@tailwindcss/postcss": { base: projectRoot },
  },
};

export default config;
