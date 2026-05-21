// ============================================================
// PROFIL CLIENT — à ajouter à la fin de auth_client.js
// ============================================================

// --- Ouverture / fermeture ---

function openProfileModal() {
    const overlay = document.getElementById('profile-modal-overlay');
    overlay.style.display = 'flex';
    populateProfileModal();
}

function closeProfileModal() {
    document.getElementById('profile-modal-overlay').style.display = 'none';
}

function populateProfileModal() {
    if (!currentUser) return;

    // Pseudo
    const usernameInput = document.getElementById('profile-username-input');
    if (usernameInput) usernameInput.value = currentUser.username || '';

    // Élo
    const eloQuiz   = document.getElementById('profile-elo-quiz');
    const eloImages = document.getElementById('profile-elo-images');
    if (eloQuiz)   eloQuiz.textContent   = currentUser.elo_quiz   ?? '--';
    if (eloImages) eloImages.textContent = currentUser.elo_images ?? '--';

    // Avatar
    updateProfileAvatar(currentUser.avatar_url, currentUser.username);

    // Infos compte
    const accountInfo = document.getElementById('profile-account-info');
    if (accountInfo) {
        if (currentUser.email) {
            accountInfo.textContent = `📧 ${currentUser.email}${currentUser.google_id ? ' · Google' : ''}`;
        } else {
            accountInfo.innerHTML = `Mode invité — <a href="#" id="profile-link-account" style="color:#e94560;">Créer un compte</a> pour sauvegarder ta progression.`;
            document.getElementById('profile-link-account')?.addEventListener('click', (e) => {
                e.preventDefault();
                closeProfileModal();
                openAuthModal('register');
            });
        }
    }

    // Cacher erreurs/succès
    ['profile-username-error', 'profile-username-success'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.textContent = ''; }
    });
}

function updateProfileAvatar(avatarUrl, username) {
    const img         = document.getElementById('profile-avatar-img');
    const placeholder = document.getElementById('profile-avatar-placeholder');
    const topAvatar   = document.getElementById('top-player-avatar');

    if (avatarUrl) {
        if (img) {
            img.src = avatarUrl;
            img.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';

        // Mettre à jour le petit avatar dans le HUD
        if (topAvatar) {
            topAvatar.style.backgroundImage = `url(${avatarUrl})`;
            topAvatar.style.backgroundSize = 'cover';
            topAvatar.style.backgroundPosition = 'center';
            topAvatar.textContent = '';
        }
    } else {
        if (img) img.style.display = 'none';
        // Initiale du pseudo comme placeholder
        const initial = (username || '?')[0].toUpperCase();
        if (placeholder) {
            placeholder.style.display = 'flex';
            placeholder.textContent = initial;
        }
        if (topAvatar) {
            topAvatar.style.backgroundImage = '';
            topAvatar.textContent = initial;
        }
    }
}

// --- Fermeture ---
document.getElementById('btn-profile-close')?.addEventListener('click', closeProfileModal);
document.getElementById('profile-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('profile-modal-overlay')) closeProfileModal();
});

// --- Bouton paramètres → ouvre le profil ---
document.getElementById('btn-profile-settings')?.addEventListener('click', openProfileModal);

// --- Sauvegarde du pseudo ---
document.getElementById('btn-save-username')?.addEventListener('click', async () => {
    const input = document.getElementById('profile-username-input');
    const errorEl   = document.getElementById('profile-username-error');
    const successEl = document.getElementById('profile-username-success');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const username = input?.value.trim();
    if (!username) return;

    const btn = document.getElementById('btn-save-username');
    btn.disabled = true;
    btn.textContent = '...';

    try {
        const res = await fetch('/api/auth/profile/username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.error;
            errorEl.style.display = 'block';
        } else {
            currentUser.username = data.username;
            updateUserHUD();
            successEl.textContent = 'Pseudo mis à jour !';
            successEl.style.display = 'block';
            setTimeout(() => { successEl.style.display = 'none'; }, 3000);
        }
    } catch (err) {
        errorEl.textContent = 'Erreur réseau.';
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sauvegarder';
    }
});

// --- Upload avatar ---
document.getElementById('profile-avatar-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Vérification taille côté client
    if (file.size > 5 * 1024 * 1024) {
        showToast('❌ Fichier trop lourd (5 Mo max).');
        return;
    }

    // Aperçu immédiat avant l'upload
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = document.getElementById('profile-avatar-img');
        const placeholder = document.getElementById('profile-avatar-placeholder');
        if (img) { img.src = ev.target.result; img.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);

    showToast('⏳ Upload en cours...');

    try {
        const formData = new FormData();
        formData.append('avatar', file);

        const res = await fetch('/api/auth/profile/avatar', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(`❌ ${data.error}`);
        } else {
            currentUser.avatar_url = data.avatar_url;
            updateProfileAvatar(data.avatar_url, currentUser.username);
            showToast('✅ Photo de profil mise à jour !');
        }
    } catch (err) {
        showToast('❌ Erreur lors de l\'upload.');
    }

    // Reset input pour permettre de re-sélectionner le même fichier
    e.target.value = '';
});

// Appel initial pour afficher l'avatar dans le HUD dès le chargement
// (sera appelé après initUser() dans le flux existant)
function initProfileHUD() {
    if (currentUser) {
        updateProfileAvatar(currentUser.avatar_url, currentUser.username);
        updateUserHUD();
    }
}