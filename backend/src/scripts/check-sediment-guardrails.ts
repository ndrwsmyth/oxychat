import { promises as fs } from 'node:fs';
import path from 'node:path';

const EXPECTED_DEPENDENCY = 'git+https://github.com/ndrwsmyth/sediment.git#v0.1.1';

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function findBadImports(content: string): string[] {
  const bad: string[] = [];
  const patterns = [
    /from\s+['"]@oxy\/sediment(?:\/[^'"]*)?['"]/g,
    /from\s+['"]sediment(?:\/[^'"]*)?['"]/g,
    /import\s+['"]@oxy\/sediment(?:\/[^'"]*)?['"]/g,
    /import\s+['"]sediment(?:\/[^'"]*)?['"]/g,
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      bad.push(...matches);
    }
  }

  return bad;
}

async function main() {
  const backendRoot = process.cwd();
  const repoRoot = path.resolve(backendRoot, '..');

  const packageJsonPath = path.join(backendRoot, 'package.json');
  const packageJsonRaw = await fs.readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonRaw) as {
    dependencies?: Record<string, string>;
  };

  const sedimentDep = packageJson.dependencies?.['@ndrwsmyth/sediment'];
  if (sedimentDep !== EXPECTED_DEPENDENCY) {
    throw new Error(
      `Expected @ndrwsmyth/sediment dependency to be ${EXPECTED_DEPENDENCY}, found ${sedimentDep}`
    );
  }

  const sourceFiles = await collectTsFiles(path.join(backendRoot, 'src'));
  const violations: string[] = [];

  for (const file of sourceFiles) {
    const content = await fs.readFile(file, 'utf-8');
    const badImports = findBadImports(content);
    if (badImports.length > 0) {
      violations.push(`${path.relative(backendRoot, file)} => ${badImports.join(', ')}`);
    }
  }

  if (violations.length > 0) {
    throw new Error(`Sediment import guard violations:\n${violations.join('\n')}`);
  }

  const ciPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml');
  const dockerfilePath = path.join(backendRoot, 'Dockerfile');
  const ciContent = await fs.readFile(ciPath, 'utf-8');
  const dockerContent = await fs.readFile(dockerfilePath, 'utf-8');

  if (!ciContent.includes('SEDIMENT_GIT_TOKEN')) {
    throw new Error('CI workflow is missing SEDIMENT_GIT_TOKEN configuration');
  }
  if (!dockerContent.includes('SEDIMENT_GIT_TOKEN')) {
    throw new Error('Backend Dockerfile is missing SEDIMENT_GIT_TOKEN build arg usage');
  }

  console.log('[guard:sediment] All checks passed');
}

main().catch((error) => {
  console.error('[guard:sediment] Failed:', error);
  process.exitCode = 1;
});
