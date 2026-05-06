// check.js
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2] || 'images_downloaded';

fs.readdirSync(DIR).forEach(file => {
    const filepath = path.join(DIR, file);
    const buffer = fs.readFileSync(filepath);
    
    // Lire les premiers octets (magic bytes) pour identifier le vrai format
    const hex = buffer.slice(0, 12).toString('hex');
    const text = buffer.slice(0, 15).toString('utf8');
    
    let format = 'INCONNU';
    if (hex.startsWith('52494646') && buffer.slice(8, 12).toString() === 'WEBP') format = '✓ WebP';
    else if (hex.startsWith('89504e47')) format = '✓ PNG';
    else if (hex.startsWith('ffd8ff'))   format = '✓ JPEG';
    else if (text.startsWith('<!') || text.startsWith('<h')) format = '✗ HTML (erreur serveur)';
    else if (text.startsWith('{') || text.startsWith('[')) format = '✗ JSON';
    
    console.log(`${format.padEnd(25)} ${file}`);
});