# -*- coding: utf-8 -*-
"""
Génère un thème LeDuel "Régions (Carte)" à partir d'un fichier GeoJSON
contenant les régions françaises.

Rendu :
- uniquement les 13 régions métropolitaines sont prises en compte ;
- carte complète de la France métropolitaine en gris clair ;
- région cible surlignée en foncé ;
- aucun territoire d'outre-mer n'est affiché ni utilisé dans le thème.

Le script :
1) lit un GeoJSON des régions françaises ;
2) génère une image PNG par région dans images/regions_carte/ ;
3) crée un bloc JS compatible avec LeDuel ;
4) peut patcher automatiquement server.js, script.js / script(1).js et index.html.

Installation minimale :
    py -m pip install pillow shapely

Exemple d'utilisation :
    py generate_regions_carte.py --geojson "C:\\Users\\Toi\\Downloads\\regions-50m.geojson" --project "." --patch-code
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


# 13 régions métropolitaines seulement.
REGIONS: List[Dict[str, Any]] = [
    {"code": "84", "name": "Auvergne-Rhône-Alpes", "diff": 1, "extra": []},
    {"code": "27", "name": "Bourgogne-Franche-Comté", "diff": 2, "extra": []},
    {"code": "53", "name": "Bretagne", "diff": 1, "extra": []},
    {"code": "24", "name": "Centre-Val de Loire", "diff": 2, "extra": []},
    {"code": "94", "name": "Corse", "diff": 2, "extra": []},
    {"code": "44", "name": "Grand Est", "diff": 2, "extra": []},
    {"code": "32", "name": "Hauts-de-France", "diff": 1, "extra": []},
    {"code": "11", "name": "Île-de-France", "diff": 1, "extra": ["Ile de France"]},
    {"code": "28", "name": "Normandie", "diff": 1, "extra": []},
    {"code": "75", "name": "Nouvelle-Aquitaine", "diff": 1, "extra": []},
    {"code": "76", "name": "Occitanie", "diff": 1, "extra": []},
    {"code": "52", "name": "Pays de la Loire", "diff": 1, "extra": []},
    {"code": "93", "name": "Provence-Alpes-Côte d'Azur", "diff": 1, "extra": ["PACA", "Provence Alpes Cote d Azur"]},
]

METRO_CODES = {r["code"] for r in REGIONS}


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


def backup_file(path: Path, tag: str = "regions_carte") -> None:
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
        "nom", "NOM", "name", "NAME", "libgeo", "LIBGEO", "nom_reg", "NOM_REG", "region", "REGION",
    ]
    code_keys = [
        "code", "CODE", "code_insee", "CODE_INSEE", "reg", "REG", "id", "ID", "code_region", "CODE_REGION",
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
                by_code.setdefault(code, feat)
                by_code.setdefault(code.zfill(2), feat) if code.isdigit() and len(code) == 1 else None

    return by_name, by_code


def find_feature_for_region(region: Dict[str, Any], by_name: Dict[str, Dict[str, Any]], by_code: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    code = region["code"]
    if code in by_code:
        return by_code[code]
    variants = [region["name"], *region.get("extra", [])]
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
    zoom_multiplier: float = 1.0,
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
    scale = min(drawable_w / width, drawable_h / height) * zoom_multiplier
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


def make_server_js_block() -> str:
    region_lines = []
    for r in REGIONS:
        extra_js = json.dumps(r.get("extra", []), ensure_ascii=False)
        region_lines.append(
            f'    {{ code: {json.dumps(r["code"])}, name: {json.dumps(r["name"], ensure_ascii=False)}, diff: {r["diff"]}, extra: {extra_js} }},'
        )
    regions_block = "\n".join(region_lines)

    return (
        "\n"
        "// =====================================================================\n"
        "// THÈME \"RÉGIONS (CARTE)\"\n"
        "//   - regionscarte : on affiche une carte de France avec la région surlignée\n"
        "//   - Les fichiers PNG sont générés par generate_regions_carte.py\n"
        "// =====================================================================\n"
        "const _REGIONS_METRO = [\n"
        f"{regions_block}\n"
        "];\n\n"
        "function _slugRegionImage(name) {\n"
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
        "allQuestions.regionscarte = _REGIONS_METRO.map(r => ({\n"
        "    image: `images/regions_carte/${_slugRegionImage(r.name)}.png`,\n"
        "    answer: r.name,\n"
        "    acceptedAnswers: _acceptedNoms(r.name, r.extra || []),\n"
        "    difficulty: r.diff,\n"
        "}));\n"
    )


def patch_server_js(server_js: Path) -> bool:
    text = server_js.read_text(encoding="utf-8")
    if "allQuestions.regionscarte" in text:
        return False

    block = make_server_js_block()
    anchor_patterns = [
        r'(allQuestions\.departementscarte\s*=\s*_DEPARTEMENTS\.map\(d\s*=>\s*\(\{[\s\S]*?\}\)\);\s*)',
        r'(allQuestions\.departementsnumeros\s*=\s*_DEPARTEMENTS\.map\(d\s*=>\s*\(\{[\s\S]*?\}\)\);\s*)',
    ]
    match = None
    for pattern in anchor_patterns:
        m = re.search(pattern, text)
        if m:
            match = m
            break
    if not match:
        raise RuntimeError("Impossible de trouver un point d'insertion après departementscarte/departementsnumeros dans server.js")

    backup_file(server_js)
    text = text[:match.end()] + "\n" + block + text[match.end():]
    server_js.write_text(text, encoding="utf-8")
    return True


def patch_script_js(script_js: Path) -> List[str]:
    text = script_js.read_text(encoding="utf-8")
    changes: List[str] = []

    if "regionscarte: 'Les accents" not in text:
        needles = [
            "    departementscarte: 'Les accents ne sont pas nécessaires.<br>Tape le nom du département surligné sur la carte.',\n",
            "    departementsnumeros: 'Les accents ne sont pas nécessaires.<br>Tape le nom du département.',\n",
        ]
        insert = "    regionscarte: 'Les accents ne sont pas nécessaires.<br>Tape le nom de la région surlignée sur la carte.',\n"
        for needle in needles:
            if needle in text:
                text = text.replace(needle, needle + insert, 1)
                changes.append("hintMessages.regionscarte")
                break
        else:
            print("⚠️  Hint non patché : ligne departementscarte/departementsnumeros introuvable dans script.js")

    if "regionscarte: 'images'" not in text:
        needles = [
            "  departementscarte: 'images',\n",
            "  departementsnumeros: 'images',\n",
        ]
        insert = "  regionscarte: 'images',\n"
        for needle in needles:
            if needle in text:
                text = text.replace(needle, needle + insert, 1)
                changes.append("themeModeMap.regionscarte")
                break
        else:
            print("⚠️  themeModeMap non patché : ligne departementscarte/departementsnumeros introuvable dans script.js")

    if changes:
        backup_file(script_js)
        script_js.write_text(text, encoding="utf-8")
    return changes


def patch_index_html(index_html: Path) -> bool:
    text = index_html.read_text(encoding="utf-8")
    if 'data-theme="regionscarte"' in text:
        return False

    needles = [
        '<button class="choice-btn theme-choice" data-theme="departementscarte" type="button">Départements (Carte)</button>',
        '<button class="choice-btn theme-choice" data-theme="departementsnumeros" type="button">Départements (Numéros)</button>',
    ]
    insert = '\n          <button class="choice-btn theme-choice" data-theme="regionscarte" type="button">Régions (Carte)</button>'
    for needle in needles:
        if needle in text:
            backup_file(index_html)
            text = text.replace(needle, needle + insert, 1)
            index_html.write_text(text, encoding="utf-8")
            return True
    raise RuntimeError("Impossible de trouver le bouton departementscarte/departementsnumeros dans index.html")


def write_generated_js_file(project: Path) -> Path:
    out = project / "regions_carte.generated.js"
    out.write_text(make_server_js_block(), encoding="utf-8")
    return out


def resolve_project_files(project: Path) -> Tuple[Path, Optional[Path], Optional[Path]]:
    server_js = project / "server.js"
    script_candidates = [project / "script.js", project / "script(1).js"]
    script_js = next((p for p in script_candidates if p.exists()), None)
    index_html = project / "index.html"
    return server_js, script_js if script_js and script_js.exists() else None, index_html if index_html.exists() else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Génère le thème LeDuel 'Régions (Carte)' depuis un GeoJSON des régions françaises.")
    parser.add_argument("--geojson", required=True, help="Chemin vers le fichier GeoJSON des régions françaises")
    parser.add_argument("--project", default=".", help="Dossier racine du projet LeDuel contenant server.js, script.js et index.html")
    parser.add_argument("--patch-code", action="store_true", help="Modifie automatiquement server.js, script.js et index.html")
    parser.add_argument("--size", type=int, default=1000, help="Taille finale des PNG carrés, en pixels")
    parser.add_argument("--padding", type=float, default=0.06, help="Marge interne des cartes, ratio 0.06 = 6%%")
    parser.add_argument("--background", default="#ffffff", help="Couleur du fond")
    parser.add_argument("--other-fill", default="#d9d9d9", help="Couleur de remplissage des autres régions")
    parser.add_argument("--other-outline", default="#b8b8b8", help="Couleur des contours des autres régions")
    parser.add_argument("--target-fill", default="#120722", help="Couleur de remplissage de la région cible")
    parser.add_argument("--target-outline", default="#120722", help="Couleur du contour de la région cible")
    parser.add_argument("--supersample", type=int, default=3, help="Facteur d'anticrénelage")
    parser.add_argument("--metro-zoom", type=float, default=1.08, help="Zoom supplémentaire appliqué à la carte métropolitaine (ex: 1.08 = +8%%)")
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
    for region in REGIONS:
        feat = find_feature_for_region(region, by_name, by_code)
        if not feat:
            missing.append(f'{region["code"]} {region["name"]} | introuvable dans le GeoJSON')
            continue
        try:
            geom = shape(feat.get("geometry"))
            geom = geom.buffer(0) if not geom.is_valid else geom
            polys = list(iter_polygons(geom))
            if len(polys) > 1:
                geom = unary_union(polys)
            all_geoms[region["code"]] = geom
        except Exception as exc:
            missing.append(f'{region["code"]} {region["name"]} | erreur géométrie: {exc}')

    out_dir = project / "images" / "regions_carte"
    generated: List[str] = []
    for region in REGIONS:
        code = region["code"]
        if code not in all_geoms:
            continue
        out_path = out_dir / f"{slugify(region['name'])}.png"
        try:
            draw_highlight_map(
                all_geoms=all_geoms,
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
                zoom_multiplier=max(0.1, args.metro_zoom),
            )
            generated.append(f'{code} {region["name"]}')
        except Exception as exc:
            missing.append(f'{code} {region["name"]} | erreur rendu: {exc}')

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
        "THÈME RÉGIONS (CARTE) — RAPPORT\n"
        f"Projet : {project}\n"
        f"GeoJSON : {geojson_path}\n"
        f"Images générées : {len(generated)} / {len(REGIONS)}\n"
        f"Bloc JS : {js_file}\n"
        f"Fichiers patchés : {', '.join(patched) if patched else 'aucun'}\n\n"
        "RÉGIONS MANQUANTES / ERREURS\n"
        + ("\n".join(missing) if missing else "Aucun"),
        encoding="utf-8",
    )

    print(f"✅ Images générées : {len(generated)} / {len(REGIONS)}")
    print(f"📁 Dossier images : {out_dir}")
    print(f"🧩 Bloc JS généré : {js_file}")
    print(f"📝 Rapport : {report_path}")
    if missing:
        print("⚠️  Certaines régions n'ont pas été générées. Consulte le rapport_generation.txt")
    if args.patch_code:
        print(f"🔧 Fichiers patchés : {', '.join(patched) if patched else 'aucun changement nécessaire'}")
    else:
        print("ℹ️  Code non patché. Ajoute --patch-code pour modifier server.js, script.js et index.html automatiquement.")


if __name__ == "__main__":
    main()
