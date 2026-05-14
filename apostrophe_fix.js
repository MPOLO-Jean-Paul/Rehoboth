const fs = require('fs');
const path = require('path');

const targets = ['./src/screens', './src/components', './src/services', './src/hooks'];

const apostropheFix = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Replace double quote between two letters with a single quote (broken apostrophe)
  content = content.replace(/([a-zA-Z])\u0022([a-zA-Z])/g, "$1'$2");

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Apostrophe Fix applied to: ${path.basename(filePath)}`);
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

console.log('Apostrophe Fix complete.');
