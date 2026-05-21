"""
download_chats.py
-----------------
Télécharge les images des 100 races de chats les plus populaires
depuis Wikipedia EN — utilise l'API Action (plus fiable que REST).

Usage :
    pip install requests
    python download_chats.py
"""

import requests
import time
import re
from pathlib import Path

# ─────────────────────────────────────────────
#  CONFIGURATION
# ─────────────────────────────────────────────

OUTPUT_DIR = "images/chats"
DELAY      = 0.6
MIN_WIDTH  = 250
HEADERS    = {"User-Agent": "LeDuel-CatDownloader/1.0 (contact@leduel.fr)"}

# ─────────────────────────────────────────────
#  LISTE DES 100 RACES DE CHATS
#  ("nom_fichier", "titre_wikipedia_EN", "reponse_FR")
# ─────────────────────────────────────────────

CATS = [
    # ── Difficulté 1 — races très connues du grand public ──
    ("siamois",              "Siamese cat",                  "siamois"),
    ("persan",               "Persian cat",                  "persan"),
    ("maine_coon",           "Maine Coon",                   "maine coon"),
    ("bengal",               "Bengal cat",                   "bengal"),
    ("ragdoll",              "Ragdoll",                      "ragdoll"),
    ("british_shorthair",    "British Shorthair",            "british shorthair"),
    ("abyssin",              "Abyssinian cat",               "abyssin"),
    ("scottish_fold",        "Scottish Fold",                "scottish fold"),
    ("sphynx",               "Sphynx cat",                   "sphynx"),
    ("sacre_birmanie",       "Birman",                       "sacre de birmanie"),
    ("norvegien",            "Norwegian Forest cat",         "norvegien"),
    ("angora",               "Turkish Angora",               "angora"),
    ("russe_bleu",           "Russian Blue",                 "bleu russe"),
    ("burmese",              "Burmese cat",                  "burmese"),
    ("chartreux",            "Chartreux",                    "chartreux"),
    ("somali",               "Somali cat",                   "somali"),
    ("ragamuffin",           "Ragamuffin cat",               "ragamuffin"),
    ("savannah",             "Savannah cat",                 "savannah"),
    ("tonkinois",            "Tonkinese cat",                "tonkinois"),
    ("turc_van",             "Turkish Van",                  "turc van"),

    # ── Difficulté 2 — bien connues des amateurs ──
    ("american_shorthair",   "American Shorthair",           "american shorthair"),
    ("bombay",               "Bombay cat",                   "bombay"),
    ("devon_rex",            "Devon Rex",                    "devon rex"),
    ("cornish_rex",          "Cornish Rex",                  "cornish rex"),
    ("exotic_shorthair",     "Exotic Shorthair",             "exotic shorthair"),
    ("oriental_shorthair",   "Oriental Shorthair",           "oriental shorthair"),
    ("balinais",             "Balinese cat",                 "balinais"),
    ("manx",                 "Manx cat",                     "manx"),
    ("japonais_bobtail",     "Japanese Bobtail",             "bobtail japonais"),
    ("american_bobtail",     "American Bobtail",             "bobtail americain"),
    ("havana",               "Havana Brown",                 "havana"),
    ("ocichat",              "Ocicat",                       "ocichat"),
    ("selkirk_rex",          "Selkirk Rex",                  "selkirk rex"),
    ("siberian",             "Siberian cat",                 "siberien"),
    ("singapura",            "Singapura cat",                "singapura"),
    ("snowshoe",             "Snowshoe cat",                 "snowshoe"),
    ("sokoke",               "Sokoke",                       "sokoke"),
    ("turkish_angora",       "Turkish Angora",               "angora turc"),
    ("egyptian_mau",         "Egyptian Mau",                 "mau egyptien"),
    ("kurilian_bobtail",     "Kurilian Bobtail",             "bobtail des kouriles"),
    ("laperm",               "LaPerm",                       "laperm"),
    ("munchkin",             "Munchkin cat",                 "munchkin"),
    ("nebelung",             "Nebelung",                     "nebelung"),
    ("neva_masquerade",      "Neva Masquerade",              "neva masquerade"),
    ("ocicat",               "Ocicat",                       "ocicat"),
    ("peterbald",            "Peterbald",                    "peterbald"),
    ("pixiebob",             "Pixie-bob",                    "pixiebob"),
    ("american_curl",        "American Curl",                "american curl"),
    ("burmilla",             "Burmilla",                     "burmilla"),
    ("chausie",              "Chausie",                      "chausie"),
    ("cymric",               "Cymric cat",                   "cymric"),
    ("donskoy",              "Donskoy cat",                  "donskoy"),
    ("european_shorthair",   "European shorthair",           "europeen"),
    ("german_rex",           "German Rex",                   "rex allemand"),
    ("highlander",           "Highlander cat",               "highlander"),
    ("khao_manee",           "Khao Manee",                   "khao manee"),
    ("korat",                "Korat",                        "korat"),
    ("lykoi",                "Lykoi",                        "lykoi"),
    ("ojos_azules",          "Ojos Azules",                  "ojos azules"),
    ("oriental_longhair",    "Oriental Longhair",            "oriental longhair"),

    # ── Difficulté 3 — races rares / culture féline ──
    ("australian_mist",      "Australian Mist",              "australian mist"),
    ("birman",               "Birman",                       "birman"),
    ("california_spangled",  "California Spangled",          "california spangled"),
    ("chantilly_tiffany",    "Chantilly-Tiffany",            "chantilly tiffany"),
    ("colorpoint_shorthair", "Colorpoint Shorthair",         "colorpoint shorthair"),
    ("cyprus",               "Aphrodite cat",                "chat de chypre"),
    ("dragon_li",            "Dragon Li",                    "dragon li"),
    ("foldex",               "Foldex cat",                   "foldex"),
    ("genetta",              "Genetta cat",                   "genetta"),
    ("himalayan",            "Himalayan cat",                "himalayen"),
    ("javanese",             "Javanese cat",                 "javanais"),
    ("lambkin",              "Lambkin cat",                  "lambkin"),
    ("maine_wave",           "Maine Wave",                   "maine wave"),
    ("mojave_spotted",       "Mojave Spotted",               "mojave spotted"),
    ("mosaic",               "Mosaic cat",                   "mosaique"),
    ("napoleon",             "Napoleon cat",                 "napoleon"),
    ("pantherette",          "Pantherette",                  "pantherette"),
    ("raas",                 "Raas cat",                     "raas"),
    ("serengeti",            "Serengeti cat",                "serengeti"),
    ("suphalak",             "Suphalak",                     "suphalak"),
    ("thai",                 "Thai cat",                     "chat thai"),
    ("tiffanie",             "Tiffanie cat",                 "tiffanie"),
    ("toyger",               "Toyger",                       "toyger"),
    ("ukrainian_levkoy",     "Ukrainian Levkoy",             "levkoy ukrainien"),
    ("ural_rex",             "Ural Rex",                     "ural rex"),
    ("van_kedisi",           "Van Kedisi",                   "van kedisi"),
    ("viverral",             "Viverral",                     "viverral"),
    ("york_chocolate",       "York Chocolate",               "york chocolate"),
    ("zeus",                 "Zeus cat",                     "zeus"),
    ("bristol",              "Bristol cat",                  "bristol"),
    ("habari",               "Habari",                       "habari"),
    ("jungala",              "Jungala",                      "jungala"),
    ("kohana",               "Kohana cat",                   "kohana"),
    ("li_hua",               "Li Hua cat",                   "li hua"),
    ("maine_coon_polydactyl","Maine Coon",                   "maine coon polydactyle"),
    ("mandarin",             "Mandarin cat",                 "mandarin"),
    ("minuet",               "Minuet cat",                   "minuet"),
    ("minskin",              "Minskin",                      "minskin"),
    ("miranda",              "Miranda cat",                   "miranda"),
    ("misty",                "Misty cat",                    "misty"),
]

