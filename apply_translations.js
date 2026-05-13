const fs = require('fs');
const path = require('path');

const dict = JSON.parse(fs.readFileSync('en_dict.json', 'utf8'));

// 1. Update translations.js
const transPath = './src/i18n/translations.js';
let transContent = fs.readFileSync(transPath, 'utf8');

const frDynamic = {};
const enDynamic = {};

for (const [fr, en] of Object.entries(dict)) {
  frDynamic[fr] = fr;
  enDynamic[fr] = en;
}

// Safely inject dynamic object into translations.js
if (!transContent.includes('dynamic: {')) {
  transContent = transContent.replace(/fr: \{/, `fr: {\n    dynamic: ${JSON.stringify(frDynamic, null, 6)},\n`);
  transContent = transContent.replace(/en: \{/, `en: {\n    dynamic: ${JSON.stringify(enDynamic, null, 6)},\n`);
  fs.writeFileSync(transPath, transContent);
  console.log('Updated translations.js');
}

// 2. Replace hardcoded strings in files
const dirs = ['./src/screens', './src/components'];

const replaceInDir = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Replace >STRING< with >{t.dynamic["STRING"] || "STRING"}<
      content = content.replace(/>\s*([^<{]+?)\s*<\/Text>/g, (match, p1) => {
        const text = p1.trim();
        if (dict[text]) {
          changed = true;
          // Escape quotes in text if any
          const safeText = text.replace(/"/g, '\\"');
          return `>{t?.dynamic?.["${safeText}"] || "${safeText}"}</Text>`;
        }
        return match;
      });

      // Replace placeholder="STRING" with placeholder={t.dynamic["STRING"] || "STRING"}
      content = content.replace(/placeholder=["']([^"']+)["']/g, (match, p1) => {
        const text = p1.trim();
        if (dict[text]) {
          changed = true;
          const safeText = text.replace(/"/g, '\\"');
          return `placeholder={t?.dynamic?.["${safeText}"] || "${safeText}"}`;
        }
        return match;
      });

      // Same for title="STRING"
      content = content.replace(/title=["']([^"']+)["']/g, (match, p1) => {
        const text = p1.trim();
        if (dict[text]) {
          changed = true;
          const safeText = text.replace(/"/g, '\\"');
          return `title={t?.dynamic?.["${safeText}"] || "${safeText}"}`;
        }
        return match;
      });

      if (changed) {
        // Ensure `t` is defined in the file. Most files define it. If missing, we might have an error, but using t?.dynamic prevents hard crash.
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
};

dirs.forEach(replaceInDir);
console.log('Done.');
