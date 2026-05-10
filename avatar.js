/* ==========================================================
   AVATAR SYSTEM — Le Duel
   - Avatars chibi/cartoon en SVG paramétrable
   - Personnalisation : peau, cheveux (style + couleur), tenue, accessoire
   - Animations : idle / win (bras levés) / lose (pleurs)
   - Persistance : localStorage
   ========================================================== */

const AVATAR_OPTIONS = {
  skin: [
    { id: 'skin1', color: '#fcd9b6' },
    { id: 'skin2', color: '#f1c27d' },
    { id: 'skin3', color: '#e0ac69' },
    { id: 'skin4', color: '#c68642' },
    { id: 'skin5', color: '#8d5524' },
    { id: 'skin6', color: '#5c3317' }
  ],
  hairStyle: [
    { id: 'short',     label: 'Court' },
    { id: 'long',      label: 'Long' },
    { id: 'curly',     label: 'Bouclé' },
    { id: 'ponytail',  label: 'Queue' },
    { id: 'bun',       label: 'Chignon' },
    { id: 'mohawk',    label: 'Crête' },
    { id: 'bald',      label: 'Chauve' },
    { id: 'cap',       label: 'Casquette' }
  ],
  hairColor: [
    { id: 'h1', color: '#1a1a1a' },
    { id: 'h2', color: '#5c3a21' },
    { id: 'h3', color: '#a0522d' },
    { id: 'h4', color: '#d4a017' },
    { id: 'h5', color: '#e94560' },
    { id: 'h6', color: '#9333ea' },
    { id: 'h7', color: '#4dd0e1' },
    { id: 'h8', color: '#f5f5f5' }
  ],
  outfit: [
    { id: 'red',    color: '#e94560' },
    { id: 'purple', color: '#9333ea' },
    { id: 'cyan',   color: '#4dd0e1' },
    { id: 'gold',   color: '#c89b3c' },
    { id: 'green',  color: '#28a745' },
    { id: 'blue',   color: '#0f3460' },
    { id: 'pink',   color: '#f857a6' },
    { id: 'black',  color: '#222' }
  ],
  eyes: [
    { id: 'normal',  label: 'Normal' },
    { id: 'happy',   label: 'Joyeux' },
    { id: 'cool',    label: 'Cool' },
    { id: 'wink',    label: 'Clin' }
  ]
};

const DEFAULT_AVATAR = {
  skin: 'skin2',
  hairStyle: 'short',
  hairColor: 'h2',
  outfit: 'red',
  eyes: 'normal'
};

const AVATAR_STORAGE_KEY = 'leduel_avatar_config';

function loadAvatarConfig() {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AVATAR };
    const cfg = JSON.parse(raw);
    return { ...DEFAULT_AVATAR, ...cfg };
  } catch (e) {
    return { ...DEFAULT_AVATAR };
  }
}

function saveAvatarConfig(cfg) {
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {}
}

function getColor(category, id) {
  const opts = AVATAR_OPTIONS[category];
  const found = opts.find(o => o.id === id);
  return found ? found.color : opts[0].color;
}

/* ----------------------------------------------------------
   GÉNÉRATION DU SVG
   ViewBox 200x240. L'avatar est centré.
   Structure :
     <g class="avatar-root">
       <g class="av-body"> torse + bras (au repos)
       <g class="av-arms-up"> bras en l'air (cachés par défaut)
       <g class="av-head"> tête
       <g class="av-tears"> larmes (cachées par défaut)
   ---------------------------------------------------------- */
