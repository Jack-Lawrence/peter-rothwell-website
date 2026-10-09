// Invisible control characters in source (e.g. a real backspace where a regex
// meant "\b") break code silently, so none are allowed outside tabs and newlines.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const roots = ['src', 'scripts', 'tests', '.github'];
const skip = /[\\/]assets[\\/]|\.(jpe?g|png|webp|avif|woff2?|svg|ico)$/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (skip.test(path)) return [];
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

it('source files have no stray control characters', () => {
  const found: string[] = [];
  for (const file of roots.flatMap(files)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(line)) found.push(`${file}:${i + 1}`);
      });
  }
  expect(found).toEqual([]);
});
