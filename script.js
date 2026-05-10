const socket = io();

const displayArea = document.getElementById('display-area');
const quizDisplayArea = document.getElementById('quiz-display-area');
const quizQuestionText = document.getElementById('quiz-question-text');
const answerInput = document.getElementById('answer-input');
const passBtn = document.getElementById('pass-btn');

let myRoomCode = null;
let currentMode = 'images';

/* ==========================================================
   AVATAR — état & DOM
   ========================================================== */
let myAvatarConfig = window.Avatar.load();
let opponentAvatarConfig = null; // sera reçu en jeu

const homeAvatarDisplay = document.getElementById('home-avatar-display');
const gameAvatarMe = document.getElementById('game-avatar-me');
const gameAvatarOpp = document.getElementById('game-avatar-opp');
const avatarModalOverlay = document.getElementById('avatar-modal-overlay');
const avatarPreview = document.getElementById('avatar-preview');
const avatarOptions = document.getElementById('avatar-options');

// Affiche l'avatar à l'accueil dès le chargement
window.Avatar.renderInto(homeAvatarDisplay, myAvatarConfig);

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

document.getElementById('btn-customize-avatar').addEventListener('click', openAvatarModal);
document.getElementById('btn-avatar-cancel').addEventListener('click', closeAvatarModal);

document.getElementById('btn-avatar-save').addEventListener('click', () => {
  myAvatarConfig = { ...pendingAvatarConfig };
  window.Avatar.save(myAvatarConfig);
  window.Avatar.renderInto(homeAvatarDisplay, myAvatarConfig);
  closeAvatarModal();
});

// Fermer en cliquant en dehors de la modale
avatarModalOverlay.addEventListener('click', e => {
  if (e.target === avatarModalOverlay) closeAvatarModal();
});

// Sélection d'options dans la modale (délégation)
avatarOptions.addEventListener('click', e => {
  const el = e.target.closest('[data-cat][data-id]');
  if (!el) return;
  const cat = el.dataset.cat;
  const id = el.dataset.id;
  pendingAvatarConfig[cat] = id;
  buildAvatarOptionsUI();
  refreshAvatarPreview();
});

// Boutons de test des animations (preview)
document.getElementById('preview-test-win').addEventListener('click', () => {
  window.Avatar.setState(avatarPreview, 'win');
  setTimeout(() => window.Avatar.setState(avatarPreview, null), 2000);
});
document.getElementById('preview-test-lose').addEventListener('click', () => {
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
    "Passer une question coûte 3 secondes de pénalité.",
    "Le premier dont le temps atteint 0 perd la partie.",
    "Les accents ne sont pas nécessaires pour répondre.",
  ],
  images: [
    "Une image s'affiche — reconnais ce qu'elle représente.",
    "Si tu réponds juste, c'est à ton adversaire de jouer.",
    "Chaque joueur a son propre compteur de temps.",
    "Passer une question coûte 3 secondes de pénalité.",
    "Le premier dont le temps atteint 0 perd la partie.",
    "Les accents ne sont pas nécessaires pour répondre.",
  ],
};

