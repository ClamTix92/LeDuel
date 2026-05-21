const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Resend } = require('resend');
const { pool } = require('./db');
const { body, validationResult } = require('express-validator');

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ============================================================
// HELPERS
// ============================================================

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Configuration de la stratégie Google
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.APP_URL}/api/auth/google/callback`
},
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const googleId = profile.id;
      const username = profile.displayName || 'Joueur';
      const avatar = profile.photos?.[0]?.value || null;

      // Cherche un compte existant avec ce google_id
      let result = await pool.query(
        'SELECT * FROM users WHERE google_id = $1', [googleId]
      );

      if (result.rows.length > 0) {
        // Compte Google déjà existant → connexion directe
        return done(null, result.rows[0]);
      }

      // Cherche un compte avec le même email (ex: créé via email/mdp)
      if (email) {
        result = await pool.query(
          'SELECT * FROM users WHERE email = $1', [email]
        );
        if (result.rows.length > 0) {
          // Lie le google_id à ce compte existant
          await pool.query(
            'UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3',
            [googleId, avatar, result.rows[0].id]
          );
          return done(null, result.rows[0]);
        }
      }

      // Nouveau compte via Google
      result = await pool.query(
        `INSERT INTO users (google_id, email, username, avatar_url, email_verified)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING *`,
        [googleId, email, username, avatar]
      );

      return done(null, result.rows[0]);

    } catch (err) {
      return done(err, null);
    }
  }
));

// Lancer le flow Google
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Callback après connexion Google
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/?google=error' }),
  async (req, res) => {
    try {
      // Transfert élo invité si le joueur avait une session invité
      const guestId = req.session.guestUserId;
      if (guestId && req.user) {
        const guest = await pool.query(
          'SELECT elo_quiz, elo_images, guest_uuid FROM users WHERE id = $1',
          [guestId]
        );
        if (guest.rows.length > 0 && guest.rows[0].guest_uuid) {
          // On garde le meilleur élo entre l'invité et le compte Google
          await pool.query(
            `UPDATE users SET
              elo_quiz   = GREATEST(elo_quiz, $1),
              elo_images = GREATEST(elo_images, $2)
             WHERE id = $3`,
            [guest.rows[0].elo_quiz, guest.rows[0].elo_images, req.user.id]
          );
          await pool.query('DELETE FROM users WHERE id = $1', [guestId]);
        }
      }

      req.session.userId = req.user.id;
      req.session.guestUserId = null;
      res.redirect('/?google=success');

    } catch (err) {
      console.error('Erreur Google callback :', err);
      res.redirect('/?google=error');
    }
  }
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});

async function sendVerificationEmail(email, token) {
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;
  await resend.emails.send({
    from: 'Le Duel <onboarding@resend.dev>', // remplace par ton domaine si tu en as un
    to: email,
    subject: 'Vérifie ton adresse email — Le Duel',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Bienvenue sur Le Duel !</h2>
        <p>Clique sur le bouton ci-dessous pour vérifier ton adresse email.</p>
        <a href="${link}" style="
          display: inline-block;
          background: #e94560;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          margin: 16px 0;
        ">Vérifier mon email</a>
        <p style="color: #888; font-size: 0.85em;">Ce lien expire dans 24h. Si tu n'as pas créé de compte, ignore cet email.</p>
      </div>
    `
  });
}

async function sendResetEmail(email, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: 'Le Duel <onboarding@resend.dev>',
    to: email,
    subject: 'Réinitialisation de ton mot de passe — Le Duel',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Réinitialisation du mot de passe</h2>
        <p>Tu as demandé à réinitialiser ton mot de passe sur Le Duel.</p>
        <a href="${link}" style="
          display: inline-block;
          background: #e94560;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          margin: 16px 0;
        ">Réinitialiser mon mot de passe</a>
        <p style="color: #888; font-size: 0.85em;">Ce lien expire dans 1h. Si tu n'as pas fait cette demande, ignore cet email.</p>
      </div>
    `
  });
}

// ============================================================
// INSCRIPTION
// ============================================================
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide.'),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe : 8 caractères minimum.'),
  body('username')
    .isLength({ min: 2, max: 20 }).withMessage('Pseudo : 2 à 20 caractères.')
    .matches(/^[a-zA-Z0-9_\- ]+$/).withMessage('Pseudo : lettres, chiffres, _, - uniquement.')
    .trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { email, password, username, transferElo } = req.body;

  try {
    // Vérifier si l'email existe déjà
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = generateToken();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Récupérer l'élo invité si transfert demandé
    let eloQuiz = 1000;
    let eloImages = 1000;
    if (transferElo && req.session.userId) {
      const guest = await pool.query(
        'SELECT elo_quiz, elo_images, guest_uuid FROM users WHERE id = $1',
        [req.session.userId]
      );
      if (guest.rows.length > 0 && guest.rows[0].guest_uuid) {
        eloQuiz = guest.rows[0].elo_quiz;
        eloImages = guest.rows[0].elo_images;
        // Supprimer l'ancien compte invité
        await pool.query('DELETE FROM users WHERE id = $1', [req.session.userId]);
      }
    }

    // Ajouter les colonnes de vérification si pas encore en BDD
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS verify_token TEXT,
        ADD COLUMN IF NOT EXISTS verify_token_expires TIMESTAMP,
        ADD COLUMN IF NOT EXISTS reset_token TEXT,
        ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP
    `);

    // Créer le compte
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, username, elo_quiz, elo_images,
        email_verified, verify_token, verify_token_expires)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7)
       RETURNING id, username, elo_quiz, elo_images`,
      [email, passwordHash, username, eloQuiz, eloImages, verifyToken, verifyExpires]
    );

    const user = result.rows[0];

    // Envoyer l'email de vérification
    await sendVerificationEmail(email, verifyToken);

    // Connecter l'utilisateur
    req.session.userId = user.id;

    res.json({
      success: true,
      message: 'Compte créé ! Vérifie ton email pour activer ton compte.',
      user: { id: user.id, username: user.username, elo_quiz: user.elo_quiz, elo_images: user.elo_images, email_verified: false }
    });

  } catch (err) {
    console.error('Erreur register :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ============================================================
// VÉRIFICATION EMAIL
// ============================================================
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide.'),
  body('password').notEmpty().withMessage('Mot de passe requis.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET email_verified = TRUE, verify_token = NULL, verify_token_expires = NULL
       WHERE verify_token = $1 AND verify_token_expires > NOW()
       RETURNING id`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.redirect('/?verified=expired');
    }

    res.redirect('/?verified=success');
  } catch (err) {
    console.error('Erreur verify-email :', err);
    res.redirect('/?verified=error');
  }
});

