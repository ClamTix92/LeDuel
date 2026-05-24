const socket = io();

// Profil du joueur courant (chargé depuis le serveur)
let currentUser = null;

// Au chargement de la page, on se connecte en tant qu'invité automatiquement
// (si déjà un vrai compte en session, le serveur le retourne directement)
async function initUser() {
  try {
    await fetch('/api/guest-login');
    const res = await fetch('/api/me');
    currentUser = await res.json();
    console.log('Connecté en tant que :', currentUser.username, '| Élo quiz:', currentUser.elo_quiz, '| Élo images:', currentUser.elo_images);

    // Affiche l'élo dans l'UI si les éléments existent
    const eloQuizEl = document.getElementById('elo-quiz');
    const eloImagesEl = document.getElementById('elo-images');
    if (eloQuizEl) eloQuizEl.textContent = currentUser.elo_quiz;
    if (eloImagesEl) eloImagesEl.textContent = currentUser.elo_images;

    initProfileHUD();

  } catch (err) {
    console.error('Erreur initUser :', err);
  }
}

initUser();

const displayArea = document.getElementById('display-area');
const quizDisplayArea = document.getElementById('quiz-display-area');
const quizQuestionText = document.getElementById('quiz-question-text');
const answerInput = document.getElementById('answer-input');
const passBtn = document.getElementById('pass-btn');

let myRoomCode = null;
let currentMode = 'images';

// État du match en cours (manches gagnantes)
let currentMatchRounds = 1;
let currentOpponentId = null;
let matchHistory = [];       // winnerId pour chaque manche terminée
let matchInProgress = false; // true entre deux manches d'un même match

// Historique des questions/réponses du match en cours (alimenté par le serveur).
// Utilisé par l'écran "Réponses" accessible depuis le lobby.
let currentMatchAnswers = [];

// Lit le champ matchAnswers d'un payload serveur et met à jour le cache local.
// Tous les events serveur qui modifient l'état du match (init-game, next-round,
// round-end, round-start, return-to-lobby, game-over) embarquent cet historique.
function updateMatchAnswers(payload) {
  if (payload && Array.isArray(payload.matchAnswers)) {
    currentMatchAnswers = payload.matchAnswers;
  }
}

/* ==========================================================
   CHRONOMÈTRE DU DUEL
   - Le serveur n'envoie une mise à jour qu'une fois par seconde
     (en secondes entières). Pour afficher les centièmes et animer
     une barre qui se vide en continu, on interpole côté client
     entre deux mises à jour serveur, via requestAnimationFrame.
   - Seul le joueur actif voit son temps décrémenter ; le temps
     de l'inactif reste figé.
   ========================================================== */
const timerState = {
  serverTimes: {},          // { playerId: secondes restantes (entier serveur) }
  activePlayerId: null,     // id du joueur dont le chrono décompte
  maxRoundTime: 45,         // valeur de départ d'une manche (pour la barre %)
  lastSyncAt: 0,            // performance.now() de la dernière réception serveur
  lastSyncedActiveValue: 0, // valeur du joueur actif à lastSyncAt
  rafHandle: null
};

// Met à jour l'état à partir des données serveur (init-game, round-start,
// next-round, timer-update). opts.resetMax = true pour les événements qui
// (re)démarrent une manche : on recalcule la valeur "plein" de la barre.
function syncTimer(times, activePlayerId, opts) {
  opts = opts || {};

  if (times) {
    // Avant d'écraser serverTimes, on capture la valeur interpolée courante
    // du joueur actif ACTUEL. Cela sert à éviter le saut visuel lors d'un
    // next-round : le serveur renvoie une valeur entière (ex. 34) alors que
    // le timer interpolé est à 33.47 → sans précaution on saute à 34:00.
    const prevActiveId = timerState.activePlayerId;
    const interpolatedNow = (prevActiveId != null && !opts.resetMax)
      ? getInterpolatedTime(prevActiveId)
      : null;

    timerState.serverTimes = Object.assign({}, times);

    if (opts.resetMax) {
      // Au début d'une manche les deux joueurs ont la même valeur :
      // c'est la valeur "plein" de la barre.
      const vals = Object.values(times).map(Number).filter(v => !isNaN(v));
      if (vals.length) timerState.maxRoundTime = Math.max.apply(null, vals);
    }

    // Si on n'est pas en resetMax et qu'on a une valeur interpolée en cours,
    // on la réutilise comme ancre pour le joueur actif (conservé ou nouveau).
    // Le nouveau joueur actif (passé en paramètre) hérite aussi de son
    // propre interpolatedValue (il était inactif donc sa valeur est exacte
    // côté serveur — pas de saut possible ; on utilise la valeur serveur).
    if (interpolatedNow !== null && prevActiveId != null) {
      // Remplacer la valeur serveur du joueur actif actuel par la valeur
      // interpolée, pour que lastSyncedActiveValue parte de là.
      timerState.serverTimes[prevActiveId] = interpolatedNow;
    }
  }

  if (activePlayerId !== undefined) {
    timerState.activePlayerId = activePlayerId;
  }

  // (Re)caler l'horloge d'interpolation sur "maintenant"
  timerState.lastSyncAt = performance.now();
  if (timerState.activePlayerId != null) {
    const v = timerState.serverTimes[timerState.activePlayerId];
    timerState.lastSyncedActiveValue = (typeof v === 'number') ? v : 0;
  }
  ensureTimerLoop();
}

// Temps affiché (float, en secondes) pour un joueur donné.
// Joueur actif : on retire le temps écoulé depuis la dernière synchro.
// Joueur inactif : valeur figée du serveur.
function getInterpolatedTime(playerId) {
  const raw = timerState.serverTimes[playerId];
  if (typeof raw !== 'number') return 0;
  if (playerId !== timerState.activePlayerId) return Math.max(0, raw);
  const elapsed = (performance.now() - timerState.lastSyncAt) / 1000;
  return Math.max(0, timerState.lastSyncedActiveValue - elapsed);
}

// Format "S:CC" — secondes sans padding, centièmes toujours sur 2 chiffres.
// Exemples : 45.00 -> "45:00", 5.07 -> "5:07", 0.00 -> "0:00"
// L'epsilon (1e-9) corrige les erreurs de flottants type 5.10*100 = 509.9999…
function formatTimerValue(value) {
  if (value < 0) value = 0;
  const totalCentis = Math.floor(value * 100 + 1e-9);
  const secs = Math.floor(totalCentis / 100);
  const centis = totalCentis % 100;
  return secs + ':' + String(centis).padStart(2, '0');
}

// Choix de la couleur en fonction du temps restant.
// > 10s  : vert
// (5;10] : orange
// <= 5s  : rouge
function timerColorClass(value) {
  if (value <= 5) return 'timer-red';
  if (value <= 10) return 'timer-orange';
  return 'timer-green';
}

// Met à jour la classe de couleur seulement quand elle change
// (transition CSS sur background-color = "léger dégradé").
function applyBarColor(barEl, value) {
  if (!barEl) return;
  const cls = timerColorClass(value);
  if (barEl._timerCls === cls) return;
  barEl.classList.remove('timer-green', 'timer-orange', 'timer-red');
  barEl.classList.add(cls);
  barEl._timerCls = cls;
}

// Boucle d'animation : recalcule le texte + la largeur de barre à chaque frame.
function renderTimerFrame() {
  const mySecsEl = document.getElementById('my-time-secs');
  const myCentisEl = document.getElementById('my-time-centis');
  const oppSecsEl = document.getElementById('opp-time-secs');
  const oppCentisEl = document.getElementById('opp-time-centis');
  const myBarEl = document.getElementById('timer-bar-me');
  const oppBarEl = document.getElementById('timer-bar-opp');
  if (!mySecsEl || !oppSecsEl) return;

  // Identifier l'adversaire à partir des times reçus.
  let oppId = null;
  for (const id in timerState.serverTimes) {
    if (id !== socket.id) { oppId = id; break; }
  }

  const myValue = getInterpolatedTime(socket.id);
  const oppValue = oppId ? getInterpolatedTime(oppId) : 0;

  // Écrire secondes et centièmes séparément pour que les deux-points
  // restent fixes (ils sont dans leur propre span .tv-sep).
  function renderSplit(secsEl, centisEl, value) {
    if (value < 0) value = 0;
    const totalCentis = Math.floor(value * 100 + 1e-9);
    const s = Math.floor(totalCentis / 100);
    const c = totalCentis % 100;
    secsEl.textContent = s;
    centisEl.textContent = String(c).padStart(2, '0');
  }

  renderSplit(mySecsEl, myCentisEl, myValue);
  renderSplit(oppSecsEl, oppCentisEl, oppValue);

  const max = timerState.maxRoundTime || 1;
  const myPct = Math.max(0, Math.min(100, (myValue / max) * 100));
  const oppPct = Math.max(0, Math.min(100, (oppValue / max) * 100));

  if (myBarEl) { myBarEl.style.width = myPct + '%'; applyBarColor(myBarEl, myValue); }
  if (oppBarEl) { oppBarEl.style.width = oppPct + '%'; applyBarColor(oppBarEl, oppValue); }
}

function ensureTimerLoop() {
  if (timerState.rafHandle != null) return;
  const tick = () => {
    renderTimerFrame();
    timerState.rafHandle = requestAnimationFrame(tick);
  };
  timerState.rafHandle = requestAnimationFrame(tick);
}

function stopTimerLoop() {
  if (timerState.rafHandle != null) {
    cancelAnimationFrame(timerState.rafHandle);
    timerState.rafHandle = null;
  }
}

/* ==========================================================
   AVATAR — état & DOM
   ========================================================== */
let myAvatarConfig = window.Avatar.load();
let opponentAvatarConfig = null; // sera reçu en jeu

const homeAvatarDisplay = document.getElementById('home-avatar-display');
const topPlayerAvatar = document.getElementById('top-player-avatar');
// const gameAvatarMe = document.getElementById('game-avatar-me');
// const gameAvatarOpp = document.getElementById('game-avatar-opp');
const avatarModalOverlay = document.getElementById('avatar-modal-overlay');
const avatarPreview = document.getElementById('avatar-preview');
const avatarOptions = document.getElementById('avatar-options');

// Affiche l'avatar à l'accueil dès le chargement
window.Avatar.renderInto(homeAvatarDisplay, myAvatarConfig);
window.Avatar.renderInto(topPlayerAvatar, myAvatarConfig);

// Marquer l'écran courant pour gérer l'affichage de l'avatar latéral
function setActiveScreen(screen) {
  document.body.classList.remove('screen-home', 'screen-mode', 'screen-lobby', 'screen-mm', 'screen-game');
  document.body.classList.add('screen-' + screen);
}
setActiveScreen('home'); // accueil par défaut

/* --- Modale de personnalisation --- */
let pendingAvatarConfig = null; // copie temporaire pendant l'édition

function buildAvatarOptionsUI() {
  const cfg = pendingAvatarConfig;
  const O = window.Avatar.OPTIONS;

  const skinHTML = O.skin.map(o =>
    `<div class="swatch ${cfg.skin === o.id ? 'active' : ''}"
          data-cat="skin" data-id="${o.id}"
          style="background:${o.color}"></div>`
  ).join('');

  const hairColHTML = O.hairColor.map(o =>
    `<div class="swatch ${cfg.hairColor === o.id ? 'active' : ''}"
          data-cat="hairColor" data-id="${o.id}"
          style="background:${o.color}"></div>`
  ).join('');

  const outfitHTML = O.outfit.map(o =>
    `<div class="swatch ${cfg.outfit === o.id ? 'active' : ''}"
          data-cat="outfit" data-id="${o.id}"
          style="background:${o.color}"></div>`
  ).join('');

  const hairStyleHTML = O.hairStyle.map(o =>
    `<button class="pill ${cfg.hairStyle === o.id ? 'active' : ''}"
             data-cat="hairStyle" data-id="${o.id}">${o.label}</button>`
  ).join('');

  const eyesHTML = O.eyes.map(o =>
    `<button class="pill ${cfg.eyes === o.id ? 'active' : ''}"
             data-cat="eyes" data-id="${o.id}">${o.label}</button>`
  ).join('');

  avatarOptions.innerHTML = `
    <div class="option-group">
      <p class="option-group-label">Couleur de peau</p>
      <div class="option-swatches">${skinHTML}</div>
    </div>
    <div class="option-group">
      <p class="option-group-label">Style de cheveux</p>
      <div class="option-pills">${hairStyleHTML}</div>
    </div>
    <div class="option-group">
      <p class="option-group-label">Couleur des cheveux</p>
      <div class="option-swatches">${hairColHTML}</div>
    </div>
    <div class="option-group">
      <p class="option-group-label">Tenue</p>
      <div class="option-swatches">${outfitHTML}</div>
    </div>
    <div class="option-group">
      <p class="option-group-label">Yeux</p>
      <div class="option-pills">${eyesHTML}</div>
    </div>
  `;
}

