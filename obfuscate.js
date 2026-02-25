const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Cấu hình obfuscation
const config = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: true,
  debugProtectionInterval: 2000,
  disableConsoleOutput: false, // Để true nếu muốn chặn console.log
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: true,
  shuffleStringArray: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayEncoding: ['base64', 'rc4'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

// Obfuscate app.js
const inputFile = 'app.js';
const outputFile = 'app.obf.js';

if (!fs.existsSync(inputFile)) {
  console.error('❌ Không tìm thấy app.js');
  process.exit(1);
}

console.log('🔐 Đang obfuscate app.js...');

const code = fs.readFileSync(inputFile, 'utf8');
const obfuscationResult = JavaScriptObfuscator.obfuscate(code, config);

fs.writeFileSync(outputFile, obfuscationResult.getObfuscatedCode());

console.log('✅ Đã tạo app.obf.js');
console.log(`📊 Original: ${(code.length / 1024).toFixed(2)} KB`);
console.log(`📊 Obfuscated: ${(obfuscationResult.getObfuscatedCode().length / 1024).toFixed(2)} KB`);

// Update index.html để dùng file obfuscated
let html = fs.readFileSync('index.html', 'utf8');

// Thay <script src="app.js"> thành <script src="app.obf.js">
if (html.includes('src="app.js"')) {
  html = html.replace('src="app.js"', 'src="app.obf.js"');
  fs.writeFileSync('index.html', html);
  console.log('✅ Đã cập nhật index.html để dùng app.obf.js');
} else if (html.includes('src="app.obf.js"')) {
  console.log('✅ index.html đã dùng app.obf.js');
} else {
  console.log('⚠️ Không tìm thấy script tag, hãy tự sửa index.html');
}

console.log('\n🚀 Để build lại: node obfuscate.js');
