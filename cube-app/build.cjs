const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname,'dist',name),'utf8');
const html = read('index.html')
  .replace('<link rel="stylesheet" href="style.css">',()=>`<style>\n${read('style.css')}\n</style>`)
  .replace('<script defer src="cube.js"></script>',()=>`<script defer>\n${read('cube.js')}\n</script>`)
  .replace('<script defer src="beginner.js"></script>',()=>`<script>\n${read('beginner.js')}\n</script>`)
  .replace('<script defer src="app.js"></script>',()=>`<script>window.addEventListener('DOMContentLoaded', () => {\n${read('app.js')}\n});</script>`);
fs.writeFileSync(path.join(__dirname,'..','index.html'),html);
console.log('Created standalone index.html');