function refreshAvatarPreview() {
  window.Avatar.renderInto(avatarPreview, pendingAvatarConfig);
  window.Avatar.setState(avatarPreview, null);
}

function openAvatarModal() {
  pendingAvatarConfig = { ...myAvatarConfig };
  buildAvatarOptionsUI();
  refreshAvatarPreview();
  avatarModalOverlay.classList.add('active');
}

function closeAvatarModal() {
  avatarModalOverlay.classList.remove('active');
}

document.getElementById('btn-customize-avatar')?.addEventListener('click', openAvatarModal);
document.getElementById('btn-avatar-cancel')?.addEventListener('click', closeAvatarModal);

document.getElementById('btn-avatar-save')?.addEventListener('click', () => {
  myAvatarConfig = { ...pendingAvatarConfig };
  window.Avatar.save(myAvatarConfig);
  window.Avatar.renderInto(homeAvatarDisplay, myAvatarConfig);
  window.Avatar.renderInto(topPlayerAvatar, myAvatarConfig);
  closeAvatarModal();
});

// Fermer en cliquant en dehors de la modale
avatarModalOverlay?.addEventListener('click', e => {
  if (e.target === avatarModalOverlay) closeAvatarModal();
});

// Sélection d'options dans la modale (délégation)
avatarOptions?.addEventListener('click', e => {
  const el = e.target.closest('[data-cat][data-id]');
  if (!el) return;
  const cat = el.dataset.cat;
  const id = el.dataset.id;
  pendingAvatarConfig[cat] = id;
  buildAvatarOptionsUI();
  refreshAvatarPreview();
});

// Boutons de test des animations (preview)
document.getElementById('preview-test-win')?.addEventListener('click', () => {
  window.Avatar.setState(avatarPreview, 'win');
  setTimeout(() => window.Avatar.setState(avatarPreview, null), 2000);
});
document.getElementById('preview-test-lose')?.addEventListener('click', () => {
  window.Avatar.setState(avatarPreview, 'lose');
  setTimeout(() => window.Avatar.setState(avatarPreview, null), 2500);
});

/* Petite fonction utilitaire : déclencher une animation temporaire */
function flashAvatarState(el, state, duration) {
  if (!el) return;
  window.Avatar.setState(el, state);
  setTimeout(() => window.Avatar.setState(el, null), duration || 1800);
}

const modeRules = {
  quiz: [
    "Une question de culture générale s'affiche.",
    "Si tu réponds juste, c'est à ton adversaire de jouer.",
    "Chaque joueur a son propre compteur de temps.",
    "Le premier dont le temps atteint 0 perd la partie.",
    "Les accents ne sont pas nécessaires pour répondre.",
  ],
  images: [
    "Une image s'affiche — reconnais ce qu'elle représente.",
    "Si tu réponds juste, c'est à ton adversaire de jouer.",
    "Chaque joueur a son propre compteur de temps.",
    "Le premier dont le temps atteint 0 perd la partie.",
    "Les accents ne sont pas nécessaires pour répondre.",
  ],
};

const themeModeMap = {
  athletes: 'images',
  stades: 'images',
  logospremierleague: 'images',
  logosligue1: 'images',
  logoslaliga: 'images',
  logosbundesliga: 'images',
  logosseriea: 'images',
  logostop14: 'images',
  logosnationsrugby: 'images',
  logosnba: 'images',
  logosnfl: 'images',
  logosnhl: 'images',
  logosmlb: 'images',
  logosmls: 'images',
  logosnrl: 'images',
  voitures: 'images',
  //politiquefr: 'images',
  //hommesetat: 'images',
  animaux: 'images',
  chiens: 'images',
  chats: 'images',
  plats: 'images',
  fruits_legumes: 'images',
  fleurs_plantes: 'images',
  drapeaux: 'images',
  departementsnoms: 'images',
  departementsnumeros: 'images',
  departementscarte: 'images',
  regionscarte: 'images',
  capitales: 'images',
  capitalespays: 'images',
  formespays: 'images',
  etatsusa: 'images',
  chefslieux: 'images',
  chefslieuxnoms: 'images',
  repliques: 'images',
  langues: 'images',
  quizculture: 'quiz',
  quizhistoire: 'quiz',
  quizgeographie: 'quiz',
  quizsport: 'quiz',
  quizsciences: 'quiz',
  quizcinema: 'quiz',
  quiztout: 'quiz',
};

function updateRules(mode) {
  const list = document.getElementById('rules-list');
  if (!list) return;
  list.innerHTML = modeRules[mode].map(r => `<li>${r}</li>`).join('');
}

function setActiveChoice(groupSelector, activeBtn) {
  document.querySelectorAll(`${groupSelector} .choice-btn`).forEach(btn => {
    btn.classList.remove('active-choice');
  });
  if (activeBtn) activeBtn.classList.add('active-choice');
}

function applyModeFilter(mode) {
  const themeButtons = document.querySelectorAll('#theme-choice-group .theme-choice');
  themeButtons.forEach(btn => {
    const theme = btn.dataset.theme;
    const matches = themeModeMap[theme] === mode;
    btn.style.display = matches ? 'inline-flex' : 'none';
    if (!matches) btn.classList.remove('active-choice');
  });

  const firstVisible = [...themeButtons].find(btn => btn.style.display !== 'none');
  if (firstVisible) {
    setActiveChoice('#theme-choice-group', firstVisible);
  }
}

function syncStartButton() {
  const startBtn = document.getElementById('btn-start-custom');
  const selectedModeBtn = document.querySelector('#mode-choice-group .choice-btn.active-choice');
  const selectedThemeBtn = document.querySelector('#theme-choice-group .choice-btn.active-choice');
  const selectedTimerBtn = document.querySelector('#timer-choice-group .choice-btn.active-choice');
  const selectedRoundsBtn = document.querySelector('#rounds-choice-group .choice-btn.active-choice');

  const enabled = !!selectedModeBtn && !!selectedThemeBtn && !!selectedTimerBtn && !!selectedRoundsBtn;
  if (startBtn) startBtn.disabled = !enabled;
}

function refreshLobbyThemeVisibility() {
  const selectedModeBtn = document.querySelector('#mode-choice-group .choice-btn.active-choice');
  if (!selectedModeBtn) return;
  applyModeFilter(selectedModeBtn.dataset.mode);
  syncStartButton();
}

function goToHome(mode) {
  currentMode = mode;
  const label = document.getElementById('home-mode-label');

  if (mode === 'quiz') {
    label.textContent = 'Mode Quiz';
    label.style.color = '#f857a6';
  } else {
    label.textContent = 'Mode Images';
    label.style.color = '#e94560';
  }

  const selectMode = document.getElementById('select-mode');
  if (selectMode) selectMode.value = mode;

  updateRules(mode);

  document.getElementById('mode-select-container').style.display = 'none';
  document.getElementById('home-container').style.display = 'block';
  setActiveScreen('mode');
}

document.getElementById('card-images').addEventListener('click', () => goToHome('images'));
document.getElementById('card-quiz').addEventListener('click', () => goToHome('quiz'));

document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToHome(card.dataset.mode);
    }
  });
});

