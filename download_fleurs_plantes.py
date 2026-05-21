"""
download_fleurs_plantes.py  v2
-------------------------------
Source : Wikimedia Commons (recherche par mots-clés).

Usage :
    pip install requests
    python download_fleurs_plantes.py
"""

import requests, time, re
from pathlib import Path

OUTPUT_DIR = "images/fleurs_plantes"
DELAY      = 0.5
MIN_WIDTH  = 300
HEADERS    = {"User-Agent": "LeDuel-FlowerDownloader/2.0 (contact@leduel.fr)"}

FLOWERS = [
    # ── Difficulté 1 ──
    ("rose",             ["rose flower red pink photo"],                   "rose"),
    ("tulipe",           ["tulip flower colorful photo"],                  "tulipe"),
    ("tournesol",        ["sunflower field photo"],                        "tournesol"),
    ("marguerite",       ["daisy flower white photo"],                     "marguerite"),
    ("coquelicot",       ["poppy flower red photo"],                       "coquelicot"),
    ("lys",              ["lily flower white photo"],                      "lys"),
    ("lilas",            ["lilac flower purple photo"],                    "lilas"),
    ("orchidee",         ["orchid flower exotic photo"],                   "orchidee"),
    ("pivoine",          ["peony flower pink photo"],                      "pivoine"),
    ("camelia",          ["camellia flower photo"],                        "camelia"),
    ("chrysantheme",     ["chrysanthemum flower photo"],                   "chrysantheme"),
    ("geranium",         ["geranium flower photo red"],                    "geranium"),
    ("pensee",           ["pansy flower colorful photo"],                  "pensee"),
    ("muguet",           ["lily valley flower white photo"],               "muguet"),
    ("jacinthe",         ["hyacinth flower blue purple photo"],            "jacinthe"),
    ("iris",             ["iris flower purple blue photo"],                "iris"),
    ("jonquille",        ["daffodil yellow flower photo"],                 "jonquille"),
    ("narcisse",         ["narcissus white flower photo"],                 "narcisse"),
    ("primevere",        ["primrose flower yellow photo"],                 "primevere"),
    ("capucine",         ["nasturtium flower orange photo"],               "capucine"),

    # ── Difficulté 2 ──
    ("oeillet",          ["carnation flower photo"],                       "oeillet"),
    ("zinnia",           ["zinnia flower colorful photo"],                 "zinnia"),
    ("dahlia",           ["dahlia flower photo"],                          "dahlia"),
    ("gladieul",         ["gladiolus flower spike photo"],                 "glaieul"),
    ("begonia",          ["begonia flower photo"],                         "begonia"),
    ("hortensia",        ["hydrangea flower blue pink photo"],             "hortensia"),
    ("hibiscus",         ["hibiscus flower red photo"],                    "hibiscus"),
    ("azalee",           ["azalea flower pink photo"],                     "azalee"),
    ("magnolia",         ["magnolia tree flower photo"],                   "magnolia"),
    ("jasmin",           ["jasmine flower white photo"],                   "jasmin"),
    ("bougainvillee",    ["bougainvillea flower pink purple photo"],       "bougainvillee"),
    ("laurier_rose",     ["oleander flower pink photo"],                   "laurier rose"),
    ("cosmos",           ["cosmos flower pink photo"],                     "cosmos"),
    ("impatiente",       ["impatiens flower photo"],                       "impatiente"),
    ("anemone",          ["anemone flower photo"],                         "anemone"),
    ("lavande",          ["lavender flower purple field"],                 "lavande"),
    ("glycine",          ["wisteria flower purple hanging"],               "glycine"),
    ("campanule",        ["bellflower campanula flower photo"],            "campanule"),
    ("coreopsis",        ["coreopsis flower yellow photo"],                "coreopsis"),
    ("souci",            ["calendula marigold flower orange photo"],       "souci"),

    # ── Difficulté 3 ──
    ("acacia",           ["acacia flower yellow photo"],                   "acacia"),
    ("agapanthe",        ["agapanthus flower blue photo"],                 "agapanthe"),
    ("amaryllis",        ["amaryllis flower red photo"],                   "amaryllis"),
    ("ancolie",          ["columbine aquilegia flower photo"],             "ancolie"),
    ("anthurium",        ["anthurium flower red photo"],                   "anthurium"),
    ("aster",            ["aster flower purple photo"],                    "aster"),
    ("astilbe",          ["astilbe flower feathery photo"],                "astilbe"),
    ("baptisia",         ["baptisia flower blue photo"],                   "baptisia"),
    ("bleuet",           ["cornflower blue flower photo"],                 "bleuet"),
    ("belladone",        ["belladonna flower purple photo"],               "belladone"),
    ("bergenia",         ["bergenia flower pink photo"],                   "bergenia"),
    ("brunelle",         ["selfheal flower purple photo"],                 "brunelle"),
    ("bugle",            ["bugle ajuga flower blue photo"],                "bugle"),
    ("caladium",         ["caladium leaf colorful photo"],                 "caladium"),
    ("calandrinia",      ["calandrinia flower pink photo"],                "calandrinia"),
    ("calciolaire",      ["calceolaria flower yellow photo"],              "calciolaire"),
    ("camomille",        ["chamomile flower white photo"],                 "camomille"),
    ("digitale",         ["foxglove digitalis flower pink photo"],         "digitale"),
    ("echinacea",        ["echinacea flower purple photo"],                "echinacea"),
    ("erigeron",         ["erigeron fleabane flower photo"],               "erigeron"),
    ("forsythia",        ["forsythia flower yellow spring photo"],         "forsythia"),
    ("francoa",          ["francoa flower white photo"],                   "francoa"),
    ("freesia",          ["freesia flower colorful photo"],                "freesia"),
    ("fucsia",           ["fuchsia flower hanging photo"],                 "fucsia"),
    ("gaillarde",        ["gaillardia flower red yellow photo"],           "gaillarde"),
    ("gaura",            ["gaura flower white pink photo"],                "gaura"),
    ("gentiane",         ["gentian flower blue photo"],                    "gentiane"),
    ("geum",             ["geum flower orange photo"],                     "geum"),
    ("hellebore",        ["hellebore flower photo"],                       "hellebore"),
    ("hemerocallis",     ["daylily hemerocallis flower photo"],            "hemerocallis"),
    ("hosta",            ["hosta leaf plant photo"],                       "hosta"),
    ("impatiens",        ["impatiens flower pink photo"],                  "impatiens"),
    ("kniphofia",        ["kniphofia red hot poker flower photo"],         "kniphofia"),
    ("lamium",           ["lamium flower purple photo"],                   "lamium"),
    ("linaire",          ["toadflax linaria flower photo"],                "linaire"),
    ("linum",            ["flax linum flower blue photo"],                 "linum"),
    ("lupin",            ["lupin flower blue purple photo"],               "lupin"),
    ("lychnis",          ["lychnis campion flower photo"],                 "lychnis"),
    ("lysimaque",        ["loosestrife lysimachia flower photo"],          "lysimaque"),
    ("monarde",          ["monarda flower red photo"],                     "monarde"),
    ("myosotis",         ["forget me not flower blue photo"],              "myosotis"),
    ("nigelle",          ["nigella love mist flower photo"],               "nigelle"),
    ("oenothera",        ["evening primrose flower yellow photo"],         "oenothera"),
    ("pavot",            ["poppy pavot flower photo"],                     "pavot"),
    ("pentstemon",       ["penstemon flower photo"],                       "pentstemon"),
    ("persicaire",       ["persicaria flower pink photo"],                 "persicaire"),
    ("phlox",            ["phlox flower colorful photo"],                  "phlox"),
    ("physalis",         ["physalis lantern plant photo"],                 "physalis"),
    ("potentille",       ["potentilla flower yellow photo"],               "potentille"),
]

