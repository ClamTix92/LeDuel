// ============================================================
// AUTH CLIENT — à ajouter à la fin de script.js
// ============================================================

// --- Ouverture / fermeture de la modale ---

function openAuthModal(panel = 'login') {
  document.getElementById('auth-modal-overlay').style.display = 'flex';
  showAuthPanel(panel);

  // Pré-remplir l'aperçu de l'élo invité si disponible
  if (currentUser) {
    const preview = document.getElementById('auth-elo-preview');
    if (preview) {
      preview.textContent = `(Quiz: ${currentUser.elo_quiz} / Images: ${currentUser.elo_images})`;
    }
    // Cacher la case transfert si c'est déjà un vrai compte (pas un invité)
    const transferBlock = document.getElementById('auth-transfer-elo');
    if (transferBlock) {
      transferBlock.style.display = currentUser.guest_uuid ? 'block' : 'none';
    }
  }
}

function closeAuthModal() {
  document.getElementById('auth-modal-overlay').style.display = 'none';
  clearAuthErrors();
}

function showAuthPanel(name) {
  ['login', 'register', 'forgot', 'reset'].forEach(p => {
    document.getElementById(`panel-${p}`).style.display = p === name ? 'block' : 'none';
  });
  // Synchroniser les onglets (seulement pour login/register)
  document.getElementById('tab-login').classList.toggle('active', name === 'login');
  document.getElementById('tab-register').classList.toggle('active', name === 'register');
}

function clearAuthErrors() {
  ['login-error', 'register-error', 'forgot-error', 'forgot-success', 'reset-error', 'reset-success'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  });
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function showAuthSuccess(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// --- Onglets ---
document.getElementById('tab-login').addEventListener('click', () => showAuthPanel('login'));
document.getElementById('tab-register').addEventListener('click', () => showAuthPanel('register'));

// --- Fermeture ---
document.getElementById('btn-auth-close').addEventListener('click', closeAuthModal);
document.getElementById('auth-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('auth-modal-overlay')) closeAuthModal();
});

// --- Mot de passe oublié ---
document.getElementById('btn-show-forgot').addEventListener('click', () => showAuthPanel('forgot'));
document.getElementById('btn-back-to-login').addEventListener('click', () => showAuthPanel('login'));

// --- CONNEXION ---
document.getElementById('btn-login').addEventListener('click', async () => {
  clearAuthErrors();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) return showAuthError('login-error', 'Remplis tous les champs.');

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Connexion...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showAuthError('login-error', data.error || 'Erreur de connexion.');
    } else {
      currentUser = data.user;
      updateUserHUD();
      closeAuthModal();
      showToast(`Bienvenue, ${data.user.username} !`);
      if (!data.user.email_verified) {
        showToast('⚠️ Pense à vérifier ton email pour activer ton compte.');
      }
    }
  } catch (err) {
    showAuthError('login-error', 'Erreur réseau, réessaie.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'SE CONNECTER';
  }
});

// --- INSCRIPTION ---
document.getElementById('btn-register').addEventListener('click', async () => {
  clearAuthErrors();
  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const transferElo = document.getElementById('transfer-elo-checkbox').checked;

  if (!username || !email || !password) return showAuthError('register-error', 'Remplis tous les champs.');

  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  btn.textContent = 'Création...';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, transferElo })
    });
    const data = await res.json();

    if (!res.ok) {
      showAuthError('register-error', data.error || 'Erreur lors de la création.');
    } else {
      currentUser = data.user;
      updateUserHUD();
      closeAuthModal();
      showToast('Compte créé ! Vérifie ton email. 📧');
    }
  } catch (err) {
    showAuthError('register-error', 'Erreur réseau, réessaie.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'CRÉER MON COMPTE';
  }
});

// --- MOT DE PASSE OUBLIÉ ---
document.getElementById('btn-forgot').addEventListener('click', async () => {
  clearAuthErrors();
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) return showAuthError('forgot-error', 'Entre ton email.');

  const btn = document.getElementById('btn-forgot');
  btn.disabled = true;
  btn.textContent = 'Envoi...';

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    showAuthSuccess('forgot-success', data.message);
  } catch (err) {
    showAuthError('forgot-error', 'Erreur réseau, réessaie.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'ENVOYER LE LIEN';
  }
});