document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = -y / rect.height * 16;
    const rotateY = x / rect.width * 16;
    card.style.transform = `translateY(-12px) scale(1.07) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    card.style.perspective = '600px';
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.perspective = '';
  });
});

const privateRoomOverlay = document.getElementById('private-room-overlay');
const privateRoomClose = document.getElementById('private-room-close');
const privateCreateConfirm = document.getElementById('private-create-confirm');
const privateJoinConfirm = document.getElementById('private-join-confirm');
const sheetRoomCode = document.getElementById('sheet-room-code');
const homeToast = document.getElementById('home-toast');
let toastTimeout = null;

function showToast(message) {
  if (!homeToast) return;
  homeToast.textContent = message;
  homeToast.classList.add('active');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => homeToast.classList.remove('active'), 2600);
}

function openPrivateRoomSheet(prefillCode = '') {
  if (!privateRoomOverlay) return;
  privateRoomOverlay.classList.add('active');
  privateRoomOverlay.setAttribute('aria-hidden', 'false');
  if (prefillCode && sheetRoomCode) sheetRoomCode.value = prefillCode.toUpperCase();
  setTimeout(() => (prefillCode ? sheetRoomCode : privateCreateConfirm)?.focus(), 40);
}

function closePrivateRoomSheet() {
  if (!privateRoomOverlay) return;
  privateRoomOverlay.classList.remove('active');
  privateRoomOverlay.setAttribute('aria-hidden', 'true');
}

document.getElementById('btn-create-room-home').addEventListener('click', () => {
  socket.emit('create-room', { avatar: myAvatarConfig });
});
document.getElementById('btn-private-from-mode')?.addEventListener('click', () => {
  socket.emit('create-room', { avatar: myAvatarConfig });
});
privateRoomClose?.addEventListener('click', closePrivateRoomSheet);
privateRoomOverlay?.addEventListener('click', e => {
  if (e.target === privateRoomOverlay) closePrivateRoomSheet();
});

privateCreateConfirm?.addEventListener('click', () => {
  privateCreateConfirm.disabled = true;
  privateCreateConfirm.textContent = 'CRÉATION...';
  socket.emit('create-room', { avatar: myAvatarConfig });
});

function joinPrivateRoomFromInput(inputEl) {
  const code = (inputEl?.value || '').trim().toUpperCase();
  if (code.length !== 4) {
    showToast('Entre un code de 4 lettres pour rejoindre un salon.');
    openPrivateRoomSheet(code);
    return;
  }
  socket.emit('join-room', { code, avatar: myAvatarConfig });
}

document.getElementById('private-join-form')?.addEventListener('submit', e => {
  e.preventDefault();
  joinPrivateRoomFromInput(document.getElementById('input-room-code'));
});

privateJoinConfirm?.addEventListener('click', () => joinPrivateRoomFromInput(sheetRoomCode));
sheetRoomCode?.addEventListener('keydown', e => {
  if (e.key === 'Enter') joinPrivateRoomFromInput(sheetRoomCode);
});

const profileSettingsBtn = document.getElementById('btn-profile-settings');
profileSettingsBtn?.addEventListener('click', openAvatarModal);

// L'engrenage ouvre la modale de connexion
const authGearBtn = document.getElementById('btn-auth-gear');
authGearBtn?.addEventListener('click', () => {
  document.getElementById('btn-auth-open')?.click();
});

const mascotButton = document.getElementById('mascot-button');
mascotButton?.addEventListener('click', () => {
  mascotButton.classList.remove('mascot-pop');
  void mascotButton.offsetWidth;
  mascotButton.classList.add('mascot-pop');
  showToast('Défi surprise : lance une partie privée et impose un thème à ton adversaire !');
});

document.getElementById('btn-back-home').addEventListener('click', () => {
  document.getElementById('home-container').style.display = 'none';
  document.getElementById('mode-select-container').style.display = 'flex';
  setActiveScreen('home');
});

document.getElementById('btn-back-lobby').addEventListener('click', () => {
  // On prévient le serveur qu'on quitte la room avant de revenir à l'accueil
  if (myRoomCode) {
    socket.emit('leave-room', { code: myRoomCode });
    myRoomCode = null;
  }
  document.getElementById('lobby-container').style.display = 'none';
  document.getElementById('mode-select-container').style.display = 'flex';
  setActiveScreen('home');
});

document.getElementById('btn-matchmaking').addEventListener('click', () => {
  const selectedBtns = document.querySelectorAll('#mm-rounds-choice-group .choice-btn.active-choice');
  if (selectedBtns.length === 0) return;
  const acceptedRounds = [...selectedBtns].map(b => parseInt(b.dataset.rounds, 10));

  document.getElementById('home-container').style.display = 'none';
  document.getElementById('matchmaking-container').style.display = 'block';
  setActiveScreen('mm');
  socket.emit('join-matchmaking', { avatar: myAvatarConfig, acceptedRounds, mode: currentMode });
});

document.getElementById('btn-back-matchmaking').addEventListener('click', () => {
  socket.emit('leave-matchmaking');
  document.getElementById('matchmaking-container').style.display = 'none';
  document.getElementById('home-container').style.display = 'block';
  setActiveScreen('mode');
  document.getElementById('queue-status').style.display = 'block';
  document.getElementById('vs-screen').style.display = 'none';
  // Reset la sélection de formats pour la prochaine recherche
  document.querySelectorAll('#mm-rounds-choice-group .choice-btn.active-choice')
    .forEach(b => b.classList.remove('active-choice'));
  document.getElementById('btn-matchmaking').disabled = true;
});

// Retour pendant l'écran de transition (3-2-1) : on annule la partie déjà initialisée
// côté serveur et on revient au bon endroit selon le contexte (lobby privé ou accueil).
document.getElementById('btn-back-transition').addEventListener('click', () => {
  clearTransitionTimers();
  document.getElementById('transition-container').style.display = 'none';

  // La partie a déjà été initialisée côté serveur → on l'annule proprement.
  socket.emit('abort-game');

  if (myRoomCode) {
    // Salon privé : retour au salon, en conservant l'état BO3/BO5 si le duel
    // avait déjà commencé.
    if (currentMatchRounds > 1) {
      matchInProgress = true;
      updateLobbyMatchStatus({ forceVisible: true });
    }
    returnToLobbyUI();
  } else {
    // Matchmaking : retour à l'accueil
    document.getElementById('mode-select-container').style.display = 'flex';
    setActiveScreen('home');
  }
});

document.getElementById('mm-rounds-choice-group').addEventListener('click', e => {
  const btn = e.target.closest('.choice-btn');
  if (!btn) return;
  // Toggle : cliquer une fois active, recliquer désactive
  btn.classList.toggle('active-choice');
  // Le bouton matchmaking s'active dès qu'au moins un format est sélectionné
  const anySelected = document.querySelectorAll('#mm-rounds-choice-group .choice-btn.active-choice').length > 0;
  document.getElementById('btn-matchmaking').disabled = !anySelected;
});

// Diffuse aux autres joueurs du salon les paramètres en cours.
// Appelée quand l'hôte change le mode, le thème, le chrono ou les manches.
function broadcastLobbySettings() {
  if (!myRoomCode) return;
  const hostSettings = document.getElementById('host-settings');
  if (!hostSettings || hostSettings.dataset.role !== 'host') return;

  const modeBtn = document.querySelector('#mode-choice-group .choice-btn.active-choice');
  const themeBtn = document.querySelector('#theme-choice-group .choice-btn.active-choice');
  const timerBtn = document.querySelector('#timer-choice-group .choice-btn.active-choice');
  const roundsBtn = document.querySelector('#rounds-choice-group .choice-btn.active-choice');
  const arcadeBtn = document.getElementById('btn-arcade-mode');
  const formatBtn = document.querySelector('#format-choice-group .choice-btn.active-choice');
  const arcadeOn = arcadeBtn && arcadeBtn.classList.contains('is-on');

  socket.emit('lobby-settings-update', {
    code: myRoomCode,
    mode: modeBtn ? modeBtn.dataset.mode : null,
    theme: themeBtn ? themeBtn.dataset.theme : null,
    timer: timerBtn ? parseInt(timerBtn.dataset.timer, 10) : null,
    rounds: roundsBtn ? parseInt(roundsBtn.dataset.rounds, 10) : null,
    arcadeMode: !!arcadeOn,
    format: arcadeOn && formatBtn ? formatBtn.dataset.format : '1v1'
  });
}

document.getElementById('mode-choice-group').addEventListener('click', e => {
  const btn = e.target.closest('.choice-btn');
  if (!btn) return;
  if (document.getElementById('host-settings').dataset.role === 'guest') return;
  setActiveChoice('#mode-choice-group', btn);
  applyModeFilter(btn.dataset.mode);
  syncStartButton();
  broadcastLobbySettings();
});

document.getElementById('theme-choice-group').addEventListener('click', e => {
  const btn = e.target.closest('.choice-btn');
  if (!btn || btn.style.display === 'none') return;
  if (document.getElementById('host-settings').dataset.role === 'guest') return;
  setActiveChoice('#theme-choice-group', btn);
  syncStartButton();
  broadcastLobbySettings();
});

document.getElementById('timer-choice-group').addEventListener('click', e => {
  const btn = e.target.closest('.choice-btn');
  if (!btn) return;
  if (document.getElementById('host-settings').dataset.role === 'guest') return;
  setActiveChoice('#timer-choice-group', btn);
  syncStartButton();
  broadcastLobbySettings();
});

document.getElementById('rounds-choice-group').addEventListener('click', e => {
  const btn = e.target.closest('.choice-btn');
  if (!btn) return;
  if (document.getElementById('host-settings').dataset.role === 'guest') return;
  // Ne pas rediffuser si le groupe est verrouillé (entre deux manches)
  if (document.getElementById('rounds-choice-group').classList.contains('locked')) return;
  setActiveChoice('#rounds-choice-group', btn);
  syncStartButton();
  broadcastLobbySettings();
});

/* ================================================================
   MODE ARCADE — toggle on/off + sélection du format
   ----------------------------------------------------------------
   Pour l'instant, le format choisi n'est pas envoyé au serveur :
   la logique réseau pourra être ajoutée plus tard, quand chaque
   format aura ses propres règles. On gère ici uniquement l'UI.
   ================================================================ */
const arcadeToggleBtn  = document.getElementById('btn-arcade-mode');
const arcadeFormatBlock = document.getElementById('arcade-format-block');
const formatChoiceGroup = document.getElementById('format-choice-group');

function setArcadeMode(isOn) {
  arcadeToggleBtn.classList.toggle('is-on', isOn);
  arcadeToggleBtn.setAttribute('aria-checked', isOn ? 'true' : 'false');
  arcadeFormatBlock.hidden = !isOn;

  // Si on rallume le mode arcade, on s'assure qu'un format reste sélectionné.
  if (isOn) {
    const anyActive = formatChoiceGroup.querySelector('.choice-btn.active-choice');
    if (!anyActive) {
      const first = formatChoiceGroup.querySelector('.choice-btn');
      if (first) first.classList.add('active-choice');
    }
  }
}

arcadeToggleBtn.addEventListener('click', () => {
  if (document.getElementById('host-settings').dataset.role === 'guest') return;
  setArcadeMode(!arcadeToggleBtn.classList.contains('is-on'));
  broadcastLobbySettings();
});

formatChoiceGroup.addEventListener('click', e => {
  const btn = e.target.closest('.choice-btn');
  if (!btn) return;
  if (document.getElementById('host-settings').dataset.role === 'guest') return;
  setActiveChoice('#format-choice-group', btn);
  broadcastLobbySettings();
});

document.getElementById('btn-start-custom').addEventListener('click', () => {
  const themeBtn = document.querySelector('#theme-choice-group .choice-btn.active-choice');
  const modeBtn = document.querySelector('#mode-choice-group .choice-btn.active-choice');
  const timerBtn = document.querySelector('#timer-choice-group .choice-btn.active-choice');
  const roundsBtn = document.querySelector('#rounds-choice-group .choice-btn.active-choice');

  if (!themeBtn || !modeBtn || !timerBtn || !roundsBtn) return;

  const theme = themeBtn.dataset.theme;
  const mode = modeBtn.dataset.mode;
  const timer = parseInt(timerBtn.dataset.timer, 10);
  const rounds = parseInt(roundsBtn.dataset.rounds, 10);

  socket.emit('start-game', {
    code: myRoomCode,
    theme,
    timer,
    mode,
    rounds
  });
});

// Normalise les payloads room-created/room-joined : le serveur envoie désormais
// { code, matchState }, mais on accepte aussi l'ancienne forme string (compat).
function normalizeRoomPayload(payload) {
  if (typeof payload === 'string') return { code: payload, matchState: null };
  if (payload && typeof payload === 'object') {
    return { code: payload.code, matchState: payload.matchState || null };
  }
  return { code: null, matchState: null };
}

// Restaure l'état d'un match en cours dans le lobby : score, label
// "Manche X/Y", et historique des réponses pour l'écran Réponses.
// Renvoie true si un match a été restauré, false sinon.
function applyMatchStateFromServer(matchState) {
  if (!matchState) return false;
  const rounds = Number(matchState.rounds || 1);
  if (rounds <= 1) return false;

  const history = Array.isArray(matchState.matchHistory) ? matchState.matchHistory : [];
  matchHistory = history.slice();
  currentMatchRounds = rounds;
  matchInProgress = true;
  currentMatchAnswers = Array.isArray(matchState.matchAnswers) ? matchState.matchAnswers.slice() : [];

  // Réafficher le bandeau Manche X/Y + score + verrou des boutons rounds.
  updateLobbyMatchStatus({
    nextRound: matchState.currentRound,
    rounds: rounds,
    forceVisible: true
  });
  return true;
}

socket.on('room-created', payload => {
  const { code, matchState } = normalizeRoomPayload(payload);
  if (!code) return;
  myRoomCode = code;

  const restored = applyMatchStateFromServer(matchState);
  if (!restored) resetLobbyMatchStatus();

  closePrivateRoomSheet();
  if (privateCreateConfirm) {
    privateCreateConfirm.disabled = false;
    privateCreateConfirm.textContent = 'CRÉER UN SALON';
  }
  document.getElementById('mode-select-container').style.display = 'none';
  document.getElementById('home-container').style.display = 'none';
  document.getElementById('lobby-container').style.display = 'flex';
  setActiveScreen('lobby');
  document.getElementById('display-room-code').innerText = code;
  document.getElementById('host-settings').style.display = 'block';
  document.getElementById('host-settings').dataset.role = 'host';
  const guestNote = document.getElementById('guest-waiting-note');
  if (guestNote) guestNote.style.display = 'none';

  // Si on restaure un match, on ne réécrase pas les boutons : on conserve
  // les réglages déjà transmis par le serveur (mode/theme/timer/rounds via
  // matchState). Sinon, on applique les valeurs par défaut habituelles.
  if (restored && matchState) {
    if (matchState.mode) {
      const modeBtn = document.querySelector(`#mode-choice-group .choice-btn[data-mode="${matchState.mode}"]`);
      if (modeBtn) { setActiveChoice('#mode-choice-group', modeBtn); applyModeFilter(matchState.mode); }
    }
    if (matchState.theme) {
      const themeBtn = document.querySelector(`#theme-choice-group .choice-btn[data-theme="${matchState.theme}"]`);
      if (themeBtn) setActiveChoice('#theme-choice-group', themeBtn);
    }
    if (matchState.timer) {
      const timerBtn = document.querySelector(`#timer-choice-group .choice-btn[data-timer="${matchState.timer}"]`);
      if (timerBtn) setActiveChoice('#timer-choice-group', timerBtn);
    }
    if (matchState.rounds) {
      const roundsBtn = document.querySelector(`#rounds-choice-group .choice-btn[data-rounds="${matchState.rounds}"]`);
      if (roundsBtn) setActiveChoice('#rounds-choice-group', roundsBtn);
    }
    syncStartButton();
  } else {
    const defaultMode = currentMode === 'quiz' ? 'quiz' : 'images';
    const defaultTheme = defaultMode === 'quiz' ? 'quizculture' : 'athletes';
    const defaultModeBtn = document.querySelector(`#mode-choice-group .choice-btn[data-mode="${defaultMode}"]`);
    const defaultThemeBtn = document.querySelector(`#theme-choice-group .choice-btn[data-theme="${defaultTheme}"]`);
    const defaultTimerBtn = document.querySelector('#timer-choice-group .choice-btn[data-timer="45"]');
    const defaultRoundsBtn = document.querySelector('#rounds-choice-group .choice-btn[data-rounds="3"]');

    if (defaultModeBtn) setActiveChoice('#mode-choice-group', defaultModeBtn);
    applyModeFilter(defaultMode);
    if (defaultThemeBtn) setActiveChoice('#theme-choice-group', defaultThemeBtn);
    if (defaultTimerBtn) setActiveChoice('#timer-choice-group', defaultTimerBtn);
    if (defaultRoundsBtn) setActiveChoice('#rounds-choice-group', defaultRoundsBtn);
    syncStartButton();
  }
});

socket.on('room-joined', payload => {
  const { code, matchState } = normalizeRoomPayload(payload);
  if (!code) return;
  myRoomCode = code;

  const restored = applyMatchStateFromServer(matchState);
  if (!restored) resetLobbyMatchStatus();

  closePrivateRoomSheet();
  document.getElementById('mode-select-container').style.display = 'none';
  document.getElementById('home-container').style.display = 'none';
  document.getElementById('lobby-container').style.display = 'flex';
  setActiveScreen('lobby');
  document.getElementById('display-room-code').innerText = code;
  // L'invité voit les paramètres du salon comme l'hôte, mais en lecture seule.
  document.getElementById('host-settings').style.display = 'block';
  document.getElementById('host-settings').dataset.role = 'guest';
  const guestNote = document.getElementById('guest-waiting-note');
  if (guestNote) guestNote.style.display = 'block';
});