function buildAvatarSVG(config) {
  const cfg = { ...DEFAULT_AVATAR, ...(config || {}) };
  const skin   = getColor('skin', cfg.skin);
  const hair   = getColor('hairColor', cfg.hairColor);
  const outfit = getColor('outfit', cfg.outfit);

  const hairSVG = buildHair(cfg.hairStyle, hair);
  const eyesSVG = buildEyes(cfg.eyes);

  return `
<svg class="avatar-svg" viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="floorShadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="rgba(0,0,0,0.4)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>

  <!-- ombre au sol -->
  <ellipse class="av-shadow" cx="100" cy="225" rx="48" ry="7" fill="url(#floorShadow)"/>

  <!-- BRAS LEVÉS (cachés par défaut, visibles en .win) -->
  <g class="av-arms-up">
    <!-- bras gauche levé -->
    <path d="M 70 130 Q 50 100 45 60 Q 42 50 52 48 Q 60 47 63 58 Q 68 95 82 125 Z"
          fill="${outfit}"/>
    <circle cx="48" cy="50" r="9" fill="${skin}"/>
    <!-- bras droit levé -->
    <path d="M 130 130 Q 150 100 155 60 Q 158 50 148 48 Q 140 47 137 58 Q 132 95 118 125 Z"
          fill="${outfit}"/>
    <circle cx="152" cy="50" r="9" fill="${skin}"/>
  </g>

  <!-- CORPS (avec bras au repos) -->
  <g class="av-body">
    <!-- jambes -->
    <rect x="82" y="195" width="14" height="25" rx="5" fill="#2a2a4e"/>
    <rect x="104" y="195" width="14" height="25" rx="5" fill="#2a2a4e"/>
    <ellipse cx="89" cy="222" rx="10" ry="4" fill="#1a1a1a"/>
    <ellipse cx="111" cy="222" rx="10" ry="4" fill="#1a1a1a"/>

    <!-- torse (forme arrondie type t-shirt) -->
    <path d="M 70 135 Q 70 125 80 122 L 120 122 Q 130 125 130 135 L 132 200 Q 130 205 122 205 L 78 205 Q 70 205 68 200 Z"
          fill="${outfit}"/>
    <!-- col -->
    <path d="M 90 122 Q 100 130 110 122 L 110 125 Q 100 133 90 125 Z" fill="rgba(0,0,0,0.18)"/>

    <!-- bras au repos -->
    <g class="av-arm av-arm-left">
      <path d="M 72 138 Q 60 165 64 195 Q 66 200 72 198 Q 78 195 78 175 Q 80 155 84 140 Z"
            fill="${outfit}"/>
      <circle cx="68" cy="197" r="8" fill="${skin}"/>
    </g>
    <g class="av-arm av-arm-right">
      <path d="M 128 138 Q 140 165 136 195 Q 134 200 128 198 Q 122 195 122 175 Q 120 155 116 140 Z"
            fill="${outfit}"/>
      <circle cx="132" cy="197" r="8" fill="${skin}"/>
    </g>
  </g>

  <!-- TÊTE -->
  <g class="av-head">
    <!-- cou -->
    <rect x="92" y="115" width="16" height="14" fill="${skin}"/>
    <!-- visage -->
    <ellipse cx="100" cy="80" rx="42" ry="46" fill="${skin}"/>
    <!-- oreilles -->
    <ellipse cx="58" cy="83" rx="6" ry="9" fill="${skin}"/>
    <ellipse cx="142" cy="83" rx="6" ry="9" fill="${skin}"/>

    <!-- cheveux -->
    ${hairSVG}

    <!-- yeux -->
    ${eyesSVG}

    <!-- joues -->
    <ellipse class="av-cheek" cx="72" cy="92" rx="6" ry="4" fill="rgba(233,69,96,0.4)"/>
    <ellipse class="av-cheek" cx="128" cy="92" rx="6" ry="4" fill="rgba(233,69,96,0.4)"/>

    <!-- bouches : normal / smile / sad — on les empile, l'animation les bascule -->
    <g class="av-mouth av-mouth-normal">
      <path d="M 90 102 Q 100 108 110 102" stroke="#3a1a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </g>
    <g class="av-mouth av-mouth-smile">
      <path d="M 86 100 Q 100 116 114 100 Q 100 110 86 100 Z" fill="#3a1a1a"/>
      <path d="M 90 104 Q 100 110 110 104" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>
    <g class="av-mouth av-mouth-sad">
      <path d="M 88 108 Q 100 98 112 108" stroke="#3a1a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </g>

    <!-- larmes (cachées par défaut) -->
    <g class="av-tears">
      <path class="av-tear av-tear-1" d="M 78 88 Q 76 95 78 100 Q 80 95 78 88 Z" fill="#4dd0e1"/>
      <path class="av-tear av-tear-2" d="M 122 88 Q 120 95 122 100 Q 124 95 122 88 Z" fill="#4dd0e1"/>
    </g>
  </g>
</svg>`;
}

