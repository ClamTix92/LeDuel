"""
download_plats.py  v2
---------------------
Télécharge ~100 images de plats du monde depuis Wikimedia Commons
(recherche par mots-clés — bien plus fiable que l'API Wikipedia pour les plats).

Usage :
    pip install requests
    python download_plats.py
"""

import requests
import time
import re
from pathlib import Path

OUTPUT_DIR = "images/plats"
DELAY      = 0.5
MIN_WIDTH  = 300
HEADERS    = {"User-Agent": "LeDuel-DishDownloader/2.0 (contact@leduel.fr)"}

# ─────────────────────────────────────────────
#  LISTE DES PLATS
#
#  Format : ("nom_fichier", ["terme1", "terme2", ...], "reponse_FR")
#  Plusieurs termes de recherche = plus de chances de trouver une bonne image
# ─────────────────────────────────────────────

DISHES = [
    # ── Difficulté 1 ──
    ("pizza",             ["pizza margherita food", "pizza dish"],                          "pizza"),
    ("sushi",             ["sushi platter japanese", "sushi food"],                         "sushi"),
    ("hamburger",         ["hamburger burger food", "hamburger dish"],                       "hamburger"),
    ("pates",             ["pasta dish italian", "spaghetti food"],                         "pates"),
    ("tacos",             ["tacos mexican food", "taco dish"],                              "tacos"),
    ("croissant",         ["croissant pastry french", "croissant bakery"],                  "croissant"),
    ("crepes",            ["crepe french dish", "crêpe food"],                              "crepes"),
    ("omelette",          ["omelette egg dish", "omelette food"],                           "omelette"),
    ("sandwich",          ["sandwich food", "sandwich bread"],                              "sandwich"),
    ("hot_dog",           ["hot dog food", "hotdog sausage"],                               "hot dog"),
    ("frites",            ["french fries food", "frites pommes de terre"],                  "frites"),
    ("steak",             ["steak grilled meat", "steak beef dish"],                        "steak"),
    ("soupe",             ["soup bowl food", "soupe plat"],                                 "soupe"),
    ("salade",            ["salad dish food", "salade verte"],                              "salade"),
    ("riz",               ["rice dish food", "riz plat asiatique"],                         "riz"),
    ("pizza_margherita",  ["margherita pizza", "pizza margherita neapolitan"],              "pizza margherita"),
    ("burger",            ["cheeseburger food", "burger beef cheese"],                      "burger"),
    ("kebab",             ["kebab food", "doner kebab dish"],                               "kebab"),
    ("curry",             ["curry dish indian", "curry food"],                              "curry"),
    ("tiramisu",          ["tiramisu dessert italian", "tiramisu food"],                    "tiramisu"),

    # ── Difficulté 2 ──
    ("paella",            ["paella valenciana spanish", "paella rice dish"],                "paella"),
    ("couscous",          ["couscous dish north africa", "couscous food"],                  "couscous"),
    ("ratatouille",       ["ratatouille provencal dish", "ratatouille food"],               "ratatouille"),
    ("lasagne",           ["lasagne italian dish", "lasagna food"],                         "lasagne"),
    ("risotto",           ["risotto italian rice", "risotto dish"],                         "risotto"),
    ("moussaka",          ["moussaka greek dish", "moussaka food"],                         "moussaka"),
    ("quiche",            ["quiche lorraine french", "quiche food"],                        "quiche"),
    ("fondue",            ["fondue cheese swiss", "fondue dish"],                           "fondue"),
    ("raclette",          ["raclette cheese dish", "raclette food"],                        "raclette"),
    ("choucroute",        ["choucroute garnie alsace", "sauerkraut dish"],                  "choucroute"),
    ("bouillabaisse",     ["bouillabaisse fish soup", "bouillabaisse marseille"],           "bouillabaisse"),
    ("cassoulet",         ["cassoulet dish french", "cassoulet beans"],                    "cassoulet"),
    ("beef_bourguignon",  ["beef bourguignon french", "boeuf bourguignon"],                "boeuf bourguignon"),
    ("coq_au_vin",        ["coq au vin french dish", "coq au vin"],                        "coq au vin"),
    ("blanquette",        ["blanquette de veau french", "blanquette veau"],                "blanquette de veau"),
    ("tarte_tatin",       ["tarte tatin french dessert", "tarte tatin apple"],             "tarte tatin"),
    ("kimchi",            ["kimchi korean fermented", "kimchi dish"],                       "kimchi"),
    ("pho",               ["pho vietnamese soup", "phở noodle soup"],                      "pho"),
    ("ramen",             ["ramen japanese noodle soup", "ramen bowl"],                    "ramen"),
    ("pad_thai",          ["pad thai noodle dish", "pad thai food"],                        "pad thai"),
    ("sushi_maki",        ["maki sushi roll", "maki japanese food"],                       "maki"),
    ("dim_sum",           ["dim sum chinese food", "dim sum basket"],                      "dim sum"),
    ("peking_duck",       ["peking duck chinese", "Beijing duck roasted"],                 "canard laque"),
    ("tempura",           ["tempura japanese fried", "tempura food"],                      "tempura"),
    ("takoyaki",          ["takoyaki japanese street food", "takoyaki octopus balls"],     "takoyaki"),
    ("biryani",           ["biryani indian rice", "biryani food"],                         "biryani"),
    ("tandoori",          ["tandoori chicken indian", "tandoori food"],                    "tandoori"),
    ("falafel",           ["falafel middle east food", "falafel chickpea"],                "falafel"),
    ("tagine",            ["tagine moroccan dish", "tajine food"],                         "tajine"),
    ("hummus",            ["hummus dip food", "hummus chickpea"],                          "hummus"),
    ("ceviche",           ["ceviche peruvian fish", "ceviche food"],                       "ceviche"),
    ("empanada",          ["empanada latin american", "empanada pastry"],                  "empanada"),
    ("churros",           ["churros spanish fried", "churros food"],                       "churros"),
    ("tacos_al_pastor",   ["tacos al pastor mexican", "al pastor taco"],                   "tacos al pastor"),
    ("goulash",           ["goulash hungarian beef stew", "goulash dish"],                 "goulash"),
    ("borscht",           ["borscht ukrainian soup", "borscht beetroot soup"],             "borscht"),
    ("pierogi",           ["pierogi polish dumpling", "pierogi food"],                     "pierogi"),
    ("schnitzel",         ["wiener schnitzel austrian", "schnitzel veal"],                 "schnitzel"),
    ("pelmeni",           ["pelmeni russian dumpling", "pelmeni food"],                    "pelmeni"),
    ("samosa",            ["samosa indian pastry", "samosa fried"],                        "samosa"),

    # ── Difficulté 3 ──
    ("okonomiyaki",       ["okonomiyaki japanese pancake", "okonomiyaki food"],             "okonomiyaki"),
    ("gyoza",             ["gyoza japanese dumpling", "gyoza fried"],                      "gyoza"),
    ("banh_mi",           ["banh mi vietnamese sandwich", "banh mi food"],                 "banh mi"),
    ("pho_bo",            ["pho bo beef noodle soup", "pho bo vietnamese"],                "pho bo"),
    ("laksa",             ["laksa noodle soup singapore", "laksa food"],                   "laksa"),
    ("satay",             ["satay grilled skewer", "satay food"],                          "satay"),
    ("nasi_goreng",       ["nasi goreng indonesian fried rice", "nasi goreng"],            "nasi goreng"),
    ("rendang",           ["rendang beef indonesian", "rendang food"],                     "rendang"),
    ("som_tam",           ["som tam green papaya salad", "som tam thai"],                  "som tam"),
    ("spring_roll",       ["spring roll vietnamese nem", "nem vietnamese"],                "nem"),
    ("tom_yum",           ["tom yum soup thai", "tom yum food"],                           "tom yum"),
    ("dosa",              ["dosa indian crepe", "masala dosa food"],                       "dosa"),
    ("thali",             ["thali indian meal", "thali food plate"],                       "thali"),
    ("jerk_chicken",      ["jerk chicken jamaican", "jerk chicken food"],                  "jerk chicken"),
    ("mofongo",           ["mofongo puerto rican", "mofongo plantain"],                    "mofongo"),
    ("poutine",           ["poutine canadian dish", "poutine fries cheese"],               "poutine"),
    ("fish_chips",        ["fish and chips british", "fish chips food"],                   "fish and chips"),
    ("shepherd_pie",      ["shepherd's pie british", "shepherd pie food"],                 "shepherd pie"),
    ("haggis",            ["haggis scottish dish", "haggis food"],                         "haggis"),
    ("bangers_mash",      ["bangers and mash british", "sausages mashed potato"],          "bangers and mash"),
    ("souvlaki",          ["souvlaki greek skewer", "souvlaki food"],                      "souvlaki"),
    ("gyro",              ["gyro greek wrap", "gyros food"],                               "gyro"),
    ("dolma",             ["dolma stuffed grape leaves", "dolma turkish food"],            "dolma"),
    ("tabbouleh",         ["tabbouleh salad lebanese", "tabbouleh food"],                  "tabbouleh"),
    ("baklava",           ["baklava sweet pastry", "baklava turkish dessert"],             "baklava"),
    ("panna_cotta",       ["panna cotta italian dessert", "panna cotta food"],             "panna cotta"),
    ("cannoli",           ["cannoli sicilian dessert", "cannoli food"],                    "cannoli"),
    ("flan",              ["flan caramel dessert", "creme caramel food"],                  "flan"),
    ("crema_catalana",    ["crema catalana spanish dessert", "creme brulee food"],         "crema catalana"),
    ("arancini",          ["arancini sicilian rice balls", "arancini food"],               "arancini"),
    ("polenta",           ["polenta italian cornmeal", "polenta food"],                    "polenta"),
    ("bruschetta",        ["bruschetta italian tomato", "bruschetta food"],                "bruschetta"),
    ("carbonara",         ["spaghetti carbonara italian", "carbonara pasta food"],         "carbonara"),
    ("osso_buco",         ["osso buco italian veal", "osso buco food"],                    "osso buco"),
    ("poke",              ["poke bowl hawaiian", "poke bowl food"],                        "poke bowl"),
]

