# -*- coding: utf-8 -*-
"""
Génère un thème LeDuel "Départements (Carte)" à partir d'un fichier GeoJSON
contenant les départements français.

Rendu :
- Départements métropolitains (y compris Corse) : carte complète de la France
  métropolitaine en gris clair, avec le département cible surligné.
- DOM présents dans ta liste (971, 972, 973, 974, 976) : uniquement le
  département demandé sur fond blanc, sans la métropole.

Le script :
1) lit la liste _DEPARTEMENTS déjà présente dans server.js ;
2) génère une image PNG par département dans images/departements_carte/ ;
3) crée un bloc JS compatible avec LeDuel ;
4) peut patcher automatiquement server.js, script.js / script(1).js et index.html.

Installation minimale :
    py -m pip install pillow shapely

Exemple d'utilisation :
    py generate_departements_carte.py --geojson "C:\\Users\\Toi\\Downloads\\departements-50m.geojson" --project "." --patch-code
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

DOM_CODES = {"971", "972", "973", "974", "976"}


# ---------------------------------------------------------------------------
# Outils texte / chemins
# ---------------------------------------------------------------------------

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


def backup_file(path: Path, tag: str = "departements_carte") -> None:
    stamp = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(path, path.with_suffix(path.suffix + f".bak_{tag}_{stamp}"))


# ---------------------------------------------------------------------------
# Lecture des départements dans server.js
# ---------------------------------------------------------------------------

def extract_departements_from_server(server_js: Path) -> List[Dict[str, Any]]:
    text = server_js.read_text(encoding="utf-8")
    match = re.search(r"const _DEPARTEMENTS = \[(.*?)\];", text, flags=re.S)
    if not match:
        raise RuntimeError("Impossible de trouver const _DEPARTEMENTS dans server.js")

    block = match.group(1)
    rows = re.findall(
        r'\{\s*num:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*diff:\s*(\d+)\s*\}',
        block,
    )
    if not rows:
        raise RuntimeError("Aucun département n'a pu être extrait de _DEPARTEMENTS")

    return [{"num": num, "name": name, "diff": int(diff)} for num, name, diff in rows]


# ---------------------------------------------------------------------------
# Lecture / indexation GeoJSON
# ---------------------------------------------------------------------------

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
        "nom", "NOM", "name", "NAME", "libgeo", "LIBGEO", "nom_dep", "NOM_DEP", "department", "DEPARTMENT",
    ]
    code_keys = [
        "code", "CODE", "code_insee", "CODE_INSEE", "dep", "DEP", "insee_dep", "INSEE_DEP",
        "code_departement", "CODE_DEPARTEMENT", "id", "ID", "department_code", "DEPARTMENT_CODE",
    ]

    for feat in features:
        props = feature_properties(feat)
        for key in name_keys:
            value = props.get(key)
            if value is not None:
                by_name.setdefault(normalize(str(value)), feat)
        for key in code_keys:
            value = props.get(key)
            if value is not None:
                code = str(value).strip()
                by_code.setdefault(code.upper(), feat)
                by_code.setdefault(code.zfill(2).upper(), feat) if code.isdigit() and len(code) == 1 else None

    return by_name, by_code


def build_name_variants(name: str) -> List[str]:
    variants = [name]
    variants.append(name.replace("-", " "))
    variants.append(name.replace("'", " "))
    variants.append(name.replace("-", " ").replace("'", " "))

    # Variantes Saint / Sainte si jamais la source diffère.
    if name.startswith("Saint-") or name.startswith("Saint ") or name.startswith("Sainte-") or name.startswith("Sainte "):
        variants.append(name.replace("Saint-", "St-").replace("Saint ", "St ").replace("Sainte-", "Ste-").replace("Sainte ", "Ste "))

    # Quelques variantes fréquentes.
    manual = {
        "Côte-d'Or": ["Cote-d'Or", "Cote d Or", "Côte d'Or"],
        "Côtes-d'Armor": ["Cotes-d'Armor", "Cotes d Armor", "Côtes d'Armor"],
        "Corse-du-Sud": ["Corse du Sud"],
        "Hauts-de-Seine": ["Hauts de Seine"],
        "Seine-Saint-Denis": ["Seine Saint Denis"],
        "Val-d'Oise": ["Val d Oise", "Val d'Oise"],
        "Val-de-Marne": ["Val de Marne"],
        "Bouches-du-Rhône": ["Bouches du Rhone", "Bouches-du-Rhone"],
        "La Réunion": ["Reunion", "La Reunion"],
    }
    variants.extend(manual.get(name, []))
    return variants


def find_feature_for_departement(dep: Dict[str, Any], by_name: Dict[str, Dict[str, Any]], by_code: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    code = dep["num"].upper()
    if code in by_code:
        return by_code[code]

    # Compatibilités éventuelles pour 2A / 2B ou zéros non significatifs.
    compat_codes = [code.lstrip("0"), code.zfill(2), code]
    for c in compat_codes:
        if c in by_code:
            return by_code[c]

    for variant in build_name_variants(dep["name"]):
        nv = normalize(variant)
        if nv in by_name:
            return by_name[nv]

    return None


# ---------------------------------------------------------------------------
# Géométrie / dessin
# ---------------------------------------------------------------------------

def iter_polygons(geom) -> Iterable[Polygon]:
    if geom.is_empty:
        return
    if isinstance(geom, Polygon):
        yield geom
    elif isinstance(geom, MultiPolygon):
        for g in geom.geoms:
            if isinstance(g, Polygon):
                yield g


def draw_polygon(draw: ImageDraw.ImageDraw, polygon: Polygon, project, fill: str, outline: Optional[str] = None, hole_fill: Optional[str] = None) -> None:
    exterior = [project(p) for p in polygon.exterior.coords]
    if len(exterior) >= 3:
        draw.polygon(exterior, fill=fill, outline=outline)
    for interior in polygon.interiors:
        hole = [project(p) for p in interior.coords]
        if len(hole) >= 3:
            draw.polygon(hole, fill=hole_fill if hole_fill is not None else fill)


def draw_highlight_map(
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

    for key, geom in all_geoms.items():
        if key == target_key:
            continue
        for polygon in iter_polygons(geom):
            draw_polygon(draw, polygon, project, fill=other_fill, outline=other_outline, hole_fill=background)

    target_geom = all_geoms[target_key]
    for polygon in iter_polygons(target_geom):
        draw_polygon(draw, polygon, project, fill=target_fill, outline=target_outline, hole_fill=background)

    if supersample > 1:
        img = img.resize((size, size), Image.Resampling.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)


def draw_single_geometry(
    geom,
    out_path: Path,
    size: int,
    padding_ratio: float,
    background: str,
    fill: str,
    outline: str,
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
        draw_polygon(draw, polygon, project, fill=fill, outline=outline, hole_fill=background)

    if supersample > 1:
        img = img.resize((size, size), Image.Resampling.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)


# ---------------------------------------------------------------------------
# Génération du code JS / patch du projet
# ---------------------------------------------------------------------------

def make_server_js_block() -> str:
    return r'''

// =====================================================================
// THÈME "DÉPARTEMENTS (CARTE)"
//   - departementscarte : on affiche une carte de France avec le département
//                         surligné, ou le DOM seul pour 971/972/973/974/976
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
'''.strip("\n") + "\n"


def patch_server_js(server_js: Path) -> bool:
    text = server_js.read_text(encoding="utf-8")
    if "allQuestions.departementscarte" in text:
        return False

    block = make_server_js_block()
    pattern = re.compile(
        r'(allQuestions\.departementsnumeros\s*=\s*_DEPARTEMENTS\.map\(d\s*=>\s*\(\{[\s\S]*?\}\)\);\s*)'
    )
    match = pattern.search(text)
    if not match:
        raise RuntimeError("Impossible de trouver le bloc allQuestions.departementsnumeros dans server.js")

    backup_file(server_js)
    text = text[:match.end()] + "\n" + block + text[match.end():]
    server_js.write_text(text, encoding="utf-8")
    return True


def patch_script_js(script_js: Path) -> List[str]:
    text = script_js.read_text(encoding="utf-8")
    changes: List[str] = []

    if "departementscarte: 'Les accents" not in text:
        needle = "    departementsnumeros: 'Les accents ne sont pas nécessaires.<br>Tape le nom du département.',\n"
        insert = "    departementscarte: 'Les accents ne sont pas nécessaires.<br>Tape le nom du département surligné sur la carte.',\n"
        if needle in text:
            text = text.replace(needle, needle + insert, 1)
            changes.append("hintMessages.departementscarte")
        else:
            print("⚠️  Hint non patché : ligne departementsnumeros introuvable dans script.js")

    if "departementscarte: 'images'" not in text:
        needle = "  departementsnumeros: 'images',\n"
        insert = "  departementscarte: 'images',\n"
        if needle in text:
            text = text.replace(needle, needle + insert, 1)
            changes.append("themeModeMap.departementscarte")
        else:
            print("⚠️  themeModeMap non patché : ligne departementsnumeros introuvable dans script.js")

    if changes:
        backup_file(script_js)
        script_js.write_text(text, encoding="utf-8")
    return changes


def patch_index_html(index_html: Path) -> bool:
    text = index_html.read_text(encoding="utf-8")
    if 'data-theme="departementscarte"' in text:
        return False

    needle = '<button class="choice-btn theme-choice" data-theme="departementsnumeros" type="button">Départements (Numéros)</button>'
    insert = '\n          <button class="choice-btn theme-choice" data-theme="departementscarte" type="button">Départements (Carte)</button>'
    if needle not in text:
        raise RuntimeError("Impossible de trouver le bouton departementsnumeros dans index.html")

    backup_file(index_html)
    text = text.replace(needle, needle + insert, 1)
    index_html.write_text(text, encoding="utf-8")
    return True


def write_generated_js_file(project: Path) -> Path:
    out = project / "departements_carte.generated.js"
    out.write_text(make_server_js_block(), encoding="utf-8")
    return out


def resolve_project_files(project: Path) -> Tuple[Path, Optional[Path], Optional[Path]]:
    server_js = project / "server.js"
    script_candidates = [project / "script.js", project / "script(1).js"]
    script_js = next((p for p in script_candidates if p.exists()), None)
    index_html = project / "index.html"
    return server_js, script_js if script_js and script_js.exists() else None, index_html if index_html.exists() else None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Génère le thème LeDuel 'Départements (Carte)' depuis un GeoJSON des départements français.")
    parser.add_argument("--geojson", required=True, help="Chemin vers le fichier GeoJSON des départements français")
    parser.add_argument("--project", default=".", help="Dossier racine du projet LeDuel contenant server.js, script.js et index.html")
    parser.add_argument("--patch-code", action="store_true", help="Modifie automatiquement server.js, script.js et index.html")
    parser.add_argument("--size", type=int, default=1000, help="Taille finale des PNG carrés, en pixels")
    parser.add_argument("--padding", type=float, default=0.06, help="Marge interne des cartes, ratio 0.06 = 6%%")
    parser.add_argument("--background", default="#ffffff", help="Couleur du fond")
    parser.add_argument("--other-fill", default="#d9d9d9", help="Couleur de remplissage des autres départements")
    parser.add_argument("--other-outline", default="#b8b8b8", help="Couleur des contours des autres départements")
    parser.add_argument("--target-fill", default="#120722", help="Couleur de remplissage du département cible")
    parser.add_argument("--target-outline", default="#120722", help="Couleur du contour du département cible")
    parser.add_argument("--dom-fill", default="#120722", help="Couleur de remplissage des DOM affichés seuls")
    parser.add_argument("--dom-outline", default="#120722", help="Couleur du contour des DOM affichés seuls")
    parser.add_argument("--supersample", type=int, default=3, help="Facteur d'anticrénelage")
    args = parser.parse_args()

    project = Path(args.project).resolve()
    geojson_path = Path(args.geojson).resolve()
    server_js, script_js, index_html = resolve_project_files(project)

    if not geojson_path.exists():
        raise FileNotFoundError(f"GeoJSON introuvable : {geojson_path}")
    if not server_js.exists():
        raise FileNotFoundError(f"server.js introuvable : {server_js}")

    departements = extract_departements_from_server(server_js)
    features = read_geojson_features(geojson_path)
    by_name, by_code = build_feature_indexes(features)

    all_geoms: Dict[str, Any] = {}
    missing: List[str] = []

    for dep in departements:
        feat = find_feature_for_departement(dep, by_name, by_code)
        if not feat:
            missing.append(f'{dep["num"]} {dep["name"]} | introuvable dans le GeoJSON')
            continue
        try:
            geom = shape(feat.get("geometry"))
            geom = geom.buffer(0) if not geom.is_valid else geom
            polys = list(iter_polygons(geom))
            if len(polys) > 1:
                geom = unary_union(polys)
            all_geoms[dep["num"]] = geom
        except Exception as exc:
            missing.append(f'{dep["num"]} {dep["name"]} | erreur géométrie: {exc}')

    metropolitan_deps = [d for d in departements if d["num"] not in DOM_CODES and d["num"] in all_geoms]
    metro_geoms = {d["num"]: all_geoms[d["num"]] for d in metropolitan_deps}

    out_dir = project / "images" / "departements_carte"
    generated: List[str] = []

    for dep in departements:
        code = dep["num"]
        if code not in all_geoms:
            continue
        out_path = out_dir / f"{slugify(dep['name'])}.png"
        try:
            if code in DOM_CODES:
                draw_single_geometry(
                    geom=all_geoms[code],
                    out_path=out_path,
                    size=args.size,
                    padding_ratio=args.padding,
                    background=args.background,
                    fill=args.dom_fill,
                    outline=args.dom_outline,
                    supersample=max(1, args.supersample),
                )
            else:
                draw_highlight_map(
                    all_geoms=metro_geoms,
                    target_key=code,
                    out_path=out_path,
                    size=args.size,
                    padding_ratio=args.padding,
                    background=args.background,
                    other_fill=args.other_fill,
                    other_outline=args.other_outline,
                    target_fill=args.target_fill,
                    target_outline=args.target_outline,
                    supersample=max(1, args.supersample),
                )
            generated.append(f'{code} {dep["name"]}')
        except Exception as exc:
            missing.append(f'{code} {dep["name"]} | erreur rendu: {exc}')

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
        "THÈME DÉPARTEMENTS (CARTE) — RAPPORT\n"
        f"Projet : {project}\n"
        f"GeoJSON : {geojson_path}\n"
        f"Images générées : {len(generated)} / {len(departements)}\n"
        f"Bloc JS : {js_file}\n"
        f"Fichiers patchés : {', '.join(patched) if patched else 'aucun'}\n\n"
        "DÉPARTEMENTS MANQUANTS / ERREURS\n"
        + ("\n".join(missing) if missing else "Aucun"),
        encoding="utf-8",
    )

    print(f"✅ Images générées : {len(generated)} / {len(departements)}")
    print(f"📁 Dossier images : {out_dir}")
    print(f"🧩 Bloc JS généré : {js_file}")
    print(f"📝 Rapport : {report_path}")
    if missing:
        print("⚠️  Certains départements n'ont pas été générés. Consulte le rapport_generation.txt")
    if args.patch_code:
        print(f"🔧 Fichiers patchés : {', '.join(patched) if patched else 'aucun changement nécessaire'}")
    else:
        print("ℹ️  Code non patché. Ajoute --patch-code pour modifier server.js, script.js et index.html automatiquement.")


if __name__ == "__main__":
    main()
