// Simple static file server for Nexus frontend
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname); // c:\Users\harsh\Downloads\ffsd\frontend
const PORT = 8080;

const MIME = {
  '.html': 'text/html',
  '.css' : 'text/css',
  '.js'  : 'text/javascript',
  '.json': 'application/json',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico' : 'image/x-icon',
  '.svg' : 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0]; // strip query string for file lookup
  if (url === '/') url = '/pages/my-activity.html';

  const filePath = path.join(ROOT, url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + filePath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'text/plain',
      'Cache-Control': 'no-cache, no-store',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('=================================================');
  console.log(' Nexus Frontend Server running at:');
  console.log(' http://localhost:' + PORT + '/pages/my-activity.html');
  console.log('=================================================');
});
