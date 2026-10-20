// Inlines src/ into one self-contained dist/index.html (no dependencies).
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'src');
const read = p => fs.readFileSync(path.join(src, p), 'utf8');
const js = fs.readdirSync(path.join(src, 'js')).filter(f => f.endsWith('.js')).sort()
  .map(f => `/* ${f} */\n` + read('js/' + f)).join('\n');
const html = read('index.html')
  .replace('/*__CSS__*/', () => read('styles.css'))
  .replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(1)} KB`);
