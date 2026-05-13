const fs = require('fs');
const path = require('path');

const dirs = ['./src/screens', './src/components'];

const fixReferenceError = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixReferenceError(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('t?.dynamic?.')) {
        // Safe replacement
        content = content.replace(/t\?\.dynamic\?\./g, "(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})");
        fs.writeFileSync(fullPath, content);
        console.log('Fixed', fullPath);
      }
    }
  }
};

dirs.forEach(fixReferenceError);
console.log('All fixed.');
