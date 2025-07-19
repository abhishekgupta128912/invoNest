const fs = require('fs');
const path = require('path');

// Read the logo file and convert to base64
const logoPath = path.join(__dirname, 'public', 'invologo.png');
const logoBuffer = fs.readFileSync(logoPath);
const logoBase64 = logoBuffer.toString('base64');

console.log('Base64 Logo Data URL:');
console.log(`data:image/png;base64,${logoBase64}`);

// Also save to a file for easy copying
fs.writeFileSync(path.join(__dirname, 'logo-base64.txt'), `data:image/png;base64,${logoBase64}`);
console.log('\nBase64 data URL saved to logo-base64.txt');
