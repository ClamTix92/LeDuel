"""
download_desserts.py
--------------------
Télécharge les images des 60 desserts/pâtisseries/viennoiseries du monde
depuis Wikimedia Commons, classés par difficulté.

Usage :
    pip install requests
    python download_desserts.py
"""

import requests, time, re
from pathlib import Path

OUTPUT_DIR = "images/desserts"
DELAY      = 0.5
MIN_WIDTH  = 300
HEADERS    = {"User-Agent": "LeDuel-DessertDownloader/1.0 (contact@leduel.fr)"}

# Format : ("nom_fichier", ["requête1", "requête2"], "réponse_FR", difficulté)
DESSERTS = [
    # ── Difficulté 1 — très connus du grand public (20) ──
    ("gateau_chocolat",   ["chocolate cake dessert slice"],            "gateau au chocolat",  1),
    ("tiramisu",          ["tiramisu italian dessert"],                "tiramisu",            1),
    ("creme_brulee",      ["creme brulee custard caramelized"],        "creme brulee",        1),
    ("mousse_chocolat",   ["chocolate mousse dessert"],                "mousse au chocolat",  1),
    ("tarte_pommes",      ["apple tart french dessert"],               "tarte aux pommes",    1),
    ("croissant",         ["croissant pastry french butter"],          "croissant",           1),
    ("pain_chocolat",     ["pain au chocolat french viennoiserie"],    "pain au chocolat",    1),
    ("eclair_chocolat",   ["eclair chocolate pastry french"],          "eclair",              1),
    ("macaron",           ["macaron french almond colorful"],          "macaron",             1),
    ("panna_cotta",       ["panna cotta italian cream dessert"],       "panna cotta",         1),
    ("crepe",             ["crepe thin french pancake"],               "crepe",               1),
    ("brownie",           ["brownie chocolate square cake"],           "brownie",             1),
    ("cheesecake",        ["cheesecake american dessert"],             "cheesecake",          1),
    ("flan",              ["creme caramel flan dessert"],              "flan",                1),
    ("mille_feuille",     ["mille feuille napoleon pastry"],           "mille feuille",       1),
    ("tarte_tatin",       ["tarte tatin caramelized apple"],           "tarte tatin",         1),
    ("donut",             ["donut doughnut glazed sweet"],             "donut",               1),
    ("muffin",            ["muffin blueberry baked sweet"],            "muffin",              1),
    ("cupcake",           ["cupcake frosting decorated"],              "cupcake",             1),
    ("waffle",            ["waffle gaufre belgian"],                   "gaufre",              1),

    # ── Difficulté 2 — bien connus des amateurs (25) ──
    ("profiteroles",      ["profiteroles cream puffs chocolate"],      "profiteroles",        2),
    ("paris_brest",       ["paris brest choux praline cream"],         "paris brest",         2),
    ("opera",             ["opera cake french chocolate"],             "opera",               2),
    ("clafoutis",         ["clafoutis cherry french dessert"],         "clafoutis",           2),
    ("crumble",           ["apple crumble fruit dessert"],             "crumble",             2),
    ("baba_rhum",         ["baba au rhum cake french"],                "baba au rhum",        2),
    ("savarin",           ["savarin rum cake ring"],                   "savarin",             2),
    ("religieuse",        ["religieuse french cream puff"],            "religieuse",          2),
    ("charlotte",         ["charlotte ladyfingers cream dessert"],     "charlotte",           2),
    ("baklava",           ["baklava phyllo honey nuts"],                "baklava",             2),
    ("pavlova",           ["pavlova meringue fruit dessert"],          "pavlova",             2),
    ("foret_noire",       ["black forest cherry chocolate cake"],      "foret noire",         2),
    ("sachertorte",       ["sachertorte chocolate austrian cake"],     "sachertorte",         2),
    ("strudel",           ["apple strudel austrian pastry"],           "strudel",             2),
    ("panettone",         ["panettone italian christmas bread"],       "panettone",           2),
    ("stollen",           ["stollen german christmas cake"],           "stollen",             2),
    ("cannoli",           ["cannoli sicilian ricotta pastry"],         "cannoli",             2),
    ("tarte_citron",      ["lemon tart meringue dessert"],             "tarte au citron",     2),
    ("nougat",            ["nougat almond candy sweet"],               "nougat",              2),
    ("madeleine",         ["madeleine french shell cake"],             "madeleine",           2),
    ("financier",         ["financier almond cake french"],            "financier",           2),
    ("canele",            ["canele french bordeaux pastry"],           "canele",              2),
    ("kouign_amann",      ["kouign amann breton butter pastry"],       "kouign amann",        2),
    ("chausson_pommes",   ["chausson aux pommes apple turnover"],      "chausson aux pommes", 2),
    ("brioche",           ["brioche french bread sweet"],              "brioche",             2),

    # ── Difficulté 3 — moins connus / internationaux (15) ──
    ("mont_blanc",        ["mont blanc chestnut cream dessert"],       "mont blanc",          3),
    ("paris_mont",        ["paris brest mont blanc"],                  "paris mont",          3),
    ("calisson",          ["calisson provence almond candy"],          "calisson",            3),
    ("dobos",             ["dobos torte hungarian layered"],           "dobos",               3),
    ("baumkuchen",        ["baumkuchen german ring cake"],             "baumkuchen",          3),
    ("mochi",             ["mochi japanese rice cake"],                "mochi",               3),
    ("daifuku",           ["daifuku mochi red bean japanese"],         "daifuku",             3),
    ("dorayaki",          ["dorayaki japanese red bean pancake"],      "dorayaki",            3),
    ("gulab_jamun",       ["gulab jamun indian sweet syrup"],          "gulab jamun",         3),
    ("jalebi",            ["jalebi indian spiral sweet syrup"],        "jalebi",              3),
    ("churros",           ["churros spanish fried pastry"],            "churros",             3),
    ("tres_leches",       ["tres leches cake mexican"],                "tres leches",         3),
    ("lamington",         ["lamington australian chocolate coconut"],  "lamington",           3),
    ("anzac",             ["anzac biscuit australian oat"],            "anzac",               3),
    ("loukoumades",       ["loukoumades greek honey doughnut"],        "loukoumades",         3),
]

