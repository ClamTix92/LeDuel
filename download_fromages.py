"""
download_fromages.py
--------------------
Télécharge les images des 50 fromages du monde les plus populaires
depuis Wikimedia Commons, classés par difficulté.

Usage :
    pip install requests
    python download_fromages.py
"""

import requests, time, re
from pathlib import Path

OUTPUT_DIR = "images/fromages"
DELAY      = 0.5
MIN_WIDTH  = 300
HEADERS    = {"User-Agent": "LeDuel-CheeseDownloader/1.0 (contact@leduel.fr)"}

# Format : ("nom_fichier", ["requête1", "requête2"], "réponse_FR", difficulté)
CHEESES = [
    # ── Difficulté 1 — très connus du grand public (20) ──
    ("camembert",         ["camembert cheese french normandy"],        "camembert",         1),
    ("cheddar",           ["cheddar cheese yellow english"],           "cheddar",           1),
    ("brie",              ["brie cheese french soft"],                 "brie",              1),
    ("mozzarella",        ["mozzarella cheese white italian"],         "mozzarella",        1),
    ("emmental",          ["emmental swiss cheese holes"],             "emmental",          1),
    ("parmesan",          ["parmesan cheese italian wheel"],           "parmesan",          1),
    ("gouda",             ["gouda cheese dutch netherlands"],          "gouda",             1),
    ("feta",              ["feta cheese greek white"],                 "feta",              1),
    ("gruyere",           ["gruyere cheese swiss alps"],               "gruyere",           1),
    ("roquefort",         ["roquefort blue cheese french"],            "roquefort",         1),
    ("ricotta",           ["ricotta cheese fresh italian"],            "ricotta",           1),
    ("mascarpone",        ["mascarpone cream cheese italian"],         "mascarpone",        1),
    ("raclette",          ["raclette cheese melted swiss"],            "raclette",          1),
    ("comte",             ["comte cheese french jura"],                "comte",             1),
    ("reblochon",         ["reblochon cheese french savoie"],          "reblochon",         1),
    ("burrata",           ["burrata fresh cheese italian"],            "burrata",           1),
    ("halloumi",          ["halloumi cheese cyprus grilled"],          "halloumi",          1),
    ("gorgonzola",        ["gorgonzola blue cheese italian"],          "gorgonzola",        1),
    ("munster",           ["munster cheese alsace orange"],            "munster",           1),
    ("cantal",            ["cantal cheese french auvergne"],           "cantal",            1),

    # ── Difficulté 2 — bien connus des amateurs (20) ──
    ("beaufort",          ["beaufort cheese french alps"],             "beaufort",          2),
    ("taleggio",          ["taleggio cheese italian washed"],          "taleggio",          2),
    ("asiago",            ["asiago cheese italian"],                   "asiago",            2),
    ("fontina",           ["fontina cheese italian alpine"],           "fontina",           2),
    ("provolone",         ["provolone cheese italian aged"],           "provolone",         2),
    ("pecorino",          ["pecorino romano sheep cheese"],            "pecorino",          2),
    ("manchego",          ["manchego cheese spanish sheep"],           "manchego",          2),
    ("epoisses",          ["epoisses cheese burgundy strong"],         "epoisses",          2),
    ("livarot",           ["livarot cheese normandy"],                 "livarot",           2),
    ("mont_dor",          ["mont d'or vacherin cheese"],               "mont d'or",         2),
    ("saint_nectaire",    ["saint nectaire cheese auvergne"],          "saint nectaire",    2),
    ("tomme_savoie",      ["tomme de savoie cheese"],                  "tomme de savoie",   2),
    ("fourme_ambert",     ["fourme d'ambert blue cheese"],             "fourme d'ambert",   2),
    ("bleu_auvergne",     ["bleu d'auvergne cheese"],                  "bleu d'auvergne",   2),
    ("brie_meaux",        ["brie de meaux cheese"],                    "brie de meaux",     2),
    ("chaource",          ["chaource cheese french soft"],             "chaource",          2),
    ("langres",           ["langres cheese champagne"],                "langres",           2),
    ("valencay",          ["valencay goat cheese pyramid ash"],        "valencay",          2),
    ("sainte_maure",      ["sainte maure goat cheese log"],            "sainte maure",      2),
    ("crottin_chavignol", ["crottin chavignol goat cheese"],           "crottin de chavignol", 2),

    # ── Difficulté 3 — moins connus / spécialisés (10) ──
    ("selles_sur_cher",   ["selles sur cher goat cheese ash"],         "selles sur cher",   3),
    ("pouligny",          ["pouligny saint pierre goat"],              "pouligny saint pierre", 3),
    ("cabrales",          ["cabrales blue cheese asturias"],           "cabrales",          3),
    ("tetilla",           ["tetilla cheese galicia spain"],            "tetilla",           3),
    ("jarlsberg",         ["jarlsberg cheese norwegian holes"],        "jarlsberg",         3),
    ("havarti",           ["havarti cheese danish"],                   "havarti",           3),
    ("limburger",         ["limburger cheese strong german"],          "limburger",         3),
    ("tilsit",            ["tilsit cheese german yellow"],             "tilsit",            3),
    ("stilton",           ["stilton blue cheese english"],             "stilton",           3),
    ("caerphilly",        ["caerphilly cheese welsh white"],           "caerphilly",        3),
]

