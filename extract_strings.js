const fs = require('fs');
const path = require('path');

const dirs = ['./src/screens', './src/components'];
const allStrings = new Set();

const extract = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      extract(fullPath);
    } else if (fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Extract <Text>...</Text> strings
      const textMatches = content.matchAll(/>\s*([^<{]+?)\s*<\/Text>/g);
      for (const match of textMatches) {
        const text = match[1].trim();
        if (text && !text.match(/^[0-9\W]+$/)) { // avoid numbers/symbols only
          allStrings.add(text);
        }
      }

      // Extract placeholder="..."
      const placeholderMatches = content.matchAll(/placeholder=["']([^"']+)["']/g);
      for (const match of placeholderMatches) {
        const text = match[1].trim();
        if (text && !text.startsWith('{')) {
          allStrings.add(text);
        }
      }
    }
  }
};

dirs.forEach(extract);
fs.writeFileSync('extracted_strings.json', JSON.stringify([...allStrings], null, 2));
console.log('Extracted ' + allStrings.size + ' strings.');
