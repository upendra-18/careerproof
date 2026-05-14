const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'public');

const files = [
  'careerproof.html',
  'apply.html',
  'verify.html',
];

fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(outDir, file));
}

fs.copyFileSync(path.join(root, 'careerproof.html'), path.join(outDir, 'index.html'));

const assetsSrc = path.join(root, 'assets');
const assetsDest = path.join(outDir, 'assets');
fs.rmSync(assetsDest, { recursive: true, force: true });
fs.cpSync(assetsSrc, assetsDest, { recursive: true });

console.log('Prepared Vercel static output in public/');