# ─────────────────────────────────────────────
#  RÉPONSES ACCEPTÉES (variantes par race)
# ─────────────────────────────────────────────

ACCEPTED = {
    "siamois":              ["siamois", "siamese"],
    "persan":               ["persan", "persian"],
    "maine coon":           ["maine coon", "maine-coon"],
    "british shorthair":    ["british shorthair", "british"],
    "scottish fold":        ["scottish fold", "scottish"],
    "sacre de birmanie":    ["sacre de birmanie", "birman", "birmanie"],
    "norvegien":            ["norvegien", "chat des forets norvegiennes"],
    "angora":               ["angora", "angora turc"],
    "bleu russe":           ["bleu russe", "russian blue", "russe bleu"],
    "somali":               ["somali"],
    "savannah":             ["savannah"],
    "devon rex":            ["devon rex"],
    "cornish rex":          ["cornish rex"],
    "exotic shorthair":     ["exotic shorthair", "exotic"],
    "oriental shorthair":   ["oriental shorthair", "oriental"],
    "bobtail japonais":     ["bobtail japonais", "japanese bobtail"],
    "bobtail americain":    ["bobtail americain", "american bobtail"],
    "mau egyptien":         ["mau egyptien", "egyptian mau"],
    "bobtail des kouriles": ["bobtail des kouriles", "kurilian bobtail"],
    "american curl":        ["american curl"],
    "rex allemand":         ["rex allemand", "german rex"],
    "khao manee":           ["khao manee"],
    "chantilly tiffany":    ["chantilly tiffany", "chantilly"],
    "chat de chypre":       ["chat de chypre", "aphrodite", "cyprus"],
    "himalayen":            ["himalayen", "himalayan"],
    "javanais":             ["javanais", "javanese"],
    "levkoy ukrainien":     ["levkoy ukrainien", "ukrainian levkoy"],
    "chat thai":            ["chat thai", "thai"],
    "american shorthair":   ["american shorthair"],
    "selkirk rex":          ["selkirk rex"],
    "siberien":             ["siberien", "siberian"],
}

# ─────────────────────────────────────────────
#  FONCTIONS UTILITAIRES
# ─────────────────────────────────────────────