ACCEPTED = {
    "gateau au chocolat":  ["gateau au chocolat", "gateau chocolat", "chocolate cake"],
    "creme brulee":        ["creme brulee", "crème brûlée"],
    "mousse au chocolat":  ["mousse au chocolat", "mousse chocolat", "mousse"],
    "tarte aux pommes":    ["tarte aux pommes", "tarte pommes", "apple tart"],
    "pain au chocolat":    ["pain au chocolat", "chocolatine"],
    "mille feuille":       ["mille feuille", "mille-feuille", "napoleon"],
    "tarte tatin":         ["tarte tatin"],
    "tarte au citron":     ["tarte au citron", "tarte citron"],
    "paris brest":         ["paris brest", "paris-brest"],
    "foret noire":         ["foret noire", "forêt noire", "black forest"],
    "baba au rhum":        ["baba au rhum", "baba"],
    "mont blanc":          ["mont blanc"],
    "kouign amann":        ["kouign amann", "kouign-amann"],
    "chausson aux pommes": ["chausson aux pommes", "chausson"],
    "gaufre":              ["gaufre", "waffle"],
    "donut":               ["donut", "doughnut", "beignet"],
    "lamington":           ["lamington"],
    "anzac":               ["anzac"],
    "gulab jamun":         ["gulab jamun"],
    "tres leches":         ["tres leches", "tres-leches"],
    "mochi":               ["mochi"],
    "daifuku":             ["daifuku"],
    "dorayaki":            ["dorayaki"],
    "loukoumades":         ["loukoumades"],
    "jalebi":              ["jalebi"],
    "calisson":            ["calisson", "calissons"],
    "churros":             ["churros", "churro"],
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
    seen, desserts = set(), []
    for entry in DESSERTS:
        if entry[0] not in seen:
            seen.add(entry[0])
            desserts.append(entry)

    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)
    total, success, skipped, failed = len(desserts), 0, 0, []

    print(f"\n🍰  Téléchargement de {total} desserts du monde  (Wikimedia Commons)")
    print(f"📁  Dossier : {output_path.resolve()}\n")
    print("─" * 68)

    for i, (filename, queries, answer_fr, diff) in enumerate(desserts, 1):
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
    print("    desserts: [")
    current_diff = 0
    labels = {1: "Difficulté 1 — très populaires",
              2: "Difficulté 2 — bien connus",
              3: "Difficulté 3 — moins connus"}

    for filename, _, answer_fr, diff in desserts:
        if diff != current_diff:
            print(f"        // ── {labels[diff]} ──")
            current_diff = diff
        clean = slugify(filename)
        ext = get_saved_ext(output_path, clean)
        v = ACCEPTED.get(answer_fr, [answer_fr])
        acc = (f", acceptedAnswers: [{', '.join(chr(34)+x+chr(34) for x in v)}]" if len(v)>1 else "")
        print(f'        {{ image: "images/desserts/{clean}{ext}", answer: "{answer_fr}"{acc}, difficulty: {diff} }},')
    print("    ],")
    print(f"\n🎉  Terminé ! {success} images dans : {output_path.resolve()}\n")

if __name__ == "__main__":
    main()