// Compteur de joueurs actifs maintenu en mémoire (l'élément DOM `room-player-count`
// a été supprimé : l'info vit désormais dans le panneau latéral). Cette valeur
// est utilisée par syncStartButton() et autres checks "au moins 2 joueurs".
let activePlayerCount = 1;

socket.on('room-update', payload => {
  const playerCount = payload && payload.playerCount;
  const hostId = payload && payload.hostId;
  if (typeof playerCount === 'number') activePlayerCount = playerCount;
  // Compat : si jamais l'ancien élément est encore présent dans le DOM
  // (vieux templates en cache), on continue à le mettre à jour.
  const legacyCountEl = document.getElementById('room-player-count');
  if (legacyCountEl) legacyCountEl.innerText = playerCount;

  // Si le serveur indique qui est l'hôte et que c'est nous, basculer l'UI
  // en mode hôte (par exemple si l'hôte précédent vient de quitter).
  const hostSettings = document.getElementById('host-settings');
  const guestNote = document.getElementById('guest-waiting-note');
  if (hostSettings && hostId) {
    const iAmHost = hostId === socket.id;
    const previousRole = hostSettings.dataset.role;
    hostSettings.dataset.role = iAmHost ? 'host' : 'guest';
    if (guestNote) guestNote.style.display = iAmHost ? 'none' : 'block';
    // Si on vient de devenir hôte, s'assurer qu'on diffuse nos paramètres.
    if (iAmHost && previousRole !== 'host' && playerCount >= 2) {
      broadcastLobbySettings();
    }
  }

  const startBtn = document.getElementById('btn-start-custom');
  if (startBtn && playerCount >= 2) {
    startBtn.disabled = false;
    if (matchInProgress && currentMatchRounds > 1) {
      updateLobbyMatchStatus({ forceVisible: true });
    } else {
      startBtn.innerText = 'LANCER LE DUEL';
    }
  }
  // Si un invité vient de rejoindre, l'hôte rediffuse ses paramètres
  // pour que l'UI de l'invité parte en phase avec celle de l'hôte.
  if (hostSettings && hostSettings.dataset.role === 'host' && playerCount >= 2) {
    broadcastLobbySettings();
  }
});

// L'invité reçoit les paramètres en direct depuis l'hôte et reflète son UI.
// L'hôte n'écoute pas son propre événement (le serveur ne le lui renvoie pas).
socket.on('lobby-settings-update', payload => {
  if (!payload) return;
  const hostSettings = document.getElementById('host-settings');
  // Sécurité : seul un invité doit appliquer ces mises à jour
  if (!hostSettings || hostSettings.dataset.role !== 'guest') return;

  if (payload.mode) {
    const modeBtn = document.querySelector(`#mode-choice-group .choice-btn[data-mode="${payload.mode}"]`);
    if (modeBtn) {
      setActiveChoice('#mode-choice-group', modeBtn);
      applyModeFilter(payload.mode);
    }
  }
  if (payload.theme) {
    const themeBtn = document.querySelector(`#theme-choice-group .choice-btn[data-theme="${payload.theme}"]`);
    if (themeBtn) setActiveChoice('#theme-choice-group', themeBtn);
  }
  if (payload.timer != null) {
    const timerBtn = document.querySelector(`#timer-choice-group .choice-btn[data-timer="${payload.timer}"]`);
    if (timerBtn) setActiveChoice('#timer-choice-group', timerBtn);
  }
  if (payload.rounds != null) {
    const roundsBtn = document.querySelector(`#rounds-choice-group .choice-btn[data-rounds="${payload.rounds}"]`);
    if (roundsBtn) setActiveChoice('#rounds-choice-group', roundsBtn);
  }
  // Mode arcade : on/off
  if (typeof payload.arcadeMode === 'boolean') {
    setArcadeMode(payload.arcadeMode);
  }
  // Format actif (visible uniquement quand l'arcade est on)
  if (payload.format) {
    const formatBtn = document.querySelector(`#format-choice-group .choice-btn[data-format="${payload.format}"]`);
    if (formatBtn) setActiveChoice('#format-choice-group', formatBtn);
  }
});

/* ================================================================
   PANNEAU DES JOUEURS (Salon Privé) — sidebar de droite
   ----------------------------------------------------------------
   Le serveur émet `lobby-state` à chaque changement (arrivée, départ,
   déplacement, changement de format). Le client redessine le panneau
   à partir de cet état et offre 2 façons de déplacer son pseudo :
     • Drag & drop (desktop)
     • Clic sur le pseudo → menu contextuel (fallback mobile/tactile)
   ================================================================ */

// Miroir de la config serveur. À synchroniser si tu ajoutes/change un format.
const LOBBY_FORMAT_CONFIG = {
  '1v1':     { teams: ['free'],          showTeamHeaders: false },
  '1v1v1':   { teams: ['free'],          showTeamHeaders: false },
  '1v2':     { teams: ['team1', 'team2'], showTeamHeaders: true  },
  'format4': { teams: ['free'],          showTeamHeaders: false },
  'format5': { teams: ['free'],          showTeamHeaders: false },
  'format6': { teams: ['free'],          showTeamHeaders: false },
  'format7': { teams: ['free'],          showTeamHeaders: false },
  'format8': { teams: ['free'],          showTeamHeaders: false }
};

// État reçu du serveur (initialisé vide).
let lobbyState = {
  members: [],
  format: '1v1',
  arcadeMode: false,
  maxActivePlayers: 2,
  maxSpectators: 10,
  hostId: null
};

// Renvoie la config (avec fallback sur 1v1 si format inconnu).
function getLobbyFormatConfig(format) {
  return LOBBY_FORMAT_CONFIG[format] || LOBBY_FORMAT_CONFIG['1v1'];
}

// Renvoie le slot du joueur actif courant (utile pour colorer rouge/blanc).
function getMySlot() {
  const me = lobbyState.members.find(m => m.socketId === socket.id);
  return me ? me.slot : null;
}

// Construit un chip <div> pour un membre.
function buildPlayerChip(member, isOpponent, canMove) {
  const chip = document.createElement('div');
  chip.className = 'lobby-player-chip';
  chip.dataset.memberId = member.socketId;
  chip.dataset.draggable = canMove ? 'true' : 'false';
  if (member.isHost) chip.classList.add('has-crown');
  if (isOpponent) chip.classList.add('is-opponent');
  if (member.slot === 'spectator') chip.classList.add('is-spectator');

  if (member.isHost) {
    const crown = document.createElement('span');
    crown.className = 'lobby-player-chip-crown';
    crown.textContent = '👑';
    crown.setAttribute('aria-label', 'Hôte du salon');
    chip.appendChild(crown);
  }

  const name = document.createElement('span');
  name.className = 'lobby-player-chip-name';
  name.textContent = member.nickname || 'Joueur';
  chip.appendChild(name);

  if (canMove) {
    chip.setAttribute('draggable', 'true');
    chip.title = 'Glisse pour changer d\'équipe ou clique pour ouvrir le menu';
  }
  return chip;
}

// Détermine si le joueur courant peut déplacer ce membre.
//   • Soi-même : toujours.
//   • Hôte : peut déplacer n'importe qui.
function canMoveMember(memberId) {
  if (memberId === socket.id) return true;
  return lobbyState.hostId === socket.id;
}

// (Re)construit l'intégralité du panneau à partir de lobbyState.
function renderLobbyPanel() {
  const headerCountEl = document.getElementById('lobby-active-count');
  const headerMaxEl   = document.getElementById('lobby-active-max');
  const playersZone   = document.getElementById('lobby-players-zone');
  const specToggle    = document.getElementById('lobby-spectators-toggle');
  const specCountEl   = document.getElementById('lobby-spectators-count');
  const specList      = document.getElementById('lobby-spectators-list');

  if (!playersZone || !specList) return;

  // 1) Découpage membres : actifs vs spectateurs.
  const active     = lobbyState.members.filter(m => m.slot !== 'spectator');
  const spectators = lobbyState.members.filter(m => m.slot === 'spectator');

  // 2) En-tête X/Y
  headerCountEl.textContent = active.length;
  headerMaxEl.textContent = `/${lobbyState.maxActivePlayers} Joueurs`;

  // 3) Compteur spectateurs
  specCountEl.textContent = `${spectators.length}/${lobbyState.maxSpectators}`;

  // 4) Zone des actifs
  playersZone.innerHTML = '';
  const cfg = getLobbyFormatConfig(lobbyState.format);
  const mySlot = getMySlot();

  // Pour la coloration (mes coéquipiers / adversaires)
  // - 1v2 (équipes) : mêmes membres de mon équipe = blanc, autre équipe = rouge
  // - autres formats : tous les autres = rouge, moi = blanc
  const isOpponentOf = (member) => {
    if (member.socketId === socket.id) return false;
    if (cfg.teams.length === 2 && mySlot && mySlot !== 'spectator') {
      return member.slot !== mySlot;
    }
    return true;
  };

  if (cfg.showTeamHeaders) {
    // Format en équipes : on construit une section par équipe.
    // En mode équipes, la zone joueurs n'est plus un drop-target global :
    // seules les sections d'équipe le sont, pour cibler précisément 1 ou 2.
    delete playersZone.dataset.slot;

    // On met l'équipe du joueur courant en premier (s'il est actif).
    const order = cfg.teams.slice();
    if (mySlot && order.includes(mySlot)) {
      order.sort((a, b) => (a === mySlot ? -1 : (b === mySlot ? 1 : 0)));
    }
    // Mais on garde les labels "Équipe 1"/"Équipe 2" attachés au slot d'origine.
    order.forEach(teamSlot => {
      const block = document.createElement('div');
      block.className = 'lobby-team-block';
      // Tout le bloc d'équipe sert de drop-target (header + chips + empty hint)
      block.dataset.slot = `dropzone-${teamSlot}`;

      // En-tête équipe (style pilule sombre + texte jaune)
      const header = document.createElement('div');
      header.className = 'lobby-panel-pill lobby-team-header';
      const labelIdx = cfg.teams.indexOf(teamSlot) + 1;
      header.textContent = `Équipe ${labelIdx}`;
      block.appendChild(header);

      // Membres de l'équipe (moi en premier si je suis dans cette équipe)
      const teamMembers = active.filter(m => m.slot === teamSlot);
      teamMembers.sort((a, b) => {
        if (a.socketId === socket.id) return -1;
        if (b.socketId === socket.id) return 1;
        return 0;
      });

      if (teamMembers.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'lobby-team-empty-hint';
        hint.textContent = '(vide)';
        block.appendChild(hint);
        block.classList.add('lobby-team-block-empty');
      } else {
        teamMembers.forEach(m => {
          block.appendChild(buildPlayerChip(m, isOpponentOf(m), canMoveMember(m.socketId)));
        });
      }
      playersZone.appendChild(block);
    });
  } else {
    // Format à liste plate (1v1, 1v1v1, …) : pas de label d'équipe.
    // La zone entière devient un drop-target pour revenir actif.
    playersZone.dataset.slot = `dropzone-${cfg.teams[0]}`;

    // Mon pseudo en premier, puis les autres.
    const sorted = active.slice().sort((a, b) => {
      if (a.socketId === socket.id) return -1;
      if (b.socketId === socket.id) return 1;
      return 0;
    });
    sorted.forEach(m => {
      playersZone.appendChild(buildPlayerChip(m, isOpponentOf(m), canMoveMember(m.socketId)));
    });
  }

  // 5) Liste spectateurs
  specList.innerHTML = '';
  spectators.forEach(m => {
    specList.appendChild(buildPlayerChip(m, false, canMoveMember(m.socketId)));
  });

  // 6) Sync du bouton "LANCER LE DUEL" — en 1v1 il faut 2 joueurs actifs
  const startBtn = document.getElementById('btn-start-custom');
  if (startBtn && lobbyState.format === '1v1') {
    startBtn.disabled = active.length < 2;
  }
}

// === Spectateurs : repli/déploiement ===
const spectatorsToggleEl = document.getElementById('lobby-spectators-toggle');
if (spectatorsToggleEl) {
  spectatorsToggleEl.addEventListener('click', (e) => {
    // Si le clic provient d'un chip enfant, on ne déplie pas.
    if (e.target.closest('.lobby-player-chip')) return;
    const expanded = spectatorsToggleEl.getAttribute('aria-expanded') === 'true';
    spectatorsToggleEl.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    const list = document.getElementById('lobby-spectators-list');
    if (list) list.hidden = expanded;
  });
}

