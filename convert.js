// convert.js
// npm install sharp

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT_DIR = process.argv[2] || 'images_downloaded';
const OUTPUT_DIR = process.argv[3] || 'images/logos_nfl'; // Par défaut : remplace dans le même dossier

if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Dossier introuvable : ${INPUT_DIR}`);
    process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const files = fs.readdirSync(INPUT_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.webp', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'].includes(ext);
});

if (files.length === 0) {
    console.log('Aucune image à convertir.');
    process.exit(0);
}

console.log(`${files.length} fichier(s) à convertir en .png...\n`);

(async () => {
    let success = 0;
    let errors = 0;

    for (const file of files) {
        const inputPath = path.join(INPUT_DIR, file);
        const baseName = path.basename(file, path.extname(file));
        const outputPath = path.join(OUTPUT_DIR, `${baseName}.png`);

        try {
            await sharp(inputPath)
                .png({ quality: 100, compressionLevel: 6 })
                .toFile(outputPath);

            // Supprimer l'original si même dossier
            if (INPUT_DIR === OUTPUT_DIR) {
                fs.unlinkSync(inputPath);
            }

            console.log(`✓ ${file}  →  ${baseName}.png`);
            success++;
        } catch (err) {
            console.error(`✗ ${file} : ${err.message}`);
            errors++;
        }
    }

    console.log(`\nTerminé ! ${success} converti(s), ${errors} erreur(s).`);
})();