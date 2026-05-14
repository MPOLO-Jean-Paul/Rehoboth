const fs = require('fs');

const fixLogin = () => {
  const path = './src/screens/LoginScreen.js';
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/showToast\(\u0022([^\u0022]+)\u0022,\s*\u0022([^\u0022\u0027]+)\u0027\)/g, 'showToast(\u0022$1\u0022, \u0022$2\u0022)');
  content = content.replace(/showToast\(t\.success \|\| \u0022Connecté\u0022, \u0022success\u0027\)/g, 'showToast(t.success || \u0022Connecté\u0022, \u0022success\u0022)');
  fs.writeFileSync(path, content, 'utf8');
};

const fixReception = () => {
  const path = './src/screens/ReceptionScreen.js';
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/class=\u0022badge \$\{patient\.is_insured \? \u0022insured\u0027 : \u0027private\u0027\}\u0022/g, 'class=\u0022badge ${patient.is_insured ? \u0027insured\u0027 : \u0027private\u0027}\u0022');
  fs.writeFileSync(path, content, 'utf8');
};

fixLogin();
fixReception();
console.log('Specific fixes for Login and Reception complete.');
