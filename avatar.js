(function () {
  const STORAGE_KEY = 'le_duel_avatar_config_v3';
  const LEGACY_STORAGE_KEY = 'le_duel_avatar_config_v2';

  const OPTIONS = {
    skin: [
      { id: 'peach', label: 'Pêche', color: '#ffbf96' },
      { id: 'cream', label: 'Clair', color: '#ffd7b3' },
      { id: 'gold', label: 'Doré', color: '#d99261' },
      { id: 'brown', label: 'Brun', color: '#8f563b' },
      { id: 'deep', label: 'Foncé', color: '#5c3428' }
    ],
    hairStyle: [
      { id: 'cap', label: 'Casquette' },
      { id: 'short', label: 'Court' },
      { id: 'tuft', label: 'Mèche' },
      { id: 'curly', label: 'Bouclé' },
      { id: 'long', label: 'Long' }
    ],
    hairColor: [
      { id: 'brown', label: 'Brun', color: '#3b211c' },
      { id: 'black', label: 'Noir', color: '#17151f' },
      { id: 'blond', label: 'Blond', color: '#f7c857' },
      { id: 'auburn', label: 'Roux', color: '#9a3f22' },
      { id: 'purple', label: 'Violet', color: '#5f2bd6' },
      { id: 'blue', label: 'Bleu', color: '#1677ff' }
    ],
    outfit: [
      { id: 'purple', label: 'Violet', color: '#7c2dff' },
      { id: 'orange', label: 'Orange', color: '#ff7b1a' },
      { id: 'blue', label: 'Bleu', color: '#1d8cff' },
      { id: 'pink', label: 'Rose', color: '#f132b7' },
      { id: 'green', label: 'Vert', color: '#23c96f' },
      { id: 'black', label: 'Noir', color: '#27213d' },
      { id: 'gold', label: 'Or', color: '#ffba32' }
    ],
    eyes: [
      { id: 'round', label: 'Ronds' },
      { id: 'happy', label: 'Sourire' },
      { id: 'focus', label: 'Focus' },
      { id: 'spark', label: 'Étoiles' }
    ],
    accessory: [
      { id: 'none', label: 'Aucun' },
      { id: 'glasses', label: 'Lunettes' },
      { id: 'headset', label: 'Casque' },
      { id: 'crown', label: 'Couronne' },
      { id: 'badge', label: 'Badge VIP' }
    ],
    platform: [
      { id: 'purple', label: 'Violet', color: '#8a26ff' },
      { id: 'orange', label: 'Orange', color: '#ff8b16' },
      { id: 'blue', label: 'Bleu', color: '#21c8ff' },
      { id: 'gold', label: 'Or', color: '#ffd34d' }
    ]
  };

  const DEFAULT = {
    skin: 'peach',
    hairStyle: 'cap',
    hairColor: 'brown',
    outfit: 'purple',
    eyes: 'round',
    accessory: 'none',
    platform: 'purple'
  };

  const LABELS = {
    skin: 'Couleur de peau',
    hairStyle: 'Style de cheveux',
    hairColor: 'Couleur des cheveux',
    outfit: 'Tenue',
    eyes: 'Yeux',
    accessory: 'Accessoire',
    platform: 'Socle'
  };

  const SWATCH_CATEGORIES = new Set(['skin', 'hairColor', 'outfit', 'platform']);

  function normalizeConfig(config) {
    const cfg = { ...DEFAULT, ...(config || {}) };
    Object.keys(DEFAULT).forEach(cat => {
      if (!OPTIONS[cat].some(option => option.id === cfg[cat])) cfg[cat] = DEFAULT[cat];
    });
    return cfg;
  }

  function getOption(cat, id) {
    return OPTIONS[cat].find(option => option.id === id) || OPTIONS[cat].find(option => option.id === DEFAULT[cat]) || OPTIONS[cat][0];
  }

  function pickColor(cat, id) {
    return getOption(cat, id).color || '#ffffff';
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return { ...DEFAULT };
      return normalizeConfig(JSON.parse(raw));
    } catch (_) {
      return { ...DEFAULT };
    }
  }

  function save(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeConfig(config)));
    } catch (_) {}
  }

  function clamp(v) {
    return Math.max(0, Math.min(255, v));
  }

  function shade(hex, amount) {
    const clean = String(hex || '#000000').replace('#', '');
    const n = parseInt(clean, 16);
    let r = (n >> 16) + amount;
    let g = ((n >> 8) & 255) + amount;
    let b = (n & 255) + amount;
    r = clamp(r); g = clamp(g); b = clamp(b);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  function hairSvg(style, color) {
    const dark = shade(color, -38);
    if (style === 'short') {
      return `
        <g class="av-hair">
          <path d="M64 87c6-31 31-48 63-42 28 5 45 26 47 52-24-15-67-18-110-10z" fill="${color}"/>
          <path d="M78 78c18-23 54-29 82-7" fill="none" stroke="${dark}" stroke-width="7" stroke-linecap="round" opacity=".36"/>
          <path d="M72 91c28-8 65-8 96 1" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".08"/>
        </g>`;
    }
    if (style === 'tuft') {
      return `
        <g class="av-hair">
          <path d="M64 89c5-29 30-48 61-44 31 4 49 25 50 54-24-16-67-20-111-10z" fill="${color}"/>
          <path d="M95 57c13-27 45-29 59-8-23 0-34 10-46 32" fill="${color}"/>
          <path d="M98 61c13-13 32-17 48-8" fill="none" stroke="#fff" stroke-width="4" opacity=".09"/>
          <path d="M72 89c31-10 66-8 99 5" fill="none" stroke="${dark}" stroke-width="5" opacity=".25"/>
        </g>`;
    }
    if (style === 'curly') {
      return `
        <g class="av-hair">
          <path d="M62 93c0-31 25-51 62-50 34 1 55 23 55 54-30-12-78-15-117-4z" fill="${color}"/>
          ${[68, 82, 98, 114, 130, 146, 162].map((x, i) => `<circle cx="${x}" cy="80" r="16" fill="${i % 2 ? color : dark}" opacity="${i % 2 ? .98 : .92}"/>`).join('')}
          <circle cx="78" cy="64" r="15" fill="${color}"/><circle cx="100" cy="56" r="16" fill="${dark}" opacity=".88"/><circle cx="124" cy="55" r="17" fill="${color}"/><circle cx="148" cy="65" r="15" fill="${dark}" opacity=".88"/>
        </g>`;
    }
    if (style === 'long') {
      return `
        <g class="av-hair av-hair-long">
          <path d="M64 83c7-29 29-47 60-46 37 1 60 25 61 65 1 37-10 68-30 84-3-24 0-58-8-78-22-16-51-19-79-7-7 26-3 58-6 84-20-18-26-63 2-102z" fill="${dark}"/>
          <path d="M64 92c5-32 30-52 62-48 32 4 51 25 52 57-26-15-74-18-114-9z" fill="${color}"/>
          <path d="M75 99c26-9 65-8 94 4" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".08"/>
        </g>`;
    }
    return `
      <g class="av-hair">
        <path d="M59 89c6-31 34-48 69-40 23 5 39 24 42 50-23-15-68-17-111-10z" fill="${color}" opacity=".98"/>
        <path d="M47 70c18-23 67-34 110-17 21 8 32 21 35 35l-8 10c-35-19-89-22-134-8l-8-9c-2-4 0-8 5-11z" fill="#1b1730"/>
        <path d="M54 69c21-16 61-25 100-10 15 5 26 14 31 25-44-14-87-16-134-4-1-4-1-8 3-11z" fill="#2a2450"/>
        <path d="M153 57c17 5 28 15 32 27-23-8-44-12-65-13 6-8 15-13 33-14z" fill="#3a2b6d" opacity=".72"/>
        <rect x="91" y="59" width="43" height="18" rx="7" fill="#120d22" opacity=".75"/>
        <circle cx="112" cy="68" r="4" fill="#7c2dff"/>
      </g>`;
  }

  function eyesSvg(type, className) {
    if (type === 'happy') {
      return `<g class="${className}"><path d="M81 112q9-10 20 0" fill="none" stroke="#14111d" stroke-width="5" stroke-linecap="round"/><path d="M127 112q9-10 20 0" fill="none" stroke="#14111d" stroke-width="5" stroke-linecap="round"/></g>`;
    }
    if (type === 'focus') {
      return `<g class="${className}"><ellipse cx="91" cy="112" rx="10" ry="12" fill="#fff"/><circle cx="94" cy="113" r="5.5" fill="#17151f"/><circle cx="96" cy="110" r="1.8" fill="#fff"/><ellipse cx="137" cy="112" rx="10" ry="12" fill="#fff"/><circle cx="134" cy="113" r="5.5" fill="#17151f"/><circle cx="136" cy="110" r="1.8" fill="#fff"/><path d="M78 97l24-5" stroke="#221525" stroke-width="5" stroke-linecap="round"/><path d="M127 92l24 5" stroke="#221525" stroke-width="5" stroke-linecap="round"/></g>`;
    }
    if (type === 'spark') {
      return `<g class="${className}"><path d="M91 98l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#fff" stroke="#17151f" stroke-width="3"/><path d="M137 98l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#fff" stroke="#17151f" stroke-width="3"/></g>`;
    }
    if (type === 'sad') {
      return `<g class="${className}"><path d="M80 107q10 8 21 0" fill="none" stroke="#14111d" stroke-width="5" stroke-linecap="round"/><path d="M126 107q10 8 21 0" fill="none" stroke="#14111d" stroke-width="5" stroke-linecap="round"/></g>`;
    }
    return `<g class="${className}"><ellipse cx="91" cy="112" rx="12" ry="14" fill="#fff"/><circle cx="93" cy="114" r="6" fill="#17151f"/><circle cx="96" cy="109" r="2.4" fill="#fff"/><ellipse cx="137" cy="112" rx="12" ry="14" fill="#fff"/><circle cx="135" cy="114" r="6" fill="#17151f"/><circle cx="138" cy="109" r="2.4" fill="#fff"/></g>`;
  }

  function accessorySvg(accessory, outfit) {
    if (accessory === 'glasses') {
      return `
        <g class="av-accessory av-accessory-glasses">
          <circle cx="91" cy="112" r="15" fill="none" stroke="#161226" stroke-width="4"/>
          <circle cx="137" cy="112" r="15" fill="none" stroke="#161226" stroke-width="4"/>
          <path d="M106 112h16" stroke="#161226" stroke-width="4" stroke-linecap="round"/>
          <path d="M76 110l-14-7M152 110l14-7" stroke="#161226" stroke-width="4" stroke-linecap="round"/>
        </g>`;
    }
    if (accessory === 'headset') {
      return `
        <g class="av-accessory av-accessory-headset">
          <path d="M72 93c5-33 28-53 58-53 30 0 51 20 56 54" fill="none" stroke="#12101f" stroke-width="8" stroke-linecap="round"/>
          <rect x="57" y="102" width="21" height="39" rx="10" fill="#181225" stroke="#8a26ff" stroke-width="4"/>
          <rect x="162" y="102" width="21" height="39" rx="10" fill="#181225" stroke="#8a26ff" stroke-width="4"/>
          <path d="M166 137c-2 17-13 27-30 29" fill="none" stroke="#1e1730" stroke-width="5" stroke-linecap="round"/>
          <circle cx="134" cy="166" r="4" fill="#ffba32"/>
        </g>`;
    }
    if (accessory === 'crown') {
      return `
        <g class="av-accessory av-accessory-crown">
          <path d="M83 55l12-22 17 19 18-23 16 24 17-15-6 34H86z" fill="#ffd34d" stroke="#4b2556" stroke-width="4" stroke-linejoin="round"/>
          <circle cx="95" cy="34" r="5" fill="#ff5b70"/><circle cx="130" cy="29" r="5" fill="#62d6ff"/><circle cx="164" cy="38" r="5" fill="#ff5b70"/>
        </g>`;
    }
    if (accessory === 'badge') {
      const badge = shade(outfit, 48);
      return `
        <g class="av-accessory av-accessory-badge">
          <path d="M136 207l9 5 10-4-1 11 8 8-11 2-5 10-6-10-11-1 8-8z" fill="${badge}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
          <text x="146" y="226" text-anchor="middle" font-family="Fredoka, Arial" font-size="10" font-weight="900" fill="#210b2d">V</text>
        </g>`;
    }
    return '';
  }

  function svg(config, uid) {
    const cfg = normalizeConfig(config);
    const skin = pickColor('skin', cfg.skin);
    const skinDark = shade(skin, -28);
    const hair = pickColor('hairColor', cfg.hairColor);
    const outfit = pickColor('outfit', cfg.outfit);
    const outfitDark = shade(outfit, -38);
    const outfitLight = shade(outfit, 32);
    const platform = pickColor('platform', cfg.platform);
    const platformDark = shade(platform, -44);
    const glowId = `avatarGlow-${uid}`;
    const torsoId = `avatarTorso-${uid}`;

    return `
      <svg class="avatar-svg" viewBox="0 0 220 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id="${glowId}" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="${platform}" stop-opacity=".95"/>
            <stop offset=".58" stop-color="${platform}" stop-opacity=".32"/>
            <stop offset="1" stop-color="${platform}" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${torsoId}" x1="62" y1="176" x2="158" y2="269" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="${outfitLight}"/>
            <stop offset=".45" stop-color="${outfit}"/>
            <stop offset="1" stop-color="${outfitDark}"/>
          </linearGradient>
        </defs>

        <g class="av-platform">
          <ellipse cx="110" cy="266" rx="68" ry="28" fill="url(#${glowId})"/>
          <ellipse cx="110" cy="271" rx="55" ry="10" fill="${platformDark}" opacity=".65"/>
          <ellipse cx="110" cy="261" rx="48" ry="10" fill="${platform}" opacity=".72"/>
          <path d="M62 259c16 15 80 15 96 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".28"/>
        </g>

        <g class="av-character">
          <g class="av-legs">
            <path d="M86 236c-7 13-10 26-9 38h33l2-40z" fill="#171225" stroke="#120d20" stroke-width="5"/>
            <path d="M134 236c7 13 10 26 9 38h-33l-2-40z" fill="#171225" stroke="#120d20" stroke-width="5"/>
            <path d="M79 264h31v15H75c-9 0-12-9-6-13 3-2 6-2 10-2z" fill="#241d39" stroke="#110b1d" stroke-width="4"/>
            <path d="M141 264h-31v15h35c9 0 12-9 6-13-3-2-6-2-10-2z" fill="#241d39" stroke="#110b1d" stroke-width="4"/>
            <path d="M77 278h32M111 278h32" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
          </g>

          <g class="av-arm av-arm-left">
            <path d="M69 190c-15 11-26 29-29 53" stroke="${outfitDark}" stroke-width="21" stroke-linecap="round" fill="none"/>
            <path d="M65 190c-13 10-21 25-24 42" stroke="${outfitLight}" stroke-width="6" stroke-linecap="round" fill="none" opacity=".28"/>
            <circle cx="39" cy="246" r="11" fill="${skin}" stroke="#1d102a" stroke-width="4"/>
          </g>
          <g class="av-arm av-arm-right">
            <path d="M151 190c15 11 26 29 29 53" stroke="${outfitDark}" stroke-width="21" stroke-linecap="round" fill="none"/>
            <path d="M155 190c13 10 21 25 24 42" stroke="${outfitLight}" stroke-width="6" stroke-linecap="round" fill="none" opacity=".28"/>
            <circle cx="181" cy="246" r="11" fill="${skin}" stroke="#1d102a" stroke-width="4"/>
          </g>

          <g class="av-torso">
            <path d="M75 174c-26 19-36 55-29 90h128c7-35-3-71-29-90-19 17-51 17-70 0z" fill="url(#${torsoId})" stroke="#1d102a" stroke-width="5" stroke-linejoin="round"/>
            <path d="M78 178c13 17 50 23 65-1l15 22c-22 21-76 21-98 0z" fill="${outfitDark}" opacity=".72"/>
            <path d="M75 207c11 12 22 18 35 18s26-6 37-18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".18"/>
            <path d="M91 202v51M129 202v51" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".62"/>
            <circle cx="91" cy="253" r="4" fill="#fff" opacity=".75"/><circle cx="129" cy="253" r="4" fill="#fff" opacity=".75"/>
          </g>

          <g class="av-neck">
            <path d="M94 159h32v30c-8 9-24 9-32 0z" fill="${skinDark}"/>
            <path d="M96 157h28v24c-8 7-20 7-28 0z" fill="${skin}"/>
          </g>

          <g class="av-head">
            <path d="M69 95c-11 5-15 19-10 31 4 9 13 14 22 10" fill="${skin}" stroke="#1d102a" stroke-width="4"/>
            <path d="M151 95c11 5 15 19 10 31-4 9-13 14-22 10" fill="${skin}" stroke="#1d102a" stroke-width="4"/>
            <path d="M68 88c4-32 25-51 56-51 33 0 57 21 60 53 5 49-25 84-58 84S62 137 68 88z" fill="${skin}" stroke="#1d102a" stroke-width="5"/>
            <path d="M75 96c6-28 24-44 51-44 23 0 41 12 50 34" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".11"/>
            ${hairSvg(cfg.hairStyle, hair)}
            ${eyesSvg(cfg.eyes, 'av-eyes av-eyes-config')}
            ${eyesSvg('happy', 'av-eyes av-eyes-happy')}
            ${eyesSvg('sad', 'av-eyes av-eyes-sad')}
            <path d="M111 111q-4 16-1 28" fill="none" stroke="#b66f56" stroke-width="3" stroke-linecap="round" opacity=".52"/>
            <ellipse class="av-cheek" cx="76" cy="133" rx="10" ry="5" fill="#ff758b" opacity=".38"/>
            <ellipse class="av-cheek" cx="148" cy="133" rx="10" ry="5" fill="#ff758b" opacity=".38"/>
            <path class="av-mouth av-mouth-normal" d="M99 145q12 9 25 0" fill="none" stroke="#1b1420" stroke-width="5" stroke-linecap="round"/>
            <path class="av-mouth av-mouth-smile" d="M93 142q17 21 38 0" fill="none" stroke="#1b1420" stroke-width="6" stroke-linecap="round"/>
            <path class="av-mouth av-mouth-sad" d="M97 156q15-15 31 0" fill="none" stroke="#1b1420" stroke-width="5" stroke-linecap="round"/>
            <g class="av-tears">
              <path class="av-tear av-tear-1" d="M79 127c8 10 9 17 2 21-7-4-6-11-2-21z" fill="#58d6ff"/>
              <path class="av-tear av-tear-2" d="M145 127c8 10 9 17 2 21-7-4-6-11-2-21z" fill="#58d6ff"/>
            </g>
          </g>

          ${accessorySvg(cfg.accessory, outfit)}
        </g>
      </svg>`;
  }

  let renderCount = 0;
  function renderInto(el, config, opts) {
    if (!el) return;
    const cfg = normalizeConfig(config);
    renderCount += 1;
    const classes = ['avatar-container'];
    if (opts && opts.flip) classes.push('flipped');
    el.innerHTML = `<div class="${classes.join(' ')}">${svg(cfg, renderCount)}</div>`;
  }

  function setState(el, state) {
    if (!el) return;
    const container = el.classList && el.classList.contains('avatar-container') ? el : el.querySelector('.avatar-container');
    if (!container) return;
    container.classList.remove('state-win', 'state-lose', 'state-cry');
    if (state === 'win') container.classList.add('state-win');
    if (state === 'lose') container.classList.add('state-lose');
    if (state === 'cry') container.classList.add('state-cry');
  }

  window.Avatar = { OPTIONS, DEFAULT, LABELS, SWATCH_CATEGORIES, load, save, renderInto, setState };
})();
