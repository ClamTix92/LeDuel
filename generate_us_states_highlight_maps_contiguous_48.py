# -*- coding: utf-8 -*-
"""
Génère un thème LeDuel "États des USA" à partir d'un fichier GeoJSON des États américains,
avec une carte des 48 États contigus en gris clair et un État cible surligné (Alaska et Hawaï exclus).

Ce script :
1) lit un GeoJSON contenant les États américains ;
# Alaska et Hawaï sont exclus du rendu et du thème ;
2) génère une image PNG par État dans images/etats_usa/ ;
3) crée un bloc JS compatible avec LeDuel ;
4) peut patcher automatiquement server.js, script.js (ou script(1).js) et index.html.

Installation minimale :
    py -m pip install pillow shapely

Exemple d'utilisation :
    py generate_us_states_highlight_maps.py --geojson "C:\\Users\\Toi\\Downloads\\us_states.geojson" --project "." --patch-code

Notes :
- Le GeoJSON doit idéalement contenir les 48 États contigus américains (Alaska et Hawaï exclus).
- Certaines sources placent l'Alaska et Hawaï dans leur vraie position géographique,
  d'autres les repositionnent déjà en encart. Le script dessine ce que contient le GeoJSON.
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


# ---------------------------------------------------------------------------
# Base de données des 50 États :
# - name  : nom attendu dans le jeu (français de préférence)
# - en    : nom anglais (souvent utilisé dans le GeoJSON)
# - code  : code postal / abréviation de l'État
# - diff  : difficulté LeDuel
# - extra : réponses alternatives acceptées (fr + en)
# ---------------------------------------------------------------------------
US_STATES: List[Dict[str, Any]] = [
    {"name": "Alabama", "en": "Alabama", "code": "AL", "diff": 3, "extra": []},
    {"name": "Arizona", "en": "Arizona", "code": "AZ", "diff": 2, "extra": []},
    {"name": "Arkansas", "en": "Arkansas", "code": "AR", "diff": 3, "extra": []},
    {"name": "Californie", "en": "California", "code": "CA", "diff": 1, "extra": ["California"]},
    {"name": "Caroline du Nord", "en": "North Carolina", "code": "NC", "diff": 2, "extra": ["North Carolina"]},
    {"name": "Caroline du Sud", "en": "South Carolina", "code": "SC", "diff": 3, "extra": ["South Carolina"]},
    {"name": "Colorado", "en": "Colorado", "code": "CO", "diff": 2, "extra": []},
    {"name": "Connecticut", "en": "Connecticut", "code": "CT", "diff": 3, "extra": []},
    {"name": "Dakota du Nord", "en": "North Dakota", "code": "ND", "diff": 3, "extra": ["North Dakota"]},
    {"name": "Dakota du Sud", "en": "South Dakota", "code": "SD", "diff": 3, "extra": ["South Dakota"]},
    {"name": "Delaware", "en": "Delaware", "code": "DE", "diff": 3, "extra": []},
    {"name": "Floride", "en": "Florida", "code": "FL", "diff": 1, "extra": ["Florida"]},
    {"name": "Géorgie", "en": "Georgia", "code": "GA", "diff": 2, "extra": ["Georgia"]},
    {"name": "Idaho", "en": "Idaho", "code": "ID", "diff": 3, "extra": []},
    {"name": "Illinois", "en": "Illinois", "code": "IL", "diff": 2, "extra": []},
    {"name": "Indiana", "en": "Indiana", "code": "IN", "diff": 3, "extra": []},
    {"name": "Iowa", "en": "Iowa", "code": "IA", "diff": 3, "extra": []},
    {"name": "Kansas", "en": "Kansas", "code": "KS", "diff": 3, "extra": []},
    {"name": "Kentucky", "en": "Kentucky", "code": "KY", "diff": 3, "extra": []},
    {"name": "Louisiane", "en": "Louisiana", "code": "LA", "diff": 2, "extra": ["Louisiana"]},
    {"name": "Maine", "en": "Maine", "code": "ME", "diff": 3, "extra": []},
    {"name": "Maryland", "en": "Maryland", "code": "MD", "diff": 3, "extra": []},
    {"name": "Massachusetts", "en": "Massachusetts", "code": "MA", "diff": 3, "extra": []},
    {"name": "Michigan", "en": "Michigan", "code": "MI", "diff": 2, "extra": []},
    {"name": "Minnesota", "en": "Minnesota", "code": "MN", "diff": 3, "extra": []},
    {"name": "Mississippi", "en": "Mississippi", "code": "MS", "diff": 3, "extra": []},
    {"name": "Missouri", "en": "Missouri", "code": "MO", "diff": 3, "extra": []},
    {"name": "Montana", "en": "Montana", "code": "MT", "diff": 3, "extra": []},
    {"name": "Nebraska", "en": "Nebraska", "code": "NE", "diff": 3, "extra": []},
    {"name": "Nevada", "en": "Nevada", "code": "NV", "diff": 1, "extra": []},
    {"name": "New Hampshire", "en": "New Hampshire", "code": "NH", "diff": 3, "extra": []},
    {"name": "New Jersey", "en": "New Jersey", "code": "NJ", "diff": 2, "extra": []},
    {"name": "New York", "en": "New York", "code": "NY", "diff": 1, "extra": []},
    {"name": "Nouveau-Mexique", "en": "New Mexico", "code": "NM", "diff": 2, "extra": ["New Mexico", "Nouveau Mexique"]},
    {"name": "Ohio", "en": "Ohio", "code": "OH", "diff": 2, "extra": []},
    {"name": "Oklahoma", "en": "Oklahoma", "code": "OK", "diff": 2, "extra": []},
    {"name": "Oregon", "en": "Oregon", "code": "OR", "diff": 2, "extra": []},
    {"name": "Pennsylvanie", "en": "Pennsylvania", "code": "PA", "diff": 2, "extra": ["Pennsylvania"]},
    {"name": "Rhode Island", "en": "Rhode Island", "code": "RI", "diff": 3, "extra": []},
    {"name": "Tennessee", "en": "Tennessee", "code": "TN", "diff": 2, "extra": []},
    {"name": "Texas", "en": "Texas", "code": "TX", "diff": 1, "extra": []},
    {"name": "Utah", "en": "Utah", "code": "UT", "diff": 2, "extra": []},
    {"name": "Vermont", "en": "Vermont", "code": "VT", "diff": 3, "extra": []},
    {"name": "Virginie", "en": "Virginia", "code": "VA", "diff": 2, "extra": ["Virginia"]},
    {"name": "Virginie-Occidentale", "en": "West Virginia", "code": "WV", "diff": 3, "extra": ["West Virginia", "Virginie Occidentale"]},
    {"name": "Washington", "en": "Washington", "code": "WA", "diff": 2, "extra": []},
    {"name": "Wisconsin", "en": "Wisconsin", "code": "WI", "diff": 3, "extra": []},
    {"name": "Wyoming", "en": "Wyoming", "code": "WY", "diff": 3, "extra": []},
]

# États exclus volontairement du thème et du rendu pour agrandir la carte.
EXCLUDED_STATES = {"Alaska", "Hawaï", "Hawaii", "Alaska"}


def normalize(s: str) -> str:
    s = str(s)
    s = s.replace("œ", "oe").replace("Œ", "Oe")
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.lower()
    s = re.sub(r"[’']", " ", s)
    s = s.replace("&", " et ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def slugify(s: str) -> str:
    s = str(s)
    s = s.replace("œ", "oe").replace("Œ", "Oe")
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.lower()
    s = s.replace("&", " et ")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def backup_file(path: Path, tag: str = "us_states_highlight") -> None:
    stamp = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(path, path.with_suffix(path.suffix + f".bak_{tag}_{stamp}"))


def read_geojson_features(path: Path) -> List[Dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("type") == "FeatureCollection":
        return list(data.get("features", []))
    if data.get("type") == "Feature":
        return [data]
    raise ValueError("Le fichier fourni n'est pas un GeoJSON FeatureCollection valide.")


def feature_properties(feature: Dict[str, Any]) -> Dict[str, Any]:
    return feature.get("properties") or {}


def build_feature_indexes(features: List[Dict[str, Any]]) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    by_name: Dict[str, Dict[str, Any]] = {}
    by_code: Dict[str, Dict[str, Any]] = {}

    name_keys = [
        "name", "NAME", "STATE_NAME", "state_name", "STATE", "state",
        "st_nm", "stname", "namelsad", "NAME10", "NAME_1",
    ]
    code_keys = [
        "stusps", "STUSPS", "postal", "POSTAL", "abbr", "ABBR", "state_abbr", "STATE_ABBR",
        "usps", "USPS", "code", "CODE",
    ]

    for feat in features:
        props = feature_properties(feat)
        for key in name_keys:
            value = props.get(key)
            if value:
                by_name.setdefault(normalize(str(value)), feat)
        for key in code_keys:
            value = props.get(key)
            if value:
                by_code.setdefault(normalize(str(value)), feat)

    return by_name, by_code


def find_feature_for_state(state: Dict[str, Any], by_name: Dict[str, Dict[str, Any]], by_code: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    code = state.get("code")
    if code and normalize(code) in by_code:
        return by_code[normalize(code)]

    candidates = [state["en"], state["name"], *state.get("extra", [])]
    variants: List[str] = []
    for candidate in candidates:
        if not candidate:
            continue
        variants.append(candidate)
        variants.append(candidate.replace("-", " "))
        variants.append(candidate.replace(" ", "-"))
        variants.append(f"State of {candidate}")

    for v in variants:
        nv = normalize(v)
        if nv in by_name:
            return by_name[nv]
    return None


def iter_polygons(geom) -> Iterable[Polygon]:
    if geom.is_empty:
        return
    if isinstance(geom, Polygon):
        yield geom
    elif isinstance(geom, MultiPolygon):
        for g in geom.geoms:
            if isinstance(g, Polygon):
                yield g


def draw_polygon(draw: ImageDraw.ImageDraw, polygon: Polygon, project, fill: str, outline: Optional[str] = None, width: int = 1, hole_fill: Optional[str] = None) -> None:
    exterior = [project(p) for p in polygon.exterior.coords]
    if len(exterior) >= 3:
        draw.polygon(exterior, fill=fill, outline=outline)
    for interior in polygon.interiors:
        hole = [project(p) for p in interior.coords]
        if len(hole) >= 3:
            draw.polygon(hole, fill=hole_fill if hole_fill is not None else fill)


def draw_us_map_highlight(
    all_geoms: Dict[str, Any],
    target_key: str,
    out_path: Path,
    size: int,
    padding_ratio: float,
    background: str,
    other_fill: str,
    other_outline: str,
    target_fill: str,
    target_outline: str,
    supersample: int,
    outline_width: int,
) -> None:
    union_geom = unary_union([g for g in all_geoms.values()])
    union_geom = union_geom.buffer(0) if not union_geom.is_valid else union_geom

    minx, miny, maxx, maxy = union_geom.bounds
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

    # Dessiner d'abord tous les autres États.
    for key, geom in all_geoms.items():
        if key == target_key:
            continue
        for polygon in iter_polygons(geom):
            draw_polygon(
                draw,
                polygon,
                project,
                fill=other_fill,
                outline=other_outline,
                width=outline_width,
                hole_fill=background,
            )

    # Dessiner ensuite l'État cible par-dessus.
    target_geom = all_geoms[target_key]
    for polygon in iter_polygons(target_geom):
        draw_polygon(
            draw,
            polygon,
            project,
            fill=target_fill,
            outline=target_outline,
            width=outline_width,
            hole_fill=background,
        )

    if supersample > 1:
        img = img.resize((size, size), Image.Resampling.LANCZOS)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)


def make_server_js_block() -> str:
    state_lines = []
    for st in US_STATES:
        extras = [st["en"], *st.get("extra", [])]
        dedup_extras: List[str] = []
        seen = {normalize(st["name"])}
        for e in extras:
            ne = normalize(e)
            if ne and ne not in seen:
                seen.add(ne)
                dedup_extras.append(e)
        extra_js = json.dumps(dedup_extras, ensure_ascii=False)
        state_lines.append(
            f'    {{ name: {json.dumps(st["name"], ensure_ascii=False)}, diff: {st["diff"]}, extra: {extra_js} }},'
        )

    states_block = "\n".join(state_lines)

    return (
        "\n"
        "// =====================================================================\n"
        "// THÈME \"ÉTATS DES USA\"\n"
        "//   - etatsusa : on affiche une carte des USA avec un État surligné\n"
        "//   - Les fichiers PNG sont générés par generate_us_states_highlight_maps.py\n"
        "// =====================================================================\n"
        "const _US_STATES = [\n"
        f"{states_block}\n"
        "];\n\n"
        "function _slugEtatUsaImage(name) {\n"
        "    return String(name)\n"
        "        .replace(/œ/g, \"oe\")\n"
        "        .replace(/Œ/g, \"Oe\")\n"
        "        .normalize(\"NFD\")\n"
        "        .replace(/[\\u0300-\\u036f]/g, \"\")\n"
        "        .toLowerCase()\n"
        "        .replace(/&/g, \" et \")\n"
        "        .replace(/[^a-z0-9]+/g, \"_\")\n"
        "        .replace(/^_+|_+$/g, \"\")\n"
        "        .replace(/_+/g, \"_\");\n"
        "}\n\n"
        "allQuestions.etatsusa = _US_STATES.map(s => ({\n"
        "    image: `images/etats_usa/${_slugEtatUsaImage(s.name)}.png`,\n"
        "    answer: s.name,\n"
        "    acceptedAnswers: _acceptedNoms(s.name, s.extra || []),\n"
        "    difficulty: s.diff,\n"
        "}));\n"
    )


def patch_server_js(server_js: Path) -> bool:
    text = server_js.read_text(encoding="utf-8")
    if "allQuestions.etatsusa" in text:
        return False

    block = make_server_js_block()
    anchor_patterns = [
        r'(allQuestions\.formespays\s*=\s*_COUNTRIES\.map\(c\s*=>\s*\(\{[\s\S]*?\}\)\);\s*)',
        r'(allQuestions\.capitalespays\s*=\s*_COUNTRIES\.map\(c\s*=>\s*\(\{[\s\S]*?\}\)\);\s*)',
    ]

    match = None
    for pattern in anchor_patterns:
        m = re.search(pattern, text)
        if m:
            match = m
            break

    if not match:
        raise RuntimeError("Impossible de trouver un point d'insertion après capitalespays/formespays dans server.js")

    backup_file(server_js)
    text = text[:match.end()] + "\n" + block + text[match.end():]
    server_js.write_text(text, encoding="utf-8")
    return True


def patch_script_js(script_js: Path) -> List[str]:
    text = script_js.read_text(encoding="utf-8")
    changes: List[str] = []

    if "etatsusa: 'Les accents" not in text:
        hint_needles = [
            "    formespays: 'Les accents ne sont pas nécessaires.<br>Tape le nom du pays dont la forme est affichée.',\n",
            "    capitalespays: 'Les accents ne sont pas nécessaires.<br>Tape le nom du pays correspondant à la capitale.',\n",
        ]
        insert = "    etatsusa: 'Les accents ne sont pas nécessaires.<br>Tape le nom de l\'État américain surligné. Les réponses en français et en anglais sont acceptées.',\n"
        for needle in hint_needles:
            if needle in text:
                text = text.replace(needle, needle + insert, 1)
                changes.append("hintMessages.etatsusa")
                break
        else:
            print("⚠️  Hint non patché : ligne formespays/capitalespays introuvable dans script.js")

    if "etatsusa: 'images'" not in text:
        map_needles = [
            "  formespays: 'images',\n",
            "  capitalespays: 'images',\n",
        ]
        insert = "  etatsusa: 'images',\n"
        for needle in map_needles:
            if needle in text:
                text = text.replace(needle, needle + insert, 1)
                changes.append("themeModeMap.etatsusa")
                break
        else:
            print("⚠️  themeModeMap non patché : ligne formespays/capitalespays introuvable dans script.js")

    if changes:
        backup_file(script_js)
        script_js.write_text(text, encoding="utf-8")
    return changes


def patch_index_html(index_html: Path) -> bool:
    text = index_html.read_text(encoding="utf-8")
    if 'data-theme="etatsusa"' in text:
        return False

    needles = [
        '<button class="choice-btn theme-choice" data-theme="formespays" type="button">Formes des pays</button>',
        '<button class="choice-btn theme-choice" data-theme="capitalespays" type="button">Capitales (Nom du pays)</button>',
    ]
    insert = '\n          <button class="choice-btn theme-choice" data-theme="etatsusa" type="button">États des USA</button>'

    for needle in needles:
        if needle in text:
            backup_file(index_html)
            text = text.replace(needle, needle + insert, 1)
            index_html.write_text(text, encoding="utf-8")
            return True

    raise RuntimeError("Impossible de trouver le bouton formespays/capitalespays dans index.html")


def write_generated_js_file(project: Path) -> Path:
    out = project / "etats_usa.generated.js"
    out.write_text(make_server_js_block(), encoding="utf-8")
    return out


def resolve_project_files(project: Path) -> Tuple[Path, Optional[Path], Optional[Path]]:
    server_js = project / "server.js"
    script_candidates = [project / "script.js", project / "script(1).js"]
    script_js = next((p for p in script_candidates if p.exists()), None)
    index_html = project / "index.html"
    return server_js, script_js if script_js and script_js.exists() else None, index_html if index_html.exists() else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Génère le thème LeDuel 'États des USA' sous forme de carte des USA avec un État surligné.")
    parser.add_argument("--geojson", required=True, help="Chemin vers le fichier us_states.geojson (ou .txt contenant du GeoJSON)")
    parser.add_argument("--project", default=".", help="Dossier racine du projet LeDuel contenant server.js, script.js et index.html")
    parser.add_argument("--patch-code", action="store_true", help="Modifie automatiquement server.js, script.js et index.html")
    parser.add_argument("--size", type=int, default=1000, help="Taille finale des PNG carrés, en pixels")
    parser.add_argument("--padding", type=float, default=0.06, help="Marge interne des cartes, ratio 0.06 = 6%%")
    parser.add_argument("--background", default="#ffffff", help="Couleur du fond")
    parser.add_argument("--other-fill", default="#d9d9d9", help="Couleur de remplissage des autres États")
    parser.add_argument("--other-outline", default="#b8b8b8", help="Couleur des contours des autres États")
    parser.add_argument("--target-fill", default="#120722", help="Couleur de remplissage de l'État cible")
    parser.add_argument("--target-outline", default="#120722", help="Couleur du contour de l'État cible")
    parser.add_argument("--outline-width", type=int, default=1, help="Épaisseur logique des contours (surtout utile à haute résolution)")
    parser.add_argument("--supersample", type=int, default=3, help="Facteur d'anticrénelage")
    args = parser.parse_args()

    project = Path(args.project).resolve()
    geojson_path = Path(args.geojson).resolve()
    server_js, script_js, index_html = resolve_project_files(project)

    if not geojson_path.exists():
        raise FileNotFoundError(f"GeoJSON introuvable : {geojson_path}")
    if not server_js.exists():
        raise FileNotFoundError(f"server.js introuvable : {server_js}")

    features = read_geojson_features(geojson_path)
    by_name, by_code = build_feature_indexes(features)

    all_geoms: Dict[str, Any] = {}
    missing: List[str] = []
    for state in US_STATES:
        feat = find_feature_for_state(state, by_name, by_code)
        if not feat:
            missing.append(f'{state["name"]} | code attendu: {state["code"]} | nom anglais: {state["en"]}')
            continue
        try:
            geom = shape(feat.get("geometry"))
            geom = geom.buffer(0) if not geom.is_valid else geom
            polys = list(iter_polygons(geom))
            if len(polys) > 1:
                geom = unary_union(polys)
            all_geoms[state["name"]] = geom
        except Exception as exc:
            missing.append(f'{state["name"]} | erreur géométrie: {exc}')

    out_dir = project / "images" / "etats_usa"
    generated: List[str] = []

    for state in US_STATES:
        key = state["name"]
        if key not in all_geoms:
            continue
        out_path = out_dir / f"{slugify(key)}.png"
        try:
            draw_us_map_highlight(
                all_geoms=all_geoms,
                target_key=key,
                out_path=out_path,
                size=args.size,
                padding_ratio=args.padding,
                background=args.background,
                other_fill=args.other_fill,
                other_outline=args.other_outline,
                target_fill=args.target_fill,
                target_outline=args.target_outline,
                supersample=max(1, args.supersample),
                outline_width=max(1, args.outline_width),
            )
            generated.append(key)
        except Exception as exc:
            missing.append(f'{key} | erreur rendu: {exc}')

    js_file = write_generated_js_file(project)

    patched: List[str] = []
    if args.patch_code:
        if patch_server_js(server_js):
            patched.append("server.js")
        if script_js:
            changes = patch_script_js(script_js)
            if changes:
                patched.append(script_js.name)
        else:
            print("⚠️  script.js introuvable, non patché")
        if index_html:
            if patch_index_html(index_html):
                patched.append(index_html.name)
        else:
            print("⚠️  index.html introuvable, non patché")

    report_path = out_dir / "rapport_generation.txt"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        "THÈME ÉTATS DES USA — CARTE AVEC ÉTAT SURLIGNÉ — RAPPORT\n"
        f"Projet : {project}\n"
        f"GeoJSON : {geojson_path}\n"
        f"Images générées : {len(generated)} / {len(US_STATES)}\n"
        f"Bloc JS : {js_file}\n"
        f"Fichiers patchés : {', '.join(patched) if patched else 'aucun'}\n\n"
        "ÉTATS MANQUANTS / ERREURS\n"
        + ("\n".join(missing) if missing else "Aucun"),
        encoding="utf-8",
    )

    print(f"✅ Images générées : {len(generated)} / {len(US_STATES)}")
    print(f"📁 Dossier images : {out_dir}")
    print(f"🧩 Bloc JS généré : {js_file}")
    print(f"📝 Rapport : {report_path}")
    if missing:
        print("⚠️  Certains États n'ont pas été générés. Consulte le rapport_generation.txt")
    if args.patch_code:
        print(f"🔧 Fichiers patchés : {', '.join(patched) if patched else 'aucun changement nécessaire'}")
    else:
        print("ℹ️  Code non patché. Ajoute --patch-code pour modifier server.js, script.js et index.html automatiquement.")


if __name__ == "__main__":
    main()
