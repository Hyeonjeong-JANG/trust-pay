import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const sourceRoot = join(__dirname);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return sourceFiles(path);
    if (!/\.(ts|tsx)$/.test(path) || /\.spec\.tsx?$/.test(path)) return [];
    return [path];
  });
}

describe('native dialog policy', () => {
  it('uses app-rendered modals instead of Alert.alert or browser dialogs', () => {
    const offenders = sourceFiles(sourceRoot).flatMap((path) => {
      const contents = readFileSync(path, 'utf8');
      const hasNativeDialog = /import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*['"]react-native['"]|\bAlert\.alert\s*\(|\bwindow\.(alert|prompt|confirm)\s*\(|\b(prompt|alert|confirm)\s*\(/.test(contents);
      return hasNativeDialog ? [relative(sourceRoot, path)] : [];
    });

    expect(offenders).toEqual([]);
  });
});
