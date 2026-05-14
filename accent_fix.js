const fs = require('fs');
const path = require('path');

const targets = ['./src/screens', './src/components', './src/services', './src/hooks'];

const apostropheFix = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Replace double quote between two letters (including accented ones) with a single quote
  content = content.replace(/([a-zA-ZÀ-ÿ])\u0022([a-zA-ZÀ-ÿ])/g, "$1'$2");

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Accented Apostrophe Fix applied to: ${path.basename(filePath)}`);
  }
};

const walkDir = (dir) => {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.js')) {
      apostropheFix(fullPath);
    }
  }
};

for (const dir of targets) {
  walkDir(dir);
}

console.log('Accented Apostrophe Fix complete.');
