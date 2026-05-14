const fs = require('fs');
const path = require('path');

const dirs = ['./src/screens', './src/components'];

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1. Fix placeholder={"... '
  content = content.replace(/placeholder=\{\u0022([^"']{1,50})\u0027/g, 'placeholder=\u0022$1\u0022');
  
  // 2. Fix resizeMode=""
  content = content.replace(/resizeMode=\u0022\u0022/g, 'resizeMode=\u0022contain\u0022');
  
  // 3. Fix ActivityIndicator color=""
  content = content.replace(/<ActivityIndicator\s+([^>]*?)color=\u0022\u0022/g, '<ActivityIndicator $1color={brandColor}');
  
  // 4. Fix other color="" (guess brandColor or #FFF)
  content = content.replace(/color=\u0022\u0022/g, 'color={brandColor}');

  // 5. One more specific check for the CashierScreen error reported
  content = content.replace(/placeholder=\{\u0022Entrez le numéro mobile\.\.\.\u0027/g, 'placeholder=\u0022Entrez le numéro mobile...\u0022');

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
