#!/usr/bin/env node
/**
 * publish.js — 技能打包与发布准备（一条命令）
 *
 * 做四件事：
 *   1. 校验技能（SKILL.md、必填元数据）
 *   2. 生成标准包（dist/<slug>-<version>.zip，含 SKILL.md、references、scripts）
 *   3. 生成平台元数据清单（dist/manifest.json）
 *   4. 打印两个平台的确切导入路径
 *
 * 用法：
 *   node publish.js                          # 打包当前技能
 *   node publish.js --slug ste-five-rules    # 指定 ASCII slug（中文名必需）
 *   node publish.js --version 1.1.0          # 覆盖版本号
 *   node publish.js --dry-run                # 只校验，不打包
 *
 * 退出码：0 成功 / 1 校验失败 / 2 打包失败
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const DIST = path.join(SKILL_DIR, 'dist');

// Windows 上必须用系统自带 bsdtar：Git Bash 的 GNU tar 会把 "C:\..." 当成远程主机
const WIN_TAR = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const TAR = process.platform === 'win32' && fs.existsSync(WIN_TAR) ? WIN_TAR : 'tar';

const EXCLUDE = new Set(['node_modules', '.git', 'dist', '__pycache__', '.DS_Store', 'Thumbs.db']);

function parseArgs(argv) {
  const out = { slug: '', version: '', dryRun: false, outDir: DIST };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--slug') out.slug = argv[++i] || '';
    else if (a === '--version') out.version = argv[++i] || '';
    else if (a === '--out') out.outDir = path.resolve(argv[++i] || DIST);
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
      process.exit(0);
    }
  }
  return out;
}

function fail(msg, code) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(code || 1);
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    meta[kv[1]] = v;
  }
  return meta;
}

function asciiSlug(name) {
  const s = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else n += 1;
  }
  return n;
}

function main() {
  const args = parseArgs(process.argv);
  console.log('\n=== 技能发布打包 ===\n');

  // 1. 校验
  const skillMd = path.join(SKILL_DIR, 'SKILL.md');
  if (!fs.existsSync(skillMd)) fail(`没有找到 SKILL.md：${skillMd}`);

  const meta = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
  if (!meta) fail('SKILL.md 缺少 frontmatter（需以 --- 包裹的元数据块）');

  const name = (meta.name || '').trim();
  const description = (meta.description || '').trim();
  if (!name) fail('frontmatter 缺少 name');
  if (!description) fail('frontmatter 缺少 description');
  if (description.length < 20) fail(`description 太短（${description.length} 字），市场要求能说清用途`);

  const slug = args.slug || meta.slug || asciiSlug(name);
  if (!slug) fail('中文技能名无法自动生成 slug，请用 --slug 指定英文标识（小写字母、数字、连字符）');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail(`slug 不合规：${slug}（只允许小写字母、数字、连字符）`);

  const version = args.version || meta.version || '1.0.0';
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`版本号不合规：${version}（需 x.y.z）`);

  const pkgDir = path.join(args.outDir, slug);
  const zipPath = path.join(args.outDir, `${slug}-${version}.zip`);

  console.log(`  技能目录   ${SKILL_DIR}`);
  console.log(`  名称       ${name}`);
  console.log(`  slug       ${slug}`);
  console.log(`  版本       ${version}`);
  console.log(`  简介       ${description.slice(0, 60)}${description.length > 60 ? '…' : ''}`);

  if (args.dryRun) {
    console.log('\n  校验通过（--dry-run，不生成文件）\n');
    return;
  }

  // 2. 打包
  try {
    fs.rmSync(pkgDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    copyDir(SKILL_DIR, pkgDir);
    if (fs.existsSync(path.join(pkgDir, 'dist'))) {
      fs.rmSync(path.join(pkgDir, 'dist'), { recursive: true, force: true });
    }

    const fileCount = countFiles(pkgDir);
    if (fileCount < 1) fail('打包目录为空', 2);

    // Windows 自带 bsdtar 支持 -a 按扩展名生成 zip
    execFileSync(TAR, ['-a', '-c', '-f', zipPath, '-C', args.outDir, slug], { stdio: 'pipe' });

    if (!fs.existsSync(zipPath)) fail('压缩包未生成', 2);
    const kb = (fs.statSync(zipPath).size / 1024).toFixed(1);

    // 3. 元数据清单
    const manifest = {
      name,
      slug,
      version,
      description,
      category: meta.category || '',
      tags: meta.tags ? String(meta.tags).split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [],
      entry: 'SKILL.md',
      files: fileCount,
      package: path.basename(zipPath),
      builtAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(args.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    // 4. 结果
    console.log('\n  ✓ 打包完成');
    console.log(`  ${fileCount} 个文件 · ${kb} KB`);
    console.log(`  ${zipPath}`);
    console.log(`  ${path.join(args.outDir, 'manifest.json')}`);
    console.log('\n=== 接下来（各点一次即可）===');
    console.log('  炉子：右上「+ 新建」→「上传 Skill」→ 选上面这个 zip');
    console.log('  市场：技能页右上「添加技能」→「上传技能」→ 选同一个 zip');
    console.log('');
  } catch (e) {
    fail(`打包失败：${e.message}`, 2);
  }
}

main();
