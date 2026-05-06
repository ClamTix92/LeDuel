const fs = require('fs');
const path = require('path');

// Dictionnaire partiel (à compléter ou utiliser une librairie)
const isoToFrench = {
    "ad": "andorre", "ae": "emirats arabes unis", "af": "afghanistan", "ag": "antigua et barbuda",
    "al": "albanie", "am": "armenie", "ao": "angola", "ar": "argentine", "at": "autriche",
    "au": "australie", "az": "azerbaidjan", "ba": "bosnie", "bb": "barbade", "bd": "bangladesh",
    "be": "belgique", "bf": "burkina faso", "bg": "bulgarie", "bh": "bahrein", "bi": "burundi",
    "bj": "benin", "bn": "brunei", "bo": "bolivie", "br": "bresil", "bs": "bahamas",
    "bt": "bhoutan", "bw": "botswana", "by": "bielorussie", "bz": "belize", "ca": "canada",
    "cd": "congo", "cf": "centrafrique", "cg": "congo", "ch": "suisse", "ci": "cote d'ivoire",
    "cl": "chili", "cm": "cameroun", "cn": "chine", "co": "colombie", "cr": "costa rica",
    "cu": "cuba", "cv": "cap vert", "cy": "chypre", "cz": "republique tcheque", "de": "allemagne",
    "dj": "djibouti", "dk": "danemark", "dm": "dominique", "do": "republique dominicaine",
    "dz": "algerie", "ec": "equateur", "ee": "estonie", "eg": "egypte", "er": "erythree",
    "es": "espagne", "et": "ethiopie", "fi": "finlande", "fj": "fidji", "fm": "micronesie",
    "fr": "france", "ga": "gabon", "gb": "royaume uni", "gd": "grenade", "ge": "georgie",
    "gh": "ghana", "gm": "gambie", "gn": "guinee", "gq": "guinee equatoriale", "gr": "grece",
    "gt": "guatemala", "gw": "guinee bissau", "gy": "guyana", "hn": "honduras", "hr": "croatie",
    "ht": "haiti", "hu": "hongrie", "id": "indonesie", "ie": "irlande", "il": "israel",
    "in": "inde", "iq": "irak", "ir": "iran", "is": "islande", "it": "italie",
    "jm": "jamaique", "jo": "jordanie", "jp": "japon", "ke": "kenya", "kg": "kirghizistan",
    "kh": "cambodge", "km": "comores", "kn": "saint kitts et nevis", "kp": "coree du nord",
    "kr": "coree du sud", "kw": "koweit", "kz": "kazakhstan", "la": "laos", "lb": "liban",
    "lc": "sainte lucie", "li": "liechtenstein", "lk": "sri lanka", "lr": "liberia", "ls": "lesotho",
    "lt": "lituanie", "lu": "luxembourg", "lv": "lettonie", "ly": "libye", "ma": "maroc",
    "mc": "monaco", "md": "moldavie", "me": "montenegro", "mg": "madagascar", "mh": "iles marshall",
    "mk": "macedoine", "ml": "mali", "mm": "myanmar", "mn": "mongolie", "mr": "mauritanie",
    "mt": "malte", "mu": "maurice", "mv": "maldives", "mw": "malawi", "mx": "mexique",
    "my": "malaisie", "mz": "mozambique", "na": "namibie", "ne": "niger", "ng": "nigeria",
    "ni": "nicaragua", "nl": "pays bas", "no": "norvege", "np": "nepal", "nz": "nouvelle zelande",
    "om": "oman", "pa": "panama", "pe": "perou", "pg": "papouasie", "ph": "philippines",
    "pk": "pakistan", "pl": "pologne", "pt": "portugal", "pw": "palaos", "py": "paraguay",
    "qa": "qatar", "ro": "roumanie", "rs": "serbie", "ru": "russie", "rw": "rwanda",
    "sa": "arabie saoudite", "sc": "seychelles", "sd": "soudan", "se": "suede", "sg": "singapour",
    "si": "slovenie", "sk": "slovaquie", "sl": "sierra leone", "sm": "saint marin", "sn": "senegal",
    "so": "somalie", "sr": "suriname", "ss": "soudan du sud", "st": "sao tome", "sv": "salvador",
    "sy": "syrie", "sz": "eswatini", "td": "tchad", "tg": "togo", "th": "thailande", "tj": "tadjikistan",
    "tl": "timor oriental", "tm": "turkmenistan", "tn": "tunisie", "to": "tonga", "tr": "turquie",
    "tt": "trinite et tobago", "tv": "tuvalu", "tw": "taiwan", "tz": "tanzanie", "ua": "ukraine",
    "ug": "ouganda", "us": "etats unis", "uy": "uruguay", "uz": "ouzbekistan", "vc": "saint vincent",
    "ve": "venezuela", "vn": "vietnam", "vu": "vanuatu", "ws": "samoa", "ye": "yemen",
    "za": "afrique du sud", "zm": "zambie", "zw": "zimbabwe"
};

const directoryPath = path.join(__dirname, 'images/drapeaux'); // Ton dossier d'images

fs.readdir(directoryPath, (err, files) => {
    if (err) return console.log('Impossible de lire le dossier: ' + err);

    const questions = [];

    files.forEach(file => {
        const iso = file.split('.')[0].toLowerCase(); // récupère 'fr' de 'fr.png'
        if (isoToFrench[iso]) {
            questions.push({
                image: `images/drapeaux/${file}`,
                answer: isoToFrench[iso]
            });
        }
    });

    console.log("Voici le code à copier dans server.js :");
    console.log("Voici le code à copier dans server.js :");
    console.log("        drapeaux: [");
    questions.forEach((q, index) => {
        const comma = index === questions.length - 1 ? "" : ",";
        // On construit la ligne manuellement pour contrôler les guillemets
        console.log(`            { image: "${q.image}", answer: "${q.answer}" }${comma}`);
    });
    console.log("        ],");
});