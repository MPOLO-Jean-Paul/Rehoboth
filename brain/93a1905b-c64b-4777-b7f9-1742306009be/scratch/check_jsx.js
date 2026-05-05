import fs from 'fs';

const content = fs.readFileSync('c:/laragon/www/polyclique-api/polyclique-mobile/src/screens/AdminScreen.js', 'utf8');

const lines = content.split('\n');
let openTags = [];
let openBrackets = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Simple tag counting (very naive)
    const matches = line.match(/<([a-zA-Z]+)(?:\s+[^>]*?)?\/?>|<\/([a-zA-Z]+)>/g);
    if (matches) {
        for (const match of matches) {
            if (match.startsWith('</')) {
                const tag = match.match(/<\/([a-zA-Z]+)>/)[1];
                const last = openTags.pop();
                if (last !== tag) {
                    console.log(`Mismatch at line ${i + 1}: expected ${last}, found ${tag}`);
                    // Push back to try to recover
                    openTags.push(last);
                }
            } else if (match.endsWith('/>')) {
                // Self-closing, do nothing
            } else {
                const tag = match.match(/<([a-zA-Z]+)/)[1];
                // Ignore some tags that are often self-closing in naive way but not here
                if (['TextInput', 'ActivityIndicator', 'MaterialIcons', 'MaterialCommunityIcons', 'Image', 'StatusBar', 'Switch'].includes(tag) && !line.includes('</' + tag)) {
                     // Check if it's truly open or just a single line usage
                     if (line.includes('</' + tag)) {
                         // Balanced on same line
                     } else {
                         // Might be open or self-closing without />
                         // In RN, these are usually self-closing if no children
                         // But for simplicity of this script, let's assume if it has no children on same line, it's self-closing
                         if (!line.match(new RegExp(`<${tag}[^>]*>[^<]+</${tag}>`))) {
                             // openTags.push(tag); // Let's skip them for now
                         }
                     }
                } else {
                    openTags.push(tag);
                }
            }
        }
    }
}

console.log("Remaining tags:", openTags);
