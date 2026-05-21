"""
download_fruits_legumes.py  v2
-------------------------------
Source : Wikimedia Commons (recherche par mots-clés).
Bien plus fiable que l'API Wikipedia pour les fruits/légumes.

Usage :
    pip install requests
    python download_fruits_legumes.py
"""

import requests, time, re
from pathlib import Path

OUTPUT_DIR = "images/fruits_legumes"
DELAY      = 0.5
MIN_WIDTH  = 300
HEADERS    = {"User-Agent": "LeDuel-FruitVeggieDownloader/2.0 (contact@leduel.fr)"}

ITEMS = [
    # ── Difficulté 1 ──
    ("tomate",          ["tomato vegetable food red"],                    "tomate"),
    ("pomme",           ["apple fruit food red green"],                   "pomme"),
    ("banane",          ["banana fruit food yellow"],                     "banane"),
    ("orange",          ["orange citrus fruit food"],                     "orange"),
    ("carotte",         ["carrot vegetable orange food"],                 "carotte"),
    ("pomme_de_terre",  ["potato vegetable food"],                        "pomme de terre"),
    ("oignon",          ["onion vegetable food"],                         "oignon"),
    ("brocoli",         ["broccoli vegetable food green"],                "brocoli"),
    ("fraise",          ["strawberry fruit red food"],                    "fraise"),
    ("raisin",          ["grape fruit food bunch"],                       "raisin"),
    ("citron",          ["lemon citrus fruit food yellow"],               "citron"),
    ("pasteque",        ["watermelon fruit food"],                        "pasteque"),
    ("concombre",       ["cucumber vegetable food green"],                "concombre"),
    ("poivron",         ["bell pepper vegetable food colorful"],          "poivron"),
    ("courgette",       ["zucchini courgette vegetable food"],            "courgette"),
    ("ail",             ["garlic bulb food"],                             "ail"),
    ("epinard",         ["spinach leaves vegetable food"],                "epinard"),
    ("champignon",      ["mushroom food edible"],                         "champignon"),
    ("aubergine",       ["eggplant aubergine vegetable food"],            "aubergine"),
    ("mais",            ["corn maize food vegetable yellow"],             "mais"),

    # ── Difficulté 2 ──
    ("poire",           ["pear fruit food"],                              "poire"),
    ("peche",           ["peach fruit food"],                             "peche"),
    ("abricot",         ["apricot fruit food orange"],                    "abricot"),
    ("cerise",          ["cherry fruit food red"],                        "cerise"),
    ("myrtille",        ["blueberry fruit food"],                         "myrtille"),
    ("framboise",       ["raspberry fruit food red"],                     "framboise"),
    ("mure",            ["blackberry fruit food"],                        "mure"),
    ("ananas",          ["pineapple fruit tropical food"],                "ananas"),
    ("mangue",          ["mango fruit tropical food"],                    "mangue"),
    ("papaye",          ["papaya fruit tropical food"],                   "papaye"),
    ("kiwi",            ["kiwifruit green food"],                         "kiwi"),
    ("noix_coco",       ["coconut food tropical"],                        "noix de coco"),
    ("grenade",         ["pomegranate fruit food red"],                   "grenade"),
    ("melon",           ["melon fruit food"],                             "melon"),
    ("navet",           ["turnip vegetable food"],                        "navet"),
    ("radis",           ["radish vegetable food red"],                    "radis"),
    ("betterave",       ["beetroot vegetable food purple"],               "betterave"),
    ("artichaut",       ["artichoke vegetable food"],                     "artichaut"),
    ("asperge",         ["asparagus vegetable food green"],               "asperge"),
    ("haricot_vert",    ["green bean vegetable food"],                    "haricot vert"),
    ("petit_pois",      ["peas green vegetable food"],                    "petit pois"),
    ("chou_fleur",      ["cauliflower vegetable food white"],             "chou fleur"),
    ("chou",            ["cabbage vegetable food green"],                 "chou"),
    ("poireau",         ["leek vegetable food"],                          "poireau"),
    ("fenouil",         ["fennel vegetable food"],                        "fenouil"),
    ("celeri",          ["celery vegetable food"],                        "celeri"),
    ("patate_douce",    ["sweet potato food vegetable orange"],           "patate douce"),
    ("avocat",          ["avocado fruit food green"],                     "avocat"),
    ("olive",           ["olive food"],                                   "olive"),
    ("gingembre",       ["ginger root spice food"],                       "gingembre"),

    # ── Difficulté 3 ──
    ("rhubarbe",        ["rhubarb vegetable food red stem"],              "rhubarbe"),
    ("cresson",         ["watercress salad green food"],                  "cresson"),
    ("roquette",        ["rocket arugula salad leaves"],                  "roquette"),
    ("kale",            ["kale vegetable food leaves"],                   "kale"),
    ("panais",          ["parsnip vegetable root food"],                  "panais"),
    ("rutabaga",        ["rutabaga swede vegetable food"],                "rutabaga"),
    ("igname",          ["yam root vegetable food"],                      "igname"),
    ("manioc",          ["cassava manioc root vegetable"],                "manioc"),
    ("taro",            ["taro root vegetable food"],                     "taro"),
    ("curcuma",         ["turmeric spice yellow powder"],                 "curcuma"),
    ("safran",          ["saffron spice threads"],                        "safran"),
    ("vanille",         ["vanilla pod spice"],                            "vanille"),
    ("noix",            ["walnut nut food"],                              "noix"),
    ("amande",          ["almond nut food"],                              "amande"),
    ("noisette",        ["hazelnut nut food"],                            "noisette"),
    ("cacahuete",       ["peanut groundnut food"],                        "cacahuete"),
    ("pistache",        ["pistachio nut food green"],                     "pistache"),
    ("datte",           ["date fruit food palm"],                         "datte"),
    ("figue",           ["fig fruit food"],                               "figue"),
    ("prune",           ["plum fruit food purple"],                       "prune"),
    ("litchi",          ["lychee fruit food tropical"],                   "litchi"),
    ("ramboutan",       ["rambutan fruit tropical food"],                 "ramboutan"),
    ("carambole",       ["carambola starfruit food tropical"],            "carambole"),
    ("fruit_passion",   ["passion fruit food tropical"],                  "fruit de la passion"),
    ("goyave",          ["guava fruit tropical food"],                    "goyave"),
    ("tomate_cerise",   ["cherry tomato food red small"],                 "tomate cerise"),
    ("haricot_rouge",   ["red kidney bean food"],                         "haricot rouge"),
    ("lentille",        ["lentil legume food"],                           "lentille"),
    ("pois_chiche",     ["chickpea garbanzo bean food"],                  "pois chiche"),
    ("soja",            ["soybean soya food"],                            "soja"),
    ("longane",         ["longan fruit tropical food"],                   "longane"),
    ("mangoustan",      ["mangosteen fruit tropical food"],               "mangoustan"),
    ("pitaya",          ["dragon fruit pitaya food"],                     "pitaya"),
    ("kumquat",         ["kumquat citrus fruit food"],                    "kumquat"),
    ("physalis",        ["physalis cape gooseberry food"],                "physalis"),
    ("jackfruit",       ["jackfruit tropical fruit food"],                "jackfruit"),
    ("durian",          ["durian fruit tropical food"],                   "durian"),
    ("cacao",           ["cacao bean chocolate food"],                    "cacao"),
    ("cafe",            ["coffee bean food"],                             "cafe"),
    ("cannelle",        ["cinnamon spice food"],                          "cannelle"),
    ("aneth",           ["dill herb food"],                               "aneth"),
    ("basilic",         ["basil herb food green"],                        "basilic"),
    ("menthe",          ["mint herb leaves food"],                        "menthe"),
    ("persil",          ["parsley herb food green"],                      "persil"),
    ("thym",            ["thyme herb food"],                              "thym"),
    ("romarin",         ["rosemary herb food"],                           "romarin"),
    ("coriandre",       ["coriander herb food"],                          "coriandre"),
    ("estragon",        ["tarragon herb food"],                           "estragon"),
    ("laurier",         ["bay leaf herb food"],                           "laurier"),
    ("girofle",         ["clove spice food"],                             "girofle"),
    ("cardamome",       ["cardamom spice food"],                          "cardamome"),
    ("anis",            ["anise spice food"],                             "anis"),
]

