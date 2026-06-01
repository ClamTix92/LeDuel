// ============================================================
//  XP ENGINE — Le Duel
//  Moteur de gain d'expérience + courbe de niveaux.
//  Module autonome et testable. Aucune dépendance.
//
//  Idée : xp = BASE * mult_victoire * mult_format * mult_perf
//             + bonus_ecart_elo + bonus_premiere_victoire_jour
//  Toutes les valeurs sont réglables dans CONFIG ci-dessous.
// ============================================================

const XP_CONFIG = {
  // --- Socle ---
  BASE: 50,                 // XP de base pour un match joué en matchmaking

  // --- Victoire / défaite (multiplicateur appliqué au socle) ---
  MULT_VICTOIRE: 1.0,       // gagnant : 100% du socle
  MULT_DEFAITE: 0.4,        // perdant : 40% du socle (jamais 0, pour ne pas décourager)

  // --- Format BO1 / BO3 / BO5 (multiplicateur) ---
  MULT_FORMAT: { 1: 1.0, 3: 1.35, 5: 1.8 },

  // --- Performance : écart de temps en fin de match ---
  // Bonus de "domination" proportionnel à l'avance de temps du gagnant.
  // ratio = temps_restant_gagnant / temps_initial  (0 → 1)
  PERF_DOMINATION_MAX: 0.5, // jusqu'à +50% du socle pour une victoire écrasante
  // (le perdant ne touche pas ce bonus de domination)

  // --- Écart d'élo (critère clé) ---
  // Battre plus fort que soi → gros bonus ; battre plus faible → quasi rien.
  // On borne pour éviter les valeurs extrêmes.
  ELO_BONUS_MAX: 80,        // bonus max pour avoir battu un adversaire bien plus fort
  ELO_MALUS_MIN: 5,         // plancher : battre un adversaire très faible rapporte au moins ça
  ELO_ECHELLE: 400,         // échelle de sensibilité (comme le 400 du calcul d'élo)

  // --- Bonus première VICTOIRE du jour ---
  BONUS_PREMIERE_VICTOIRE_JOUR: 100,

  // --- Partie privée : XP réduit (anti-farm entre amis) ---
  MULT_PARTIE_PRIVEE: 0.4,  // 40% de l'XP en partie privée

  // --- Courbe de niveaux ---
  // xp cumulé requis pour ATTEINDRE le niveau n : LEVEL_BASE * (n-1)^LEVEL_EXP
  LEVEL_BASE: 100,
  LEVEL_EXP: 1.6,
  LEVEL_MAX: 100,
};