ACCEPTED = {
    "pizza":               ["pizza"],
    "hamburger":           ["hamburger", "burger"],
    "pates":               ["pates", "pasta", "spaghetti"],
    "tacos":               ["tacos", "taco"],
    "crepes":              ["crepes", "crepe"],
    "hot dog":             ["hot dog", "hotdog"],
    "pizza margherita":    ["pizza margherita", "margherita"],
    "boeuf bourguignon":   ["boeuf bourguignon", "beef bourguignon"],
    "coq au vin":          ["coq au vin"],
    "blanquette de veau":  ["blanquette de veau", "blanquette"],
    "canard laque":        ["canard laque", "canard a pekin", "peking duck"],
    "tajine":              ["tajine", "tagine"],
    "nem":                 ["nem", "spring roll"],
    "fish and chips":      ["fish and chips"],
    "shepherd pie":        ["shepherd pie", "shepherd's pie"],
    "bangers and mash":    ["bangers and mash"],
    "poke bowl":           ["poke bowl", "poke"],
    "tacos al pastor":     ["tacos al pastor", "al pastor"],
    "nasi goreng":         ["nasi goreng", "riz frit indonesien"],
    "dosa":                ["dosa", "masala dosa"],
    "jerk chicken":        ["jerk chicken"],
    "maki":                ["maki", "maki sushi"],
    "dim sum":             ["dim sum"],
    "pad thai":            ["pad thai"],
    "tom yum":             ["tom yum"],
    "som tam":             ["som tam"],
    "banh mi":             ["banh mi"],
}