// === Drag & drop ===
let dragSourceMemberId = null;

function getDropTargetSlot(el) {
  if (!el) return null;
  const targetEl = el.closest('[data-slot]');
  if (!targetEl) return null;
  const ds = targetEl.dataset.slot;
  if (!ds) return null;
  // Les zones de drop sont préfixées "dropzone-" pour éviter les ambiguïtés
  if (ds.startsWith('dropzone-')) return ds.replace('dropzone-', '');
  return null;
}

function sendMemberMove(memberId, targetSlot) {
  if (!myRoomCode || !memberId || !targetSlot) return;
  socket.emit('lobby-member-move', {
    code: myRoomCode,
    memberId,
    targetSlot
  });
}

const lobbyPanel = document.getElementById('lobby-players-panel');
if (lobbyPanel) {
  // dragstart : on mémorise quel membre est en train d'être déplacé.
  lobbyPanel.addEventListener('dragstart', (e) => {
    const chip = e.target.closest('.lobby-player-chip');
    if (!chip || chip.dataset.draggable !== 'true') {
      e.preventDefault();
      return;
    }
    dragSourceMemberId = chip.dataset.memberId;
    chip.classList.add('is-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragSourceMemberId); } catch (err) { /* IE */ }
    }
  });

  lobbyPanel.addEventListener('dragend', (e) => {
    const chip = e.target.closest('.lobby-player-chip');
    if (chip) chip.classList.remove('is-dragging');
    dragSourceMemberId = null;
    lobbyPanel.querySelectorAll('.lobby-drop-target').forEach(el => el.classList.remove('lobby-drop-target'));
  });

  lobbyPanel.addEventListener('dragover', (e) => {
    if (!dragSourceMemberId) return;
    const slot = getDropTargetSlot(e.target);
    if (!slot) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    // Surligner la zone visée
    lobbyPanel.querySelectorAll('.lobby-drop-target').forEach(el => el.classList.remove('lobby-drop-target'));
    const targetEl = e.target.closest('[data-slot]');
    if (targetEl) targetEl.classList.add('lobby-drop-target');
  });

  lobbyPanel.addEventListener('dragleave', (e) => {
    // On enlève le surlignage si on quitte vraiment la zone.
    const targetEl = e.target.closest('[data-slot]');
    if (targetEl && !targetEl.contains(e.relatedTarget)) {
      targetEl.classList.remove('lobby-drop-target');
    }
  });

  lobbyPanel.addEventListener('drop', (e) => {
    const slot = getDropTargetSlot(e.target);
    if (!slot || !dragSourceMemberId) return;
    e.preventDefault();
    sendMemberMove(dragSourceMemberId, slot);
    lobbyPanel.querySelectorAll('.lobby-drop-target').forEach(el => el.classList.remove('lobby-drop-target'));
    dragSourceMemberId = null;
  });
}

// === Fallback clic (tactile / accessibilité) : ouvre un petit menu ===
let lobbyActionMenuEl = null;

function closeLobbyActionMenu() {
  if (lobbyActionMenuEl) {
    lobbyActionMenuEl.remove();
    lobbyActionMenuEl = null;
    document.removeEventListener('click', onDocClickCloseMenu, true);
  }
}

function onDocClickCloseMenu(e) {
  if (lobbyActionMenuEl && !lobbyActionMenuEl.contains(e.target)) closeLobbyActionMenu();
}

function openLobbyActionMenu(chip) {
  closeLobbyActionMenu();
  const memberId = chip.dataset.memberId;
  if (!memberId) return;
  const member = lobbyState.members.find(m => m.socketId === memberId);
  if (!member) return;

  const cfg = getLobbyFormatConfig(lobbyState.format);
  const menu = document.createElement('div');
  menu.className = 'lobby-action-menu';

  const buildBtn = (label, targetSlot) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.disabled = (member.slot === targetSlot);
    b.addEventListener('click', () => {
      sendMemberMove(memberId, targetSlot);
      closeLobbyActionMenu();
    });
    return b;
  };

  if (cfg.showTeamHeaders) {
    cfg.teams.forEach((slot, i) => menu.appendChild(buildBtn(`Rejoindre Équipe ${i + 1}`, slot)));
  } else {
    // Liste plate : la seule action utile est passer/quitter spectateur,
    // donc on n'ajoute pas de bouton "Rejoindre les joueurs" si déjà actif.
    if (member.slot === 'spectator') {
      menu.appendChild(buildBtn('Rejoindre les joueurs', cfg.teams[0]));
    }
  }
  menu.appendChild(buildBtn('Devenir spectateur', 'spectator'));

  // Position : juste sous le chip
  const rect = chip.getBoundingClientRect();
  document.body.appendChild(menu);
  // On positionne après ajout pour pouvoir lire menu.offsetWidth si besoin
  const left = Math.min(rect.left, window.innerWidth - menu.offsetWidth - 10);
  menu.style.left = Math.max(10, left) + 'px';
  menu.style.top = (rect.bottom + 6) + 'px';

  lobbyActionMenuEl = menu;
  // Petit délai pour éviter que le clic d'ouverture ne soit attrapé par le close.
  setTimeout(() => document.addEventListener('click', onDocClickCloseMenu, true), 0);
}

if (lobbyPanel) {
  lobbyPanel.addEventListener('click', (e) => {
    const chip = e.target.closest('.lobby-player-chip');
    if (!chip) return;
    // Sur le bouton de repli des spectateurs, ne pas réagir
    if (e.target.closest('#lobby-spectators-toggle') && !chip) return;
    if (chip.dataset.draggable !== 'true') return;
    e.stopPropagation();
    openLobbyActionMenu(chip);
  });
}

// === Réception de l'état du salon depuis le serveur ===
socket.on('lobby-state', payload => {
  if (!payload) return;
  lobbyState = {
    members: Array.isArray(payload.members) ? payload.members : [],
    format: payload.format || '1v1',
    arcadeMode: !!payload.arcadeMode,
    maxActivePlayers: payload.maxActivePlayers || 2,
    maxSpectators: payload.maxSpectators || 10,
    hostId: payload.hostId || null
  };
  renderLobbyPanel();
});

socket.on('error-message', msg => {
  if (privateCreateConfirm) {
    privateCreateConfirm.disabled = false;
    privateCreateConfirm.textContent = 'CRÉER UN SALON';
  }
  showToast(msg || 'Une erreur est survenue.');
});

// État de l'écran de transition (compte à rebours avant le duel)
let transitionTimers = []; // ids de setTimeout pour pouvoir tout annuler proprement
let transitionRunId = 0;   // invalide les callbacks decode/requestAnimationFrame d'une ancienne transition

const transitionCountdownSources = [
  'assets/transition_trois.png',
  'assets/transition_deux.png',
  'assets/transition_un.png'
];

// Précharge les trois chiffres dès que le script est chargé. Ce n'est pas
// obligatoire pour fonctionner, mais cela réduit fortement le risque de frame
// blanche au premier affichage.
transitionCountdownSources.forEach(src => {
  const preloader = new Image();
  preloader.src = src;
});

function clearTransitionTimers() {
  transitionRunId += 1;
  transitionTimers.forEach(id => clearTimeout(id));
  transitionTimers = [];
}

// Affiche l'écran de transition (3 → 2 → 1 sur 2 secondes), puis appelle onDone().
function runIntroTransition(mode, onDone) {
  clearTransitionTimers();
  const runId = transitionRunId;

  // Cacher les autres écrans
  document.getElementById('mode-select-container').style.display = 'none';
  document.getElementById('home-container').style.display = 'none';
  document.getElementById('lobby-container').style.display = 'none';
  document.getElementById('matchmaking-container').style.display = 'none';
  document.getElementById('game-container').style.display = 'none';
  const answersC = document.getElementById('answers-container');
  if (answersC) answersC.style.display = 'none';

  // Label "Mode Images" ou "Mode Quiz" (style identique au home-mode-label)
  const label = document.getElementById('transition-mode-label');
  if (mode === 'quiz') {
    label.textContent = 'Mode Quiz';
    label.style.color = '#f857a6';
  } else {
    label.textContent = 'Mode Images';
    label.style.color = '#e94560';
  }

  const img = document.getElementById('transition-countdown-img');
  const container = document.getElementById('transition-container');

  // Important : vider explicitement l'ancien src AVANT d'afficher le conteneur.
  // Sinon le navigateur peut conserver visuellement l'ancien bitmap (souvent le "1")
  // pendant quelques frames, le temps de décoder le nouveau "3".
  img.classList.remove('pop');
  img.style.visibility = 'hidden';
  img.style.opacity = '0';
  img.removeAttribute('src');

  // Afficher l'écran de transition avec l'image encore masquée. Le premier chiffre
  // ne sera révélé qu'après décodage de sa vraie source.
  container.style.display = 'flex';
  setActiveScreen('mm'); // même contexte que matchmaking (avatar latéral caché)

  let numberToken = 0;

  // Helper : change l'image affichée + relance l'animation "pop".
  // Le token empêche une promesse decode() lente de révéler un ancien chiffre.
  function showNumber(src) {
    const token = ++numberToken;
    img.classList.remove('pop');
    img.style.visibility = 'hidden';
    img.style.opacity = '0';
    img.removeAttribute('src');
    void img.offsetWidth; // forcer un reflow pour pouvoir relancer l'animation CSS

    img.src = src;

    const reveal = () => {
      if (runId !== transitionRunId || token !== numberToken) return;
      img.classList.remove('pop');
      void img.offsetWidth;
      img.style.visibility = 'visible';
      img.style.opacity = '';
      img.classList.add('pop');
    };

    if (typeof img.decode === 'function') {
      img.decode().catch(() => { }).then(() => requestAnimationFrame(reveal));
    } else {
      requestAnimationFrame(reveal);
    }
  }

  // Total : 2000 ms répartis sur 3 chiffres → ~666 ms chacun
  const STEP = 2000 / 3;

  showNumber(transitionCountdownSources[0]);
  transitionTimers.push(setTimeout(() => showNumber(transitionCountdownSources[1]), STEP));
  transitionTimers.push(setTimeout(() => showNumber(transitionCountdownSources[2]), STEP * 2));

  // Fin de la transition → on cache et on enchaîne sur le duel
  transitionTimers.push(setTimeout(() => {
    if (runId !== transitionRunId) return;
    container.style.display = 'none';
    img.classList.remove('pop');
    img.style.visibility = 'hidden';
    img.style.opacity = '0';
    img.removeAttribute('src');
    if (typeof onDone === 'function') onDone();
  }, 2000));
}

const THEME_LABELS = {
  // Images
  athletes: 'Athlètes Français',
  stades: 'Stades de Foot',
  logospremierleague: 'Premier League',
  logosligue1: 'Ligue 1',
  logoslaliga: 'La Liga',
  logosbundesliga: 'Bundesliga',
  logosseriea: 'Serie A',
  logostop14: 'Top 14',
  logosnationsrugby: 'Nations Rugby',
  logosnba: 'NBA',
  logosnfl: 'NFL',
  logosnhl: 'NHL',
  logosmlb: 'MLB',
  logosmls: 'MLS',
  logosnrl: 'NRL',
  voitures: 'Marques de Voitures',
  animaux: 'Animaux',
  chiens: 'Chiens',
  chats: 'Chats',
  plats: 'Plats',
  fruits_legumes: 'Fruits & Légumes',
  fleurs_plantes: 'Fleurs & Plantes',
  repliques: 'Réplique de films',
  drapeaux: 'Drapeaux Pays',
  departementsnoms: 'Départements (Noms)',
  departementsnumeros: 'Départements (Numéros)',
  departementscarte: 'Départements (Carte)',
  regionscarte: 'Régions (Carte)',
  capitales: 'Capitales',
  capitalespays: 'Capitales (Nom du pays)',
  formespays: 'Formes des pays',
  etatsusa: 'États des USA',
  chefslieux: 'Chefs-lieux',
  chefslieuxnoms: 'Chefs-lieux (Nom du département)',
  langues: 'Langues',
  // Quiz
  quiztout: 'Tout',
  quizculture: 'Culture Générale',
  quizhistoire: 'Histoire',
  quizgeographie: 'Géographie',
  quizsport: 'Sport',
  quizsciences: 'Sciences',
  quizcinema: 'Cinéma',
};

