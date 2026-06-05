const fs = require('fs');
const path = require('path');

const dir = 'public/videos';
const files = fs.readdirSync(dir);

let count = 1;
let renameMap = {};

for (const file of files) {
  if (file.endsWith('.mp4')) {
    const newName = 'bg-' + count + '.mp4';
    fs.renameSync(path.join(dir, file), path.join(dir, newName));
    renameMap[file] = newName;
    count++;
  }
}

console.log("Renamed files:");
console.log(renameMap);

const srcDir = 'src';
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const tsxFiles = walk(srcDir);
for (const file of tsxFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const oldName of Object.keys(renameMap)) {
    if (content.includes(oldName)) {
      content = content.split(oldName).join(renameMap[oldName]);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, content);
    console.log("Updated", file);
  }
}