# ─────────────────────────────────────────────
#  FONCTIONS
# ─────────────────────────────────────────────

def slugify(name):
    r = {'é':'e','è':'e','ê':'e','ë':'e','à':'a','â':'a','ä':'a',
         'ù':'u','û':'u','ü':'u','î':'i','ï':'i','ô':'o','ö':'o',
         'ç':'c',' ':'_','-':'_'}
    name = name.lower()
    for s, d in r.items():
        name = name.replace(s, d)
    return re.sub(r'[^a-z0-9_]', '', name)


def search_commons(queries):
    """
    Cherche une image sur Wikimedia Commons avec plusieurs termes.
    Retourne le titre du premier fichier .jpg/.png trouvé.
    """
    for query in queries:
        params = {
            "action": "query", "list": "search",
            "srsearch": query, "srnamespace": 6,
            "srlimit": 10, "format": "json",
        }
        try:
            r = requests.get("https://commons.wikimedia.org/w/api.php",
                             params=params, headers=HEADERS, timeout=10)
            results = r.json().get("query", {}).get("search", [])
            good = [res["title"] for res in results
                    if any(res["title"].lower().endswith(ext)
                           for ext in [".jpg", ".jpeg", ".png"])]
            if good:
                return good[0]
        except Exception:
            continue
    return None


