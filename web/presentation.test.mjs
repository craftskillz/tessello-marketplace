import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { decoratePage } from './presentation.mjs';

const tessello = resolve(process.env.TESSELLO || '.tessello');
const { renderSite } = await import(pathToFileURL(join(tessello, 'packages/marketplace/src/site.ts')));
const host = 'http://127.0.0.1:8080/';
const module = (overrides = {}) => ({
  id: '@creator/tool', creator: '@creator', source: 'https://github.com/creator/tool', license: 'MIT',
  tags: ['productivity', 'notes'], screenshots: [], versions: [], state: 'listed',
  latest: {
    name: 'Tool', version: '1.0.0', url: 'https://example.com/tool.zip', sha256: 'a'.repeat(64),
    icon: 'modules/creator/tool/1.0.0/icon.svg', convention: 1, description: 'A useful tool.',
    permissions: { network: ['https://example.com'] }, widget: { size: 'M' },
    guide: { path: 'guide.md', markdown: '# Guide\n\nUse the tool.\n\n![View](view.png)', images: { 'view.png': 'modules/creator/tool/1.0.0/view.png' } },
  }, ...overrides,
});
const catalogue = modules => ({ format: 1, generatedAt: '2026-10-25T12:00:00Z', modules });
function render(index) {
  const original = renderSite(index, { hostUrl: host });
  const pages = new Map([...original].filter(([path]) => path.endsWith('.html')).map(([path, html]) => [path, decoratePage(html, path, index, host)]));
  return { original, pages };
}
const cardIds = html => [...html.matchAll(/data-id="([^"]+)"/g)].map(match => match[1]);

test('keeps catalogue visibility, search hooks, filters, and module links from the generator', () => {
  const index = catalogue([module(), module({ id: '@creator/banned', state: 'banned', reason: 'Removed' }),
    module({ id: '@creator/withdrawn', state: 'withdrawn' }), module({ id: '@creator/missing', latest: null })]);
  const { original, pages } = render(index);
  const home = pages.get('index.html');
  assert.deepEqual(cardIds(home), cardIds(original.get('index.html')));
  assert.deepEqual(cardIds(home), ['@creator/tool']);
  for (const fragment of ['id="query"', 'id="permissions"', 'id="cards"', 'id="empty"', 'src="search.js"', 'href="modules/creator/tool/index.html"']) assert.ok(home.includes(fragment));
  assert.equal(home.match(/<select[\s\S]*?<\/select>/)[0], original.get('index.html').match(/<select[\s\S]*?<\/select>/)[0]);
});

test('preserves the complete detail body, including install URL, warning, permissions and rendered guide', () => {
  const { original, pages } = render(catalogue([module()]));
  const path = 'modules/creator/tool/index.html';
  const body = original.get(path).match(/<main>\n([\s\S]*?)\n<\/main>/)[1];
  assert.ok(pages.get(path).includes(body));
  assert.ok(pages.get(path).includes(`${host}#install=${encodeURIComponent(module().latest.url)}`));
});

