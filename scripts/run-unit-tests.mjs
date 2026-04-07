import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const unitRoot = join(workspaceRoot, 'test', 'unit');

function collectTestFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectTestFiles(fullPath);
    }
    if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
      return [relative(workspaceRoot, fullPath)];
    }
    return [];
  });
}

if (!statSync(unitRoot).isDirectory()) {
  throw new Error(`Unit test directory not found: ${unitRoot}`);
}

const files = collectTestFiles(unitRoot).sort();

for (const file of files) {
  const result = spawnSync(
    process.execPath,
    ['--max-old-space-size=8192', './node_modules/vitest/vitest.mjs', 'run', file],
    {
      cwd: workspaceRoot,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
