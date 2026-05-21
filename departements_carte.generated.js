// =====================================================================
// THÈME "DÉPARTEMENTS (CARTE)"
//   - departementscarte : on affiche une carte de France avec le département
//                         surligné, ou le département seul pour la Corse et les DOM
//   - Les fichiers PNG sont générés par generate_departements_carte.py
// =====================================================================
function _slugDepartementImage(name) {
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

allQuestions.departementscarte = _DEPARTEMENTS.map(d => ({
    image: `images/departements_carte/${_slugDepartementImage(d.name)}.png`,
    answer: d.name,
    acceptedAnswers: _acceptedNoms(d.name),
    difficulty: d.diff,
}));