test('banned, withdrawn and version-less modules retain unavailable pages without install links', () => {
  for (const overrides of [{ state: 'banned', reason: '<script>unsafe</script>' }, { state: 'withdrawn' }, { latest: null }]) {
    const { pages } = render(catalogue([module(overrides)]));
    assert.deepEqual(cardIds(pages.get('index.html')), []);
    const detail = pages.get('modules/creator/tool/index.html');
    assert.match(detail, /no longer available/);
    assert.doesNotMatch(detail, /#install=|class="guide"|<script>unsafe/);
  }
});

test('new card fields and image attributes are escaped, including replacement-string characters', () => {
  const special = module({ license: '<b>MIT</b> $&', screenshots: ['images/$&-" onerror="alert(1).png'] });
  const home = render(catalogue([special])).pages.get('index.html');
  assert.match(home, /&lt;b&gt;MIT&lt;\/b&gt; \$&amp;/);
  assert.match(home, /images\/\$&amp;-&quot; onerror=&quot;alert\(1\)\.png/);
  assert.doesNotMatch(home, /<b>|" onerror="/);
});

test('supports empty catalogues and cards without screenshots', () => {
  assert.match(render(catalogue([])).pages.get('index.html'), /0 modules in the catalogue/);
  const plain = module();
  plain.latest.guide.images = {};
  assert.match(render(catalogue([plain])).pages.get('index.html'), /class="cover-icon"/);
});

test('retains the CSP, uses a single stylesheet, and removes all preview UI', () => {
  for (const [path, html] of render(catalogue([module()])).pages) {
    assert.match(html, /default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'/);
    assert.equal([...html.matchAll(/rel="stylesheet"/g)].length, 1, path);
    assert.doesNotMatch(html, /preview-bar|Local design preview|Compare with current design|original\/|theme\.css|<style|\sstyle=|<script(?![^>]*\ssrc=)/);
  }
});

test('fails explicitly when the pinned generator changes its card markup', () => {
  const index = catalogue([module()]);
  const html = renderSite(index, { hostUrl: host }).get('index.html').replace('\n</div>\n</li>', '</div></li>');
  assert.throws(() => decoratePage(html, 'index.html', index, host), /card layout has changed/);
});

test('production build keeps index, search, assets and CORS headers intact and emits only the final design', async () => {
  const { zipSync, strToU8 } = await import(pathToFileURL(join(tessello, 'node_modules/fflate/esm/index.mjs')));
  const { buildSite } = await import(pathToFileURL(join(tessello, 'packages/marketplace/scripts/build-site.ts')));
  const work = await mkdtemp(join(tmpdir(), 'marketplace design '));
  try {
    const repo = join(work, 'repo');
    const packages = join(work, 'packages');
    const output = join(work, 'output');
    const baseline = join(work, 'baseline');
    await mkdir(join(repo, 'modules/creator/tool'), { recursive: true });
    await mkdir(join(packages, 'creator/tool'), { recursive: true });
    await mkdir(join(output, 'original'), { recursive: true });
    await writeFile(join(output, 'original/index.html'), 'Stale original design');
    const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ convention: 1, id: '@creator/tool', name: 'Tool', version: '1.0.0', icon: 'icon.svg', view: { entry: 'view/index.html' }, guide: 'guide.md' })),
      'icon.svg': strToU8(icon), 'guide.md': strToU8('# Tool\n\nA useful tool.'),
      'view/index.html': strToU8('<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>'),
    });
    await writeFile(join(packages, 'creator/tool/1.0.0.zip'), zip);
    await writeFile(join(repo, 'modules/creator/tool/entry.json'), JSON.stringify({ id: '@creator/tool', source: 'https://github.com/creator/tool', license: 'MIT', versions: [{ version: '1.0.0', url: 'https://example.com/tool.zip', sha256: createHash('sha256').update(zip).digest('hex') }] }));
    const issues = await buildSite({ repo, out: baseline, hostUrl: host, packages });
    assert.deepEqual(issues, []);
    const result = spawnSync(process.execPath, ['scripts/build-site.mjs', '--repo', repo, '--out', output, '--host', host, '--packages', packages], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const actual = JSON.parse(await readFile(join(output, 'index.json'), 'utf8'));
    const expected = JSON.parse(await readFile(join(baseline, 'index.json'), 'utf8'));
    actual.generatedAt = expected.generatedAt;
    assert.deepEqual(actual, expected);
    for (const file of ['search.js', '_headers', 'modules/creator/tool/1.0.0/icon.svg']) {
      assert.deepEqual(await readFile(join(output, file)), await readFile(join(baseline, file)), file);
    }
    assert.deepEqual(await readFile(join(output, 'style.css')), await readFile('web/theme.css'));
    assert.deepEqual((await readdir(output)).sort(), ['_headers', 'index.html', 'index.json', 'modules', 'search.js', 'style.css']);
    assert.match(await readFile(join(output, 'index.html'), 'utf8'), /Small modules\./);
    assert.match(await readFile(join(output, 'modules/creator/tool/index.html'), 'utf8'), /http:\/\/127\.0\.0\.1:8080\/#install=/);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
