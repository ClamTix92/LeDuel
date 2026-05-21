// =====================================================================
// THÈME "FORMES DES PAYS" — basé sur _COUNTRIES
//   - formespays : on affiche la silhouette du pays, on attend le NOM du pays
//   - Les fichiers PNG sont générés par generate_country_shapes.py
// =====================================================================
function _slugPaysImage(name) {
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

allQuestions.formespays = _COUNTRIES.map(c => ({
    image: `images/formes_pays/${_slugPaysImage(c.name)}.png`,
    answer: c.name,
    acceptedAnswers: _acceptedNoms(c.name, c.extraCountry || []),
    difficulty: c.diff,
}));
