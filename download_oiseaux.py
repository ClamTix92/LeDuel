"""
download_oiseaux.py
-------------------
Télécharge les images des 100 espèces d'oiseaux les plus populaires
depuis Wikimedia Commons (recherche par mots-clés).

Usage :
    pip install requests
    python download_oiseaux.py
"""

import requests, time, re
from pathlib import Path

OUTPUT_DIR = "images/oiseaux"
DELAY      = 0.5
MIN_WIDTH  = 300
HEADERS    = {"User-Agent": "LeDuel-BirdDownloader/1.0 (contact@leduel.fr)"}

BIRDS = [
    # ── Difficulté 1 — très populaires ──
    ("aigle",             ["eagle bird photo"],                             "aigle"),
    ("hibou",             ["owl bird photo"],                               "hibou"),
    ("perroquet",         ["parrot bird photo colorful"],                   "perroquet"),
    ("pigeon",            ["pigeon bird city photo"],                       "pigeon"),
    ("corbeau",           ["raven crow bird black photo"],                  "corbeau"),
    ("moineau",           ["sparrow bird small photo"],                     "moineau"),
    ("colombe",           ["dove bird white photo"],                        "colombe"),
    ("poule",             ["chicken hen bird photo"],                       "poule"),
    ("canard",            ["duck bird water photo"],                        "canard"),
    ("oie",               ["goose bird water photo"],                       "oie"),
    ("cygne",             ["swan bird white water photo"],                  "cygne"),
    ("autruche",          ["ostrich bird large photo"],                     "autruche"),
    ("pingouin",          ["penguin bird black white photo"],               "pingouin"),
    ("paon",              ["peacock bird colorful tail photo"],             "paon"),
    ("flamant",           ["flamingo bird pink photo"],                     "flamant"),
    ("manchot",           ["penguin emperor bird photo"],                   "manchot"),
    ("toucan",            ["toucan bird tropical photo"],                   "toucan"),
    ("hirondelle",        ["swallow bird flying photo"],                    "hirondelle"),
    ("mésange",           ["tit bird small photo"],                         "mesange"),
    ("corneille",         ["crow bird large photo"],                        "corneille"),

    # ── Difficulté 2 — bien connus ──
    ("faucon",            ["falcon hawk bird prey photo"],                  "faucon"),
    ("buse",              ["buzzard bird of prey photo"],                   "buse"),
    ("merle",             ["blackbird bird singing photo"],                 "merle"),
    ("geai",              ["jay bird blue photo"],                          "geai"),
    ("merlette",          ["thrush bird small photo"],                      "merlette"),
    ("rouge_gorge",       ["robin redbreast bird photo"],                   "rouge gorge"),
    ("chardonneret",      ["goldfinch bird colorful photo"],                "chardonneret"),
    ("pie",               ["magpie bird black white photo"],                "pie"),
    ("héron",             ["heron bird water tall photo"],                  "heron"),
    ("cigogne",           ["stork bird large photo"],                       "cigogne"),
    ("grebe",             ["grebe waterfowl bird photo"],                   "grebe"),
    ("cormoran",          ["cormorant seabird photo"],                      "cormoran"),
    ("pélican",           ["pelican bird large photo"],                     "pelican"),
    ("mouette",           ["seagull gull bird photo"],                      "mouette"),
    ("goeland",           ["gull seabird large photo"],                     "goeland"),
    ("alcyon",            ["kingfisher bird colorful photo"],               "alcyon"),
    ("chouette",          ["owl nocturnal bird photo"],                     "chouette"),
    ("chevêche",          ["little owl bird photo"],                        "chevêche"),
    ("bécasse",           ["woodcock bird photo"],                          "becasse"),
    ("grive",             ["thrush song bird photo"],                       "grive"),
    ("étourneau",         ["starling bird murmurations photo"],             "etourneau"),
    ("faisan",            ["pheasant bird colorful photo"],                 "faisan"),
    ("perdrix",           ["partridge bird game photo"],                    "perdrix"),
    ("alouette",          ["lark songbird photo"],                          "alouette"),
    ("coucou",            ["cuckoo bird photo"],                            "coucou"),
    ("pic",               ["woodpecker bird tree photo"],                   "pic"),
    ("roitelet",          ["wren tiny bird photo"],                         "roitelet"),
    ("bergeronnette",     ["wagtail bird water photo"],                     "bergeronnette"),
    ("loriot",            ["golden oriole bird yellow photo"],              "loriot"),

    # ── Difficulté 3 — moins connus ──
    ("gerfaut",           ["gyrfalcon bird of prey photo"],                 "gerfaut"),
    ("milan",             ["kite bird of prey photo"],                      "milan"),
    ("autour",            ["goshawk bird of prey photo"],                   "autour"),
    ("epervier",          ["sparrowhawk bird small photo"],                 "epervier"),
    ("chevalier",         ["sandpiper wader bird photo"],                   "chevalier"),
    ("courlis",           ["curlew wader bird photo"],                      "courlis"),
    ("barge",             ["godwit wader bird photo"],                      "barge"),
    ("huppe",             ["hoopoe bird crested photo"],                    "huppe"),
    ("trogon",            ["trogon colorful bird tropical photo"],          "trogon"),
    ("guepier",           ["bee-eater bird colorful photo"],                "guepier"),
    ("engoulevent",       ["nightjar bird nocturnal photo"],                "engoulevent"),
    ("martinet",          ["swift bird fast flying photo"],                 "martinet"),
    ("colibri",           ["hummingbird tiny tropical photo"],              "colibri"),
    ("carpophage",        ["fruit dove bird tropical photo"],               "carpophage"),
    ("tourterelle",       ["turtle dove bird cooing photo"],                "tourterelle"),
    ("pigeon_ramier",     ["wood pigeon bird photo"],                       "pigeon ramier"),
    ("francolin",         ["francolin bird game photo"],                    "francolin"),
    ("tetras",            ["grouse bird game photo"],                       "tetras"),
    ("gelinotte",         ["hazelhen bird game photo"],                     "gelinotte"),
    ("caille",            ["quail bird small game photo"],                  "caille"),
    ("courvite",          ["courser ground bird photo"],                    "courvite"),
    ("plovier",           ["plover wader bird photo"],                      "plovier"),
    ("becasseau",         ["stint sandpiper small photo"],                  "becasseau"),
    ("mouche",            ["fly-catcher small bird photo"],                 "mouche"),
    ("rossignol",         ["nightingale songbird photo"],                   "rossignol"),
    ("troglodyte",        ["wren brown tiny bird photo"],                   "troglodyte"),
    ("accenteur",         ["dunnock sparrow bird photo"],                   "accenteur"),
    ("rougequeue",        ["redstart bird orange photo"],                   "rougequeue"),
    ("gorgebleu",         ["bluethroat bird singing photo"],                "gorgebleu"),
    ("fauvette",          ["warbler songbird photo"],                       "fauvette"),
    ("pouillot",          ["willow warbler small bird photo"],              "pouillot"),
    ("rosélis",           ["rosefinch bird pink photo"],                    "roselis"),
    ("verdier",           ["greenfinch bird green photo"],                  "verdier"),
    ("tarin",             ["siskin small bird photo"],                      "tarin"),
    ("linotte",           ["linnet songbird photo"],                        "linotte"),
    ("bruant",            ["bunting songbird photo"],                       "bruant"),
    ("pinson",            ["chaffinch songbird photo"],                     "pinson"),
    ("grosbec",           ["hawfinch bird large bill photo"],               "grosbec"),
    ("migrateur",         ["migratory bird flight photo"],                  "migrateur"),
    ("rapace",            ["raptor bird of prey photo"],                    "rapace"),
    ("echassier",         ["wader long-legged bird photo"],                 "echassier"),
    ("palmipede",         ["waterfowl swimming bird photo"],                "palmipede"),
    ("gallinde",          ["coot waterfowl bird photo"],                    "foulque"),
    ("poule_eau",         ["moorhen waterfowl bird photo"],                 "poule d'eau"),
    ("fulmar",            ["fulmar seabird photo"],                         "fulmar"),
    ("puffin",            ["puffin seabird photo"],                         "puffin"),
    ("petrel",            ["petrel seabird small photo"],                   "petrel"),
    ("goelan_argenté",    ["herring gull large seabird photo"],             "goeland argente"),
    ("fou_de_bassan",     ["gannet diving seabird photo"],                  "fou de bassan"),
]

