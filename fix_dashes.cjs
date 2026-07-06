const fs = require('fs');
const files = ['src/routes/index.tsx', 'src/routes/dashboard.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/â€\”/g, '-');
  content = content.replace(/â€”/g, '-');
  content = content.replace(/â”€/g, '-');
  fs.writeFileSync(file, content, 'utf8');
});