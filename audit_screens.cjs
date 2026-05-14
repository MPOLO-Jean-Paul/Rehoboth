const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.join(__dirname, 'polyclique-mobile', 'src');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const files = getAllFiles(srcDir);
let errorCount = 0;

console.log(`Auditing ${files.length} files...`);

files.forEach(file => {
  try {
    // We use node --check to verify syntax. 
    // Note: This won't catch JSX specific issues unless we use a proper parser like babel.
    // Given the previous history of unclosed quotes, even node --check might fail.
    execSync(`node --check "${file}"`, { stdio: 'ignore' });
  } catch (e) {
    console.error(`Syntax error in: ${file}`);
    errorCount++;
  }
});

if (errorCount === 0) {
  console.log("All screens (files) passed basic syntax check.");
} else {
  console.log(`Found ${errorCount} files with syntax errors.`);
}
