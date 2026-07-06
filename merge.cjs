const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/khush/.gemini/antigravity-ide/scratch/new-project/supabase/migrations';
const files = fs.readdirSync(dir).sort();
let sql = '';
for (const file of files) {
  if (file.endsWith('.sql')) {
    sql += `-- MIGRATION: ${file} --\n\n`;
    sql += fs.readFileSync(path.join(dir, file), 'utf8') + '\n\n';
  }
}
fs.writeFileSync('C:/Users/khush/.gemini/antigravity-ide/scratch/all_migrations.sql', sql);
console.log('Merged ' + files.length + ' files');