/* HAIR STYLES — chacun renvoie un fragment SVG */
function buildHair(style, color) {
  switch (style) {
    case 'bald':
      return '';
    case 'short':
      return `<path d="M 60 70 Q 60 36 100 34 Q 140 36 140 70 Q 138 56 130 52 Q 120 48 100 50 Q 80 48 70 52 Q 62 56 60 70 Z" fill="${color}"/>`;
    case 'long':
      return `
        <path d="M 56 78 Q 56 32 100 30 Q 144 32 144 78 L 144 130 Q 142 138 134 138 L 134 80 Q 130 70 124 68 L 76 68 Q 70 70 66 80 L 66 138 Q 58 138 56 130 Z" fill="${color}"/>`;
    case 'curly':
      return `
        <circle cx="70" cy="55" r="14" fill="${color}"/>
        <circle cx="86" cy="44" r="14" fill="${color}"/>
        <circle cx="100" cy="40" r="14" fill="${color}"/>
        <circle cx="114" cy="44" r="14" fill="${color}"/>
        <circle cx="130" cy="55" r="14" fill="${color}"/>
        <circle cx="62" cy="68" r="11" fill="${color}"/>
        <circle cx="138" cy="68" r="11" fill="${color}"/>`;
    case 'ponytail':
      return `
        <path d="M 60 70 Q 60 36 100 34 Q 140 36 140 70 Q 138 56 130 52 Q 120 48 100 50 Q 80 48 70 52 Q 62 56 60 70 Z" fill="${color}"/>
        <path d="M 138 70 Q 158 80 162 110 Q 160 122 152 124 Q 148 110 144 95 Q 140 82 136 76 Z" fill="${color}"/>`;
    case 'bun':
      return `
        <path d="M 60 70 Q 60 36 100 34 Q 140 36 140 70 Q 138 56 130 52 Q 120 48 100 50 Q 80 48 70 52 Q 62 56 60 70 Z" fill="${color}"/>
        <circle cx="100" cy="28" r="14" fill="${color}"/>
        <circle cx="100" cy="28" r="9" fill="rgba(0,0,0,0.18)"/>`;
    case 'mohawk':
      return `
        <path d="M 70 70 Q 72 60 78 56 L 122 56 Q 128 60 130 70 Q 128 62 120 60 L 80 60 Q 72 62 70 70 Z" fill="#1a1a1a"/>
        <path d="M 88 56 Q 92 24 100 20 Q 108 24 112 56 Z" fill="${color}"/>`;
    case 'cap':
      return `
        <path d="M 60 70 Q 60 36 100 34 Q 140 36 140 70 Q 138 56 130 52 Q 120 48 100 50 Q 80 48 70 52 Q 62 56 60 70 Z" fill="${color}"/>
        <path d="M 56 60 Q 56 30 100 28 Q 144 30 144 60 L 144 64 Q 130 56 100 56 Q 70 56 56 64 Z" fill="#222"/>
        <path d="M 100 56 Q 75 56 56 64 L 50 70 Q 50 76 60 76 L 100 76 Q 130 76 130 70 L 130 64 Q 120 56 100 56 Z" fill="#222"/>
        <circle cx="100" cy="44" r="4" fill="#fff"/>`;
    default:
      return `<path d="M 60 70 Q 60 36 100 34 Q 140 36 140 70 Q 138 56 130 52 Q 120 48 100 50 Q 80 48 70 52 Q 62 56 60 70 Z" fill="${color}"/>`;
  }
}

/* EYES STYLES */
function buildEyes(style) {
  switch (style) {
    case 'happy':
      return `
        <path d="M 76 82 Q 82 76 88 82" stroke="#1a1a1a" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M 112 82 Q 118 76 124 82" stroke="#1a1a1a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case 'cool':
      return `
        <rect x="68" y="76" width="26" height="14" rx="4" fill="#1a1a1a"/>
        <rect x="106" y="76" width="26" height="14" rx="4" fill="#1a1a1a"/>
        <rect x="94" y="80" width="12" height="3" fill="#1a1a1a"/>
        <rect x="72" y="79" width="6" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
        <rect x="110" y="79" width="6" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>`;
    case 'wink':
      return `
        <ellipse cx="82" cy="82" rx="5" ry="6" fill="#fff"/>
        <circle cx="82" cy="83" r="3.5" fill="#1a1a1a"/>
        <circle cx="83" cy="81" r="1.2" fill="#fff"/>
        <path d="M 112 82 Q 118 78 124 82" stroke="#1a1a1a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case 'normal':
    default:
      return `
        <ellipse cx="82" cy="82" rx="5" ry="7" fill="#fff"/>
        <ellipse cx="118" cy="82" rx="5" ry="7" fill="#fff"/>
        <circle cx="82" cy="83" r="3.5" fill="#1a1a1a"/>
        <circle cx="118" cy="83" r="3.5" fill="#1a1a1a"/>
        <circle cx="83" cy="81" r="1.2" fill="#fff"/>
        <circle cx="119" cy="81" r="1.2" fill="#fff"/>`;
  }
}

/* ----------------------------------------------------------
   API publique
   ---------------------------------------------------------- */
function renderAvatarInto(element, config, options) {
  if (!element) return;
  const opts = options || {};
  element.innerHTML = buildAvatarSVG(config);
  element.classList.add('avatar-container');
  if (opts.flip) element.classList.add('flipped');
  else element.classList.remove('flipped');
}

function setAvatarState(element, state) {
  if (!element) return;
  element.classList.remove('state-win', 'state-lose');
  if (state === 'win') element.classList.add('state-win');
  else if (state === 'lose') element.classList.add('state-lose');
}

/* Expose globalement */
window.Avatar = {
  OPTIONS: AVATAR_OPTIONS,
  DEFAULT: DEFAULT_AVATAR,
  load: loadAvatarConfig,
  save: saveAvatarConfig,
  build: buildAvatarSVG,
  renderInto: renderAvatarInto,
  setState: setAvatarState
};