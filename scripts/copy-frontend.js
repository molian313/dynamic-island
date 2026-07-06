const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'frontend');

// Clean and create
if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
fs.mkdirSync(dest, { recursive: true });

// Files and dirs to copy
const items = [
  'index.html',
  'settings.html',
  'app.js',
  'controls.js',
  'controls.css',
  'island.css',
  'style.css',
  'settings.css',
  'package.json',
  'src',
  'shaders',
  'icons',
];

for (const item of items) {
  const src = path.join(root, item);
  const dst = path.join(dest, item);
  if (!fs.existsSync(src)) continue;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.cpSync(src, dst, { recursive: true });
  } else {
    fs.copyFileSync(src, dst);
  }
}

console.log('Frontend files copied to frontend/');