// ------------------------------------------------------------
//  CALCUL DE L'XP GAGNÉ APRÈS UN MATCH (pour UN joueur)
// ------------------------------------------------------------
// ctx = {
//   isWinner:        bool,
//   format:          1 | 3 | 5,        (rounds)
//   eloSelf:         number,            élo du joueur AVANT le match
//   eloOpponent:     number,            élo de l'adversaire AVANT le match
//   timeLeftSelf:    number,            secondes restantes (dernière manche)
//   timeLeftOpp:     number,
//   timeInitial:     number,            temps par joueur (ex. 45)
//   isFirstWinOfDay: bool,
//   isPrivate:       bool,
// }
// Retourne { xp, breakdown } — breakdown détaille chaque composante.
function computeMatchXp(ctx) {
  const C = XP_CONFIG;
  const breakdown = {};

  // 1) Socle × victoire/défaite × format
  const multWin = ctx.isWinner ? C.MULT_VICTOIRE : C.MULT_DEFAITE;
  const multFormat = C.MULT_FORMAT[ctx.format] ?? 1.0;
  let xp = C.BASE * multWin * multFormat;
  breakdown.base = Math.round(C.BASE * multWin * multFormat);

  // 2) Bonus de domination (écart de temps) — gagnant uniquement
  if (ctx.isWinner && ctx.timeInitial > 0) {
    const ratioSelf = clamp((ctx.timeLeftSelf ?? 0) / ctx.timeInitial, 0, 1);
    const ratioOpp = clamp((ctx.timeLeftOpp ?? 0) / ctx.timeInitial, 0, 1);
    // avance = combien le gagnant garde de temps en plus que le perdant
    const avance = clamp(ratioSelf - ratioOpp, 0, 1);
    const domination = C.BASE * C.PERF_DOMINATION_MAX * avance;
    xp += domination;
    breakdown.domination = Math.round(domination);
  } else {
    breakdown.domination = 0;
  }

  // 3) Bonus d'écart d'élo — gagnant uniquement
  // Plus l'adversaire était fort, plus le bonus est grand.
  if (ctx.isWinner) {
    // p = proba attendue de victoire du joueur (0→1). Battre un favori (p haut)
    // rapporte peu ; battre un outsider improbable (p bas) rapporte beaucoup.
    const p = 1 / (1 + Math.pow(10, (ctx.eloOpponent - ctx.eloSelf) / C.ELO_ECHELLE));
    const eloBonus = C.ELO_MALUS_MIN + (C.ELO_BONUS_MAX - C.ELO_MALUS_MIN) * (1 - p);
    xp += eloBonus;
    breakdown.eloBonus = Math.round(eloBonus);
  } else {
    breakdown.eloBonus = 0;
  }

  // 4) Bonus première victoire du jour
  if (ctx.isWinner && ctx.isFirstWinOfDay) {
    xp += C.BONUS_PREMIERE_VICTOIRE_JOUR;
    breakdown.premiereVictoireJour = C.BONUS_PREMIERE_VICTOIRE_JOUR;
  } else {
    breakdown.premiereVictoireJour = 0;
  }

  // 5) Réduction partie privée (appliquée à tout sauf, par choix, on l'applique au total)
  if (ctx.isPrivate) {
    xp *= C.MULT_PARTIE_PRIVEE;
    breakdown.privateMultiplier = C.MULT_PARTIE_PRIVEE;
  }

  xp = Math.max(1, Math.round(xp)); // jamais 0
  return { xp, breakdown };
}

// ------------------------------------------------------------
//  COURBE DE NIVEAUX
// ------------------------------------------------------------
// XP cumulé total requis pour ATTEINDRE le niveau `level` (level >= 1).
function totalXpForLevel(level) {
  const C = XP_CONFIG;
  if (level <= 1) return 0;
  return Math.round(C.LEVEL_BASE * Math.pow(level - 1, C.LEVEL_EXP));
}

