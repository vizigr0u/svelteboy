import { spawnSync } from 'node:child_process';

function parseLine(output) {
  const m = output.match(/Avg:\s*([\d.]+),\s*Low:\s*([\d.]+),\s*High:\s*([\d.]+)/);
  if (!m) return null;
  return { avg: m[1], low: m[2], high: m[3] };
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8' });
  return r.stdout || '';
}

const nodeArgs = ['run', 'bench'];
const browserArgs = ['run', 'bench:browser'];

console.log('Running Node benchmark...');
const nodeOut = run('pnpm', nodeArgs);
const nodeResult = parseLine(nodeOut);

console.log('\nRunning browser benchmark...');
const browserOut = run('pnpm', browserArgs);
const browserResult = parseLine(browserOut);

if (!nodeResult || !browserResult) {
  console.error('Failed to parse results');
  console.error('Node output:', nodeOut);
  console.error('Browser output:', browserOut);
  process.exit(1);
}

const pad = (s, n) => String(s).padStart(n);
console.log('\n' + '─'.repeat(44));
console.log(`${''.padEnd(12)} ${'Avg (fps)'.padStart(10)} ${'Low (fps)'.padStart(10)} ${'High (fps)'.padStart(10)}`);
console.log('─'.repeat(44));
console.log(`${'Node'.padEnd(12)} ${pad(nodeResult.avg, 10)} ${pad(nodeResult.low, 10)} ${pad(nodeResult.high, 10)}`);
console.log(`${'Browser'.padEnd(12)} ${pad(browserResult.avg, 10)} ${pad(browserResult.low, 10)} ${pad(browserResult.high, 10)}`);

function diff(a, b) {
  const d = ((parseFloat(b) - parseFloat(a)) / parseFloat(a) * 100).toFixed(1);
  return (d > 0 ? '+' : '') + d + '%';
}
console.log(`${'Diff'.padEnd(12)} ${pad(diff(nodeResult.avg, browserResult.avg), 10)} ${pad(diff(nodeResult.low, browserResult.low), 10)} ${pad(diff(nodeResult.high, browserResult.high), 10)}`);
console.log('─'.repeat(44));
