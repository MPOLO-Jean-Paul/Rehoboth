const fs = require('fs');
const path = require('path');

const replacements = {
  'LaboScreen.js': 'flask',
  'CashierScreen.js': 'cash-register',
  'DoctorScreen.js': 'stethoscope',
  'SoinsScreen.js': 'medical-bag',
  'ReceptionScreen.js': 'clipboard-account',
  'HomeScreen.js': 'view-dashboard',
  'LoginScreen.js': 'account',
  'StaffMessagesScreen.js': 'message-text',
  'PremiumRightPanel.js': 'information',
  'GlobalErrorBoundary.js': 'alert-circle',
  'Footer.js': 'map-marker',
  'DoctorActionPanel.js': 'stethoscope'
};

const dir = 'c:/laragon/www/polyclique-api/polyclique-mobile/src';

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      filelist = walkSync(filePath, filelist);
    } else {
      if (filePath.endsWith('.js')) {
        filelist.push(filePath);
      }
    }
  });
  return filelist;
};

const files = walkSync(dir);

files.forEach(file => {
  const filename = path.basename(file);
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('help-circle')) {
    const icon = replacements[filename] || 'information';
    if (filename === 'Footer.js') {
      content = content.replace('name="help-circle" size={12} color="#64748B" /><Text style={styles.text}>Lubumbashi', 'name="map-marker" size={12} color="#64748B" /><Text style={styles.text}>Lubumbashi');
      content = content.replace('name="help-circle" size={12} color="#64748B" /><Text style={styles.text}>+243', 'name="phone" size={12} color="#64748B" /><Text style={styles.text}>+243');
    } else {
      content = content.split('help-circle').join(icon);
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log('Replaced help-circle in ' + filename + ' with ' + icon);
  }
});
console.log('Done replacing icons');