def get_image_url(file_title):
    """Récupère l'URL de téléchargement d'un fichier Wikimedia Commons."""
    params = {
        "action": "query", "titles": file_title,
        "prop": "imageinfo", "iiprop": "url|size",
        "iiurlwidth": 1000, "format": "json",
    }
    try:
        r = requests.get("https://commons.wikimedia.org/w/api.php",
                         params=params, headers=HEADERS, timeout=10)
        pages = r.json().get("query", {}).get("pages", {})
        page = next(iter(pages.values()))
        ii = page.get("imageinfo", [{}])[0]
        return ii.get("thumburl"), ii.get("thumbwidth", 0)
    except Exception:
        return None, 0


def download_image(url, filepath):
    """Télécharge et sauvegarde avec la bonne extension."""
    try:
        r = requests.get(url, timeout=15, headers=HEADERS)
        if r.status_code == 200 and len(r.content) > 2000:
            url_lower = url.lower()
            if ".svg" in url_lower:
                return None
            elif ".png" in url_lower:
                p = filepath.with_suffix(".png")
            else:
                p = filepath
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


# ─────────────────────────────────────────────
#  SCRIPT PRINCIPAL
# ─────────────────────────────────────────────

def main():
    seen, dishes = set(), []
    for entry in DISHES:
        if entry[0] not in seen:
            seen.add(entry[0])
            dishes.append(entry)

    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)

    total, success, skipped, failed = len(dishes), 0, 0, []

    print(f"\n🍽️  Téléchargement de {total} plats  (source : Wikimedia Commons)")
    print(f"📁  Dossier : {output_path.resolve()}\n")
    print("─" * 68)

    for i, (filename, queries, answer_fr) in enumerate(dishes, 1):
        clean = slugify(filename)
        fp = output_path / f"{clean}.jpg"
        prefix = f"[{i:>3}/{total}]  {clean:<30}"

        # Déjà téléchargé ?
        already = next((output_path / f"{clean}{e}"
                        for e in [".jpg", ".png", ".webp"]
                        if (output_path / f"{clean}{e}").exists()), None)
        if already:
            print(f"{prefix} ⏭️  déjà présent")
            skipped += 1
            continue

        # Recherche sur Commons
        file_title = search_commons(queries)
        if not file_title:
            print(f"{prefix} ❌  introuvable sur Commons")
            failed.append((clean, queries[0]))
            time.sleep(DELAY)
            continue

        url, width = get_image_url(file_title)
        if not url:
            print(f"{prefix} ❌  URL introuvable")
            failed.append((clean, queries[0]))
            time.sleep(DELAY)
            continue

        if width < MIN_WIDTH:
            print(f"{prefix} ⚠️  image trop petite ({width}px)")
            failed.append((clean, queries[0]))
            time.sleep(DELAY)
            continue

        saved = download_image(url, fp)
        if saved:
            print(f"{prefix} ✅  {saved.stat().st_size // 1024} Ko  ← {file_title[:40]}")
            success += 1
        else:
            print(f"{prefix} ❌  échec téléchargement")
            failed.append((clean, queries[0]))

        time.sleep(DELAY)

    print("\n" + "─" * 68)
    print(f"✅  Succès  : {success}")
    print(f"⏭️   Ignorés : {skipped}")
    print(f"❌  Échoués : {len(failed)}")

    if failed:
        print("\nÀ corriger sur commons.wikimedia.org :")
        for name, term in failed:
            print(f"   • {name:<30} ← cherche \"{term}\"")

    print("\n" + "═" * 68)
    print("📋  BLOC server.js prêt à copier :\n")
    print("    plats: [")
    current_diff = 0
    labels = {1: "Difficulté 1", 2: "Difficulté 2", 3: "Difficulté 3"}

    for idx, (filename, _, answer_fr) in enumerate(dishes):
        diff = 1 if idx < 20 else (2 if idx < 60 else 3)
        clean = slugify(filename)
        ext = get_saved_ext(output_path, clean)

        if diff != current_diff:
            print(f"        // ── {labels[diff]} ──")
            current_diff = diff

        variants = ACCEPTED.get(answer_fr, [answer_fr])
        acc = (f", acceptedAnswers: [{', '.join(chr(34)+v+chr(34) for v in variants)}]"
               if len(variants) > 1 else "")
        print(f'        {{ image: "images/plats/{clean}{ext}", answer: "{answer_fr}"{acc}, difficulty: {diff} }},')

    print("    ],")
    print(f"\n🎉  Terminé ! {success} images dans : {output_path.resolve()}\n")


if __name__ == "__main__":
    main()