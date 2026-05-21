# -*- coding: utf-8 -*-
"""
Génère un thème LeDuel "Formes des pays" à partir d'un fichier countries.geojson(.txt).

Ce script :
1) lit la liste _COUNTRIES déjà présente dans server.js ;
2) génère une image PNG par pays dans images/formes_pays/ ;
3) crée un bloc JS compatible avec allQuestions ;
4) peut patcher automatiquement server.js, script.js et index.html.

Installation minimale :
    py -m pip install pillow shapely

Exemple d'utilisation depuis le dossier de ton projet LeDuel :
    py generate_country_shapes.py --geojson "C:\\Users\\Toi\\Downloads\\countries.geojson.txt" --project "." --patch-code
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import shutil
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from PIL import Image, ImageDraw
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import unary_union

# Codes ISO-3 correspondant aux 191 pays de ton thème "capitales".
# Le script utilise d'abord l'ISO_A3 du GeoJSON, ce qui évite les problèmes
# de correspondance entre noms français et noms anglais.
ISO3_BY_FRENCH_NAME: Dict[str, str] = {
    "Algérie": "DZA",
    "Allemagne": "DEU",
    "Argentine": "ARG",
    "Australie": "AUS",
    "Belgique": "BEL",
    "Brésil": "BRA",
    "Canada": "CAN",
    "Chine": "CHN",
    "Corée du Nord": "PRK",
    "Corée du Sud": "KOR",
    "Espagne": "ESP",
    "France": "FRA",
    "Grèce": "GRC",
    "Italie": "ITA",
    "Japon": "JPN",
    "Maroc": "MAR",
    "Mexique": "MEX",
    "Portugal": "PRT",
    "Royaume-Uni": "GBR",
    "Suisse": "CHE",
    "États-Unis": "USA",
    "Afrique du Sud": "ZAF",
    "Albanie": "ALB",
    "Andorre": "AND",
    "Angola": "AGO",
    "Arménie": "ARM",
    "Autriche": "AUT",
    "Azerbaïdjan": "AZE",
    "Bangladesh": "BGD",
    "Barbade": "BRB",
    "Biélorussie": "BLR",
    "Bolivie": "BOL",
    "Bosnie": "BIH",
    "Botswana": "BWA",
    "Bulgarie": "BGR",
    "Cameroun": "CMR",
    "Chili": "CHL",
    "Chypre": "CYP",
    "Colombie": "COL",
    "Costa Rica": "CRI",
    "Croatie": "HRV",
    "Cuba": "CUB",
    "Côte d'Ivoire": "CIV",
    "Danemark": "DNK",
    "Estonie": "EST",
    "Finlande": "FIN",
    "Ghana": "GHA",
    "Géorgie": "GEO",
    "Hongrie": "HUN",
    "Inde": "IND",
    "Indonésie": "IDN",
    "Iran": "IRN",
    "Irlande": "IRL",
    "Islande": "ISL",
    "Israël": "ISR",
    "Jamaïque": "JAM",
    "Liban": "LBN",
    "Liechtenstein": "LIE",
    "Lituanie": "LTU",
    "Luxembourg": "LUX",
    "Malte": "MLT",
    "Monaco": "MCO",
    "Nigeria": "NGA",
    "Norvège": "NOR",
    "Nouvelle-Zélande": "NZL",
    "Pays-Bas": "NLD",
    "Pologne": "POL",
    "Pérou": "PER",
    "Russie": "RUS",
    "République dominicaine": "DOM",
    "République du Congo": "COG",
    "République démocratique du Congo": "COD",
    "République tchèque": "CZE",
    "Seychelles": "SYC",
    "Slovaquie": "SVK",
    "Slovénie": "SVN",
    "Suède": "SWE",
    "Sénégal": "SEN",
    "Taïwan": "TWN",
    "Thaïlande": "THA",
    "Tunisie": "TUN",
    "Turquie": "TUR",
    "Ukraine": "UKR",
    "Vietnam": "VNM",
    "Égypte": "EGY",
    "Équateur": "ECU",
    "Afghanistan": "AFG",
    "Antigua-et-Barbuda": "ATG",
    "Arabie saoudite": "SAU",
    "Bahamas": "BHS",
    "Bahreïn": "BHR",
    "Belize": "BLZ",
    "Bhoutan": "BTN",
    "Brunei": "BRN",
    "Burkina Faso": "BFA",
    "Burundi": "BDI",
    "Bénin": "BEN",
    "Cambodge": "KHM",
    "Cap-Vert": "CPV",
    "Centrafrique": "CAF",
    "Comores": "COM",
    "Djibouti": "DJI",
    "Dominique": "DMA",
    "Eswatini": "SWZ",
    "Fidji": "FJI",
    "Gabon": "GAB",
    "Gambie": "GMB",
    "Grenade": "GRD",
    "Guatemala": "GTM",
    "Guinée": "GIN",
    "Guinée équatoriale": "GNQ",
    "Guinée-Bissau": "GNB",
    "Guyana": "GUY",
    "Haïti": "HTI",
    "Honduras": "HND",
    "Irak": "IRQ",
    "Jordanie": "JOR",
    "Kazakhstan": "KAZ",
    "Kenya": "KEN",
    "Kirghizistan": "KGZ",
    "Koweït": "KWT",
    "Laos": "LAO",
    "Lesotho": "LSO",
    "Lettonie": "LVA",
    "Liberia": "LBR",
    "Libye": "LBY",
    "Macédoine": "MKD",
    "Madagascar": "MDG",
    "Malaisie": "MYS",
    "Malawi": "MWI",
    "Maldives": "MDV",
    "Mali": "MLI",
    "Maurice": "MUS",
    "Mauritanie": "MRT",
    "Micronésie": "FSM",
    "Moldavie": "MDA",
    "Mongolie": "MNG",
    "Monténégro": "MNE",
    "Mozambique": "MOZ",
    "Myanmar": "MMR",
    "Namibie": "NAM",
    "Nicaragua": "NIC",
    "Niger": "NER",
    "Népal": "NPL",
    "Oman": "OMN",
    "Ouganda": "UGA",
    "Ouzbékistan": "UZB",
    "Pakistan": "PAK",
    "Palaos": "PLW",
    "Panama": "PAN",
    "Papouasie-Nouvelle-Guinée": "PNG",
    "Paraguay": "PRY",
    "Philippines": "PHL",
    "Qatar": "QAT",
    "Roumanie": "ROU",
    "Rwanda": "RWA",
    "Saint-Kitts-et-Nevis": "KNA",
    "Saint-Marin": "SMR",
    "Saint-Vincent-et-les-Grenadines": "VCT",
    "Sainte-Lucie": "LCA",
    "Salvador": "SLV",
    "Samoa": "WSM",
    "Sao Tomé-et-Principe": "STP",
    "Serbie": "SRB",
    "Sierra Leone": "SLE",
    "Singapour": "SGP",
    "Somalie": "SOM",
    "Soudan": "SDN",
    "Soudan du Sud": "SSD",
    "Sri Lanka": "LKA",
    "Suriname": "SUR",
    "Syrie": "SYR",
    "Tadjikistan": "TJK",
    "Tanzanie": "TZA",
    "Tchad": "TCD",
    "Timor oriental": "TLS",
    "Togo": "TGO",
    "Tonga": "TON",
    "Trinité-et-Tobago": "TTO",
    "Turkménistan": "TKM",
    "Tuvalu": "TUV",
    "Uruguay": "URY",
    "Vanuatu": "VUT",
    "Venezuela": "VEN",
    "Yémen": "YEM",
    "Zambie": "ZMB",
    "Zimbabwe": "ZWE",
    "Émirats arabes unis": "ARE",
    "Érythrée": "ERI",
    "Éthiopie": "ETH",
    "Îles Marshall": "MHL",
}

# Fallback par noms anglais si le GeoJSON n'a pas de champ ISO exploitable.
ENGLISH_NAME_BY_FRENCH_NAME: Dict[str, str] = {
    "Algérie": "Algeria", "Allemagne": "Germany", "Argentine": "Argentina", "Australie": "Australia",
    "Belgique": "Belgium", "Brésil": "Brazil", "Canada": "Canada", "Chine": "China",
    "Corée du Nord": "North Korea", "Corée du Sud": "South Korea", "Espagne": "Spain", "France": "France",
    "Grèce": "Greece", "Italie": "Italy", "Japon": "Japan", "Maroc": "Morocco", "Mexique": "Mexico",
    "Portugal": "Portugal", "Royaume-Uni": "United Kingdom", "Suisse": "Switzerland",
    "États-Unis": "United States of America", "Afrique du Sud": "South Africa", "Albanie": "Albania",
    "Andorre": "Andorra", "Angola": "Angola", "Arménie": "Armenia", "Autriche": "Austria",
    "Azerbaïdjan": "Azerbaijan", "Bangladesh": "Bangladesh", "Barbade": "Barbados",
    "Biélorussie": "Belarus", "Bolivie": "Bolivia", "Bosnie": "Bosnia and Herzegovina",
    "Botswana": "Botswana", "Bulgarie": "Bulgaria", "Cameroun": "Cameroon", "Chili": "Chile",
    "Chypre": "Cyprus", "Colombie": "Colombia", "Costa Rica": "Costa Rica", "Croatie": "Croatia",
    "Cuba": "Cuba", "Côte d'Ivoire": "Ivory Coast", "Danemark": "Denmark", "Estonie": "Estonia",
    "Finlande": "Finland", "Ghana": "Ghana", "Géorgie": "Georgia", "Hongrie": "Hungary",
    "Inde": "India", "Indonésie": "Indonesia", "Iran": "Iran", "Irlande": "Ireland", "Islande": "Iceland",
    "Israël": "Israel", "Jamaïque": "Jamaica", "Liban": "Lebanon", "Liechtenstein": "Liechtenstein",
    "Lituanie": "Lithuania", "Luxembourg": "Luxembourg", "Malte": "Malta", "Monaco": "Monaco",
    "Nigeria": "Nigeria", "Norvège": "Norway", "Nouvelle-Zélande": "New Zealand", "Pays-Bas": "Netherlands",
    "Pologne": "Poland", "Pérou": "Peru", "Russie": "Russia", "République dominicaine": "Dominican Republic",
    "République du Congo": "Republic of the Congo", "République démocratique du Congo": "Democratic Republic of the Congo",
    "République tchèque": "Czechia", "Seychelles": "Seychelles", "Slovaquie": "Slovakia", "Slovénie": "Slovenia",
    "Suède": "Sweden", "Sénégal": "Senegal", "Taïwan": "Taiwan", "Thaïlande": "Thailand",
    "Tunisie": "Tunisia", "Turquie": "Turkey", "Ukraine": "Ukraine", "Vietnam": "Vietnam",
    "Égypte": "Egypt", "Équateur": "Ecuador", "Afghanistan": "Afghanistan", "Antigua-et-Barbuda": "Antigua and Barbuda",
    "Arabie saoudite": "Saudi Arabia", "Bahamas": "The Bahamas", "Bahreïn": "Bahrain", "Belize": "Belize",
    "Bhoutan": "Bhutan", "Brunei": "Brunei", "Burkina Faso": "Burkina Faso", "Burundi": "Burundi",
    "Bénin": "Benin", "Cambodge": "Cambodia", "Cap-Vert": "Cape Verde", "Centrafrique": "Central African Republic",
    "Comores": "Comoros", "Djibouti": "Djibouti", "Dominique": "Dominica", "Eswatini": "eSwatini",
    "Fidji": "Fiji", "Gabon": "Gabon", "Gambie": "Gambia", "Grenade": "Grenada",
    "Guatemala": "Guatemala", "Guinée": "Guinea", "Guinée équatoriale": "Equatorial Guinea",
    "Guinée-Bissau": "Guinea-Bissau", "Guyana": "Guyana", "Haïti": "Haiti", "Honduras": "Honduras",
    "Irak": "Iraq", "Jordanie": "Jordan", "Kazakhstan": "Kazakhstan", "Kenya": "Kenya",
    "Kirghizistan": "Kyrgyzstan", "Koweït": "Kuwait", "Laos": "Laos", "Lesotho": "Lesotho",
    "Lettonie": "Latvia", "Liberia": "Liberia", "Libye": "Libya", "Macédoine": "North Macedonia",
    "Madagascar": "Madagascar", "Malaisie": "Malaysia", "Malawi": "Malawi", "Maldives": "Maldives",
    "Mali": "Mali", "Maurice": "Mauritius", "Mauritanie": "Mauritania", "Micronésie": "Federated States of Micronesia",
    "Moldavie": "Moldova", "Mongolie": "Mongolia", "Monténégro": "Montenegro", "Mozambique": "Mozambique",
    "Myanmar": "Myanmar", "Namibie": "Namibia", "Nicaragua": "Nicaragua", "Niger": "Niger",
    "Népal": "Nepal", "Oman": "Oman", "Ouganda": "Uganda", "Ouzbékistan": "Uzbekistan",
    "Pakistan": "Pakistan", "Palaos": "Palau", "Panama": "Panama", "Papouasie-Nouvelle-Guinée": "Papua New Guinea",
    "Paraguay": "Paraguay", "Philippines": "Philippines", "Qatar": "Qatar", "Roumanie": "Romania",
    "Rwanda": "Rwanda", "Saint-Kitts-et-Nevis": "Saint Kitts and Nevis", "Saint-Marin": "San Marino",
    "Saint-Vincent-et-les-Grenadines": "Saint Vincent and the Grenadines", "Sainte-Lucie": "Saint Lucia",
    "Salvador": "El Salvador", "Samoa": "Samoa", "Sao Tomé-et-Principe": "São Tomé and Principe",
    "Serbie": "Serbia", "Sierra Leone": "Sierra Leone", "Singapour": "Singapore", "Somalie": "Somalia",
    "Soudan": "Sudan", "Soudan du Sud": "South Sudan", "Sri Lanka": "Sri Lanka", "Suriname": "Suriname",
    "Syrie": "Syria", "Tadjikistan": "Tajikistan", "Tanzanie": "United Republic of Tanzania", "Tchad": "Chad",
    "Timor oriental": "East Timor", "Togo": "Togo", "Tonga": "Tonga", "Trinité-et-Tobago": "Trinidad and Tobago",
    "Turkménistan": "Turkmenistan", "Tuvalu": "Tuvalu", "Uruguay": "Uruguay", "Vanuatu": "Vanuatu",
    "Venezuela": "Venezuela", "Yémen": "Yemen", "Zambie": "Zambia", "Zimbabwe": "Zimbabwe",
    "Émirats arabes unis": "United Arab Emirates", "Érythrée": "Eritrea", "Éthiopie": "Ethiopia",
    "Îles Marshall": "Marshall Islands",
}


def normalize_text(value: Any) -> str:
    value = str(value or "")
    value = value.replace("œ", "oe").replace("Œ", "Oe")
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def slugify_country_name(name: str) -> str:
    name = name.replace("œ", "oe").replace("Œ", "Oe")
    name = unicodedata.normalize("NFD", name)
    name = "".join(ch for ch in name if unicodedata.category(ch) != "Mn")
    name = name.lower().replace("&", " et ")
    name = re.sub(r"[^a-z0-9]+", "_", name)
    return re.sub(r"_+", "_", name).strip("_")


def js_unescape(s: str) -> str:
    # Suffisant pour les chaînes double-quoted du fichier actuel.
    return bytes(s, "utf-8").decode("unicode_escape") if "\\" in s else s


def extract_countries_from_server(server_js_path: Path) -> List[dict]:
    text = server_js_path.read_text(encoding="utf-8")
    start = text.find("const _COUNTRIES = [")
    if start == -1:
        raise RuntimeError("Impossible de trouver `const _COUNTRIES = [` dans server.js")

    # Trouve le ]; qui ferme le tableau _COUNTRIES.
    end = text.find("\n];", start)
    if end == -1:
        raise RuntimeError("Impossible de trouver la fin du tableau _COUNTRIES dans server.js")
    block = text[start:end]

    pattern = re.compile(
        r'\{\s*name:\s*"((?:\\.|[^"])*)",\s*'
        r'capital:\s*"((?:\\.|[^"])*)",\s*'
        r'diff:\s*(\d+),\s*'
        r'extraCountry:\s*\[(.*?)\],\s*'
        r'extraCapital:',
        re.S,
    )

    countries: List[dict] = []
    for match in pattern.finditer(block):
        name = js_unescape(match.group(1))
        capital = js_unescape(match.group(2))
        diff = int(match.group(3))
        extras = [js_unescape(x) for x in re.findall(r'"((?:\\.|[^"])*)"', match.group(4))]
        countries.append({"name": name, "capital": capital, "diff": diff, "extraCountry": extras})

    if not countries:
        raise RuntimeError("Aucun pays extrait de _COUNTRIES. Le format du tableau a peut-être changé.")
    return countries


def read_geojson_features(geojson_path: Path) -> List[dict]:
    data = json.loads(geojson_path.read_text(encoding="utf-8-sig"))
    if data.get("type") == "FeatureCollection":
        return data.get("features", [])
    if data.get("type") == "Feature":
        return [data]
    raise RuntimeError("Le fichier fourni ne ressemble pas à un GeoJSON FeatureCollection.")


def get_iso_values(props: dict) -> List[str]:
    keys = [
        "ISO_A3", "ADM0_A3", "GU_A3", "SOV_A3", "WB_A3", "BRK_A3",
        "iso_a3", "adm0_a3", "gu_a3", "sov_a3", "wb_a3", "brk_a3",
    ]
    vals: List[str] = []
    for key in keys:
        value = props.get(key)
        if value and str(value) != "-99":
            vals.append(str(value).upper())
    return vals


def build_geojson_indexes(features: List[dict]) -> Tuple[Dict[str, dict], Dict[str, dict]]:
    by_iso: Dict[str, dict] = {}
    by_name: Dict[str, dict] = {}
    for feature in features:
        props = feature.get("properties") or {}
        for iso in get_iso_values(props):
            by_iso.setdefault(iso, feature)
        for value in props.values():
            if isinstance(value, str) and value.strip() and value.strip() != "-99":
                by_name.setdefault(normalize_text(value), feature)
    return by_iso, by_name


def find_feature_for_country(country: dict, by_iso: Dict[str, dict], by_name: Dict[str, dict]) -> Optional[dict]:
    name = country["name"]

    iso3 = ISO3_BY_FRENCH_NAME.get(name)
    if iso3 and iso3 in by_iso:
        return by_iso[iso3]

    candidates = [name]
    candidates.extend(country.get("extraCountry") or [])
    if name in ENGLISH_NAME_BY_FRENCH_NAME:
        candidates.append(ENGLISH_NAME_BY_FRENCH_NAME[name])

    # Quelques variantes courantes de Natural Earth / DataHub.
    if name == "Bahamas":
        candidates.extend(["Bahamas", "The Bahamas"])
    elif name == "République tchèque":
        candidates.extend(["Czech Republic", "Czechia"])
    elif name == "Macédoine":
        candidates.extend(["Macedonia", "North Macedonia"])
    elif name == "Tanzanie":
        candidates.extend(["Tanzania", "United Republic of Tanzania"])
    elif name == "Timor oriental":
        candidates.extend(["Timor-Leste", "East Timor"])
    elif name == "Eswatini":
        candidates.extend(["Swaziland", "eSwatini", "Eswatini"])
    elif name == "Côte d'Ivoire":
        candidates.extend(["Côte d'Ivoire", "Ivory Coast"])

    for candidate in candidates:
        feature = by_name.get(normalize_text(candidate))
        if feature:
            return feature
    return None


def iter_polygons(geom: Any) -> Iterable[Polygon]:
    if geom.is_empty:
        return
    if isinstance(geom, Polygon):
        yield geom
    elif isinstance(geom, MultiPolygon):
        yield from geom.geoms
    else:
        # GeometryCollection éventuelle.
        for sub in getattr(geom, "geoms", []):
            yield from iter_polygons(sub)


def draw_geometry_png(
    geom: Any,
    out_path: Path,
    size: int,
    padding_ratio: float,
    fill: str,
    background: str,
    supersample: int,
) -> None:
    geom = geom.buffer(0) if not geom.is_valid else geom
    minx, miny, maxx, maxy = geom.bounds
    width = max(maxx - minx, 1e-9)
    height = max(maxy - miny, 1e-9)

    canvas_size = int(size * supersample)
    padding = int(canvas_size * padding_ratio)
    drawable_w = max(canvas_size - 2 * padding, 1)
    drawable_h = max(canvas_size - 2 * padding, 1)
    scale = min(drawable_w / width, drawable_h / height)
    offset_x = (canvas_size - width * scale) / 2
    offset_y = (canvas_size - height * scale) / 2

    def project(coord: Tuple[float, float]) -> Tuple[int, int]:
        x, y = coord[:2]
        px = offset_x + (x - minx) * scale
        py = offset_y + (maxy - y) * scale
        return int(round(px)), int(round(py))

    img = Image.new("RGBA", (canvas_size, canvas_size), background)
    draw = ImageDraw.Draw(img)

    for polygon in iter_polygons(geom):
        exterior = [project(p) for p in polygon.exterior.coords]
        if len(exterior) >= 3:
            draw.polygon(exterior, fill=fill)
        for interior in polygon.interiors:
            hole = [project(p) for p in interior.coords]
            if len(hole) >= 3:
                draw.polygon(hole, fill=background)

    if supersample > 1:
        img = img.resize((size, size), Image.Resampling.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)


def make_server_js_block() -> str:
    return r'''

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
'''.strip("\n") + "\n"


def backup_file(path: Path) -> None:
    stamp = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(path, path.with_suffix(path.suffix + f".bak_country_shapes_{stamp}"))


def patch_server_js(server_js: Path) -> bool:
    text = server_js.read_text(encoding="utf-8")
    if "allQuestions.formespays" in text:
        return False

    block = make_server_js_block()
    pattern = re.compile(
        r'(allQuestions\.capitalespays\s*=\s*_COUNTRIES\.map\(c\s*=>\s*\(\{[\s\S]*?\}\)\);\s*)'
    )
    match = pattern.search(text)
    if not match:
        raise RuntimeError("Impossible de trouver le bloc allQuestions.capitalespays dans server.js")

    backup_file(server_js)
    text = text[:match.end()] + "\n" + block + text[match.end():]
    server_js.write_text(text, encoding="utf-8")
    return True


def patch_script_js(script_js: Path) -> List[str]:
    text = script_js.read_text(encoding="utf-8")
    changes: List[str] = []

    if "formespays: 'Les accents" not in text:
        needle = "    capitalespays: 'Les accents ne sont pas nécessaires.<br>Tape le nom du pays correspondant à la capitale.',\n"
        insert = "    formespays: 'Les accents ne sont pas nécessaires.<br>Tape le nom du pays dont la forme est affichée.',\n"
        if needle in text:
            text = text.replace(needle, needle + insert, 1)
            changes.append("hintMessages.formespays")
        else:
            print("⚠️  Hint non patché : ligne capitalespays introuvable dans script.js")

    if "formespays: 'images'" not in text:
        needle = "  capitalespays: 'images',\n"
        insert = "  formespays: 'images',\n"
        if needle in text:
            text = text.replace(needle, needle + insert, 1)
            changes.append("themeModeMap.formespays")
        else:
            print("⚠️  themeModeMap non patché : ligne capitalespays introuvable dans script.js")

    if changes:
        backup_file(script_js)
        script_js.write_text(text, encoding="utf-8")
    return changes


def patch_index_html(index_html: Path) -> bool:
    text = index_html.read_text(encoding="utf-8")
    if 'data-theme="formespays"' in text:
        return False

    needle = '<button class="choice-btn theme-choice" data-theme="capitalespays" type="button">Capitales (Nom du pays)</button>'
    insert = '\n          <button class="choice-btn theme-choice" data-theme="formespays" type="button">Formes des pays</button>'
    if needle not in text:
        raise RuntimeError("Impossible de trouver le bouton capitalespays dans index.html")

    backup_file(index_html)
    text = text.replace(needle, needle + insert, 1)
    index_html.write_text(text, encoding="utf-8")
    return True


def write_generated_js_file(project: Path) -> Path:
    out = project / "formes_pays.generated.js"
    out.write_text(make_server_js_block(), encoding="utf-8")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Génère le thème LeDuel 'Formes des pays' depuis countries.geojson.")
    parser.add_argument("--geojson", required=True, help="Chemin vers countries.geojson ou countries.geojson.txt")
    parser.add_argument("--project", default=".", help="Dossier racine du projet LeDuel contenant server.js, script.js, index.html")
    parser.add_argument("--patch-code", action="store_true", help="Modifie automatiquement server.js, script.js et index.html")
    parser.add_argument("--size", type=int, default=900, help="Taille finale des PNG carrés, en pixels")
    parser.add_argument("--padding", type=float, default=0.08, help="Marge interne des silhouettes, ratio 0.08 = 8%%")
    parser.add_argument("--fill", default="#120722", help="Couleur de la silhouette")
    parser.add_argument("--background", default="#ffffff", help="Couleur du fond")
    parser.add_argument("--supersample", type=int, default=3, help="Facteur d'anticrénelage")
    args = parser.parse_args()

    project = Path(args.project).resolve()
    geojson_path = Path(args.geojson).resolve()
    server_js = project / "server.js"
    script_js = project / "script.js"
    index_html = project / "index.html"

    if not geojson_path.exists():
        raise FileNotFoundError(f"GeoJSON introuvable : {geojson_path}")
    if not server_js.exists():
        raise FileNotFoundError(f"server.js introuvable : {server_js}")

    countries = extract_countries_from_server(server_js)
    features = read_geojson_features(geojson_path)
    by_iso, by_name = build_geojson_indexes(features)

    out_dir = project / "images" / "formes_pays"
    generated: List[str] = []
    missing: List[str] = []

    for country in countries:
        feature = find_feature_for_country(country, by_iso, by_name)
        slug = slugify_country_name(country["name"])
        out_path = out_dir / f"{slug}.png"
        if not feature:
            missing.append(f'{country["name"]} | ISO attendu: {ISO3_BY_FRENCH_NAME.get(country["name"], "?")}')
            continue

        try:
            geom = shape(feature.get("geometry"))
            # Union utile si la source contient plusieurs bouts ou une géométrie composite.
            polygons = list(iter_polygons(geom))
            if len(polygons) > 1:
                geom = unary_union(polygons)
            draw_geometry_png(
                geom=geom,
                out_path=out_path,
                size=args.size,
                padding_ratio=args.padding,
                fill=args.fill,
                background=args.background,
                supersample=max(1, args.supersample),
            )
            generated.append(country["name"])
        except Exception as exc:
            missing.append(f'{country["name"]} | erreur rendu: {exc}')

    js_file = write_generated_js_file(project)

    patched: List[str] = []
    if args.patch_code:
        if patch_server_js(server_js):
            patched.append("server.js")
        if script_js.exists():
            changes = patch_script_js(script_js)
            if changes:
                patched.append("script.js")
        else:
            print(f"⚠️  script.js introuvable, non patché : {script_js}")
        if index_html.exists():
            if patch_index_html(index_html):
                patched.append("index.html")
        else:
            print(f"⚠️  index.html introuvable, non patché : {index_html}")

    report_path = out_dir / "rapport_generation.txt"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        "THÈME FORMES DES PAYS — RAPPORT\n"
        f"Projet : {project}\n"
        f"GeoJSON : {geojson_path}\n"
        f"Images générées : {len(generated)} / {len(countries)}\n"
        f"Bloc JS : {js_file}\n"
        f"Fichiers patchés : {', '.join(patched) if patched else 'aucun'}\n\n"
        "PAYS MANQUANTS / ERREURS\n"
        + ("\n".join(missing) if missing else "Aucun"),
        encoding="utf-8",
    )

    print(f"✅ Images générées : {len(generated)} / {len(countries)}")
    print(f"📁 Dossier images : {out_dir}")
    print(f"🧩 Bloc JS généré : {js_file}")
    print(f"📝 Rapport : {report_path}")
    if missing:
        print("⚠️  Certains pays n'ont pas été générés. Consulte le rapport_generation.txt")
    if args.patch_code:
        print(f"🔧 Fichiers patchés : {', '.join(patched) if patched else 'aucun changement nécessaire'}")
    else:
        print("ℹ️  Code non patché. Ajoute --patch-code pour modifier server.js, script.js et index.html automatiquement.")


if __name__ == "__main__":
    main()
