"""
download_chiens.py
------------------
Télécharge les images des 100 races de chiens les plus populaires
depuis Wikipedia EN — utilise l'API Action (plus fiable que REST).

Usage :
    pip install requests
    python download_chiens.py
"""

import requests
import time
import re
from pathlib import Path

# ─────────────────────────────────────────────
#  CONFIGURATION
# ─────────────────────────────────────────────

OUTPUT_DIR = "images/chiens"
DELAY      = 0.6
MIN_WIDTH  = 250
HEADERS    = {"User-Agent": "LeDuel-DogDownloader/2.0 (contact@leduel.fr)"}

# ─────────────────────────────────────────────
#  LISTE DES 100 RACES
#  ("nom_fichier", "titre_wikipedia_EN", "reponse_FR")
# ─────────────────────────────────────────────

DOGS = [
    # ── Difficulté 1 ──
    ("labrador",              "Labrador Retriever",              "labrador"),
    ("golden_retriever",      "Golden Retriever",                "golden retriever"),
    ("berger_allemand",       "German Shepherd",                 "berger allemand"),
    ("bouledogue_francais",   "French Bulldog",                  "bouledogue francais"),
    ("bouledogue_anglais",    "Bulldog",                         "bouledogue anglais"),
    ("caniche",               "Poodle",                          "caniche"),
    ("beagle",                "Beagle",                          "beagle"),
    ("rottweiler",            "Rottweiler",                      "rottweiler"),
    ("teckel",                "Dachshund",                       "teckel"),
    ("yorkshire",             "Yorkshire Terrier",               "yorkshire"),
    ("boxer",                 "Boxer dog",                       "boxer"),
    ("doberman",              "Dobermann",                       "doberman"),
    ("husky",                 "Siberian Husky",                  "husky"),
    ("dalmatien",             "Dalmatian dog",                   "dalmatien"),
    ("chihuahua",             "Chihuahua dog",                   "chihuahua"),
    ("border_collie",         "Border Collie",                   "border collie"),
    ("shih_tzu",              "Shih Tzu",                        "shih tzu"),
    ("carlin",                "Pug",                             "carlin"),
    ("malinois",              "Belgian Malinois",                "malinois"),
    ("saint_bernard",         "Saint Bernard dog",               "saint bernard"),
    # ── Difficulté 2 ──
    ("berger_australien",     "Australian Shepherd",             "berger australien"),
    ("cocker",                "Cocker Spaniel",                  "cocker"),
    ("spitz",                 "Pomeranian dog",                  "spitz"),
    ("samoyede",              "Samoyed dog",                     "samoyede"),
    ("akita",                 "Akita dog",                       "akita"),
    ("shiba",                 "Shiba Inu",                       "shiba"),
    ("chow_chow",             "Chow Chow",                       "chow chow"),
    ("epagneul_breton",       "Brittany dog",                    "epagneul breton"),
    ("braque_weimar",         "Weimaraner",                      "braque de weimar"),
    ("berger_blanc",          "White Swiss Shepherd Dog",        "berger blanc suisse"),
    ("bull_terrier",          "Bull Terrier",                    "bull terrier"),
    ("amstaff",               "American Staffordshire Terrier",  "american staffordshire"),
    ("jack_russell",          "Jack Russell Terrier",            "jack russell"),
    ("setter_irlandais",      "Irish Setter",                    "setter irlandais"),
    ("bichon",                "Bichon Frise",                    "bichon"),
    ("whippet",               "Whippet",                         "whippet"),
    ("greyhound",             "Greyhound",                       "greyhound"),
    ("levrier_afghan",        "Afghan Hound",                    "levrier afghan"),
    ("terre_neuve",           "Newfoundland dog",                "terre neuve"),
    ("leonberger",            "Leonberger",                      "leonberger"),
    ("malamute",              "Alaskan Malamute",                "malamute"),
    ("bouvier_bernois",       "Bernese Mountain Dog",            "bouvier bernois"),
    ("briard",                "Briard",                          "briard"),
    ("pointer",               "Pointer dog",                     "pointer"),
    ("labradoodle",           "Labradoodle",                     "labradoodle"),
    ("saint_hubert",          "Bloodhound",                      "saint hubert"),
    ("basset_hound",          "Basset Hound",                    "basset hound"),
    ("cavalier_king",         "Cavalier King Charles Spaniel",   "cavalier king charles"),
    ("lhassa_apso",           "Lhasa Apso",                      "lhassa apso"),
    ("fox_terrier",           "Fox Terrier",                     "fox terrier"),
    ("levrier_irlandais",     "Irish Wolfhound",                 "levrier irlandais"),
    ("border_terrier",        "Border Terrier",                  "border terrier"),
    ("cairn_terrier",         "Cairn Terrier",                   "cairn terrier"),
    ("berger_picard",         "Picardy Shepherd",                "berger picard"),
    ("bouvier_flandres",      "Bouvier des Flandres",            "bouvier des flandres"),
    ("braque_allemand",       "German Shorthaired Pointer",      "braque allemand"),
    ("epagneul_papillon",     "Papillon dog",                    "papillon"),
    ("schnauzer",             "Schnauzer",                       "schnauzer"),
    ("berger_belge",          "Belgian Shepherd Dog",            "berger belge"),
    ("dogue_allemand",        "Great Dane",                      "dogue allemand"),
    ("beauceron",             "Beauceron",                       "beauceron"),
    # ── Difficulté 3 ──
    ("dogue_bordeaux",        "Dogue de Bordeaux",               "dogue de bordeaux"),
    ("cane_corso",            "Cane Corso",                      "cane corso"),
    ("bouledogue_americain",  "American Bulldog",                "bouledogue americain"),
    ("pitbull",               "American Pit Bull Terrier",       "pitbull"),
    ("shar_pei",              "Shar Pei",                        "shar pei"),
    ("chien_loup",            "Czechoslovakian Wolfdog",         "chien loup"),
    ("barzoi",                "Borzoi",                          "barzoi"),
    ("chien_pharaon",         "Pharaoh Hound",                   "chien du pharaon"),
    ("rhodesian",             "Rhodesian Ridgeback",             "rhodesian ridgeback"),
    ("vizsla",                "Vizsla",                          "vizsla"),
    ("kuvasz",                "Kuvasz",                          "kuvasz"),
    ("komondor",              "Komondor",                        "komondor"),
    ("eurasier",              "Eurasier",                        "eurasier"),
    ("dogue_canaries",        "Presa Canario",                   "dogue des canaries"),
    ("basenji",               "Basenji",                         "basenji"),
    ("tosa",                  "Tosa dog",                        "tosa"),
    ("fila_brasileiro",       "Fila Brasileiro",                 "fila brasileiro"),
    ("hokkaido",              "Hokkaido dog",                    "hokkaido"),
    ("azawakh",               "Azawakh",                         "azawakh"),
    ("xoloitzcuintle",        "Xoloitzcuintle",                  "xoloitzcuintle"),
    ("otterhound",            "Otterhound",                      "otterhound"),
    ("skye_terrier",          "Skye Terrier",                    "skye terrier"),
    ("kooikerhondje",         "Kooikerhondje",                   "kooikerhondje"),
    ("lagotto_romagnolo",     "Lagotto Romagnolo",               "lagotto romagnolo"),
    ("berger_caucasien",      "Caucasian Shepherd Dog",          "berger du caucase"),
    ("thai_ridgeback",        "Thai Ridgeback",                  "thai ridgeback"),
    ("chinook",               "Chinook dog",                     "chinook"),
    ("berger_maremme",        "Maremma Sheepdog",                "berger de la maremme"),
    ("kishu",                 "Kishu",                           "kishu"),
    ("bergamasco",            "Bergamasco Shepherd",             "bergamasque"),
    ("mudi",                  "Mudi dog",                        "mudi"),
    ("stabyhoun",             "Stabyhoun",                       "stabyhoun"),
    ("harrier",               "Harrier dog",                     "harrier"),
    ("glen_imaal",            "Glen of Imaal Terrier",           "glen of imaal"),
    ("chien_nu_perou",        "Peruvian Inca Orchid",            "chien nu du perou"),
    ("aidi",                  "Aidi",                            "aidi"),
    ("kishu_ken",             "Kishu Ken",                       "kishu ken"),
    ("chien_sang",            "Bloodhound",                      "chien de saint hubert"),
    ("eurasian",              "Eurasian dog",                    "eurasian"),
    ("lundehund",             "Norwegian Lundehund",             "lundehund"),
    ("perro_agua",            "Spanish Water Dog",               "chien d eau espagnol"),
]

