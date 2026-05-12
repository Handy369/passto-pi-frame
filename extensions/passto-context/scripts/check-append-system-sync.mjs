import fs from 'node:fs/promises';
import process from 'node:process';

import {
  DEFAULT_APPEND_SYSTEM_PATH,
  readGeneratorContract,
  validateAppendSystemSync,
} from '../grc-generator-contract.ts';

const targetPath = process.argv[2] ?? DEFAULT_APPEND_SYSTEM_PATH;

try {
  const actual = await fs.readFile(targetPath, 'utf-8');
  const contract = readGeneratorContract();
  const result = validateAppendSystemSync(actual, contract);

  if (result.matches) {
    console.log(`[ok] APPEND_SYSTEM is in sync: ${targetPath}`);
    process.exit(0);
  }

  console.error(`[drift] APPEND_SYSTEM differs from projected Constitution: ${targetPath}`);
  console.error('--- expected ---');
  console.error(result.expected);
  console.error('--- actual ---');
  console.error(result.actual);
  process.exit(1);
} catch (error) {
  console.error(`[error] failed to validate APPEND_SYSTEM: ${targetPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
