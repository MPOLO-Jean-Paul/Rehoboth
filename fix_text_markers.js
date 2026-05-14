const fs = require('fs');
const path = require('path');

const dirs = ['./src/screens', './src/components'];

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Fix: <Text>{"TEXT"</Text> (missing closing brace and possibly quote)
  content = content.replace(/<Text([^>]*)>\{"([^"{}\n]{1,200})"(<\/Text>)/g, '<Text$1>$2$3');
  
  // Fix: {"TEXT" (remaining cases)
  content = content.replace(/\{"([^"{}\n]{1,200})"/g, '"$1"');

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
