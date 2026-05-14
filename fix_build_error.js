const fs = require('fs');

const fixReception = () => {
  let content = fs.readFileSync('./src/screens/ReceptionScreen.js', 'utf8');
  // Fix line 687
  content = content.replace(/placeholder="1990' keyboardType=""/g, 'placeholder="1990" keyboardType="numeric"');
  // Fix line 696
  content = content.replace(/placeholder="Ex: \+243\.\.\." placeholderTextColor=\{C\.placeholder\} value=\{form\.contact_info\} onChangeText=\{v => setForm\(\{ \.\.\.form, contact_info: v \}\)\} keyboardType=""/g, 'placeholder="Ex: +243..." placeholderTextColor={C.placeholder} value={form.contact_info} onChangeText={v => setForm({ ...form, contact_info: v })} keyboardType="phone-pad"');
  // Fix line 1033
  content = content.replace(/keyboardType=""\s+value=\{newCatalogItem\.price\}/g, 'keyboardType="numeric" value={newCatalogItem.price}');
  fs.writeFileSync('./src/screens/ReceptionScreen.js', content, 'utf8');
};

const fixSoins = () => {
  let content = fs.readFileSync('./src/screens/SoinsScreen.js', 'utf8');
  content = content.replace(/keyboardType=""\s+value=\{reportForm\[f\.key\]\}/g, 'keyboardType="numeric" value={reportForm[f.key]}');
  fs.writeFileSync('./src/screens/SoinsScreen.js', content, 'utf8');
};

fixReception();
fixSoins();
console.log('Fixed Reception and Soins specific syntax errors.');
