const fs = require('fs');

// Fix PharmacyScreen icons and ActivityIndicator
let phar = fs.readFileSync('./src/screens/PharmacyScreen.js', 'utf8');
phar = phar.replace(/name="help-circle"\s+size=\{30\}/g, 'name="account-circle" size={30}'); // Patient avatar
phar = phar.replace(/name="help-circle"\s+size=\{24\}\s+color="#FFF"/g, 'name="plus" size={24} color="#FFF"'); // Add stock btn
phar = phar.replace(/name="help-circle"\s+size=\{28\}/g, 'name="pill" size={28}'); // Medicine icon
phar = phar.replace(/name="help-circle"\s+size=\{18\}\s+color="#3B82F6"/g, 'name="information-outline" size={18} color="#3B82F6"'); // Insight icon
phar = phar.replace(/name="help-circle"\s+size=\{24\}\s+color=\{brandColor\}\s+onPress=\{fetchData\}/g, 'name="refresh" size={24} color={brandColor} onPress={fetchData}');
phar = phar.replace(/ActivityIndicator size=""/g, 'ActivityIndicator size="small"');
fs.writeFileSync('./src/screens/PharmacyScreen.js', phar, 'utf8');

// Fix AdminScreen icons and ActivityIndicator
let adm = fs.readFileSync('./src/screens/AdminScreen.js', 'utf8');
adm = adm.replace(/MaterialCommunityIcons name="help-circle" size=\{18\} color=\{brandColor\}/g, 'MaterialCommunityIcons name="chart-pie" size={18} color={brandColor}'); // Revenue chart icon
adm = adm.replace(/MaterialIcons name="help-circle" size=\{20\} color=\{C\.closeIc\}/g, 'MaterialIcons name="close" size={20} color={C.closeIc}'); // Modal close icon
adm = adm.replace(/ActivityIndicator color=""/g, 'ActivityIndicator color="#FFF"');
adm = adm.replace(/animationType=""/g, 'animationType="fade"');
fs.writeFileSync('./src/screens/AdminScreen.js', adm, 'utf8');

console.log('Specific UX fixes applied.');
