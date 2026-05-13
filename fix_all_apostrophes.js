/**
 * fix_all_apostrophes.js
 * Repairs broken strings left by the translation script.
 * 
 * Patterns fixed:
 *  1.  "Some Text'</Text>   →  "Some Text"</Text>
 *  2.  "Some Text'  placeholderTextColor  →  "Some Text"  placeholderTextColor
 *  3.  'Some Text'</Text>   →  "Some Text"</Text>  (single-quoted text content)
 *  4.  {(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "SOME TEXT"}  →  "SOME TEXT"
 *  5.  name=""   →  context-dependent fix (done separately)
 */

const fs = require('fs');
const path = require('path');

const dirs = ['./src/screens', './src/components'];
let totalFixed = 0;

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // ── Pattern 1: "Text'</Text>  →  "Text"</Text>
  // Matches opening double-quote, text (no newline or double-quote), then closing single-quote before JSX
  content = content.replace(/"([^"\n]{1,200})'\s*(<\/Text>)/g, '"$1"$2');

  // ── Pattern 2: "Text'  placeholderTextColor  →  "Text"  placeholder...
  content = content.replace(/"([^"\n]{1,200})'\s*(placeholderTextColor|style=|value=|onChangeText)/g, '"$1" $2');

  // ── Pattern 3: 'Text'</Text> where it's JSX content (not an attribute value)
  // e.g., >{'ENCAISSEMENT'}</Text>  →  >"ENCAISSEMENT"</Text>
  // Only fix cases where the single-quote looks like a broken double-quote end
  content = content.replace(/>([{])'([^'\n]{1,150})'(<\/Text>)/g, '>"$2"$3');

  // ── Pattern 4: Remove broken t.dynamic lookups for empty-key translations
  // Replace: {(typeof t !== 'undefined' && t.dynamic ? t.dynamic : {})[""] || "SOME VALUE"}
  // With: "SOME VALUE"
  content = content.replace(
    /\{(?:\(typeof t !== 'undefined' && t\.dynamic \? t\.dynamic : \{\}\)\[""\] \|\| )?"([^"]{1,200})"\}/g,
    '"$1"'
  );

  // ── Pattern 5: name="" → name="help-circle" (fallback for any remaining)
  // But be careful not to touch things like placeholder=""
  content = content.replace(/(?<=\bname=)""/g, '"help-circle"');

  // ── Pattern 6: Fix specific known issues
  // "REHOBOTH' in title= attribute (AdminScreen line ~595)
  content = content.replace(/title=\{"REHOBOTH'\n/g, 'title="REHOBOTH"\n');
  content = content.replace(/title=\{"REHOBOTH'(\s+)/g, 'title="REHOBOTH"$1');

  // ── Pattern 7: Fix remaining 'TEXT'</Text> (apostrophe as closing quote of JSX text)
  content = content.replace(/'([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ][^'\n]{0,150})'\s*(<\/Text>)/g, '"$1"$2');

  // ── Pattern 8: Fix placeholders like: "Text' \n  placeholderTextColor
  content = content.replace(/"([^"\n]{1,200})'\s*\n(\s*)(placeholderTextColor)/g, '"$1"\n$2$3');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    const basename = path.basename(filePath);
    // Count approximate number of fixes
    let count = 0;
    const lines1 = original.split('\n');
    const lines2 = content.split('\n');
    for (let i = 0; i < Math.min(lines1.length, lines2.length); i++) {
      if (lines1[i] !== lines2[i]) count++;
    }
    totalFixed += count;
    console.log(`  ✅ ${basename} — ~${count} lines fixed`);
    return count;
  }
  return 0;
};

console.log('🔧 Scanning and fixing all broken apostrophe strings...\n');

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    fixFile(path.join(dir, file));
  }
}

console.log(`\n✅ DONE. Total lines repaired: ~${totalFixed}`);

// ── Verify scan ──────────────────────────────────────────────
console.log('\n🔍 Verifying remaining issues...\n');
let remaining = 0;
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const matches = content.match(/"[^"\n]{1,150}'\s*(?:<\/Text>|placeholderTextColor)/g);
    if (matches) {
      console.log(`  ⚠️  ${file}: ${matches.length} remaining`);
      matches.slice(0,2).forEach(m => console.log(`      → ${m.substring(0,70)}`));
      remaining += matches.length;
    }
  }
}

if (remaining === 0) {
  console.log('  🎉 All files are clean!');
} else {
  console.log(`\n  ⚠️  ${remaining} issues still need manual attention.`);
}