// ============================================================
// CONNEXION
// ============================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash, email_verified, elo_quiz, elo_images FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    req.session.userId = user.id;

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        elo_quiz: user.elo_quiz,
        elo_images: user.elo_images,
        email_verified: user.email_verified
      }
    });

  } catch (err) {
    console.error('Erreur login :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ============================================================
// DÉCONNEXION
// ============================================================
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// ============================================================
// MOT DE PASSE OUBLIÉ
// ============================================================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });

  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    // On renvoie toujours success pour ne pas révéler si l'email existe
    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'Si cet email existe, un lien a été envoyé.' });
    }

    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
      [token, expires, email]
    );

    await sendResetEmail(email, token);

    res.json({ success: true, message: 'Si cet email existe, un lien a été envoyé.' });

  } catch (err) {
    console.error('Erreur forgot-password :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ============================================================
// RÉINITIALISATION DU MOT DE PASSE
// ============================================================
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token et mot de passe requis.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
  }

  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Lien invalide ou expiré.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, result.rows[0].id]
    );

    res.json({ success: true, message: 'Mot de passe mis à jour !' });

  } catch (err) {
    console.error('Erreur reset-password :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ============================================================
// ROUTES PROFIL — à ajouter dans auth.js
// ============================================================

// Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer : stockage en mémoire (on envoie directement à Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format non supporté. JPG, PNG ou WEBP uniquement.'));
  }
});

// ============================================================
// ROUTE : Changer le pseudo
// ============================================================
router.post('/profile/username', [
  body('username')
    .isLength({ min: 2, max: 20 }).withMessage('Pseudo : 2 à 20 caractères.')
    .matches(/^[a-zA-Z0-9_\- ]+$/).withMessage('Lettres, chiffres, _, - uniquement.')
    .trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  if (!req.session.userId) return res.status(401).json({ error: 'Non connecté.' });

  const { username } = req.body;
  if (!username || username.trim().length < 2 || username.trim().length > 20) {
    return res.status(400).json({ error: 'Le pseudo doit faire entre 2 et 20 caractères.' });
  }

  try {
    await pool.query(
      'UPDATE users SET username = $1 WHERE id = $2',
      [username.trim(), req.session.userId]
    );
    res.json({ success: true, username: username.trim() });
  } catch (err) {
    console.error('Erreur update username :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ============================================================
// ROUTE : Uploader une photo de profil
// ============================================================
router.post('/profile/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Non connecté.' });
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

  try {
    // Vérification des vrais octets du fichier (pas le type MIME déclaré)
    const { fileTypeFromBuffer } = await import('file-type');
    const type = await fileTypeFromBuffer(req.file.buffer);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!type || !allowedTypes.includes(type.mime)) {
      return res.status(400).json({ error: 'Format invalide. JPG, PNG ou WEBP uniquement.' });
    }

    // Upload vers Cloudinary depuis le buffer mémoire
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'leduel/avatars',
          public_id: `user_${req.session.userId}`,
          overwrite: true,
          transformation: [
            { width: 256, height: 256, crop: 'fill', gravity: 'face' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // Sauvegarder l'URL en BDD
    await pool.query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [result.secure_url, req.session.userId]
    );

    res.json({ success: true, avatar_url: result.secure_url });
  } catch (err) {
    console.error('Erreur upload avatar :', err);
    res.status(500).json({ error: 'Erreur lors de l\'upload.' });
  }
});

// Gestion des erreurs multer (format invalide, fichier trop lourd)
router.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Fichier trop lourd (5 Mo max).' });
    }
    if (err.message && err.message.includes('Format non supporté')) {
        return res.status(400).json({ error: 'Format invalide. JPG, PNG ou WEBP uniquement.' });
    }
    next(err);
});

module.exports = router;