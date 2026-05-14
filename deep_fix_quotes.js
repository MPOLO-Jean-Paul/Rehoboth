const fs = require('fs');
const path = require('path');

const targets = ['./src/screens', './src/components'];

const fixTernaryQuotes = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1. Fix: "Text' :  or "Text' }
  // This version handles spaces and apostrophes inside the text
  // Pattern: ? "SOME TEXT' : 
  // We replace the opening " with ' and the closing ' remains ', but we must escape any ' inside.
  // Actually, it's easier to just change the closing ' to "
  content = content.replace(/\?\s*\u0022([^\u0022]+)\u0027(\s*[:}])/g, '? \u0022$1\u0022$2');
  
  // Pattern: : "SOME TEXT' : or : "SOME TEXT' }
  content = content.replace(/:\s*\u0022([^\u0022]+)\u0027(\s*[:}])/g, ': \u0022$1\u0022$2');

  // Fix unclosed double quotes followed by single quote terminator in template literals
  // Pattern: ${ ... "Text' ... }
  content = content.replace(/\$\{([^}]*?)\u0022([^\u0022\n]+)\u0027([^}]*?)\}/g, (match, p1, p2, p3) => {
     // If p2 contains an apostrophe, it might be the cause of the split.
     // But usually the script just used " at start and ' at end.
     return `\$\{${p1}\u0022${p2}\u0022${p3}\}`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Deep Quote Fix applied to: ${path.basename(filePath)}`);
  }
};

for (const dir of targets) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    fixTernaryQuotes(path.join(dir, file));
  }
}

console.log('Deep Quote correction complete.');
