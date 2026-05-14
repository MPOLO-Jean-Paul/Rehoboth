const fs = require('fs');
const path = require('path');

const targets = ['./src/screens', './src/components'];

const universalFix = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1. Fix mismatched braces/quotes in attributes (e.g. title={"Text' or placeholder="Text')
  // This is the most common corruption from the translation script.
  content = content.replace(/([a-zA-Z]+)=\{\u0022([^\u0022\u0027\n]+)\u0027/g, '$1=\u0022$2\u0022');
  content = content.replace(/([a-zA-Z]+)=\{\u0027([^\u0022\u0027\n]+)\u0022/g, '$1=\u0022$2\u0022');
  content = content.replace(/([a-zA-Z]+)=\u0022([^\u0022\u0027\n]+)\u0027/g, '$1=\u0022$2\u0022');
  content = content.replace(/([a-zA-Z]+)=\u0027([^\u0022\u0027\n]+)\u0022/g, '$1=\u0022$2\u0022');

  // 2. Fix empty string attributes that cause errors or bad UI
  content = content.replace(/keyboardType=\u0022\u0022/g, 'keyboardType=\u0022numeric\u0022');
  content = content.replace(/resizeMode=\u0022\u0022/g, 'resizeMode=\u0022contain\u0022');
  content = content.replace(/placeholderTextColor=\u0022\u0022/g, 'placeholderTextColor={C.placeholder}');
  content = content.replace(/animationType=\u0022\u0022/g, 'animationType=\u0022fade\u0022');
  
  // 3. ActivityIndicator specific fixes
  content = content.replace(/<ActivityIndicator\s+([^>]*?)color=\u0022\u0022/g, '<ActivityIndicator $1color={brandColor}');
  content = content.replace(/<ActivityIndicator\s+([^>]*?)size=\u0022\u0022/g, '<ActivityIndicator $1size=\u0022small\u0022');
  
  // 4. Icon name and color fixes
  content = content.replace(/name=\u0022\u0022/g, 'name=\u0022help-circle\u0022'); // Placeholder for missing icon names
  content = content.replace(/color=\u0022\u0022/g, 'color={brandColor}');

  // 5. Special case for NotificationScreen error reported
  content = content.replace(/title=\{\u0022Notifications\u0027/g, 'title=\u0022Notifications\u0022');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Universal Fix applied to: ${path.basename(filePath)}`);
  }
};

for (const dir of targets) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    universalFix(path.join(dir, file));
  }
}

console.log('Universal Perfection complete.');
