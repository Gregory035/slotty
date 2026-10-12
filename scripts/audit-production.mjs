import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const audit = spawnSync(npmCommand, ['audit', '--omit=dev', '--audit-level=high', '--json'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

if (audit.error) throw audit.error;

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  process.stderr.write(audit.stderr || audit.stdout || 'npm audit did not return JSON\n');
  process.exit(1);
}

const blocked = [];
const allowed = [];
for (const [name, finding] of Object.entries(report.vulnerabilities ?? {})) {
  if (!['high', 'critical'].includes(finding.severity)) continue;
  if (isAllowedPrismaToolingFinding(name, finding)) allowed.push(name);
  else blocked.push(`${name} (${finding.severity})`);
}

if (allowed.length > 0) {
  console.warn([
    'Temporarily allowed build-tool advisory GHSA-ggr8-5vv4-36mx:',
    ...allowed.map((name) => `- ${name}`),
    'The affected Prisma CLI packages are removed from the API runtime image.',
  ].join('\n'));
}

if (blocked.length > 0) {
  console.error(['Production dependency audit failed:', ...blocked.map((item) => `- ${item}`)].join('\n'));
  process.exit(1);
}

console.log('Production dependency audit passed');

function isAllowedPrismaToolingFinding(name, finding) {
  if (name === 'deepmerge-ts') {
    return finding.via?.length === 1
      && typeof finding.via[0] === 'object'
      && finding.via[0].source === 1145093
      && finding.via[0].url === 'https://github.com/advisories/GHSA-ggr8-5vv4-36mx';
  }
  if (name === '@prisma/config') {
    return finding.via?.length === 1 && finding.via[0] === 'deepmerge-ts';
  }
  if (name === 'prisma') {
    return finding.via?.length === 1 && finding.via[0] === '@prisma/config';
  }
  if (name === '@prisma/client') {
    return finding.via?.length === 1 && finding.via[0] === 'prisma';
  }
  return false;
}
