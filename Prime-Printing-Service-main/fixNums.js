const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./frontend');
let updatedCount = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/\.toLocaleString\(\)/g, ".toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })");
    fs.writeFileSync(f, content);
    updatedCount++;
});
console.log('Total files processed: ' + files.length);