const themeModeMap = {
  athletes: 'images',
  stades: 'images',
  logospremierleague: 'images',
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
  politiquefr: 'images',
  hommesetat: 'images',
  drapeaux: 'images',
  quizculture: 'quiz',
  quizhistoire: 'quiz',
  quizgeographie: 'quiz',
  quizsport: 'quiz',
  quizsciences: 'quiz',
  quizcinema: 'quiz',
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

  const enabled = !!selectedModeBtn && !!selectedThemeBtn && !!selectedTimerBtn;
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

document.getElementById('btn-create-room-home').addEventListener('click', () => {
  socket.emit('create-room', { avatar: myAvatarConfig });
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  const code = document.getElementById('input-room-code').value.trim().toUpperCase();
  if (code.length === 4) socket.emit('join-room', { code, avatar: myAvatarConfig });
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
  document.getElementById('home-container').style.display = 'none';
  document.getElementById('matchmaking-container').style.display = 'block';
  setActiveScreen('mm');
  socket.emit('join-matchmaking', { avatar: myAvatarConfig });
});

document.getElementById('btn-back-matchmaking').addEventListener('click', () => {
  socket.emit('leave-matchmaking');
  document.getElementById('matchmaking-container').style.display = 'none';
  document.getElementById('home-container').style.display = 'block';
  setActiveScreen('mode');
  // Reset matchmaking UI pour la prochaine recherche
  document.getElementById('queue-status').style.display = 'block';
  document.getElementById('vs-screen').style.display = 'none';
});

document.getElementById('mode-choice-group').addEventListener('click', e => {
  const btn = e.target.closest('.choice-btn');
  if (!btn) return;
  setActiveChoice('#mode-choice-group', btn);
  applyModeFilter(btn.dataset.mode);
  syncStartButton();
});

document.getElementById('theme-choice-group').addEventListener('click', e => {
  const btn = e.target.closest('.choice-btn');
  if (!btn || btn.style.display === 'none') return;
  setActiveChoice('#theme-choice-group', btn);
  syncStartButton();
});

document.getElementById('timer-choice-group').addEventListener('click', e => {
  const btn = e.target.closest('.choice-btn');
  if (!btn) return;
  setActiveChoice('#timer-choice-group', btn);
  syncStartButton();
});

document.getElementById('btn-start-custom').addEventListener('click', () => {
  const themeBtn = document.querySelector('#theme-choice-group .choice-btn.active-choice');
  const modeBtn = document.querySelector('#mode-choice-group .choice-btn.active-choice');
  const timerBtn = document.querySelector('#timer-choice-group .choice-btn.active-choice');

  if (!themeBtn || !modeBtn || !timerBtn) return;

  const theme = themeBtn.dataset.theme;
  const mode = modeBtn.dataset.mode;
  const timer = parseInt(timerBtn.dataset.timer, 10);

  socket.emit('start-game', {
    code: myRoomCode,
    theme,
    timer,
    mode
  });
});

socket.on('room-created', code => {
  myRoomCode = code;
  document.getElementById('mode-select-container').style.display = 'none';
  document.getElementById('home-container').style.display = 'none';
  document.getElementById('lobby-container').style.display = 'block';
  setActiveScreen('lobby');
  document.getElementById('display-room-code').innerText = code;
  document.getElementById('host-settings').style.display = 'block';
  document.getElementById('host-settings').dataset.role = 'host';
  document.getElementById('guest-waiting').style.display = 'none';

  const defaultModeBtn = document.querySelector('#mode-choice-group .choice-btn[data-mode="images"]');
  const defaultThemeBtn = document.querySelector('#theme-choice-group .choice-btn[data-theme="athletes"]');
  const defaultTimerBtn = document.querySelector('#timer-choice-group .choice-btn[data-timer="45"]');

  if (defaultModeBtn) setActiveChoice('#mode-choice-group', defaultModeBtn);
  applyModeFilter('images');
  if (defaultThemeBtn) setActiveChoice('#theme-choice-group', defaultThemeBtn);
  if (defaultTimerBtn) setActiveChoice('#timer-choice-group', defaultTimerBtn);
  syncStartButton();
});

socket.on('room-joined', code => {
  myRoomCode = code;
  document.getElementById('mode-select-container').style.display = 'none';
  document.getElementById('home-container').style.display = 'none';
  document.getElementById('lobby-container').style.display = 'block';
  setActiveScreen('lobby');
  document.getElementById('display-room-code').innerText = code;
  document.getElementById('host-settings').style.display = 'none';
  document.getElementById('host-settings').dataset.role = 'guest';
  document.getElementById('guest-waiting').style.display = 'block';
});

socket.on('room-update', ({ playerCount }) => {
  document.getElementById('room-player-count').innerText = playerCount;
  const startBtn = document.getElementById('btn-start-custom');
  if (startBtn && playerCount >= 2) {
    startBtn.disabled = false;
    startBtn.innerText = 'LANCER LE DUEL';
  }
});

socket.on('error-message', msg => alert(msg));

socket.on('init-game', data => {
  document.getElementById('matchmaking-container').style.display = 'none';
  document.getElementById('lobby-container').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  setActiveScreen('game');
  currentMode = data.mode;

  // === Avatars en jeu ===
  // Le serveur envoie data.avatars = { socketIdJoueur1: cfg, socketIdJoueur2: cfg }
  if (data.avatars) {
    const myCfg = data.avatars[socket.id] || myAvatarConfig;
    let oppCfg = null;
    for (const id in data.avatars) {
      if (id !== socket.id) { oppCfg = data.avatars[id]; break; }
    }
    if (!oppCfg) oppCfg = window.Avatar.DEFAULT;
    opponentAvatarConfig = oppCfg;

    // Mon avatar à gauche (non flippé), adversaire à droite (flippé pour qu'il "regarde" vers la gauche)
    window.Avatar.renderInto(gameAvatarMe, myCfg, { flip: false });
    window.Avatar.renderInto(gameAvatarOpp, oppCfg, { flip: true });
  }

  const hintMessages = {
    athletes: 'Les accents ne sont pas nécessaires<br>Tapez uniquement les noms de famille !',
    stades: 'Les accents ne sont pas nécessaires<br>Le nom le plus populaire est attendu.',
    logospremierleague: 'Les accents ne sont pas nécessaires<br>Seulement le nom de la ville du club.',
    logoslaliga: 'Les accents ne sont pas nécessaires<br>Seulement le nom de la ville du club.',
    logosbundesliga: 'Les accents ne sont pas nécessaires<br>Seulement le nom de la ville du club.',
    logosseriea: 'Les accents ne sont pas nécessaires<br>Seulement le nom de la ville du club.',
    logostop14: 'Les accents ne sont pas nécessaires<br>Nom de la ville ou du club.',
    logosnationsrugby: 'Les accents ne sont pas nécessaires<br>Nom de la ville ou du club.',
    logosnba: 'Les accents ne sont pas nécessaires<br>Nom de la franchise, pas de la ville.',
    logosnfl: 'Les accents ne sont pas nécessaires<br>Nom de la franchise, pas de la ville.',
    logosnhl: 'Les accents ne sont pas nécessaires<br>Nom de la franchise, pas de la ville.',
    logosmlb: 'Les accents ne sont pas nécessaires<br>Nom de la franchise, pas de la ville.',
    logosmls: 'Les accents ne sont pas nécessaires<br>Nom de la franchise, pas de la ville.',
    logosnrl: 'Les accents ne sont pas nécessaires<br>Nom de la franchise, pas de la ville.',
    voitures: 'Les accents ne sont pas nécessaires',
    politiquefr: 'Les accents ne sont pas nécessaires',
    hommesetat: 'Les accents ne sont pas nécessaires',
    drapeaux: 'Les accents ne sont pas nécessaires',
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
    answerInput.style.backgroundColor = '#e94560';
    answerInput.focus();
    passBtn.disabled = false;
  } else {
    answerInput.disabled = true;
    answerInput.style.backgroundColor = '#555';
    passBtn.disabled = true;
  }

  for (let id in data.times) {
    const target = id === socket.id ? 'my-time' : 'opponent-time';
    document.getElementById(target).innerText = data.times[id];
  }
});

function displayQuestion(question, mode) {
  if (!question) return;
  if (mode === 'quiz') {
    displayArea.style.display = 'none';
    quizDisplayArea.style.display = 'flex';
    quizQuestionText.innerText = question.text;
  } else {
    quizDisplayArea.style.display = 'none';
    displayArea.style.display = 'flex';
    displayArea.innerHTML = `<img src="${question.image}" style="max-width:100%;border-radius:10px;">`;
  }
}

socket.on('timer-update', times => {
  for (let id in times) {
    const target = id === socket.id ? 'my-time' : 'opponent-time';
    document.getElementById(target).innerText = times[id];
  }
});

socket.on('next-round', data => {
  if (data.nextQuestion) displayQuestion(data.nextQuestion, currentMode);

  // === Animation : celui qui a répondu juste lève les bras ===
  if (data.correctPlayerId) {
    const winnerEl = data.correctPlayerId === socket.id ? gameAvatarMe : gameAvatarOpp;
    flashAvatarState(winnerEl, 'win', 1400);
  }

  if (data.activePlayerId === socket.id) {
    answerInput.disabled = false;
    answerInput.style.backgroundColor = '#e94560';
    answerInput.placeholder = 'Tape ta réponse ici...';
    answerInput.focus();
    passBtn.disabled = false;
    passBtn.style.opacity = 1;
  } else {
    answerInput.disabled = true;
    answerInput.style.backgroundColor = '#555';
    answerInput.placeholder = "Au tour de l'adversaire...";
    passBtn.disabled = true;
    passBtn.style.opacity = 0.5;
  }
});

// Mauvaise réponse : seul le joueur fautif pleure (le serveur émettra cet event)
socket.on('wrong-answer', data => {
  if (!data || !data.playerId) return;
  const sadEl = data.playerId === socket.id ? gameAvatarMe : gameAvatarOpp;
  flashAvatarState(sadEl, 'lose', 1500);
});

// Passer une question : pleurs sur celui qui passe
socket.on('passing', data => {
  if (!data || !data.playerId) return;
  const sadEl = data.playerId === socket.id ? gameAvatarMe : gameAvatarOpp;
  flashAvatarState(sadEl, 'lose', 2800);
});

passBtn.addEventListener('click', () => {
  answerInput.disabled = true;
  passBtn.disabled = true;
  answerInput.value = '';
  answerInput.placeholder = 'PÉNALITÉ EN COURS...';
  answerInput.style.transition = 'none';
  answerInput.style.background = 'linear-gradient(to right, #555 50%, #e94560 50%)';
  answerInput.style.backgroundSize = '200% 100%';
  answerInput.style.backgroundPosition = '0 0';
  void answerInput.offsetWidth;
  answerInput.style.transition = 'background-position 3s linear';
  answerInput.style.backgroundPosition = '100% 0';
  socket.emit('pass-question');
});

socket.on('game-over', data => {
  displayArea.style.display = 'none';
  quizDisplayArea.style.display = 'none';
  document.querySelector('.hint-text').style.display = 'none';
  document.getElementById('input-area').style.display = 'none';
  document.getElementById('scoreboard').style.display = 'none';
  document.querySelector('#game-container .game-logo').style.display = 'none';

  const screen = document.getElementById('game-over-screen');
  const msg = document.getElementById('winner-message');
  screen.style.display = 'block';

  // Animations finales : gagnant lève les bras, perdant pleure
  if (data.winnerId === socket.id) {
    msg.innerText = 'VICTOIRE !';
    msg.style.color = '#4dd0e1';
    window.Avatar.setState(gameAvatarMe, 'win');
    window.Avatar.setState(gameAvatarOpp, 'lose');
  } else {
    msg.innerText = 'DÉFAITE...';
    msg.style.color = '#e94560';
    window.Avatar.setState(gameAvatarMe, 'lose');
    window.Avatar.setState(gameAvatarOpp, 'win');
  }
});

function resetGameUI() {
  document.getElementById('input-area').style.display = '';
  document.getElementById('scoreboard').style.display = '';
  document.querySelector('.hint-text').style.display = '';
  document.getElementById('game-over-screen').style.display = 'none';
  document.querySelector('#game-container .game-logo').style.display = '';
  // Réinitialiser les humeurs des avatars
  window.Avatar.setState(gameAvatarMe, null);
  window.Avatar.setState(gameAvatarOpp, null);
}

document.getElementById('btn-back-game').addEventListener('click', () => {
  resetGameUI();
  document.getElementById('game-container').style.display = 'none';
  // Réinitialiser les humeurs des avatars
  window.Avatar.setState(gameAvatarMe, null);
  window.Avatar.setState(gameAvatarOpp, null);
  if (myRoomCode) {
    socket.emit('leave-room', { code: myRoomCode });
    myRoomCode = null;
    document.getElementById('mode-select-container').style.display = 'flex';
    setActiveScreen('home');
  } else {
    // Partie matchmaking : retour à l'accueil principal
    document.getElementById('mode-select-container').style.display = 'flex';
    setActiveScreen('home');
  }
});

answerInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    socket.emit('submit-answer', answerInput.value);
    answerInput.value = '';
  }
});

document.getElementById('restart-btn').addEventListener('click', () => {
  if (myRoomCode) {
    resetGameUI();
    document.getElementById('game-container').style.display = 'none';

    // Retour au lobby
    document.getElementById('lobby-container').style.display = 'block';
    setActiveScreen('lobby');

    // Réafficher le bon panneau selon le rôle
    const hostSettings = document.getElementById('host-settings');
    const guestWaiting = document.getElementById('guest-waiting');
    if (hostSettings.dataset.role === 'host') {
      hostSettings.style.display = 'block';
      guestWaiting.style.display = 'none';
      document.getElementById('btn-start-custom').disabled = true;
    } else {
      hostSettings.style.display = 'none';
      guestWaiting.style.display = 'block';
    }
  } else {
    location.reload();
  }
});

refreshLobbyThemeVisibility();
updateRules('images');