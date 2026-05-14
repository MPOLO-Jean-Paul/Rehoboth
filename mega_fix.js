const fs = require('fs');
const path = require('path');

const targets = ['./src/screens', './src/components', './src/services', './src/hooks'];

const megaFix = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Regex to find ANY string literal starting and ending with quotes
  // We look for "..." or '...' or "..." or '...'
  // The key is to match the outermost quotes on a single line that are mismatched.
  
  // We use a non-greedy match for the content between quotes.
  // We must be careful about nested quotes like in style={{ color: 'red' }}
  
  // Strategy: Find all occurrences of "TEXT' or 'TEXT" where TEXT does not contain other quotes.
  content = content.replace(/(\u0022)([^\u0022\u0027\n\r]+)(\u0027)/g, '$1$2$1');
  content = content.replace(/(\u0027)([^\u0022\u0027\n\r]+)(\u0022)/g, '$1$2$1');

  // Second pass for strings that might contain one type of quote but are mismatched
  // e.g. "D'AFFAIRES'
  content = content.replace(/(\u0022)([^" \n\r]+)(\u0027)(?=[ \]),;}])/g, '$1$2$1');
  content = content.replace(/(\u0027)([^' \n\r]+)(\u0022)(?=[ \]),;}])/g, '$1$2$1');

  // Special cases for common corruptions seen in logs
  content = content.replace(/\u0022([^\u0022\u0027\n\r]+D\u0027[^\u0022\u0027\n\r]+)\u0027/g, '\u0022$1\u0022');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Mega Fix applied to: ${path.basename(filePath)}`);
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
      megaFix(fullPath);
    }
  }
};

for (const dir of targets) {
  walkDir(dir);
}

console.log('Mega Fix complete.');
