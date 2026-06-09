const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = 'C:/Users/usuario/OneDrive/Escritorio/TIENDA NATU';

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  let fp = path.join(DIR, url === '/' ? 'index.html' : url);
  // Clean URLs: /pos -> pos.html, /tienda -> tienda.html
  if (!path.extname(fp)) {
    const withHtml = fp + '.html';
    if (fs.existsSync(withHtml)) fp = withHtml;
  }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/html' });
    res.end(data);
  });
}).listen(PORT, () => console.log('Servidor en http://localhost:' + PORT));