// --- RESET MOT DE PASSE (si on arrive depuis le lien email) ---
function checkResetToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('reset_token');
  const verified = params.get('verified');

  const googleStatus = params.get('google');
  if (googleStatus === 'success') {
    fetch('/api/me').then(r => r.json()).then(u => {
      if (u) {
        currentUser = u;
        updateUserHUD();
        showToast(`Connecté avec Google ! Bienvenue, ${u.username} 👋`);
      }
    });
    window.history.replaceState({}, '', '/');
  } else if (googleStatus === 'error') {
    showToast('❌ Erreur de connexion Google.');
    window.history.replaceState({}, '', '/');
  }

  if (token) {
    // Afficher le panel reset
    document.getElementById('auth-modal-overlay').style.display = 'flex';
    showAuthPanel('reset');

    document.getElementById('btn-reset').addEventListener('click', async () => {
      clearAuthErrors();
      const password = document.getElementById('reset-password').value;
      const confirm = document.getElementById('reset-password-confirm').value;

      if (password !== confirm) return showAuthError('reset-error', 'Les mots de passe ne correspondent pas.');
      if (password.length < 8) return showAuthError('reset-error', 'Au moins 8 caractères.');

      const btn = document.getElementById('btn-reset');
      btn.disabled = true;
      btn.textContent = 'Mise à jour...';

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
        });
        const data = await res.json();
        if (!res.ok) {
          showAuthError('reset-error', data.error);
        } else {
          showAuthSuccess('reset-success', 'Mot de passe mis à jour ! Tu peux te connecter.');
          setTimeout(() => { showAuthPanel('login'); }, 2000);
        }
      } catch (err) {
        showAuthError('reset-error', 'Erreur réseau.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'METTRE À JOUR';
      }
    });
  }

  if (verified === 'success') {
    showToast('✅ Email vérifié ! Ton compte est actif.');
    // Nettoyer l'URL
    window.history.replaceState({}, '', '/');
  } else if (verified === 'expired') {
    showToast('⚠️ Le lien de vérification a expiré.');
    window.history.replaceState({}, '', '/');
  }
}

// --- Mise à jour du HUD avec les infos du compte ---
function updateUserHUD() {
  if (!currentUser) return;

  // Pseudo
  const playerStrong = document.querySelector('.top-player-text strong');
  if (playerStrong) playerStrong.textContent = currentUser.username || 'Joueur';

  // Élo
  const eloQuizEl = document.getElementById('elo-quiz');
  const eloImagesEl = document.getElementById('elo-images');
  if (eloQuizEl) eloQuizEl.textContent = currentUser.elo_quiz;
  if (eloImagesEl) eloImagesEl.textContent = currentUser.elo_images;

  // Badge "!" sur l'avatar si l'utilisateur est en mode invité
  // (incite à créer un compte — il le trouvera dans la modale profil)
  updateGuestBadge();

  // Bouton : si connecté avec un vrai compte → afficher "Déconnexion"
  const btnAuth = document.getElementById('btn-auth-open');
  if (btnAuth) {
    if (currentUser.email) {
      btnAuth.textContent = currentUser.username;
    } else {
      btnAuth.textContent = 'Se connecter';
    }
  }
}

// --- Badge invité sur l'avatar du HUD ---
function updateGuestBadge() {
  const identity = document.getElementById('btn-profile-settings');
  if (!identity) return;

  const isGuest = !currentUser || !currentUser.email;
  let badge = identity.querySelector('.guest-badge');

  if (isGuest) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'guest-badge';
      badge.setAttribute('aria-label', 'Crée un compte pour sauvegarder ta progression');
      badge.title = 'Crée un compte pour sauvegarder ta progression';
      badge.textContent = '!';
      // ancrer sur le bouton identité (l'avatar a overflow:hidden)
      identity.appendChild(badge);
    }
  } else if (badge) {
    badge.remove();
  }
}

// --- Bouton "Se connecter" dans le HUD (à ajouter dans index.html) ---
// <button id="btn-auth-open" type="button">Se connecter</button>
document.getElementById('btn-auth-open')?.addEventListener('click', () => {
  if (currentUser && currentUser.email) {
    // Déjà connecté → proposer déconnexion
    if (confirm(`Déconnecter ${currentUser.username} ?`)) {
      fetch('/api/auth/logout', { method: 'POST' }).then(() => {
        location.reload();
      });
    }
  } else {
    openAuthModal('login');
  }
});

/* =========================================================
   Engrenage HUD → Réglages (modale à venir)
   Pour l'instant : toast "bientôt disponible".
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const btnAuthGear = document.getElementById("btn-auth-gear");
  const btnAuthOpen = document.getElementById("btn-auth-open");
  const authOverlay = document.getElementById("auth-modal-overlay");
  const authClose = document.getElementById("btn-auth-close");

  // Bouton caché d'origine : ouvre toujours la modale auth (utilisé par le profil)
  if (btnAuthOpen) {
    btnAuthOpen.addEventListener("click", () => openAuthModal('login'));
  }

  // Bouton engrenage visible → Réglages (placeholder)
  if (btnAuthGear) {
    btnAuthGear.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showToast('⚙️ Réglages bientôt disponibles');
    });
  }

  // Fermeture avec la croix
  if (authClose) {
    authClose.addEventListener("click", closeAuthModal);
  }

  // Fermeture en cliquant sur le fond sombre
  if (authOverlay) {
    authOverlay.addEventListener("click", (event) => {
      if (event.target === authOverlay) {
        closeAuthModal();
      }
    });
  }

  // Fermeture avec Échap
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAuthModal();
    }
  });
});

// --- Lancer au chargement ---
checkResetToken();
updateUserHUD();