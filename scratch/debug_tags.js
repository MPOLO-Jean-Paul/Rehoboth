const fs = require('fs');
const content = fs.readFileSync('src/screens/AdminScreen.js', 'utf8');
const lines = content.split('\n');
let stack = [];
lines.forEach((line, i) => {
  const matches = line.matchAll(/<(View|ScrollView|TouchableOpacity|FadeInView|LinearGradient|Modal|Animated\.View)(?:\s+[^/>]*)?>|<\/(View|ScrollView|TouchableOpacity|FadeInView|LinearGradient|Modal|Animated\.View)>|<View\s+[^/>]*\/>/g);
  for (const match of matches) {
    if (match[0].endsWith('/>')) continue;
    if (match[0].startsWith('</')) {
      const tag = match[2];
      if (stack.length === 0) {
        console.log(`Extra closing tag </${tag}> at line ${i + 1}`);
      } else {
        const last = stack.pop();
        if (last.tag !== tag) {
          console.log(`Mismatched closing tag </${tag}> at line ${i + 1} (expected </${last.tag}> from line ${last.line})`);
        }
      }
    } else {
      const tag = match[1];
      stack.push({ tag, line: i + 1 });
    }
  }
});
stack.forEach(s => console.log(`Unclosed tag <${s.tag}> at line ${s.line}`));
