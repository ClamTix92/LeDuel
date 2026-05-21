"""
download_animaux.py
-------------------
Télécharge automatiquement ~100 images d'animaux populaires
depuis l'API Wikipedia FR et les place dans un dossier
prêt à l'emploi pour le mode Images de LeDuel.

Usage :
    python download_animaux.py
"""

import requests
import os
import time
import re
from pathlib import Path

# ─────────────────────────────────────────────
#  CONFIGURATION
# ─────────────────────────────────────────────

OUTPUT_DIR = "themes/chiens"   # dossier de sortie (créé automatiquement)
DELAY      = 0.4                # délai entre chaque requête (respect de l'API)
MIN_WIDTH  = 300                # largeur minimale de l'image en pixels

# ─────────────────────────────────────────────
#  LISTE DES 100 ANIMAUX
#  Format : ("nom_fichier", "terme_wikipedia_FR")
#  Le nom_fichier = ce que le joueur doit taper
# ─────────────────────────────────────────────

ANIMALS = [
    # Grands félins
    ("lion",           "Lion"),
    ("tigre",          "Tigre"),
    ("leopard",        "Léopard"),
    ("guepard",        "Guépard"),
    ("jaguar",         "Jaguar (animal)"),
    ("puma",           "Puma (animal)"),
    ("lynx",           "Lynx boréal"),
    ("serval",         "Serval"),
    ("caracal",        "Caracal"),
    ("ocelot",         "Ocelot"),

    # Primates
    ("gorille",        "Gorille"),
    ("chimpanze",      "Chimpanzé commun"),
    ("orang_outan",    "Orang-outan"),
    ("babouin",        "Babouin"),
    ("macaque",        "Macaque rhésus"),
    ("mandrill",       "Mandrill"),
    ("gibbon",         "Gibbon"),
    ("bonobo",         "Bonobo"),

    # Herbivores africains
    ("elephant",       "Éléphant d'Afrique"),
    ("girafe",         "Girafe"),
    ("zebre",          "Zèbre des plaines"),
    ("hippopotame",    "Hippopotame"),
    ("rhinoceros",     "Rhinocéros blanc"),
    ("gnu",            "Gnou bleu"),
    ("buffle",         "Buffle d'Afrique"),
    ("okapi",          "Okapi"),
    ("warthog",        "Phacochère"),

    # Ours & canidés
    ("ours_brun",      "Ours brun"),
    ("ours_polaire",   "Ours polaire"),
    ("ours_panda",     "Grand panda"),
    ("loup",           "Loup gris"),
    ("renard",         "Renard roux"),
    ("coyote",         "Coyote"),
    ("dingo",          "Dingo"),
    ("hyene",          "Hyène tachetée"),

    # Marins & aquatiques
    ("dauphin",        "Grand dauphin"),
    ("baleine",        "Baleine bleue"),
    ("orque",          "Épaulard"),
    ("requin_blanc",   "Grand requin blanc"),
    ("morse",          "Morse (animal)"),
    ("phoque",         "Phoque commun"),
    ("otarie",         "Otarie de Californie"),
    ("manatee",        "Lamantin"),
    ("tortue_marine",  "Tortue verte"),
    ("raie",           "Raie manta"),

    # Oiseaux
    ("aigle",          "Pygargue à tête blanche"),
    ("perroquet",      "Ara macao"),
    ("flamant",        "Flamant rose"),
    ("paon",           "Paon bleu"),
    ("toucan",         "Toucan toco"),
    ("manchot",        "Manchot empereur"),
    ("hibou",          "Grand-duc d'Europe"),
    ("pelican",        "Pélican blanc"),
    ("autruche",       "Autruche d'Afrique"),
    ("perroquet_gris", "Perroquet gris"),
    ("colibri",        "Colibri gorge-rubis"),
    ("albatros",       "Albatros hurleur"),

    # Reptiles
    ("crocodile",      "Crocodile du Nil"),
    ("anaconda",       "Anaconda vert"),
    ("cobra",          "Naja indien"),
    ("komodo",         "Varan de Komodo"),
    ("tortue_aldabra", "Tortue géante des Seychelles"),
    ("cameleon",       "Caméléon panthère"),
    ("iguane",         "Iguane vert"),
    ("gecko",          "Gecko léopard"),

    # Marsupiaux & Océanie
    ("kangourou",      "Kangourou roux"),
    ("koala",          "Koala"),
    ("wombat",         "Wombat commun"),
    ("wallaby",        "Wallaby de Bennett"),
    ("ornithorynque",  "Ornithorynque"),
    ("echidne",        "Échidné à nez court"),
    ("diable_tasmanie","Diable de Tasmanie"),
    ("opossum",        "Opossum de Virginie"),

    # Asie
    ("tigre_blanc",    "Tigre blanc"),
    ("panda_roux",     "Panda roux"),
    ("tapir",          "Tapir de Malaisie"),
    ("orangutan",      "Orang-outan de Bornéo"),
    ("snow_leopard",   "Panthère des neiges"),
    ("yak",            "Yack"),
    ("binturong",      "Binturong"),

    # Insectes & Arachnides
    ("tarentule",      "Mygale"),
    ("scorpion",       "Scorpion impérial"),
    ("mante",          "Mante religieuse"),
    ("scarabee",       "Scarabée Hercule"),
    ("papillon_morpho","Morpho bleu"),
    ("abeille",        "Abeille mellifère"),

    # Rongeurs & Petits mammifères
    ("capybara",       "Capybara"),
    ("castor",         "Castor d'Europe"),
    ("raton_laveur",   "Raton laveur"),
    ("tatou",          "Tatou géant"),
    ("fourmilier",     "Tamanoir"),
    ("fennec",         "Fennec"),
    ("suricate",       "Suricate"),

    # Divers
    ("girafe_okapi",   "Okapi"),
    ("narval",         "Narval"),
    ("lamantins",      "Lamantin des Caraïbes"),
    ("beluga",         "Bélouga"),
    ("platypus",       "Ornithorynque"),
    ("axolotl",        "Axolotl"),
    ("mantaray",       "Raie manta"),
]