ACCEPTED = {
    "rose":           ["rose"],
    "tulipe":         ["tulipe", "tulip"],
    "tournesol":      ["tournesol", "sunflower"],
    "orchidee":       ["orchidee", "orchid"],
    "glaieul":        ["glaieul", "gladieul", "gladiolus"],
    "jacinthe":       ["jacinthe", "hyacinth"],
    "jonquille":      ["jonquille", "daffodil"],
    "hortensia":      ["hortensia", "hydrangea"],
    "laurier rose":   ["laurier rose", "oleander"],
    "bougainvillee":  ["bougainvillee", "bougainvillea"],
    "bleuet":         ["bleuet", "cornflower"],
    "camomille":      ["camomille", "chamomile"],
    "souci":          ["souci", "calendula"],
    "lavande":        ["lavande", "lavender"],
    "glycine":        ["glycine", "wisteria"],
    "campanule":      ["campanule", "bellflower"],
    "myosotis":       ["myosotis", "forget me not"],
    "lupin":          ["lupin", "lupinus"],
    "digitale":       ["digitale", "foxglove"],
    "echinacea":      ["echinacea", "echinacee"],
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
    seen, flowers = set(), []
    for entry in FLOWERS:
        if entry[0] not in seen:
            seen.add(entry[0])
            flowers.append(entry)

    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)
    total, success, skipped, failed = len(flowers), 0, 0, []

    print(f"\n🌸  Téléchargement de {total} fleurs et plantes  (Wikimedia Commons)")
    print(f"📁  Dossier : {output_path.resolve()}\n")
    print("─" * 68)

    for i, (filename, queries, answer_fr) in enumerate(flowers, 1):
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
    print("    fleurs_plantes: [")
    cur = 0
    labels = {1:"Difficulté 1",2:"Difficulté 2",3:"Difficulté 3"}
    for idx,(filename,_,answer_fr) in enumerate(flowers):
        d = 1 if idx<20 else (2 if idx<60 else 3)
        clean = slugify(filename)
        ext = get_saved_ext(output_path, clean)
        if d != cur:
            print(f"        // ── {labels[d]} ──"); cur = d
        v = ACCEPTED.get(answer_fr,[answer_fr])
        acc = (f", acceptedAnswers: [{', '.join(chr(34)+x+chr(34) for x in v)}]" if len(v)>1 else "")
        print(f'        {{ image: "images/fleurs_plantes/{clean}{ext}", answer: "{answer_fr}"{acc}, difficulty: {d} }},')
    print("    ],")
    print(f"\n🎉  Terminé ! {success} images dans : {output_path.resolve()}\n")

if __name__ == "__main__":
    main()