# ─────────────────────────────────────────────
#  RÉPONSES ACCEPTÉES
# ─────────────────────────────────────────────

ACCEPTED = {
    "labrador":               ["labrador", "labrador retriever"],
    "golden retriever":       ["golden retriever", "golden"],
    "berger allemand":        ["berger allemand", "german shepherd"],
    "bouledogue francais":    ["bouledogue francais", "french bulldog", "frenchie"],
    "bouledogue anglais":     ["bouledogue anglais", "bulldog", "english bulldog"],
    "caniche":                ["caniche", "poodle"],
    "teckel":                 ["teckel", "dachshund", "basset allemand"],
    "husky":                  ["husky", "husky siberien", "siberian husky"],
    "carlin":                 ["carlin", "pug"],
    "saint bernard":          ["saint bernard", "st bernard"],
    "berger australien":      ["berger australien", "aussie"],
    "cocker":                 ["cocker", "cocker spaniel"],
    "braque de weimar":       ["braque de weimar", "weimaraner"],
    "berger blanc suisse":    ["berger blanc suisse", "berger blanc"],
    "bull terrier":           ["bull terrier"],
    "american staffordshire": ["american staffordshire", "amstaff"],
    "jack russell":           ["jack russell", "jack russell terrier"],
    "levrier afghan":         ["levrier afghan", "afghan hound", "afghan"],
    "terre neuve":            ["terre neuve", "newfoundland"],
    "saint hubert":           ["saint hubert", "bloodhound"],
    "basset hound":           ["basset hound", "basset"],
    "cavalier king charles":  ["cavalier king charles", "cavalier"],
    "lhassa apso":            ["lhassa apso", "lhasa apso"],
    "levrier irlandais":      ["levrier irlandais", "irish wolfhound"],
    "bouvier des flandres":   ["bouvier des flandres", "bouvier"],
    "braque allemand":        ["braque allemand", "german shorthaired pointer"],
    "berger belge":           ["berger belge", "malinois", "tervueren"],
    "dogue allemand":         ["dogue allemand", "great dane"],
    "dogue de bordeaux":      ["dogue de bordeaux", "bordeaux"],
    "shar pei":               ["shar pei"],
    "chien loup":             ["chien loup", "chien loup tchecoslovaque"],
    "chien du pharaon":       ["chien du pharaon", "pharaoh hound"],
    "rhodesian ridgeback":    ["rhodesian ridgeback", "rhodesian"],
    "dogue des canaries":     ["dogue des canaries", "presa canario"],
    "fila brasileiro":        ["fila brasileiro"],
    "berger du caucase":      ["berger du caucase", "berger caucasien"],
    "chien nu du perou":      ["chien nu du perou", "peruvian hairless"],
    "berger de la maremme":   ["berger de la maremme", "maremma"],
    "thai ridgeback":         ["thai ridgeback"],
    "lagotto romagnolo":      ["lagotto romagnolo", "lagotto"],
    "bouvier bernois":        ["bouvier bernois", "bernois"],
    "epagneul breton":        ["epagneul breton", "breton"],
    "berger picard":          ["berger picard", "picard"],
    "border collie":          ["border collie"],
    "shih tzu":               ["shih tzu"],
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
    """API Action Wikipedia EN — beaucoup plus fiable que l'API REST."""
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
    seen, dogs = set(), []
    for entry in DOGS:
        if entry[0] not in seen:
            seen.add(entry[0])
            dogs.append(entry)

    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)

    total, success, skipped, failed = len(dogs), 0, 0, []

    print(f"\n🐶  Téléchargement de {total} races de chiens")
    print(f"📁  Dossier : {output_path.resolve()}\n")
    print("─" * 65)

    for i, (filename, wiki_term, answer_fr) in enumerate(dogs, 1):
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
            print(f"{prefix} ❌  page introuvable  ← \"{wiki_term}\"")
            failed.append((clean, wiki_term))
            time.sleep(DELAY)
            continue

        if img["width"] < MIN_WIDTH:
            print(f"{prefix} ⚠️  image trop petite ({img['width']}px)")
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

    # ── Bloc server.js ──
    print("\n" + "═" * 65)
    print("📋  BLOC server.js — copie dans allQuestions :\n")

    print("    chiens: [")
    current_diff = 0
    labels = {1: "Difficulté 1 — très populaires",
               2: "Difficulté 2 — populaires",
               3: "Difficulté 3 — moins connues"}

    for idx, (filename, _, answer_fr) in enumerate(dogs):
        diff = 1 if idx < 20 else (2 if idx < 60 else 3)
        clean = slugify(filename)
        ext   = get_saved_ext(output_path, clean)

        if diff != current_diff:
            print(f"        // ── {labels[diff]} ──")
            current_diff = diff

        variants = ACCEPTED.get(answer_fr, [answer_fr])
        acc = (f", acceptedAnswers: [{', '.join(chr(34)+v+chr(34) for v in variants)}]"
               if len(variants) > 1 else "")
        print(f'        {{ image: "images/chiens/{clean}{ext}", answer: "{answer_fr}"{acc}, difficulty: {diff} }},')

    print("    ],")
    print(f"\n🎉  Terminé !  Images dans : {output_path.resolve()}\n")


if __name__ == "__main__":
    main()