const THEME_HINTS = {
  // Images
  athletes: "Des athlètes français vont s'afficher, reconnais-les !",
  stades: "Des stades de football du monde entier vont s'afficher, reconnais-les !",
  logospremierleague: "Des logos de clubs de Premier League vont s'afficher, reconnais-les !",
  logosligue1: "Des logos de clubs de Ligue 1 vont s'afficher, reconnais-les !",
  logoslaliga: "Des logos de clubs de La Liga vont s'afficher, reconnais-les !",
  logosbundesliga: "Des logos de clubs de Bundesliga vont s'afficher, reconnais-les !",
  logosseriea: "Des logos de clubs de Serie A vont s'afficher, reconnais-les !",
  logostop14: "Des logos de clubs de Top 14 vont s'afficher, reconnais-les !",
  logosnationsrugby: "Des logos de nations de rugby vont s'afficher, reconnais-les !",
  logosnba: "Des logos de franchises NBA vont s'afficher, reconnais-les !",
  logosnfl: "Des logos de franchises NFL vont s'afficher, reconnais-les !",
  logosnhl: "Des logos de franchises NHL vont s'afficher, reconnais-les !",
  logosmlb: "Des logos de franchises MLB vont s'afficher, reconnais-les !",
  logosmls: "Des logos de clubs de MLS vont s'afficher, reconnais-les !",
  logosnrl: "Des logos de clubs de NRL vont s'afficher, reconnais-les !",
  voitures: "Des logos de marques de voitures vont s'afficher, reconnais-les !",
  animaux: "Des photos d'animaux vont s'afficher, reconnais l'espèce !",
  chiens: "Des photos de chiens vont s'afficher, reconnais la race !",
  chats: "Des photos de chats vont s'afficher, reconnais la race !",
  plats: "Des photos de plats du monde vont s'afficher, reconnais-les !",
  fruits_legumes: "Des photos de fruits et légumes vont s'afficher, reconnais-les !",
  fleurs_plantes: "Des photos de fleurs et plantes vont s'afficher, reconnais-les !",
  repliques: "Des répliques cultes de films vont s'afficher, devine de quel film elles viennent !",
  drapeaux: "Des drapeaux de pays vont s'afficher, reconnais le pays !",
  departementsnoms: "Des noms de départements français vont s'afficher, donne leur numéro !",
  departementsnumeros: "Des numéros de départements français vont s'afficher, donne leur nom !",
  departementscarte: "Des formes de départements français vont s'afficher, reconnais-les !",
  regionscarte: "Des formes de régions françaises vont s'afficher, reconnais-les !",
  capitales: "Des pays vont s'afficher, donne leur capitale !",
  capitalespays: "Des capitales vont s'afficher, donne le pays correspondant !",
  formespays: "Des silhouettes de pays vont s'afficher, reconnais-les !",
  etatsusa: "Des silhouettes d'états américains vont s'afficher, reconnais-les !",
  chefslieux: "Des noms de départements vont s'afficher, donne leur chef-lieu !",
  chefslieuxnoms: "Des chefs-lieux vont s'afficher, donne le nom du département !",
  langues: "Des extraits de texte dans différentes langues vont s'afficher, reconnais la langue !",
  // Quiz
  quiztout: "Des questions de tous les thèmes vont s'enchaîner, trouve la bonne réponse !",
  quizculture: "Des questions de culture générale vont s'enchaîner, trouve la bonne réponse !",
  quizhistoire: "Des questions d'histoire vont s'enchaîner, trouve la bonne réponse !",
  quizgeographie: "Des questions de géographie vont s'enchaîner, trouve la bonne réponse !",
  quizsport: "Des questions sur le sport vont s'enchaîner, trouve la bonne réponse !",
  quizsciences: "Des questions de sciences vont s'enchaîner, trouve la bonne réponse !",
  quizcinema: "Des questions sur le cinéma vont s'enchaîner, trouve la bonne réponse !",
};

// Match trouvé en matchmaking : afficher l'écran VS et lancer le compte à rebours
socket.on('match-found', data => {
  myRoomCode = data.roomCode;

  // Affiche l'écran "VS" dans le container matchmaking
  document.getElementById('queue-status').style.display = 'none';
  document.getElementById('vs-screen').style.display = 'block';

  // Affiche les pseudos des deux joueurs
  const p1NameEl = document.getElementById('vs-p1-name');
  const p2NameEl = document.getElementById('vs-p2-name');
  if (p1NameEl) p1NameEl.textContent = data.p1Name;
  if (p2NameEl) p2NameEl.textContent = data.p2Name;

  // Affiche le mode et le thème
  const modeEl = document.getElementById('vs-mode');
  const themeEl = document.getElementById('match-theme');
  if (modeEl) modeEl.textContent = data.mode;
  if (themeEl) themeEl.textContent = THEME_LABELS[data.theme] || data.theme;

  const hintEl = document.getElementById('match-hint');
  if (hintEl) hintEl.textContent = THEME_HINTS[data.theme] || '';

  console.log('Match trouvé !', data);

  // Après 3 secondes, on signale au serveur qu'on est prêt → il lance le match
  setTimeout(() => {
    socket.emit('matchmaking-ready', { code: data.roomCode });
  }, 3000);
});

socket.on('init-game', data => {
  // On mémorise l'état du match avant la transition. Ainsi, si le joueur clique
  // sur "Retour" pendant le 3-2-1, le lobby peut déjà afficher Manche X/X + score.
  currentMode = data.mode || currentMode;
  currentMatchRounds = data.rounds || 1;
  matchHistory = data.matchHistory || [];
  matchInProgress = currentMatchRounds > 1;
  updateMatchAnswers(data);

  if (data.avatars) {
    currentOpponentId = null;
    for (const id in data.avatars) {
      if (id !== socket.id) { currentOpponentId = id; break; }
    }
  }

  // On enchaîne d'abord par l'écran de transition (3-2-1), puis on affiche le duel.
  runIntroTransition(currentMode, () => {
    document.getElementById('game-container').style.display = 'block';
    setActiveScreen('game');
    currentMode = data.mode;

    // === Avatars en jeu ===
    if (data.avatars) {
      const myCfg = data.avatars[socket.id] || myAvatarConfig;
      let oppCfg = null;
      let oppId = null;
      for (const id in data.avatars) {
        if (id !== socket.id) { oppCfg = data.avatars[id]; oppId = id; break; }
      }
      if (!oppCfg) oppCfg = window.Avatar.DEFAULT;
      opponentAvatarConfig = oppCfg;
      currentOpponentId = oppId;
      //       window.Avatar.renderInto(gameAvatarMe, myCfg, { flip: false });
      //       window.Avatar.renderInto(gameAvatarOpp, oppCfg, { flip: true });
    }

    // === Score et label de manche ===
    currentMatchRounds = data.rounds || 1;
    matchHistory = data.matchHistory || [];
    updateMatchScore(matchHistory);
    showScoreBlock('game-score-block', currentMatchRounds > 1);
    updateMatchRoundLabel(data.currentRound || 1, data.rounds || 1);

    const hintMessages = {
      athletes: 'Les accents ne sont pas nécessaires<br>Tapez uniquement les noms de famille !',
      stades: 'Les accents ne sont pas nécessaires<br>Le nom du stade le plus populaire est attendu.',
      logospremierleague: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou du club est attendu.',
      logosligue1: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou du club est attendu.',
      logoslaliga: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou du club est attendu.',
      logosbundesliga: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou du club est attendu.',
      logosseriea: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou du club est attendu.',
      logostop14: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou du club est attendu.',
      logosnationsrugby: 'Les accents ne sont pas nécessaires<br>Le nom du pays ou le surnom de l\'équipe est attendu.',
      logosnba: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou de la franchise est attendu.',
      logosnfl: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou de la franchise est attendu.',
      logosnhl: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou de la franchise est attendu.',
      logosmlb: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou de la franchise est attendu.',
      logosmls: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou de la franchise est attendu.',
      logosnrl: 'Les accents ne sont pas nécessaires<br>Le nom de la ville ou de la franchise est attendu.',
      voitures: 'Les accents ne sont pas nécessaires',
      //politiquefr: 'Les accents ne sont pas nécessaires',
      //hommesetat: 'Les accents ne sont pas nécessaires',
      animaux: 'Les accents ne sont pas nécessaires<br>Tape le nom de l\'animal au singulier.',
      chiens: 'Les accents ne sont pas nécessaires<br>Tape le nom de la race de chien.',
      chats: 'Les accents ne sont pas nécessaires<br>Tape le nom de la race de chat.',
      plats: 'Les accents ne sont pas nécessaires<br>Tape le nom du plat ou de la spécialité culinaire.',
      fruits_legumes: 'Les accents ne sont pas nécessaires<br>Tape le nom du fruit ou du légume.',
      fleurs_plantes: 'Les accents ne sont pas nécessaires<br>Tape le nom de la fleur ou de la plante.',
      repliques: 'De quel film est tirée cette réplique ?<br>Titre français ou titre original accepté.',
      drapeaux: 'Les accents ne sont pas nécessaires',
      departementsnoms: 'Tape le numéro du département.<br>Pour les départements à un chiffre, 1 et 01 sont acceptés.',
      departementsnumeros: 'Les accents ne sont pas nécessaires.<br>Tape le nom du département.',
      departementscarte: 'Les accents ne sont pas nécessaires.<br>Tape le nom du département surligné sur la carte.',
      regionscarte: 'Les accents ne sont pas nécessaires.<br>Tape le nom de la région surlignée sur la carte.',
      capitales: 'Les accents ne sont pas nécessaires.<br>Tape le nom de la capitale du pays affiché.',
      capitalespays: 'Les accents ne sont pas nécessaires.<br>Tape le nom du pays correspondant à la capitale.',
      etatsusa: 'Les accents ne sont pas nécessaires.<br>Tape le nom de l\'État américain surligné. Les réponses en français et en anglais sont acceptées.',
      formespays: 'Les accents ne sont pas nécessaires.<br>Tape le nom du pays dont la forme est affichée. (la plus grande île pour les pays insulaires)',
      chefslieux: 'Les accents ne sont pas nécessaires.<br>Tape le nom du chef-lieu du département affiché.',
      chefslieuxnoms: 'Les accents ne sont pas nécessaires.<br>Tape le nom du département correspondant au chef-lieu.',
      langues: 'Quelle langue est affichée ?<br>Réponse acceptée en français ou en anglais (les accents et variantes courantes sont tolérés).',
      quizculture: 'Culture Générale. Les accents ne sont pas nécessaires.',
      quizhistoire: 'Histoire. Les accents ne sont pas nécessaires.',
      quizgeographie: 'Géographie. Les accents ne sont pas nécessaires.',
      quizsport: 'Sport. Les accents ne sont pas nécessaires.',
      quizsciences: 'Sciences. Les accents ne sont pas nécessaires.',
      quizcinema: 'Cinéma. Les accents ne sont pas nécessaires.',
    };

    document.querySelector('.hint-text').innerHTML = hintMessages[data.theme] || 'Les accents ne sont pas nécessaires';

    displayQuestion(data.question, currentMode);

    if (data.activePlayerId === socket.id) {
      answerInput.disabled = false;
      answerInput.style.opacity = 1;
      answerInput.placeholder = 'Tape ta réponse ici...';
      answerInput.value = '';
      answerInput.focus();
      passBtn.disabled = false;
      passBtn.style.opacity = 1;
    } else {
      answerInput.disabled = true;
      answerInput.style.opacity = 0.5;
      answerInput.placeholder = "Au tour de l'adversaire...";
      answerInput.value = '';
      passBtn.disabled = true;
      passBtn.style.opacity = 0.5;
    }

    // Démarre / réinitialise le chronomètre interpolé (nouvelle manche).
    syncTimer(data.times, data.activePlayerId, { resetMax: true });
  }); // fin du callback runIntroTransition
});

function displayQuestion(question, mode) {
  if (!question) return;
  if (mode === 'quiz') {
    displayArea.style.display = 'none';
    quizDisplayArea.style.display = 'flex';
    quizQuestionText.innerText = question.text;
  } else if (question.image) {
    quizDisplayArea.style.display = 'none';
    displayArea.style.display = 'flex';
    displayArea.innerHTML = `<img src="${question.image}" style="max-width:100%;border-radius:10px;">`;
  } else {
    // Mode images mais question texte (ex. thèmes Départements, Langues) :
    // on réutilise la zone "image" et on affiche un texte avec la même police
    // (var(--font-title)) que les titres de paramètres, via la classe dédiée.
    // La taille s'adapte à la longueur du texte (court = numéro très grand,
    // long = nom de département rétréci pour tenir dans la zone).
    quizDisplayArea.style.display = 'none';
    displayArea.style.display = 'flex';
    const txt = question.text || '';
    let cls = 'display-area-text';
    let extraAttr = '';
    if (question.lang) {
      // Thème "Langues" : phrase complète dans un script potentiellement non-latin.
      // `dir="auto"` gère automatiquement les langues RTL (arabe, hébreu, persan, ourdou, yiddish, pachto…).
      // L'attribut `lang` aide le navigateur à choisir un fallback de police adapté
      // (devanagari, han, hangul, géorgien, etc.) si la police principale ne couvre pas le script.
      cls += ' is-sentence';
      extraAttr = ` lang="${escapeHTML(question.lang)}" dir="auto"`;
    } else if (/^\d/.test(txt)) {
      // `is-short` cible les numéros de département ("13", "2A", "974") : ils
      // commencent toujours par un chiffre et s'affichent en très grand. Les noms
      // de villes courts (Nice, Pau, Gap, Auch…) gardent la taille par défaut.
      cls += ' is-short';
    } else if (txt.length > 16) {
      cls += ' is-long';
    }
    displayArea.innerHTML = `<p class="${cls}"${extraAttr}>${escapeHTML(txt)}</p>`;
  }
}

