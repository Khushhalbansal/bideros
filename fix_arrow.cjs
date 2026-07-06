const fs = require('fs');
let content = fs.readFileSync('src/routes/index.tsx', 'utf8');
content = content.replace(/Ã¢â€ â€™/g, '→');
fs.writeFileSync('src/routes/index.tsx', content, 'utf8');