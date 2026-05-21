
// =====================================================================
// THÈME "ÉTATS DES USA"
//   - etatsusa : on affiche une carte des USA avec un État surligné
//   - Les fichiers PNG sont générés par generate_us_states_highlight_maps.py
// =====================================================================
const _US_STATES = [
    { name: "Alabama", diff: 3, extra: [] },
    { name: "Arizona", diff: 2, extra: [] },
    { name: "Arkansas", diff: 3, extra: [] },
    { name: "Californie", diff: 1, extra: ["California"] },
    { name: "Caroline du Nord", diff: 2, extra: ["North Carolina"] },
    { name: "Caroline du Sud", diff: 3, extra: ["South Carolina"] },
    { name: "Colorado", diff: 2, extra: [] },
    { name: "Connecticut", diff: 3, extra: [] },
    { name: "Dakota du Nord", diff: 3, extra: ["North Dakota"] },
    { name: "Dakota du Sud", diff: 3, extra: ["South Dakota"] },
    { name: "Delaware", diff: 3, extra: [] },
    { name: "Floride", diff: 1, extra: ["Florida"] },
    { name: "Géorgie", diff: 2, extra: ["Georgia"] },
    { name: "Idaho", diff: 3, extra: [] },
    { name: "Illinois", diff: 2, extra: [] },
    { name: "Indiana", diff: 3, extra: [] },
    { name: "Iowa", diff: 3, extra: [] },
    { name: "Kansas", diff: 3, extra: [] },
    { name: "Kentucky", diff: 3, extra: [] },
    { name: "Louisiane", diff: 2, extra: ["Louisiana"] },
    { name: "Maine", diff: 3, extra: [] },
    { name: "Maryland", diff: 3, extra: [] },
    { name: "Massachusetts", diff: 3, extra: [] },
    { name: "Michigan", diff: 2, extra: [] },
    { name: "Minnesota", diff: 3, extra: [] },
    { name: "Mississippi", diff: 3, extra: [] },
    { name: "Missouri", diff: 3, extra: [] },
    { name: "Montana", diff: 3, extra: [] },
    { name: "Nebraska", diff: 3, extra: [] },
    { name: "Nevada", diff: 1, extra: [] },
    { name: "New Hampshire", diff: 3, extra: [] },
    { name: "New Jersey", diff: 2, extra: [] },
    { name: "New York", diff: 1, extra: [] },
    { name: "Nouveau-Mexique", diff: 2, extra: ["New Mexico"] },
    { name: "Ohio", diff: 2, extra: [] },
    { name: "Oklahoma", diff: 2, extra: [] },
    { name: "Oregon", diff: 2, extra: [] },
    { name: "Pennsylvanie", diff: 2, extra: ["Pennsylvania"] },
    { name: "Rhode Island", diff: 3, extra: [] },
    { name: "Tennessee", diff: 2, extra: [] },
    { name: "Texas", diff: 1, extra: [] },
    { name: "Utah", diff: 2, extra: [] },
    { name: "Vermont", diff: 3, extra: [] },
    { name: "Virginie", diff: 2, extra: ["Virginia"] },
    { name: "Virginie-Occidentale", diff: 3, extra: ["West Virginia"] },
    { name: "Washington", diff: 2, extra: [] },
    { name: "Wisconsin", diff: 3, extra: [] },
    { name: "Wyoming", diff: 3, extra: [] },
];

function _slugEtatUsaImage(name) {
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

allQuestions.etatsusa = _US_STATES.map(s => ({
    image: `images/etats_usa/${_slugEtatUsaImage(s.name)}.png`,
    answer: s.name,
    acceptedAnswers: _acceptedNoms(s.name, s.extra || []),
    difficulty: s.diff,
}));