socket.on('timer-update', times => {
  // Resynchronise l'interpolation sur la nouvelle valeur serveur,
  // sans toucher au joueur actif (toujours la même manche).
  syncTimer(times);
});

socket.on('next-round', data => {
  updateMatchAnswers(data);
  if (data.nextQuestion) displayQuestion(data.nextQuestion, currentMode);

  // === Animation : celui qui a répondu juste lève les bras ===
  //  if (data.correctPlayerId) {
  //     const winnerEl = data.correctPlayerId === socket.id ? gameAvatarMe : gameAvatarOpp;
  //    flashAvatarState(winnerEl, 'win', 1400);
  // }

  // Bascule du chrono sur le nouveau joueur actif (les temps ne sont pas
  // remis à zéro : on continue dans la même manche, pas de resetMax).
  if (data.times) syncTimer(data.times, data.activePlayerId);

  if (data.activePlayerId === socket.id) {
    answerInput.disabled = false;
    answerInput.style.opacity = 1;
    answerInput.placeholder = 'Tape ta réponse ici...';
    answerInput.focus();
    passBtn.disabled = false;
    passBtn.style.opacity = 1;
  } else {
    answerInput.disabled = true;
    answerInput.style.opacity = 0.5;
    answerInput.placeholder = "Au tour de l'adversaire...";
    passBtn.disabled = true;
    passBtn.style.opacity = 0.5;
  }
});

// Mauvaise réponse : seul le joueur fautif pleure (le serveur émettra cet event)
//socket.on('wrong-answer', data => {
//  if (!data || !data.playerId) return;
//   const sadEl = data.playerId === socket.id ? gameAvatarMe : gameAvatarOpp;
//  flashAvatarState(sadEl, 'lose', 1500);
//});

// Passer une question : pleurs sur celui qui passe
//socket.on('passing', data => {
// if (!data || !data.playerId) return;
//   const sadEl = data.playerId === socket.id ? gameAvatarMe : gameAvatarOpp;
//  flashAvatarState(sadEl, 'lose', 2800);
//});

passBtn.addEventListener('click', () => {
  answerInput.disabled = true;
  passBtn.disabled = true;
  answerInput.value = '';
  socket.emit('pass-question');
});

/* ==========================================================
   SCORE DE MATCH — affichage numérique (lobby + écran duel)
   ========================================================== */

// Met à jour les chiffres du score dans les deux écrans à partir
// de l'historique des manches (array de winnerId).
function updateMatchScore(history) {
  let meWins = 0, oppWins = 0;
  if (Array.isArray(history)) {
    history.forEach(wId => {
      if (wId === socket.id) meWins++;
      else oppWins++;
    });
  }
  ['game-score-me', 'lobby-score-me'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = meWins;
  });
  ['game-score-opp', 'lobby-score-opp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = oppWins;
  });
}

// Affiche ou masque un bloc score identifié par son id.
function showScoreBlock(blockId, visible) {
  const el = document.getElementById(blockId);
  if (el) el.style.display = visible ? 'flex' : 'none';
}

// Affiche "Manche X" sous le logo dans l'écran de jeu.
// En BO1, on n'affiche rien.
function updateMatchRoundLabel(currentRound, rounds) {
  const label = document.getElementById('game-round-label');
  if (!label) return;
  if (rounds <= 1) { label.textContent = ''; return; }
  label.textContent = `Manche ${currentRound}/${rounds}`;
}

function getLobbyRoundNumber(fallbackRound) {
  const rounds = currentMatchRounds || 1;
  const raw = Number(fallbackRound || (Array.isArray(matchHistory) ? matchHistory.length + 1 : 1));
  return Math.max(1, Math.min(rounds, raw || 1));
}

// Met à jour l'en-tête du lobby quand un match en plusieurs manches est en cours
// ou vient d'être interrompu par "Retour".
function updateLobbyMatchStatus(options = {}) {
  const rounds = Number(options.rounds || currentMatchRounds || 1);
  currentMatchRounds = rounds;

  const nextRound = getLobbyRoundNumber(options.nextRound);
  const shouldShow = rounds > 1 && (options.forceVisible || matchInProgress || matchHistory.length > 0);

  updateMatchScore(matchHistory);
  showScoreBlock('lobby-score-block', shouldShow);

  const settingsTitle = document.getElementById('settings-title');
  if (settingsTitle) {
    settingsTitle.innerText = shouldShow
      ? `Paramètres de la partie - Manche ${nextRound}/${rounds}`
      : 'Paramètres de la partie';
  }

  const roundsGroup = document.getElementById('rounds-choice-group');
  if (roundsGroup) roundsGroup.classList.toggle('locked', shouldShow);

  const startBtn = document.getElementById('btn-start-custom');
  if (startBtn && shouldShow) {
    // Texte mis à jour même si on est seul, pour rester en phase avec l'état
    // du match. Le bouton ne devient cliquable qu'avec 2 joueurs présents :
    // sinon start-game côté serveur s'appuierait sur room.players[1] absent.
    startBtn.disabled = activePlayerCount < 2;
    startBtn.innerText = `LANCER LA MANCHE ${nextRound}`;
  }
}

function resetLobbyMatchStatus() {
  matchHistory = [];
  matchInProgress = false;
  currentMatchRounds = 1;
  currentOpponentId = null;
  currentMatchAnswers = [];
  updateMatchScore([]);
  showScoreBlock('lobby-score-block', false);

  const settingsTitle = document.getElementById('settings-title');
  if (settingsTitle) settingsTitle.innerText = 'Paramètres de la partie';

  document.getElementById('rounds-choice-group')?.classList.remove('locked');

  const startBtn = document.getElementById('btn-start-custom');
  if (startBtn) startBtn.innerText = 'LANCER LE DUEL';
}

// === round-end : afficher le résultat 2s, puis attendre return-to-lobby ===
socket.on('round-end', data => {
  matchHistory = data.matchHistory || [];
  updateMatchAnswers(data);
  updateMatchScore(matchHistory);

  // Stoppe la boucle d'animation du chrono (la manche est finie).
  stopTimerLoop();

  // Masquer la zone de jeu
  answerInput.disabled = true;
  passBtn.disabled = true;
  displayArea.style.display = 'none';
  quizDisplayArea.style.display = 'none';
  document.querySelector('.hint-text').style.display = 'none';
  document.getElementById('input-area').style.display = 'none';
  document.getElementById('scoreboard').style.display = 'none';
  // On masque uniquement le score de match placé dans le coin du duel.
  // Les chiffres de #round-transition-score restent affichés dans l'écran de résultat.
  showScoreBlock('game-score-block', false);
  document.querySelector('#game-container .game-logo')?.closest('.match-header')?.style.setProperty('display', 'none');

  // Afficher le résultat de la manche
  const iWon = data.roundWinnerId === socket.id;
  const result = document.getElementById('round-transition-result');
  const scoreMe = document.getElementById('round-transition-score-me');
  const scoreOpp = document.getElementById('round-transition-score-opp');

  result.innerText = iWon ? 'Manche remportée !' : 'Manche perdue';
  result.style.color = iWon ? '#4dd0e1' : '#e94560';
  scoreMe.innerText = data.score[socket.id] || 0;
  scoreOpp.innerText = (currentOpponentId && data.score[currentOpponentId]) || 0;

  document.getElementById('round-transition-screen').style.display = 'block';
});

// === return-to-lobby : retour au salon entre deux manches ===
socket.on('return-to-lobby', data => {
  matchHistory = data.matchHistory || [];
  currentMatchRounds = data.rounds || currentMatchRounds || 1;
  matchInProgress = currentMatchRounds > 1;
  updateMatchAnswers(data);

  // Nettoyer l'UI de jeu (sans réinitialiser l'état du match)
  document.getElementById('round-transition-screen').style.display = 'none';
  document.querySelector('#game-container .game-logo')?.closest('.match-header')?.style.removeProperty('display');
  resetGameUI(true); // true = garder matchHistory/currentOpponentId/currentMatchRounds
  document.getElementById('game-container').style.display = 'none';

  updateLobbyMatchStatus({
    nextRound: data.nextRound,
    rounds: data.rounds,
    forceVisible: true
  });

  returnToLobbyUI();
});

// === round-start : manche suivante en matchmaking (relance automatique) ===
socket.on('round-start', data => {
  matchHistory = data.matchHistory || [];
  updateMatchAnswers(data);

  // Cacher l'écran de résultat
  document.getElementById('round-transition-screen').style.display = 'none';

  // Restaurer le match-header et la zone de jeu
  const matchHeader = document.querySelector('#game-container .match-header');
  if (matchHeader) matchHeader.style.removeProperty('display');
  document.querySelector('.hint-text').style.display = '';
  document.getElementById('input-area').style.display = '';
  document.getElementById('scoreboard').style.display = '';

  // Réinitialiser les humeurs d'avatars
  //   window.Avatar.setState(gameAvatarMe, null);
  //   window.Avatar.setState(gameAvatarOpp, null);

  // Mettre à jour score + label de manche
  updateMatchScore(matchHistory);
  showScoreBlock('game-score-block', currentMatchRounds > 1);
  updateMatchRoundLabel(data.currentRound || 1, currentMatchRounds);

  // Afficher la nouvelle question
  if (data.question) displayQuestion(data.question, currentMode);

  // Remettre les timers (nouvelle manche : on réinitialise la valeur "plein").
  if (data.times) {
    syncTimer(data.times, data.activePlayerId, { resetMax: true });
  }

  // Setup input selon qui commence la manche
  if (data.activePlayerId === socket.id) {
    answerInput.disabled = false;
    answerInput.style.opacity = 1;
    answerInput.placeholder = 'Tape ta réponse ici...';
    answerInput.value = '';
    answerInput.focus();
    passBtn.disabled = false;
    passBtn.style.opacity = 1;
  } else {
    answerInput.disabled = true;
    answerInput.style.opacity = 0.5;
    answerInput.placeholder = "Au tour de l'adversaire...";
    passBtn.disabled = true;
    passBtn.style.opacity = 0.5;
  }
});

socket.on('game-over', data => {
  updateMatchAnswers(data);
  document.getElementById('round-transition-screen').style.display = 'none';
  // Affiche le gain/perte d'élo si disponible
  if (data.eloChanges) {
    const isWinner = (data.winnerId === socket.id);
    const change = isWinner ? data.eloChanges.winner : data.eloChanges.loser;
    const sign = change.diff >= 0 ? '+' : '';
    const color = change.diff >= 0 ? '#4caf50' : '#f44336';

    // Met à jour le currentUser local
    if (currentUser) {
      // On ne sait pas ici quel mode c'est, on rafraîchit depuis le serveur
      fetch('/api/me').then(r => r.json()).then(u => {
        if (u) {
          currentUser = u;
          const eloQuizEl = document.getElementById('elo-quiz');
          const eloImagesEl = document.getElementById('elo-images');
          if (eloQuizEl) eloQuizEl.textContent = u.elo_quiz;
          if (eloImagesEl) eloImagesEl.textContent = u.elo_images;
        }
      });
    }

    // Affiche le changement d'élo sur l'écran de fin
    const eloResultEl = document.getElementById('elo-result');
    if (eloResultEl) {
      eloResultEl.textContent = `${sign}${change.diff} élo`;
      eloResultEl.style.color = color;
      eloResultEl.style.display = 'block';
    }
  }
  // Stoppe la boucle d'animation du chrono (match terminé).
  stopTimerLoop();

  displayArea.style.display = 'none';
  quizDisplayArea.style.display = 'none';
  document.querySelector('.hint-text').style.display = 'none';
  document.getElementById('input-area').style.display = 'none';
  document.getElementById('scoreboard').style.display = 'none';
  // Cacher le match-header (logo + pastilles) pendant l'écran de victoire/défaite
  const matchHeader = document.querySelector('#game-container .match-header');
  if (matchHeader) matchHeader.style.display = 'none';

  const screen = document.getElementById('game-over-screen');
  const msg = document.getElementById('winner-message');
  const gScoreMe = document.getElementById('game-over-score-me');
  const gScoreOpp = document.getElementById('game-over-score-opp');
  screen.style.display = 'block';

  // Score final (mêmes données que round-end : data.score est indexé par socket.id)
  gScoreMe.innerText = (data.score && data.score[socket.id]) || 0;
  gScoreOpp.innerText = (data.score && currentOpponentId && data.score[currentOpponentId]) || 0;

  if (data.winnerId === socket.id) {
    msg.innerText = 'VICTOIRE !';
    msg.style.color = '#4dd0e1';
    //     window.Avatar.setState(gameAvatarMe, 'win');
    //     window.Avatar.setState(gameAvatarOpp, 'lose');
  } else {
    msg.innerText = 'DÉFAITE...';
    msg.style.color = '#e94560';
    //     window.Avatar.setState(gameAvatarMe, 'lose');
    //     window.Avatar.setState(gameAvatarOpp, 'win');
  }
});

