require('dotenv').config();
const { pool } = require('./db');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const BACKUP_EMAIL = process.env.BACKUP_EMAIL || process.env.ADMIN_EMAIL;

async function runBackup() {
    console.log('🔄 Démarrage du backup BDD...');

    try {
        // Récupère toutes les données importantes
        const users = await pool.query(`
            SELECT id, username, email, google_id, steam_id,
                   elo_quiz, elo_images, games_quiz, games_images,
                   email_verified, avatar_url, created_at
            FROM users
            ORDER BY id
        `);

        const backup = {
            date: new Date().toISOString(),
            stats: {
                total_users: users.rows.length,
                verified_users: users.rows.filter(u => u.email_verified).length,
                google_users: users.rows.filter(u => u.google_id).length,
                guest_users: users.rows.filter(u => !u.email && !u.google_id).length,
            },
            users: users.rows
        };

        const json = JSON.stringify(backup, null, 2);
        const dateStr = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');

        // Envoie par email
        await resend.emails.send({
            from: 'Le Duel Backup <onboarding@resend.dev>',
            to: BACKUP_EMAIL,
            subject: `💾 Backup BDD LeDuel — ${dateStr}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                    <h2>💾 Backup automatique — ${dateStr}</h2>
                    <h3>Statistiques</h3>
                    <ul>
                        <li>Total joueurs : <strong>${backup.stats.total_users}</strong></li>
                        <li>Comptes vérifiés : <strong>${backup.stats.verified_users}</strong></li>
                        <li>Connexions Google : <strong>${backup.stats.google_users}</strong></li>
                        <li>Invités : <strong>${backup.stats.guest_users}</strong></li>
                    </ul>
                    <p style="color:#888; font-size:0.85em;">
                        Le fichier JSON complet est en pièce jointe.<br>
                        Ne partage pas ce fichier — il contient des données personnelles.
                    </p>
                </div>
            `,
            attachments: [
                {
                    filename: `backup-leduel-${dateStr}.json`,
                    content: Buffer.from(json).toString('base64')
                }
            ]
        });

        console.log(`✅ Backup envoyé à ${BACKUP_EMAIL} (${users.rows.length} joueurs)`);

    } catch (err) {
        console.error('❌ Erreur backup :', err);
    } finally {
        await pool.end();
    }
}

runBackup();