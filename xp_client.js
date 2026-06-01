// ============================================================
//  XP CLIENT — Le Duel
//  Miroir CÔTÉ NAVIGATEUR de la courbe de niveaux du serveur.
//  Doit rester synchronisé avec LEVEL_BASE / LEVEL_EXP / LEVEL_MAX
//  de xp_engine.js (côté serveur).
//  Le calcul d'XP gagné reste 100% serveur (anti-triche) ; ici on
//  ne fait QUE convertir un total d'XP en niveau pour l'affichage.
// ============================================================

const XP_CLIENT_CONFIG = {
  LEVEL_BASE: 100,
  LEVEL_EXP: 1.6,
  LEVEL_MAX: 100,
};

function xpTotalForLevel(level) {
  const C = XP_CLIENT_CONFIG;
  if (level <= 1) return 0;
  return Math.round(C.LEVEL_BASE * Math.pow(level - 1, C.LEVEL_EXP));
}

// total XP cumulé → { level, xpInLevel, xpForNext, progress, isMax }
function xpLevelFromTotal(totalXp) {
  const C = XP_CLIENT_CONFIG;
  totalXp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  while (level < C.LEVEL_MAX && totalXp >= xpTotalForLevel(level + 1)) level++;
  const xpThis = xpTotalForLevel(level);
  const xpNext = xpTotalForLevel(level + 1);
  const xpInLevel = totalXp - xpThis;
  const xpForNext = xpNext - xpThis;
  return {
    level,
    xpInLevel,
    xpForNext: level >= C.LEVEL_MAX ? 0 : xpForNext,
    progress: level >= C.LEVEL_MAX ? 1 : (xpForNext > 0 ? xpInLevel / xpForNext : 0),
    isMax: level >= C.LEVEL_MAX,
  };
}

// --- Met à jour le niveau + la barre dans le HUD (haut de l'accueil) ---
function updateXpHUD(totalXp) {
  const info = xpLevelFromTotal(totalXp);
  const levelEl = document.querySelector('.top-player-text span');
  const barEl = document.querySelector('.top-player-text i');
  if (levelEl) levelEl.textContent = info.level;
  if (barEl) {
    barEl.style.background =
      `linear-gradient(90deg, #ff8c2e, #ef32ff ${Math.round(info.progress * 100)}%, rgba(107,42,147,.6) ${Math.round(info.progress * 100) + 1}%)`;
    barEl.title = info.isMax
      ? `Niveau MAX`
      : `Niveau ${info.level} — ${info.xpInLevel}/${info.xpForNext} XP`;
  }
}