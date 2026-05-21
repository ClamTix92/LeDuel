
// =====================================================================
// THÈME "RÉGIONS (CARTE)"
//   - regionscarte : on affiche une carte de France avec la région surlignée
//   - Les fichiers PNG sont générés par generate_regions_carte.py
// =====================================================================
const _REGIONS_METRO = [
    { code: "84", name: "Auvergne-Rhône-Alpes", diff: 1, extra: [] },
    { code: "27", name: "Bourgogne-Franche-Comté", diff: 2, extra: [] },
    { code: "53", name: "Bretagne", diff: 1, extra: [] },
    { code: "24", name: "Centre-Val de Loire", diff: 2, extra: [] },
    { code: "94", name: "Corse", diff: 2, extra: [] },
    { code: "44", name: "Grand Est", diff: 2, extra: [] },
    { code: "32", name: "Hauts-de-France", diff: 1, extra: [] },
    { code: "11", name: "Île-de-France", diff: 1, extra: ["Ile de France"] },
    { code: "28", name: "Normandie", diff: 1, extra: [] },
    { code: "75", name: "Nouvelle-Aquitaine", diff: 1, extra: [] },
    { code: "76", name: "Occitanie", diff: 1, extra: [] },
    { code: "52", name: "Pays de la Loire", diff: 1, extra: [] },
    { code: "93", name: "Provence-Alpes-Côte d'Azur", diff: 1, extra: ["PACA", "Provence Alpes Cote d Azur"] },
];

function _slugRegionImage(name) {
    return String(name)
        .replace(/œ/g, "oe")
        .replace(/Œ/g, "Oe")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " et ")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_");
}

allQuestions.regionscarte = _REGIONS_METRO.map(r => ({
    image: `images/regions_carte/${_slugRegionImage(r.name)}.png`,
    answer: r.name,
    acceptedAnswers: _acceptedNoms(r.name, r.extra || []),
    difficulty: r.diff,
}));
