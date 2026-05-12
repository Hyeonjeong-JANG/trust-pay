const { execFileSync } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '..');
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  DEMO_MODE: process.env.DEMO_MODE || 'true',
  AUTH_DEMO_OTP: process.env.AUTH_DEMO_OTP || 'true',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

execFileSync('pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate'], {
  cwd,
  env,
  stdio: 'inherit',
});

execFileSync('pnpm', ['seed'], {
  cwd,
  env,
  stdio: 'inherit',
});

require('../dist/main');