# ─────────────────────────────────────────────
#  FONCTIONS
# ─────────────────────────────────────────────

def slugify(name: str) -> str:
    """Nettoie un nom pour en faire un nom de fichier propre."""
    name = name.lower()
    replacements = {
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'à': 'a', 'â': 'a', 'ä': 'a',
        'ù': 'u', 'û': 'u', 'ü': 'u',
        'î': 'i', 'ï': 'i',
        'ô': 'o', 'ö': 'o',
        'ç': 'c', ' ': '_', '-': '_',
    }
    for src, dst in replacements.items():
        name = name.replace(src, dst)
    name = re.sub(r'[^a-z0-9_]', '', name)
    return name


def get_wikipedia_image(term: str) -> dict | None:
    """
    Appelle l'API Wikipedia FR pour récupérer l'image principale
    de la page correspondant au terme donné.
    Retourne un dict {'url': ..., 'width': ..., 'height': ...} ou None.
    """
    encoded = requests.utils.quote(term)
    url = f"https://fr.wikipedia.org/api/rest_v1/page/summary/{encoded}"

    try:
        r = requests.get(url, timeout=10, headers={"User-Agent": "LeDuel-ImageDownloader/1.0"})
        if r.status_code != 200:
            return None
        data = r.json()

        # On préfère "originalimage" (meilleure qualité) puis "thumbnail"
        img = data.get("originalimage") or data.get("thumbnail")
        if img:
            return {"url": img["source"], "width": img.get("width", 0)}
        return None

    except requests.RequestException as e:
        print(f"     ⚠️  Erreur réseau : {e}")
        return None


def download_image(url: str, filepath: Path) -> bool:
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "LeDuel-ImageDownloader/1.0"})
        if r.status_code != 200 or len(r.content) < 1000:
            return False

        # Détecte le vrai format depuis l'URL
        url_lower = url.lower()
        if ".svg" in url_lower:
            print("     ⏭️  format SVG ignoré (non supporté)")
            return False
        elif ".png" in url_lower:
            real_path = filepath.with_suffix(".png")
        elif ".webp" in url_lower:
            real_path = filepath.with_suffix(".webp")
        else:
            real_path = filepath  # .jpg par défaut

        real_path.write_bytes(r.content)
        return True

    except requests.RequestException:
        return False


# ─────────────────────────────────────────────
#  SCRIPT PRINCIPAL
# ─────────────────────────────────────────────

def main():
    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(parents=True, exist_ok=True)

    total   = len(ANIMALS)
    success = 0
    skipped = 0
    failed  = []

    print(f"\n🐾  Téléchargement de {total} images d'animaux")
    print(f"📁  Dossier de sortie : {output_path.resolve()}\n")
    print("─" * 55)

    for i, (filename, wiki_term) in enumerate(ANIMALS, 1):
        clean_name = slugify(filename)
        filepath   = output_path / f"{clean_name}.jpg"

        prefix = f"[{i:>3}/{total}]  {clean_name:<25}"

        # Sauter si déjà téléchargé
        if filepath.exists():
            print(f"{prefix} ⏭️  déjà présent")
            skipped += 1
            continue

        # Récupérer l'URL depuis Wikipedia
        img_info = get_wikipedia_image(wiki_term)

        if not img_info:
            print(f"{prefix} ❌  image introuvable sur Wikipedia")
            failed.append(clean_name)
            time.sleep(DELAY)
            continue

        if img_info["width"] < MIN_WIDTH:
            print(f"{prefix} ⚠️  image trop petite ({img_info['width']}px), ignorée")
            failed.append(clean_name)
            time.sleep(DELAY)
            continue

        # Télécharger
        ok = download_image(img_info["url"], filepath)
        if ok:
            size_kb = filepath.stat().st_size // 1024
            print(f"{prefix} ✅  {size_kb} Ko  ({img_info['width']}px)")
            success += 1
        else:
            print(f"{prefix} ❌  échec du téléchargement")
            failed.append(clean_name)

        time.sleep(DELAY)

    # ─── Rapport final ───
    print("\n" + "─" * 55)
    print(f"✅  Succès    : {success}")
    print(f"⏭️   Ignorés   : {skipped}")
    print(f"❌  Échoués   : {len(failed)}")
    print(f"📦  Total     : {success + skipped}/{total}")

    if failed:
        print(f"\nAnimaux à corriger manuellement :")
        for name in failed:
            print(f"   • {name}")

    print(f"\n🎉  Terminé ! Images dans : {output_path.resolve()}\n")


if __name__ == "__main__":
    main()