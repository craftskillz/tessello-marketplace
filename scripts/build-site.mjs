// The pinned generator owns catalogue logic; this repository owns presentation.
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { decoratePage } from '../web/presentation.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  repo: { type: 'string', default: process.env.CATALOGUE || project },
  out: { type: 'string', default: join(project, 'site') },
  host: { type: 'string', default: process.env.TESSELLO_HOST || 'https://tessello.pages.dev/' },
  packages: { type: 'string' },
} });
const output = resolve(values.out);
const tessello = resolve(project, process.env.TESSELLO || '.tessello');
const args = [join(tessello, 'packages/marketplace/scripts/build-site.ts'),
  '--repo', resolve(values.repo), '--out', output, '--host', values.host];
if (values.packages) args.push('--packages', resolve(values.packages));
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Rewrite only presentation. index.json, search.js, assets and _headers stay intact.
const index = JSON.parse(await readFile(join(output, 'index.json'), 'utf8'));
const pages = ['index.html', ...index.modules.map(module => `modules/${module.id.slice(1)}/index.html`)];
for (const page of pages) {
  const html = await readFile(join(output, page), 'utf8');
  await writeFile(join(output, page), decoratePage(html, page, index, values.host));
}
await copyFile(join(project, 'web/theme.css'), join(output, 'style.css'));
console.log(`Marketplace design applied to ${output}.`);
