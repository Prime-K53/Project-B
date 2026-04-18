
const { spawnSync } = require('child_process');
const path = require('path');

/**
 * Smart postinstall script for Prime ERP Workspace
 * 
 * This script runs 'npm install' in the backend directory
 * UNLESS we are in a Netlify build environment (where the backend
 * is not needed and often fails due to native compilation requirements).
 */

console.log('--- Prim ERP Workspace Post-Install ---');

if (process.env.NETLIFY === 'true' || process.env.IS_NETLIFY === 'true') {
  console.log('Netlify environment detected. Skipping backend dependency installation.');
  process.exit(0);
}

console.log('Installing backend dependencies via --prefix backend...');

const result = spawnSync('npm', ['install'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..', 'backend')
});

if (result.status !== 0) {
  console.error('Backend installation failed with status:', result.status);
  process.exit(result.status || 1);
}

console.log('Backend dependencies installed successfully.');
