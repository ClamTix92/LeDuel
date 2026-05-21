require('dotenv').config();
const { Pool } = require('pg');

// Connexion à PostgreSQL via la variable d'environnement DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Obligatoire sur Render
});

// Crée les tables si elles n'existent pas encore
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id              SERIAL PRIMARY KEY,
            guest_uuid      TEXT UNIQUE,                  -- pour les invités (cookie)
            google_id       TEXT UNIQUE,                  -- pour OAuth Google
            steam_id        TEXT UNIQUE,                  -- pour OAuth Steam
            email           TEXT UNIQUE,                  -- pour email/mdp
            password_hash   TEXT,                         -- bcrypt, null si OAuth
            username        TEXT NOT NULL DEFAULT 'Joueur',
            avatar_url      TEXT,
            elo_quiz        INTEGER NOT NULL DEFAULT 1000,
            elo_images      INTEGER NOT NULL DEFAULT 1000,
            games_quiz      INTEGER NOT NULL DEFAULT 0,
            games_images    INTEGER NOT NULL DEFAULT 0,
            created_at      TIMESTAMP DEFAULT NOW()
        );
    `);

        console.log('✅ Base de données initialisée');
}

module.exports = { pool, initDB };