ACCEPTED = {
    "aigle":            ["aigle", "eagle"],
    "hibou":            ["hibou", "owl"],
    "perroquet":        ["perroquet", "parrot"],
    "rouge gorge":      ["rouge gorge", "robin"],
    "heron":            ["heron", "héron"],
    "chouette":         ["chouette", "owlet"],
    "chevêche":         ["chevêche", "little owl"],
    "becasse":          ["becasse", "bécasse", "woodcock"],
    "etourneau":        ["etourneau", "étourneau", "starling"],
    "pigeon ramier":    ["pigeon ramier", "wood pigeon"],
    "roselis":          ["roselis", "rosefinch"],
    "foulque":          ["foulque", "coot"],
    "poule d'eau":      ["poule d'eau", "moorhen"],
    "goeland argente":  ["goeland argente", "herring gull"],
    "fou de bassan":    ["fou de bassan", "gannet"],
    "mesange":          ["mesange", "mésange", "tit"],
    "rouge gorge":      ["rouge gorge", "robin redbreast"],
    "pic":              ["pic", "woodpecker"],
    "martin pecheur":   ["alcyon", "martin pecheur", "kingfisher"],
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
    seen, birds = set(), []
    for entry in BIRDS:
        if entry[0] not in seen:
            seen.add(entry[0])
            birds.append(entry)

    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)
    total, success, skipped, failed = len(birds), 0, 0, []

    print(f"\n🦅  Téléchargement de {total} espèces d'oiseaux  (Wikimedia Commons)")
    print(f"📁  Dossier : {output_path.resolve()}\n")
    print("─" * 68)

    for i, (filename, queries, answer_fr) in enumerate(birds, 1):
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
    print("    oiseaux: [")
    for idx, (filename, _, answer_fr) in enumerate(birds):
        clean = slugify(filename)
        ext = get_saved_ext(output_path, clean)
        v = ACCEPTED.get(answer_fr, [answer_fr])
        acc = (f", acceptedAnswers: [{', '.join(chr(34)+x+chr(34) for x in v)}]" if len(v)>1 else "")
        print(f'        {{ image: "images/oiseaux/{clean}{ext}", answer: "{answer_fr}"{acc} }},')
    print("    ],")
    print(f"\n🎉  Terminé ! {success} images dans : {output_path.resolve()}\n")

if __name__ == "__main__":
    main()