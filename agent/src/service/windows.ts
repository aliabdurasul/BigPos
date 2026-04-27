/**
 * Windows Service installer for BigPOS Agent.
 * Run: node dist/service/windows.js install
 *      node dist/service/windows.js uninstall
 *
 * Requires: npm install node-windows
 */

const path   = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name:        'BigPOS Print Agent',
  description: 'BigPOS local thermal printer agent — bridges Supabase print queue to LAN printers.',
  script:      path.join(__dirname, '..', 'index.js'),
  nodeOptions:  [],
  env: [
    // Optionally override keystore path via env
    { name: 'BIGPOS_KEYSTORE_PATH', value: '' },
  ],
});

const command = process.argv[2];

svc.on('install',   () => { svc.start(); console.log('Service installed and started.'); });
svc.on('uninstall', () => console.log('Service uninstalled.'));
svc.on('error',     (err: Error) => console.error('Service error:', err));

if (command === 'install') {
  console.log('Installing BigPOS Agent as Windows service...');
  svc.install();
} else if (command === 'uninstall') {
  console.log('Uninstalling BigPOS Agent Windows service...');
  svc.uninstall();
} else {
  console.log('Usage: node windows.js [install|uninstall]');
  process.exit(1);
}
