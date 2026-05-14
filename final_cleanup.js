const fs = require('fs');
const path = require('path');

const dirs = ['./src/screens', './src/components'];

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1. Fix broken TextInput placeholders
  // Pattern: placeholder={"Text" placeholderTextColor=""
  // This is a common corruption where the closing brace and the quote are merged or missing.
  // We want to turn it into: placeholder="Text" placeholderTextColor={C.placeholder}
  content = content.replace(/placeholder=\{"([^"}\n]{1,200})"\s+placeholderTextColor=""/g, 'placeholder="$1" placeholderTextColor={C.placeholder}');
  
  // Also fix: placeholder={"Text..." placeholderTextColor=""
  content = content.replace(/placeholder=\{"([^"}\n]{1,200})"\s+placeholderTextColor=""/g, 'placeholder="$1" placeholderTextColor={C.placeholder}');
  
  // 2. Fix broken help-circle in MaterialIcons
  // MaterialIcons doesn't have help-circle. 
  // If it's a help circle, it should usually be MaterialCommunityIcons or just 'help' in MaterialIcons.
  // Let's replace MaterialIcons help-circle with MaterialCommunityIcons help-circle
  content = content.replace(/<MaterialIcons\s+name="help-circle"/g, '<MaterialCommunityIcons name="help-circle"');
  
  // 3. Fix literal quote wrapping in remaining places
  // Pattern: {"TEXT"} -> "TEXT"
  content = content.replace(/\{"([^"{}\n]{1,200})"\}/g, '"$1"');

  // 4. Fix specific corrupted translation placeholders in AdminScreen.js
  // e.g. placeholder={"Ex: Maintenance, Services Externes..." placeholderTextColor=""
  content = content.replace(/placeholder=\{"([^"{}\n]{1,200})"\s+placeholderTextColor=""/g, 'placeholder="$1" placeholderTextColor={C.placeholder}');

  // 5. Fix double quotes inside braces for Text content
  // Pattern: <Text>{"TEXT"}</Text> -> <Text>TEXT</Text>
  content = content.replace(/<Text([^>]*)>\{"([^"{}\n]{1,200})"\}<\/Text>/g, '<Text$1>$2</Text>');

  // 6. Fix broken modal animation types
  content = content.replace(/animationType=""/g, 'animationType="fade"');

  // 7. Fix broken PremiumLeftDrawer strings
  content = content.replace(/\{\(typeof t !== 'undefined' && t\.dynamic \? t\.dynamic : \{\}\)\["([^"\]]+)"\] \|\| "([^"]+)"\}/g, '"$2"');

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

console.log('Cleanup complete!');
