const fs = require('fs');
const path = require('path');

const dirs = ['./src/screens', './src/components'];
let totalFixed = 0;

const fixFile = (fullPath) => {
  let content = fs.readFileSync(fullPath, 'utf8');
  let original = content;

  // Pattern 1: Fix broken placeholders like:
  // placeholder={(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["Code ou Nom de l"] || "Code ou Nom de l"}examen..."
  // Should be:
  // placeholder="Code ou Nom de l'examen..."
  
  // Match: (typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})["TRUNCATED_STRING"] || "TRUNCATED_STRING"}SUFFIX"
  // The pattern is: the string was split at an apostrophe
  
  content = content.replace(
    /\(typeof t !== 'undefined' && t\.dynamic \? t\.dynamic : \{\}\)\["([^"]+)"\]\s*\|\|\s*"([^"]+)"\}([^"]*)"([^"]*)/g,
    (match, key, fallback, suffix, rest) => {
      // Reconstruct the original string with apostrophe
      const originalStr = key + "'" + suffix + '"' + rest;
      console.log(`  Fixed split-apostrophe: "${key}" + "}${suffix}"`);
      return `"${key}'${suffix}"`;
    }
  );

  // Pattern 2: More specific - the broken "}word..." pattern in placeholder attributes
  // placeholder={(typeof t ...)[\"Motif de l\"] || \"Motif de l\"}urgence (Ex: ...)\"
  content = content.replace(
    /placeholder=\{\(typeof t !== 'undefined' && t\.dynamic \? t\.dynamic : \{\}\)\["([^"]+)"\]\s*\|\|\s*"([^"]+)"\}([^"<\n]*?)"/g,
    (match, key, fallback, suffix) => {
      const fullStr = key + "'" + suffix;
      console.log(`  Fixed placeholder pattern: "${key}" -> "${fullStr}"`);
      return `placeholder="${fullStr}"`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(fullPath, content);
    totalFixed++;
    console.log('Fixed:', fullPath);
  }
};

const scanDir = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      fixFile(fullPath);
    }
  }
};

dirs.forEach(scanDir);
console.log(`\nTotal files fixed: ${totalFixed}`);
