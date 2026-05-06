// scraper.js  — version corrigée
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const QUIZ_URL = process.argv[2];
const OUTPUT_DIR = process.argv[3] || 'images_downloaded';

if (!QUIZ_URL) {
    console.error('Usage : node scraper.js <url_du_quiz> [dossier]');
    process.exit(1);
}

function toFilename(name) {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

// Détecte le vrai format depuis les magic bytes
function detectFormat(buffer) {
    const hex = buffer.slice(0, 12).toString('hex');
    const riff = buffer.slice(0, 4).toString();
    const webp = buffer.slice(8, 12).toString();

    if (riff === 'RIFF' && webp === 'WEBP') return { ext: '.webp', valid: true };
    if (hex.startsWith('89504e47'))            return { ext: '.png',  valid: true };
    if (hex.startsWith('ffd8ff'))              return { ext: '.jpg',  valid: true };
    if (hex.startsWith('47494638'))            return { ext: '.gif',  valid: true };
    return { ext: '.bin', valid: false }; // Pas une image
}

(async () => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // ─── Intercepter les réponses réseau pour capturer les images ────────────
    const capturedImages = new Map(); // url → Buffer

    page.on('response', async (response) => {
        const contentType = response.headers()['content-type'] || '';
        if (!contentType.startsWith('image/')) return;

        try {
            const buffer = await response.buffer();
            capturedImages.set(response.url(), buffer);
        } catch (_) {}
    });

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    );

    console.log(`Chargement de : ${QUIZ_URL}`);
    await page.goto(QUIZ_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('img', { timeout: 10000 }).catch(() => {});

    // ─── Associer chaque image à son label ───────────────────────────────────
    const items = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
            .filter(img => img.src?.startsWith('http'))
            .map(img => {
                let label = img.alt || img.title || '';
                if (!label) {
                    let el = img;
                    for (let i = 0; i < 5; i++) {
                        el = el.parentElement;
                        if (!el) break;
                        const text = el.innerText?.trim();
                        if (text && text.length > 1 && text.length < 60) {
                            label = text;
                            break;
                        }
                    }
                }
                return { src: img.src, label: label.trim() };
            });
    });

    console.log(`${items.length} image(s) trouvée(s), ${capturedImages.size} capturée(s) via réseau.\n`);

    const nameCount = {};
    let saved = 0;

    for (const item of items) {
        const buffer = capturedImages.get(item.src);

        if (!buffer) {
            console.warn(`⚠ Pas de données pour : ${item.src}`);
            continue;
        }

        const { ext, valid } = detectFormat(buffer);

        if (!valid) {
            console.warn(`✗ Format invalide (probablement une erreur HTML) : ${item.src}`);
            continue;
        }

        const label = item.label || 'image';
        const baseName = toFilename(label);
        nameCount[baseName] = (nameCount[baseName] || 0) + 1;
        const suffix = nameCount[baseName] > 1 ? `_${nameCount[baseName]}` : '';
        const filename = `${baseName}${suffix}${ext}`;
        const filepath = path.join(OUTPUT_DIR, filename);

        fs.writeFileSync(filepath, buffer);
        console.log(`✓ ${filename}  ←  "${item.label}"`);
        saved++;
    }

    await browser.close();
    console.log(`\n${saved} image(s) sauvegardée(s) dans "${OUTPUT_DIR}".`);
    if (saved > 0) console.log(`Lance maintenant : node convert.js ${OUTPUT_DIR}`);
})();