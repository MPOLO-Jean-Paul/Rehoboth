const fs = require('fs');
const path = require('path');

const dirs = ['./src/screens', './src/components'];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const filePath = path.join(dir, file);
    let c = fs.readFileSync(filePath, 'utf8');
    const original = c;

    // Fix: >"TEXT"</Text>  →  >TEXT</Text>
    // Pattern: > then " then text then " then </Text>
    c = c.replace(/>\"([^\"<\n]{1,200})\"(<\/Text>)/g, '>$1$2');

    // Fix remaining help-circle icons that should be something else
    // These were set as fallback - let's fix the known wrong ones
    // Revenue detail arrow
    c = c.replace(
      'name="help-circle" size={14} color="rgba(255,255,255,0.7)"',
      'name="chevron-right" size={14} color="rgba(255,255,255,0.7)"'
    );
    // Search icon in patients
    c = c.replace(
      'name="help-circle" size={22} color={brandColor}',
      'name="search" size={22} color={brandColor}'
    );

    if (c !== original) {
      fs.writeFileSync(filePath, c, 'utf8');
      console.log('Fixed: ' + file);
    }
  }
}

console.log('Done!');
