// Simple HTTP server for Valiant Volume Tracker
// Handles CORS and serves static files

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3456;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  // Default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // Get file path
  const filePath = path.join(__dirname, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  // Read and serve file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
      }
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Valiant Volume Tracker Server                      ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  Server running at: http://localhost:${PORT}/            ║`);
  console.log('║                                                        ║');
  console.log('║  Open your browser and navigate to the URL above       ║');
  console.log('║  Press Ctrl+C to stop the server                       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
});
