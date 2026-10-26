#!/usr/bin/env node
/**
 * smoke.js — zh-ste-lint 冒烟测试
 *
 * 用两个固定样本守住两条底线：
 *   1. AI 腔样本必须报出硬违规（否则检查器瞎了）
 *   2. 受控语言基准样本必须零硬违规（否则误报失控）
 *
 * 用法：node test/smoke.js  （或 npm test）
 */
const { execFileSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'zh-ste-lint.js');
const SAMPLES = path.join(__dirname, '..', 'samples');

function lint(file, extraArgs) {
  const stdout = execFileSync(process.execPath, [CLI, '--json', ...(extraArgs || []), file], {
    encoding: 'utf8',
  });
  return JSON.parse(stdout);
}

let failed = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failed += 1;
}

console.log('\nzh-ste-lint smoke test\n');

const slop = lint(path.join(SAMPLES, 'ai-slop.txt'));
console.log('[samples/ai-slop.txt]');
check('必须报出硬违规', slop.hard >= 1, `hard=${slop.hard} advisory=${slop.advisory}`);
check('必须识别出客套话', slop.findings.some((f) => f.rule === 'filler'), `filler=${slop.findings.filter((f) => f.rule === 'filler').length}`);
check('必须识别出长句', slop.findings.some((f) => f.rule === 'long-sentence'), `maxLen=${slop.maxLen}`);

const up = lint(path.join(SAMPLES, 'controlled-zh.txt'));
console.log('\n[samples/controlled-zh.txt]');
check('受控语言样本零硬违规', up.hard === 0, `hard=${up.hard} advisory=${up.advisory}`);
check('分句数量正确', up.sentences === 124, `sentences=${up.sentences}`);
check('平均句长在短句区间', Number(up.avgLen) < 12, `avgLen=${up.avgLen}`);

const strict = lint(path.join(SAMPLES, 'controlled-zh.txt'), ['--max', '15']);
console.log('\n[--max 15 严格模式]');
check('收紧上限后应报出更多长句', strict.hard > up.hard, `hard=${strict.hard}`);

console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' CHECK(S) FAILED'}\n`);
process.exit(failed === 0 ? 0 : 1);
