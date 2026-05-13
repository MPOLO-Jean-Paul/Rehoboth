const fs = require('fs');

let content = fs.readFileSync('./src/components/SoinsNavPanel.js', 'utf8');

// Fix the broken title string
content = content.replace(
  /{\"NAVIGATION SOINS'/,
  'NAVIGATION SOINS'
);

// Fix the broken MODULE INFIRMIER dynamic lookup (empty key)
content = content.replace(
  /\{.*?t\.dynamic.*?\[""\].*?MODULE INFIRMIER.*?\}/,
  'MODULE INFIRMIER'
);

fs.writeFileSync('./src/components/SoinsNavPanel.js', content);
console.log('Fixed SoinsNavPanel.js');