// Convertit un total d'XP cumulé en { level, xpInLevel, xpForNext, progress }.
function levelFromXp(totalXp) {
  const C = XP_CONFIG;
  let level = 1;
  while (level < C.LEVEL_MAX && totalXp >= totalXpForLevel(level + 1)) {
    level++;
  }
  const xpThisLevel = totalXpForLevel(level);
  const xpNextLevel = totalXpForLevel(level + 1);
  const xpInLevel = totalXp - xpThisLevel;
  const xpForNext = xpNextLevel - xpThisLevel;
  return {
    level,
    xpInLevel,
    xpForNext: level >= C.LEVEL_MAX ? 0 : xpForNext,
    progress: level >= C.LEVEL_MAX ? 1 : xpInLevel / xpForNext,
    isMax: level >= C.LEVEL_MAX,
  };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

module.exports = {
  XP_CONFIG,
  computeMatchXp,
  totalXpForLevel,
  levelFromXp,
};

// ============================================================
//  BANC D'ESSAI — lancer avec :  node xp_engine.js
// ============================================================
if (require.main === module) {
  const scenarios = [
    { nom: 'Victoire BO1, adversaire égal, serrée',        ctx: { isWinner: true,  format: 1, eloSelf: 1000, eloOpponent: 1000, timeLeftSelf: 5,  timeLeftOpp: 3,  timeInitial: 45, isFirstWinOfDay: false, isPrivate: false } },
    { nom: 'Victoire BO3, adversaire égal, serrée',        ctx: { isWinner: true,  format: 3, eloSelf: 1000, eloOpponent: 1000, timeLeftSelf: 6,  timeLeftOpp: 4,  timeInitial: 45, isFirstWinOfDay: false, isPrivate: false } },
    { nom: 'Victoire BO5, adversaire égal, serrée',        ctx: { isWinner: true,  format: 5, eloSelf: 1000, eloOpponent: 1000, timeLeftSelf: 6,  timeLeftOpp: 4,  timeInitial: 45, isFirstWinOfDay: false, isPrivate: false } },
    { nom: 'Victoire BO5 ÉCRASANTE (gros écart temps)',    ctx: { isWinner: true,  format: 5, eloSelf: 1000, eloOpponent: 1000, timeLeftSelf: 38, timeLeftOpp: 2,  timeInitial: 45, isFirstWinOfDay: false, isPrivate: false } },
    { nom: 'Victoire contre BIEN plus fort (+300 élo)',    ctx: { isWinner: true,  format: 3, eloSelf: 1000, eloOpponent: 1300, timeLeftSelf: 10, timeLeftOpp: 5,  timeInitial: 45, isFirstWinOfDay: false, isPrivate: false } },
    { nom: 'Victoire contre BIEN plus faible (-300 élo)',  ctx: { isWinner: true,  format: 3, eloSelf: 1300, eloOpponent: 1000, timeLeftSelf: 10, timeLeftOpp: 5,  timeInitial: 45, isFirstWinOfDay: false, isPrivate: false } },
    { nom: 'Première victoire du jour (BO3 égal)',         ctx: { isWinner: true,  format: 3, eloSelf: 1000, eloOpponent: 1000, timeLeftSelf: 8,  timeLeftOpp: 5,  timeInitial: 45, isFirstWinOfDay: true,  isPrivate: false } },
    { nom: 'Défaite BO3, adversaire égal',                 ctx: { isWinner: false, format: 3, eloSelf: 1000, eloOpponent: 1000, timeLeftSelf: 0,  timeLeftOpp: 7,  timeInitial: 45, isFirstWinOfDay: false, isPrivate: false } },
    { nom: 'Victoire BO5 écrasante en PARTIE PRIVÉE',      ctx: { isWinner: true,  format: 5, eloSelf: 1000, eloOpponent: 1000, timeLeftSelf: 38, timeLeftOpp: 2,  timeInitial: 45, isFirstWinOfDay: false, isPrivate: true } },
  ];

  console.log('\n===== GAIN D\'XP PAR SCÉNARIO =====\n');
  for (const s of scenarios) {
    const { xp, breakdown } = computeMatchXp(s.ctx);
    console.log(`${s.nom.padEnd(48)} => ${String(xp).padStart(4)} XP`);
    console.log(`   détail: ${JSON.stringify(breakdown)}`);
  }

  console.log('\n===== COURBE DE NIVEAUX (XP cumulé requis) =====\n');
  for (const lvl of [2, 3, 5, 10, 20, 30, 50, 75, 100]) {
    const total = totalXpForLevel(lvl);
    const prev = totalXpForLevel(lvl - 1);
    console.log(`Niveau ${String(lvl).padStart(3)} : ${String(total).padStart(7)} XP total  (+${total - prev} depuis le niveau précédent)`);
  }

  console.log('\n===== EXEMPLES levelFromXp =====\n');
  for (const xp of [0, 80, 250, 1000, 5000, 20000]) {
    const info = levelFromXp(xp);
    console.log(`${String(xp).padStart(6)} XP => niveau ${info.level}, ${info.xpInLevel}/${info.xpForNext} dans le niveau (${Math.round(info.progress*100)}%)`);
  }
}