// keepMatchState = true : conserver matchHistory/currentOpponentId entre les manches.
// keepMatchState = false (défaut) : reset complet (nouveau match ou abandon).
function resetGameUI(keepMatchState = false) {
  document.getElementById('input-area').style.display = '';
  document.getElementById('scoreboard').style.display = '';
  document.querySelector('.hint-text').style.display = '';
  document.getElementById('game-over-screen').style.display = 'none';
  document.getElementById('round-transition-screen').style.display = 'none';
  // Rétablir le match-header si masqué
  const matchHeader = document.querySelector('#game-container .match-header');
  if (matchHeader) matchHeader.style.removeProperty('display');
  // Réinitialiser les humeurs des avatars
  //   window.Avatar.setState(gameAvatarMe, null);
  //   window.Avatar.setState(gameAvatarOpp, null);

  // On arrête toujours la boucle d'animation quand on quitte l'écran de jeu ;
  // keepMatchState ne conserve que le score/la manche, pas un chrono actif.
  stopTimerLoop();

  if (!keepMatchState) {
    // Reset complet : nouveau match ou abandon
    matchHistory = [];
    matchInProgress = false;
    currentMatchRounds = 1;
    currentOpponentId = null;
    // Réinitialiser le score et masquer les blocs score
    updateMatchScore([]);
    showScoreBlock('game-score-block', false);
    showScoreBlock('lobby-score-block', false);
    // Remettre le titre du lobby et les boutons rounds à leur état initial
    const settingsTitle = document.getElementById('settings-title');
    if (settingsTitle) settingsTitle.innerText = 'Paramètres de la partie';
    document.getElementById('rounds-choice-group')?.classList.remove('locked');
    const startBtn = document.getElementById('btn-start-custom');
    if (startBtn) startBtn.innerText = 'LANCER LE DUEL';
  }
}

// Helper : ramener l'UI à l'état "lobby de salon privé" en respectant le rôle.
function returnToLobbyUI() {
  document.getElementById('lobby-container').style.display = 'flex';
  setActiveScreen('lobby');

  const hostSettings = document.getElementById('host-settings');
  const guestNote = document.getElementById('guest-waiting-note');
  // Dans les deux rôles le panneau est visible.
  hostSettings.style.display = 'block';

  if (hostSettings.dataset.role === 'host') {
    if (guestNote) guestNote.style.display = 'none';
    // Entre deux manches, les 2 joueurs sont déjà là → le bouton reste actif
    if (!matchInProgress) {
      document.getElementById('btn-start-custom').disabled = true;
    }
  } else {
    if (guestNote) guestNote.style.display = 'block';
  }
}

document.getElementById('btn-back-game').addEventListener('click', () => {
  // Si la partie est encore en cours (pas d'écran game-over affiché), on prévient
  // le serveur pour qu'il arrête son chrono — sinon le timer continue de tourner
  // et viendra polluer la prochaine partie (timers cumulés = compte à rebours x2).
  const gameOverVisible =
    document.getElementById('game-over-screen').style.display === 'block';

  const keepPrivateMatchState = !!myRoomCode && !gameOverVisible && currentMatchRounds > 1;

  resetGameUI(keepPrivateMatchState);
  document.getElementById('game-container').style.display = 'none';
  // Réinitialiser les humeurs des avatars
  //   window.Avatar.setState(gameAvatarMe, null);
  //   window.Avatar.setState(gameAvatarOpp, null);

  const isMatchmaking = myRoomCode && myRoomCode.startsWith('MATCH-');

  if (myRoomCode && !isMatchmaking) {
    // Partie privée : retour au salon de la partie
    if (!gameOverVisible) {
      socket.emit('abort-game');
    }
    if (keepPrivateMatchState) {
      matchInProgress = true;
      updateLobbyMatchStatus({ forceVisible: true });
    }
    returnToLobbyUI();
  } else {
    // Partie matchmaking (ou pas de room) : retour à l'accueil principal
    if (isMatchmaking && !gameOverVisible) {
      socket.emit('abort-game');
    }
    myRoomCode = null;
    document.getElementById('mode-select-container').style.display = 'flex';
    setActiveScreen('home');
  }
});

// L'adversaire a appuyé sur "Retour" pendant la partie : on revient aussi au salon.
socket.on('opponent-aborted', () => {
  if (!myRoomCode) return;
  clearTransitionTimers();
  document.getElementById('transition-container').style.display = 'none';

  const isMatchmaking = myRoomCode.startsWith('MATCH-');
  const keepPrivateMatchState = !isMatchmaking && currentMatchRounds > 1;

  resetGameUI(keepPrivateMatchState);
  document.getElementById('game-container').style.display = 'none';

  if (isMatchmaking) {
    // Matchmaking : retour à l'accueil principal
    myRoomCode = null;
    document.getElementById('mode-select-container').style.display = 'flex';
    setActiveScreen('home');
    showToast("L'adversaire a quitté la partie.");
  } else {
    // Salon privé : retour au lobby
    if (keepPrivateMatchState) {
      matchInProgress = true;
      updateLobbyMatchStatus({ forceVisible: true });
    }
    returnToLobbyUI();
    showToast("L'adversaire a quitté la partie.");
  }
});

answerInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    socket.emit('submit-answer', answerInput.value);
    answerInput.value = '';
  }
});

document.getElementById('restart-btn').addEventListener('click', () => {
  // Détection matchmaking : le code commence par "MATCH-"
  const isMatchmaking = myRoomCode && myRoomCode.startsWith('MATCH-');

  if (myRoomCode && !isMatchmaking) {
    // Partie privée : retour au salon de la partie
    if (!gameOverVisible) {
      socket.emit('abort-game');
    }
    if (keepPrivateMatchState) {
      matchInProgress = true;
      updateLobbyMatchStatus({ forceVisible: true });
    }
    returnToLobbyUI();
  } else {
    // Partie matchmaking (ou pas de room) : retour à l'accueil principal
    if (isMatchmaking && !gameOverVisible) {
      socket.emit('abort-game');
    }
    myRoomCode = null;
    document.getElementById('mode-select-container').style.display = 'flex';
    setActiveScreen('home');
  }
});


const copyCodeBtn = document.getElementById('btn-copy-room-code');
copyCodeBtn?.addEventListener('click', async () => {
  const code = document.getElementById('display-room-code')?.innerText || '';
  if (!code || code === '----') return;
  try {
    await navigator.clipboard.writeText(code);
    showToast(`Code ${code} copié.`);
  } catch (_) {
    showToast(`Code du salon : ${code}`);
  }
});

/* ==========================================================
   ÉCRAN RÉPONSES — bouton dans le lobby + rendu de la liste
   ========================================================== */

const btnShowAnswers = document.getElementById('btn-show-answers');
const btnBackAnswers = document.getElementById('btn-back-answers');
const answersContainer = document.getElementById('answers-container');
const answersListEl = document.getElementById('answers-list');
const answersEmptyEl = document.getElementById('answers-empty');

function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Construit le HTML d'une carte question dans l'écran des réponses.
function renderAnswerItem(a) {
  const q = a.question || {};
  const isImages = a.mode === 'images';

  let questionHTML = '';
  if (isImages && q.image) {
    questionHTML = `<img class="answer-item-img" src="${escapeHTML(q.image)}" alt="Question" loading="lazy">`;
  } else if (q.text) {
    questionHTML = `<p class="answer-item-question">${escapeHTML(q.text)}</p>`;
  }

  const answerLabel = q.answer || '';
  const mine = a.playerId === socket.id;

  let statusLabel, statusClass;
  if (a.outcome === 'correct') {
    statusLabel = mine ? '✓ Trouvée par toi' : "✓ Trouvée par l'adversaire";
    statusClass = mine ? 'answer-item-status-correct-me' : 'answer-item-status-correct-opp';
  } else if (a.outcome === 'passed') {
    statusLabel = mine ? '↷ Passée par toi' : "↷ Passée par l'adversaire";
    statusClass = 'answer-item-status-passed';
  } else { // timeout
    statusLabel = mine ? '⏰ Temps écoulé (toi)' : "⏰ Temps écoulé (adversaire)";
    statusClass = 'answer-item-status-timeout';
  }

  return `
    <div class="answer-item">
      ${questionHTML}
      <p class="answer-item-answer">${escapeHTML(answerLabel)}</p>
      <span class="answer-item-status ${statusClass}">${statusLabel}</span>
    </div>
  `;
}

// Regroupe les questions par manche et injecte tout dans le DOM.
function renderAnswersScreen() {
  if (!answersListEl || !answersEmptyEl) return;

  if (!currentMatchAnswers.length) {
    answersListEl.innerHTML = '';
    answersListEl.style.display = 'none';
    answersEmptyEl.style.display = 'block';
    return;
  }

  answersListEl.style.display = 'flex';
  answersEmptyEl.style.display = 'none';

  // Groupement par numéro de manche
  const byRound = {};
  currentMatchAnswers.forEach(a => {
    const r = a.round || 1;
    if (!byRound[r]) byRound[r] = [];
    byRound[r].push(a);
  });
  const rounds = Object.keys(byRound).map(Number).sort((x, y) => x - y);

  answersListEl.innerHTML = rounds.map(r => {
    const items = byRound[r].map(renderAnswerItem).join('');
    return `
      <div class="answers-round-block">
        <h3 class="answers-round-title">Manche ${r}</h3>
        <div class="answers-round-grid">${items}</div>
      </div>
    `;
  }).join('');
}

// Force la fermeture de l'écran réponses (utile quand le duel démarre alors
// que l'utilisateur consulte les réponses).
function hideAnswersScreen() {
  if (answersContainer) answersContainer.style.display = 'none';
}

btnShowAnswers?.addEventListener('click', () => {
  renderAnswersScreen();
  document.getElementById('lobby-container').style.display = 'none';
  if (answersContainer) answersContainer.style.display = 'block';
  setActiveScreen('lobby'); // on reste dans le contexte lobby (avatar latéral identique)
});

btnBackAnswers?.addEventListener('click', () => {
  hideAnswersScreen();
  document.getElementById('lobby-container').style.display = 'flex';
  setActiveScreen('lobby');
});

/* =========================================================
   Accueil mobile : Images / Quiz → Matchmaking
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const cardImages = document.getElementById("card-images");
  const cardQuiz = document.getElementById("card-quiz");
  const btnMatchmaking = document.getElementById("btn-matchmaking");

  function launchMatchmakingFromHome(mode) {
    // 1. On sélectionne d'abord le mode comme sur grand écran
    const card = mode === "quiz" ? cardQuiz : cardImages;

    if (card) {
      card.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    }

    // 2. On attend que ton script existant mette à jour le mode
    setTimeout(() => {
      if (!btnMatchmaking) return;

      // Si ton bouton est encore désactivé, on le réactive
      btnMatchmaking.disabled = false;

      // 3. On lance le matchmaking avec le bouton existant
      btnMatchmaking.click();
    }, 80);
  }

  if (cardImages) {
    cardImages.addEventListener("dblclick", (event) => {
      event.preventDefault();
      launchMatchmakingFromHome("images");
    });
  }

  if (cardQuiz) {
    cardQuiz.addEventListener("dblclick", (event) => {
      event.preventDefault();
      launchMatchmakingFromHome("quiz");
    });
  }
});

refreshLobbyThemeVisibility();
updateRules('images');