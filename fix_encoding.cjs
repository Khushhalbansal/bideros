const fs = require('fs');
const files = ['src/routes/index.tsx', 'src/routes/dashboard.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/Ã¢â€ â€™/g, '→');
  content = content.replace(/Ã¢â‚¬â€/g, '—');
  content = content.replace(/Ã‚Â·/g, '·');
  content = content.replace(/Ã¢â‚¬Â¦/g, '…');
  content = content.replace(/Ã¢â€šÂ¹/g, '₹');
  content = content.replace(/Ã°Å¸â€˜Â/g, '👀');
  fs.writeFileSync(file, content, 'utf8');
});