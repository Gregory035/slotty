import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const workspaces = ['@telegram-business/api', '@telegram-business/web'];

const children = workspaces.map((workspace) =>
  spawn(npmCommand, ['run', 'dev', '-w', workspace], {
    stdio: 'inherit',
    env: process.env,
  }),
);

function stopChildren(signal) {
  for (const child of children) {
    child.kill(signal);
  }
}

process.on('SIGINT', () => stopChildren('SIGINT'));
process.on('SIGTERM', () => stopChildren('SIGTERM'));

const exitCodes = await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.on('exit', (code) => resolve(code ?? 1));
      }),
  ),
);

process.exitCode = exitCodes.find((code) => code !== 0) ?? 0;
