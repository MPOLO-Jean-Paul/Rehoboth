const fs = require('fs');
const path = require('path');

const dirs = ['./src/screens', './src/components'];

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1. Fix unclosed quotes in placeholders followed by empty keyboardType
  // Pattern: placeholder="... ' keyboardType=""
  content = content.replace(/placeholder="([^"']{1,50})' keyboardType=""/g, 'placeholder="$1" keyboardType="numeric"');
  
  // 2. Fix remaining empty keyboardType
  // Pattern: keyboardType=""
  // Default to numeric for safety as most were for qty/price/year.
  content = content.replace(/keyboardType=""/g, 'keyboardType="numeric"');

  // 3. Fix: placeholder="... ' (generic unclosed quote before attribute)
  content = content.replace(/placeholder="([^"']{1,50})' ([a-zA-Z]+)=/g, 'placeholder="$1" $2=');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${path.basename(filePath)}`);
  }
};

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    fixFile(path.join(dir, file));
  }
}
