import fs from 'node:fs';
import path from 'node:path';
import { transformWithOxc } from 'vite';

const root = process.cwd();
const sourceRoots = ['src', 'tests'];
const directFiles = ['vite.config.js'];
const supportedExtensions = ['', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.json', '.css', '.svg'];

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    return /\.(?:[cm]?js|jsx|tsx?)$/.test(entry.name) ? [fullPath] : [];
  });
}

function resolveLocalImport(fromFile, specifier) {
  const basePath = path.resolve(path.dirname(fromFile), specifier);
  return supportedExtensions.some((extension) => {
    const candidate = `${basePath}${extension}`;
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  }) || supportedExtensions.some((extension) => {
    const candidate = path.join(basePath, `index${extension}`);
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  });
}

const files = [...sourceRoots.flatMap(collectFiles), ...directFiles.filter((file) => fs.existsSync(file))];
const errors = [];
for (const file of files) {
  const absolutePath = path.resolve(file);
  const source = fs.readFileSync(absolutePath, 'utf8');
  try {
    await transformWithOxc(source, absolutePath, { loader: /\.tsx?$/.test(file) ? 'tsx' : file.endsWith('.jsx') ? 'jsx' : 'js', target: 'es2022' });
  } catch (error) {
    errors.push(`${file}: ${error.message || 'could not be parsed'}`);
  }

  const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    if (!resolveLocalImport(absolutePath, specifier)) {
      errors.push(`${file}: local import "${specifier}" does not resolve to a project file`);
    }
  }
}

if (errors.length) {
  console.error(`Source check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Source check passed: ${files.length} JS/JSX files parsed/transpiled; relative imports resolved.`);
  console.log('Note: this is a syntax/import check, not a type check, browser test, or production build.');
}