ACCEPTED = {
    "camembert":              ["camembert"],
    "emmental":               ["emmental", "gruyere suisse"],
    "parmesan":               ["parmesan", "parmigiano"],
    "comte":                  ["comte", "comté"],
    "gruyere":                ["gruyere", "gruyère"],
    "gorgonzola":             ["gorgonzola"],
    "epoisses":               ["epoisses", "époisses"],
    "mont d'or":              ["mont d'or", "vacherin mont d'or"],
    "saint nectaire":         ["saint nectaire"],
    "tomme de savoie":        ["tomme de savoie", "tomme"],
    "fourme d'ambert":        ["fourme d'ambert", "fourme"],
    "bleu d'auvergne":        ["bleu d'auvergne"],
    "brie de meaux":          ["brie de meaux", "brie"],
    "valencay":               ["valencay", "valençay"],
    "sainte maure":           ["sainte maure", "sainte-maure"],
    "crottin de chavignol":   ["crottin de chavignol", "crottin", "chavignol"],
    "selles sur cher":        ["selles sur cher"],
    "pouligny saint pierre":  ["pouligny saint pierre", "pouligny"],
    "halloumi":               ["halloumi", "haloumi"],
}

def slugify(name):
    r = {'é':'e','è':'e','ê':'e','ë':'e','à':'a','â':'a','ä':'a',
         'ù':'u','û':'u','ü':'u','î':'i','ï':'i','ô':'o','ö':'o',
         'ç':'c',' ':'_','-':'_',"'":'_'}
    name = name.lower()
    for s, d in r.items():
        name = name.replace(s, d)
    return re.sub(r'[^a-z0-9_]', '', name)

def search_commons(queries):
    for query in queries:
        params = {"action":"query","list":"search","srsearch":query,
                  "srnamespace":6,"srlimit":10,"format":"json"}
        try:
            r = requests.get("https://commons.wikimedia.org/w/api.php",
                             params=params, headers=HEADERS, timeout=10)
            results = r.json().get("query",{}).get("search",[])
            good = [res["title"] for res in results
                    if any(res["title"].lower().endswith(e) for e in [".jpg",".jpeg",".png"])]
            if good:
                return good[0]
        except Exception:
            continue
    return None

