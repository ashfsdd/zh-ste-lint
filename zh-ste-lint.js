#!/usr/bin/env node
/**
 * zh-ste-lint.js — 航空维修手册五条 · 中文结构检查器
 *
 * 依赖：sentence-splitter（MIT 许可），负责中文分句
 * 自研：中文字数统计、客套话词表、"被"字句检测、一句多事启发
 *
 * 作者：二次元然酱　|　B站：二次元然酱　|　邮箱：331305990 [at] qq.com
 *
 * 用法：
 *   node zh-ste-lint.js <文件...>
 *   echo "文本" | node zh-ste-lint.js
 *   node zh-ste-lint.js --max 25 <文件>     # 自定义句长上限（默认 30）
 *   node zh-ste-lint.js --json <文件>       # 机器可读
 */
const fs = require('fs');
const { split } = require('sentence-splitter');

const MAX = (() => {
  const i = process.argv.indexOf('--max');
  return i > -1 ? parseInt(process.argv[i + 1], 10) : 30;
})();
const JSON_OUT = process.argv.includes('--json');

// 客套话 / 填充语（STE 第 5 条"不确定就说不确定"的反面）
const FILLER = [
  '一般来说', '通常情况下', '建议咨询', '视情况而定', '具体情况具体分析',
  '需要特别指出的是', '值得一提的是', '众所周知', '不难发现',
  '旨在', '为了更好地', '在很大程度上', '从某种意义上说',
  '可能会有所', '建议用户', '请用户注意',
];
// 营销形容词（STE 禁；标题/钩子场景反而需要，故单独归类为 advisory）
const MARKETING = ['炸裂', '神级', '无敌', '史上最强', '天花板', 'yyds', '逆天', '封神', '极致', '丝滑', '颠覆性'];

function lint(text) {
  const findings = [];
  const sentences = split(text).filter((s) => s.raw.trim().length > 0);

  let total = 0;
  sentences.forEach((s) => {
    const raw = s.raw.trim();
    // 去掉句末标点数字数
    const body = raw.replace(/[。！？!?；;]+$/u, '');
    const len = [...body].length;
    total += len;

    if (len > MAX) {
      findings.push({
        rule: 'long-sentence', severity: 'hard',
        msg: `句子 ${len} 字（上限 ${MAX}）。拆成两句，一句一事。`, text: raw,
      });
    }
    // 一句多事启发：长句 + 逗号 >= 3
    const commas = (body.match(/[，,]/g) || []).length;
    if (commas >= 3 && len > 20) {
      findings.push({
        rule: 'multi-idea', severity: 'advisory',
        msg: `${commas} 个逗号、${len} 字，可能一句塞了多件事。逐件拆开。`, text: raw,
      });
    }
    // 被动/藏主语："被"字句
    if (/[^。！？]*被[^。！？]*[。！？]/u.test(raw) && /被/.test(raw)) {
      findings.push({
        rule: 'hidden-actor', severity: 'advisory',
        msg: '含"被"字句，主语被藏起来。改成"谁去做某事"。', text: raw,
      });
    }
    FILLER.forEach((w) => {
      if (raw.includes(w)) {
        findings.push({
          rule: 'filler', severity: 'hard',
          msg: `客套话/填充语「${w}」。要么给确定答案，要么直接说不确定。`, text: raw,
        });
      }
    });
    MARKETING.forEach((w) => {
      if (raw.includes(w)) {
        findings.push({
          rule: 'marketing-adjective', severity: 'advisory',
          msg: `营销形容词「${w}」。信息段删掉；标题/钩子段可保留。`, text: raw,
        });
      }
    });
  });

  const hard = findings.filter((f) => f.severity === 'hard').length;
  const adv = findings.filter((f) => f.severity === 'advisory').length;
  return {
    sentences: sentences.length, totalChars: total,
    avgLen: sentences.length ? (total / sentences.length).toFixed(1) : '0',
    maxLen: sentences.length ? Math.max(...sentences.map((s) => [...s.raw.replace(/[。！？!?；;]+$/u, '')].length)) : 0,
    hard, advisory: adv, findings,
  };
}

function report(name, r) {
  if (JSON_OUT) { console.log(JSON.stringify({ file: name, ...r }, null, 2)); return; }
  console.log(`\n=== ${name} ===`);
  console.log(`  句子 ${r.sentences} 条｜平均 ${r.avgLen} 字｜最长 ${r.maxLen} 字｜上限 ${MAX}`);
  console.log(`  硬违规 ${r.hard} 条｜提示 ${r.advisory} 条`);
  r.findings.forEach((f) => {
    const mark = f.severity === 'hard' ? '✗' : '!';
    console.log(`  ${mark} [${f.rule}] ${f.msg}`);
    console.log(`      ${f.text.length > 60 ? f.text.slice(0, 60) + '…' : f.text}`);
  });
  if (!r.findings.length) console.log('  ✓ 干净');
}

// 读取输入：文件参数或 stdin
const files = process.argv.slice(2).filter((a) => !a.startsWith('--') && a !== String(MAX));
if (files.length) {
  files.forEach((f) => report(f, lint(fs.readFileSync(f, 'utf8'))));
} else {
  const chunks = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', () => report('stdin', lint(Buffer.concat(chunks).toString('utf8'))));
}