ACCEPTED = {
    "pomme de terre":       ["pomme de terre", "potato"],
    "courgette":            ["courgette", "zucchini"],
    "mais":                 ["mais", "corn"],
    "noix de coco":         ["noix de coco", "coconut"],
    "chou fleur":           ["chou fleur", "cauliflower"],
    "patate douce":         ["patate douce", "sweet potato"],
    "haricot vert":         ["haricot vert", "green bean"],
    "petit pois":           ["petit pois", "pea", "peas"],
    "fruit de la passion":  ["fruit de la passion", "passion fruit"],
    "pois chiche":          ["pois chiche", "chickpea"],
    "cacahuete":            ["cacahuete", "cacahuète", "peanut"],
    "tomate cerise":        ["tomate cerise", "cherry tomato"],
    "haricot rouge":        ["haricot rouge", "red bean"],
    "peche":                ["peche", "pêche", "peach"],
}

def slugify(name):
    r = {'é':'e','è':'e','ê':'e','ë':'e','à':'a','â':'a','ä':'a',
         'ù':'u','û':'u','ü':'u','î':'i','ï':'i','ô':'o','ö':'o',
         'ç':'c',' ':'_','-':'_'}
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
    seen, items = set(), []
    for entry in ITEMS:
        if entry[0] not in seen:
            seen.add(entry[0])
            items.append(entry)

    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)
    total, success, skipped, failed = len(items), 0, 0, []

    print(f"\n🥕  Téléchargement de {total} fruits et légumes  (Wikimedia Commons)")
    print(f"📁  Dossier : {output_path.resolve()}\n")
    print("─" * 68)

    for i, (filename, queries, answer_fr) in enumerate(items, 1):
        clean = slugify(filename)
        fp = output_path / f"{clean}.jpg"
        prefix = f"[{i:>3}/{total}]  {clean:<30}"

        already = next((output_path / f"{clean}{e}"
                        for e in [".jpg",".png",".webp"]
                        if (output_path / f"{clean}{e}").exists()), None)
        if already:
            print(f"{prefix} ⏭️  déjà présent"); skipped += 1; continue

        title = search_commons(queries)
        if not title:
            print(f"{prefix} ❌  introuvable")
            failed.append((clean, queries[0])); time.sleep(DELAY); continue

        url, w = get_image_url(title)
        if not url or w < MIN_WIDTH:
            print(f"{prefix} ⚠️  {('URL manquante' if not url else f'trop petite ({w}px)')}")
            failed.append((clean, queries[0])); time.sleep(DELAY); continue

        saved = download_image(url, fp)
        if saved:
            print(f"{prefix} ✅  {saved.stat().st_size//1024} Ko"); success += 1
        else:
            print(f"{prefix} ❌  échec"); failed.append((clean, queries[0]))
        time.sleep(DELAY)

    print("\n" + "─" * 68)
    print(f"✅  Succès  : {success} / ⏭️  Ignorés : {skipped} / ❌  Échoués : {len(failed)}")
    if failed:
        print("\nÀ corriger manuellement :")
        for name, term in failed:
            print(f"   • {name:<30} ← \"{term}\"")

    print("\n" + "═"*68 + "\n📋  BLOC server.js :\n")
    print("    fruits_legumes: [")
    cur = 0
    labels = {1:"Difficulté 1",2:"Difficulté 2",3:"Difficulté 3"}
    for idx,(filename,_,answer_fr) in enumerate(items):
        d = 1 if idx<20 else (2 if idx<60 else 3)
        clean = slugify(filename)
        ext = get_saved_ext(output_path, clean)
        if d != cur:
            print(f"        // ── {labels[d]} ──"); cur = d
        v = ACCEPTED.get(answer_fr,[answer_fr])
        acc = (f", acceptedAnswers: [{', '.join(chr(34)+x+chr(34) for x in v)}]" if len(v)>1 else "")
        print(f'        {{ image: "images/fruits_legumes/{clean}{ext}", answer: "{answer_fr}"{acc}, difficulty: {d} }},')
    print("    ],")
    print(f"\n🎉  Terminé ! {success} images dans : {output_path.resolve()}\n")

if __name__ == "__main__":
    main()