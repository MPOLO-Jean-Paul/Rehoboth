const fs = require('fs');
const path = require('path');

const targets = ['./src/screens', './src/components'];

const universalQuoteFix = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Pattern: 'TEXT" -> "TEXT"
  content = content.replace(/\u0027([^\u0027\u0022\n\r]+)\u0022/g, '\u0022$1\u0022');
  
  // Pattern: "TEXT' -> "TEXT"
  content = content.replace(/\u0022([^\u0027\u0022\n\r]+)\u0027/g, '\u0022$1\u0022');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Universal Quote Fix applied to: ${path.basename(filePath)}`);
  }
};

for (const dir of targets) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    universalQuoteFix(path.join(dir, file));
  }
}

console.log('Universal Quote Fix complete.');