def slugify(name):
    r = {'é':'e','è':'e','ê':'e','ë':'e','à':'a','â':'a','ä':'a',
         'ù':'u','û':'u','ü':'u','î':'i','ï':'i','ô':'o','ö':'o',
         'ç':'c',' ':'_','-':'_'}
    name = name.lower()
    for s, d in r.items():
        name = name.replace(s, d)
    return re.sub(r'[^a-z0-9_]', '', name)


def get_wikipedia_image(page_title):
    """API Wikipedia Action EN — fiable et non limité."""
    params = {
        "action": "query", "titles": page_title,
        "prop": "pageimages", "pithumbsize": 1000,
        "format": "json", "redirects": 1,
    }
    try:
        r = requests.get("https://en.wikipedia.org/w/api.php",
                         params=params, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return None
        pages = r.json().get("query", {}).get("pages", {})
        page  = next(iter(pages.values()))
        if page.get("pageid") == -1:
            return None
        thumb = page.get("thumbnail")
        if thumb:
            url = re.sub(r'/\d+px-', '/1200px-', thumb["source"])
            return {"url": url, "width": thumb.get("width", 800)}
        return None
    except Exception:
        return None


def download_image(url, filepath):
    """Télécharge et sauvegarde avec la bonne extension."""
    for attempt_url in [url, re.sub(r'/\d+px-', '/800px-', url)]:
        try:
            r = requests.get(attempt_url, timeout=15, headers=HEADERS)
            if r.status_code == 200 and len(r.content) > 2000:
                url_lower = attempt_url.lower()
                if ".svg" in url_lower:
                    return None
                elif ".png" in url_lower:
                    p = filepath.with_suffix(".png")
                elif ".webp" in url_lower:
                    p = filepath.with_suffix(".webp")
                else:
                    p = filepath
                p.write_bytes(r.content)
                return p
        except Exception:
            continue
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
    # Dédoublonnage
    seen, cats = set(), []
    for entry in CATS:
        if entry[0] not in seen:
            seen.add(entry[0])
            cats.append(entry)

    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)

    total, success, skipped, failed = len(cats), 0, 0, []

    print(f"\n🐱  Téléchargement de {total} races de chats")
    print(f"📁  Dossier : {output_path.resolve()}\n")
    print("─" * 65)

    for i, (filename, wiki_term, answer_fr) in enumerate(cats, 1):
        clean  = slugify(filename)
        fp     = output_path / f"{clean}.jpg"
        prefix = f"[{i:>3}/{total}]  {clean:<32}"

        # Déjà téléchargé ?
        already = next((output_path / f"{clean}{e}"
                        for e in [".jpg", ".png", ".webp"]
                        if (output_path / f"{clean}{e}").exists()), None)
        if already:
            print(f"{prefix} ⏭️  déjà présent")
            skipped += 1
            continue

        img = get_wikipedia_image(wiki_term)
        if not img:
            print(f"{prefix} ❌  introuvable  ← \"{wiki_term}\"")
            failed.append((clean, wiki_term))
            time.sleep(DELAY)
            continue

        if img["width"] < MIN_WIDTH:
            print(f"{prefix} ⚠️  trop petite ({img['width']}px)")
            failed.append((clean, wiki_term))
            time.sleep(DELAY)
            continue

        saved = download_image(img["url"], fp)
        if saved:
            print(f"{prefix} ✅  {saved.stat().st_size // 1024} Ko")
            success += 1
        else:
            print(f"{prefix} ❌  échec téléchargement")
            failed.append((clean, wiki_term))

        time.sleep(DELAY)

    # ── Rapport ──
    print("\n" + "─" * 65)
    print(f"✅  Succès  : {success}")
    print(f"⏭️   Ignorés : {skipped}")
    print(f"❌  Échoués : {len(failed)}")

    if failed:
        print("\nÀ corriger manuellement (cherche sur Wikimedia Commons) :")
        for name, term in failed:
            print(f"   • {name:<32} ← \"{term}\"")

    # ── Bloc server.js généré automatiquement ──
    print("\n" + "═" * 65)
    print("📋  BLOC server.js — copie dans allQuestions :\n")

    labels = {1: "Difficulté 1 — très populaires",
               2: "Difficulté 2 — populaires",
               3: "Difficulté 3 — moins connues"}
    print("    chats: [")
    current_diff = 0

    for idx, (filename, _, answer_fr) in enumerate(cats):
        diff  = 1 if idx < 20 else (2 if idx < 60 else 3)
        clean = slugify(filename)
        ext   = get_saved_ext(output_path, clean)

        if diff != current_diff:
            print(f"        // ── {labels[diff]} ──")
            current_diff = diff

        variants = ACCEPTED.get(answer_fr, [answer_fr])
        acc = (f", acceptedAnswers: [{', '.join(chr(34)+v+chr(34) for v in variants)}]"
               if len(variants) > 1 else "")
        print(f'        {{ image: "images/chats/{clean}{ext}", answer: "{answer_fr}"{acc}, difficulty: {diff} }},')

    print("    ],")
    print(f"\n🎉  Terminé !  Images dans : {output_path.resolve()}\n")


if __name__ == "__main__":
    main()