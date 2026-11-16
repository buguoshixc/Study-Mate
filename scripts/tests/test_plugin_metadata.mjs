/* ─────────────────────────────────────────────────────────────────────────
   StudyMate · 插件页元信息（图标 / locale 标题与简介）

   宿主在**不激活插件**时读这两处：`package.json.icon` 与 `locale/*.json` 的
   `meta.title`/`meta.description`。失败全都不出声——图标写错只记一条 meta.error、
   页面退回默认画布；只加 zh 不加 en，中文标题不生效。所以逐条钉成断言。

   判据照 host-plugin.md：icon 是相对 manifest 的包内路径，SVG/PNG/JPEG/WebP、
   ≤ 256 KiB；locale 字典从 en.json 起。tarball 是否真的带上这些文件不在这里重复
   测，交给 test_pack_json / test_bundle；文案内容也不在这里断言。
   ───────────────────────────────────────────────────────────────────────── */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MAX_ICON_BYTES = 256 * 1024;
const LOCALE_NAMES = ['en', 'zh'];

const readLocale = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'locale', `${name}.json`), 'utf8'));

test('图标：package.json.icon 是包内相对路径，且没跑出包根', () => {
  const icon = MANIFEST.icon;
  assert.equal(typeof icon, 'string');
  assert.ok(icon.trim() !== '', 'package.json.icon 是空串');
  assert.equal(path.isAbsolute(icon), false, `icon 必须是相对路径：${icon}`);
  assert.equal(icon.includes('\\'), false, `icon 不能用反斜杠：${icon}`);
  assert.equal(/^[A-Za-z][A-Za-z\d+.-]*:/u.test(icon), false, `icon 不能是 URL / file:：${icon}`);
  assert.equal(['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(icon).toLowerCase()), true,
    `icon 类型不在宿主白名单里：${icon}`);
  const resolved = path.resolve(ROOT, icon);
  assert.equal(fs.existsSync(resolved), true, `icon 不在盘上：${icon}`);
  const relative = path.relative(fs.realpathSync(ROOT), fs.realpathSync(resolved));
  assert.equal(relative.startsWith('..') || path.isAbsolute(relative), false, `icon 跑出了包根：${icon}`);
});

test('图标：可读、≤ 256 KiB、按扩展名验魔数', () => {
  const file = path.join(ROOT, MANIFEST.icon);
  assert.equal(fs.statSync(file).isFile(), true);
  const bytes = fs.statSync(file).size;
  assert.ok(bytes <= MAX_ICON_BYTES, `图标超过宿主 256 KiB 上限：${bytes} B`);
  const head = fs.readFileSync(file).subarray(0, 16);
  const extension = path.extname(file).toLowerCase();
  if (extension === '.png') {
    assert.deepEqual(head.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'PNG 魔数不对');
  } else if (extension === '.jpg' || extension === '.jpeg') {
    assert.deepEqual(head.subarray(0, 3), Buffer.from([0xff, 0xd8, 0xff]), 'JPEG 魔数不对');
  } else if (extension === '.webp') {
    assert.equal(head.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(head.subarray(8, 12).toString('ascii'), 'WEBP');
  } else {
    assert.match(head.toString('utf8'), /<svg/u, 'SVG 里没有 <svg');
  }
});

test('locale：en / zh 都能解析，meta.title / description 是非空字符串', () => {
  for (const name of LOCALE_NAMES) {
    const { meta } = readLocale(name);
    assert.equal(typeof meta?.title, 'string', `locale/${name}.json 缺 meta.title`);
    assert.ok(meta.title.trim() !== '', `locale/${name}.json 的 meta.title 是空串`);
    assert.equal(typeof meta?.description, 'string', `locale/${name}.json 缺 meta.description`);
    assert.ok(meta.description.trim() !== '', `locale/${name}.json 的 meta.description 是空串`);
  }
});

test('locale：两本字典的 meta 键集合一致，以 en 为基线', () => {
  const keys = name => Object.keys(readLocale(name).meta ?? {}).sort();
  assert.deepEqual(keys('zh'), keys('en'), 'zh 与 en 的 meta 键集合不一致：宿主只从 en.json 起字典');
});
