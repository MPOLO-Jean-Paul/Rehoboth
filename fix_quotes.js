const fs = require('fs');
const path = require('path');

const targets = ['./src/screens', './src/components'];

const fixMismatchedQuotes = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Fix ternary operator quote mismatches
  // Pattern 1: ? "text' : 'text'
  content = content.replace(/\?\s*\u0022([a-zA-Z0-9_\-]+)\u0027\s*:\s*\u0027([a-zA-Z0-9_\-]+)\u0027/g, "? '$1' : '$2'");
  
  // Pattern 2: ? 'text" : 'text'
  content = content.replace(/\?\s*\u0027([a-zA-Z0-9_\-]+)\u0022\s*:\s*\u0027([a-zA-Z0-9_\-]+)\u0027/g, "? '$1' : '$2'");

  // Pattern 3: Generic double-quote followed by single-quote termination in strings
  // Only if followed by space or colon or brace (common in code)
  content = content.replace(/\u0022([a-zA-Z0-9_\- ]{1,50})\u0027(\s*[:},])/g, "'$1'$2");
  
  // Pattern 4: Generic single-quote followed by double-quote termination
  content = content.replace(/\u0027([a-zA-Z0-9_\- ]{1,50})\u0022(\s*[:},])/g, "'$1'$2");

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Mismatched Quotes Fixed: ${path.basename(filePath)}`);
  }
};

for (const dir of targets) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    fixMismatchedQuotes(path.join(dir, file));
  }
}

console.log('Quote correction complete.');