def get_image_url(file_title):
    params = {"action":"query","titles":file_title,"prop":"imageinfo",
              "iiprop":"url|size","iiurlwidth":1000,"format":"json"}
    try:
        r = requests.get("https://commons.wikimedia.org/w/api.php",
                         params=params, headers=HEADERS, timeout=10)
        pages = r.json().get("query",{}).get("pages",{})
        page = next(iter(pages.values()))
        ii = page.get("imageinfo",[{}])[0]
        return ii.get("thumburl"), ii.get("thumbwidth",0)
    except Exception:
        return None, 0

def download_image(url, filepath):
    try:
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code == 200 and len(r.content) > 2000:
            if ".svg" in url.lower():
                return None
            p = filepath.with_suffix(".png") if ".png" in url.lower() else filepath
            p.write_bytes(r.content)
            return p
    except Exception:
        pass
    return None

def get_saved_ext(folder, name):
    for ext in [".jpg", ".png", ".webp"]:
        if (folder / f"{name}{ext}").exists():
            return ext
    return ".jpg"

def main():
    seen, cheeses = set(), []
    for entry in CHEESES:
        if entry[0] not in seen:
            seen.add(entry[0])
            cheeses.append(entry)

    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)
    total, success, skipped, failed = len(cheeses), 0, 0, []

    print(f"\n🧀  Téléchargement de {total} fromages du monde  (Wikimedia Commons)")
    print(f"📁  Dossier : {output_path.resolve()}\n")
    print("─" * 68)

    for i, (filename, queries, answer_fr, diff) in enumerate(cheeses, 1):
        clean = slugify(filename)
        fp = output_path / f"{clean}.jpg"
        prefix = f"[{i:>3}/{total}]  {clean:<28}  D{diff}"

        already = next((output_path / f"{clean}{e}"
                        for e in [".jpg",".png",".webp"]
                        if (output_path / f"{clean}{e}").exists()), None)
        if already:
            print(f"{prefix} ⏭️  déjà présent")
            skipped += 1
            continue

        title = search_commons(queries)
        if not title:
            print(f"{prefix} ❌  introuvable")
            failed.append((clean, queries[0]))
            time.sleep(DELAY)
            continue

        url, w = get_image_url(title)
        if not url or w < MIN_WIDTH:
            print(f"{prefix} ⚠️  {('URL manquante' if not url else f'trop petite ({w}px)')}")
            failed.append((clean, queries[0]))
            time.sleep(DELAY)
            continue

        saved = download_image(url, fp)
        if saved:
            print(f"{prefix} ✅  {saved.stat().st_size//1024} Ko")
            success += 1
        else:
            print(f"{prefix} ❌  échec")
            failed.append((clean, queries[0]))
        time.sleep(DELAY)

    print("\n" + "─" * 68)
    print(f"✅  Succès  : {success} / ⏭️  Ignorés : {skipped} / ❌  Échoués : {len(failed)}")
    if failed:
        print("\nÀ corriger manuellement :")
        for name, term in failed:
            print(f"   • {name:<30} ← \"{term}\"")

    print("\n" + "═"*68 + "\n📋  BLOC server.js :\n")
    print("    fromages: [")
    current_diff = 0
    labels = {1: "Difficulté 1 — très populaires",
              2: "Difficulté 2 — bien connus",
              3: "Difficulté 3 — moins connus"}

    for filename, _, answer_fr, diff in cheeses:
        if diff != current_diff:
            print(f"        // ── {labels[diff]} ──")
            current_diff = diff
        clean = slugify(filename)
        ext = get_saved_ext(output_path, clean)
        v = ACCEPTED.get(answer_fr, [answer_fr])
        acc = (f", acceptedAnswers: [{', '.join(chr(34)+x+chr(34) for x in v)}]" if len(v)>1 else "")
        print(f'        {{ image: "images/fromages/{clean}{ext}", answer: "{answer_fr}"{acc}, difficulty: {diff} }},')
    print("    ],")
    print(f"\n🎉  Terminé ! {success} images dans : {output_path.resolve()}\n")

if __name__ == "__main__":
    main()