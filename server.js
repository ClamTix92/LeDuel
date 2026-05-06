const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
let matchmakingQueue = [];

app.use(express.static(__dirname));

// On va stocker toutes les parties en cours ici
const rooms = {};

// Fonction pour générer un code aléatoire à 4 lettres
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startGame(code) {
    const room = rooms[code];
    if (!room || !room.gameState) return;

    // 1. Envoyer l'événement d'initialisation aux deux joueurs
    io.to(code).emit('init-game', {
        question: room.gameState.questions[0],
        activePlayerId: room.gameState.activePlayerId,
        times: room.gameState.times,
        theme: room.settings.theme
    });

    // 2. Lancer le chronomètre de la room (si pas déjà lancé)
    if (room.gameState.timerInterval) clearInterval(room.gameState.timerInterval);

    room.gameState.timerInterval = setInterval(() => {
        const activeId = room.gameState.activePlayerId;

        if (activeId && room.gameState.times[activeId] > 0) {
            room.gameState.times[activeId] -= 1;

            if (room.gameState.times[activeId] <= 0) {
                clearInterval(room.gameState.timerInterval);
                const winnerId = room.players.find(id => id !== activeId);
                io.to(code).emit('game-over', { winnerId: winnerId });
            } else {
                io.to(code).emit('timer-update', room.gameState.times);
            }
        }
    }, 1000);
}

function normalize(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

let questions = []; // La liste qui sera utilisée pour la partie

const allQuestions = {
    athletes: [
        { image: "images/sportifs_français/agbegnenou.jpg", answer: "agbegnenou" },
        { image: "images/sportifs_français/manaudou.jpg", answer: "manaudou" },
        { image: "images/sportifs_français/marchand.jpg", answer: "marchand" },
        { image: "images/sportifs_français/alaphilippe.jpg", answer: "alaphilippe" },
        { image: "images/sportifs_français/biellebiarrey.jpg", answer: "bielle biarrey" },
        { image: "images/sportifs_français/dupont.jpg", answer: "dupont" },
        { image: "images/sportifs_français/ferrandprevot.jpg", answer: "ferrand prevot" },
        { image: "images/sportifs_français/fillonmaillet.jpg", answer: "fillon maillet" },
        { image: "images/sportifs_français/fils.jpg", answer: "fils" },
        { image: "images/sportifs_français/garcia.jpg", answer: "garcia" },
        { image: "images/sportifs_français/gasly.jpg", answer: "gasly" },
        { image: "images/sportifs_français/giroud.jpg", answer: "giroud" },
        { image: "images/sportifs_français/hadjar.jpg", answer: "hadjar" },
        { image: "images/sportifs_français/henry.jpg", answer: "henry" },
        { image: "images/sportifs_français/jeanmonnot.jpg", answer: "jeanmonnot" },
        { image: "images/sportifs_français/karabatic.jpg", answer: "karabatic" },
        { image: "images/sportifs_français/lacourt.jpg", answer: "lacourt" },
        { image: "images/sportifs_français/loeb.jpg", answer: "loeb" },
        { image: "images/sportifs_français/mayer.jpg", answer: "mayer" },
        { image: "images/sportifs_français/mbappe.jpg", answer: "mbappe" },
        { image: "images/sportifs_français/monflis.jpg", answer: "monflis" },
        { image: "images/sportifs_français/ocon.jpg", answer: "ocon" },
        { image: "images/sportifs_français/parker.jpg", answer: "parker" },
        { image: "images/sportifs_français/pinot.jpg", answer: "pinot" },
        { image: "images/sportifs_français/prost.jpg", answer: "prost" },
        { image: "images/sportifs_français/riner.jpg", answer: "riner" },
        { image: "images/sportifs_français/seixas.jpg", answer: "seixas" },
        { image: "images/sportifs_français/simon.jpg", answer: "simon" },
        { image: "images/sportifs_français/tsonga.jpg", answer: "tsonga" },
        { image: "images/sportifs_français/wembanyama.jpg", answer: "wembanyama" },
        { image: "images/sportifs_français/yoka.jpg", answer: "yoka" },
        { image: "images/sportifs_français/zizou.jpg", answer: "zidane" },

    ],
    stades: [
        { image: "images/stades/stade_allianz_riviera.jpg", answer: "allianz riviera" },
        { image: "images/stades/stade_de_france.jpg", answer: "stade de france" },
        { image: "images/stades/stade_de_la_beaujoire.jpg", answer: "beaujoire" },
        { image: "images/stades/stade_de_toulouse.jpg", answer: "stadium" },
        { image: "images/stades/stade_felix_bollaert.jpg", answer: "felix bollaert" },
        { image: "images/stades/stade_geoffroy_guichard.jpg", answer: "geoffroy guichard" },
        { image: "images/stades/stade_groupama_stadium.jpg", answer: "groupama stadium" },
        { image: "images/stades/stade_jean_bouin.jpg", answer: "jean bouin" },
        { image: "images/stades/stade_marcel_deflandre.jpg", answer: "marcel deflandre" },
        { image: "images/stades/stade_oceane.jpg", answer: "oceane" },
        { image: "images/stades/stade_parc_des_princes.jpg", answer: "parc des princes" },
        { image: "images/stades/stade_pierre_mauroy.jpg", answer: "pierre mauroy" },
        { image: "images/stades/stade_roazhon_park.jpg", answer: "roazhon park" },
        { image: "images/stades/stade_saint_symphorien.jpg", answer: "saint symphorien" },
        { image: "images/stades/stade_velodrome.jpg", answer: "velodrome" }
    ],
    logos_clubs_foot: [
        { image: "images/logo_club_foot/acmilan.png", answer: "milan" },
        { image: "images/logo_club_foot/asse.png", answer: "saint etienne" },
        { image: "images/logo_club_foot/barca.png", answer: "barcelone" },
        { image: "images/logo_club_foot/bayern.png", answer: "munich" },
        { image: "images/logo_club_foot/bordeaux.png", answer: "bordeaux" },
        { image: "images/logo_club_foot/intermilan.png", answer: "milan" },
        { image: "images/logo_club_foot/juve.png", answer: "turin" },
        { image: "images/logo_club_foot/lens.png", answer: "lens" },
        { image: "images/logo_club_foot/losc.png", answer: "lille" },
        { image: "images/logo_club_foot/mancity.png", answer: "manchester" },
        { image: "images/logo_club_foot/monaco.png", answer: "monaco" },
        { image: "images/logo_club_foot/ol.png", answer: "lyon" },
        { image: "images/logo_club_foot/om.png", answer: "marseille" },
        { image: "images/logo_club_foot/pfc.png", answer: "paris" },
        { image: "images/logo_club_foot/psg.png", answer: "paris" },
        { image: "images/logo_club_foot/rcs.png", answer: "strasbourg" },
        { image: "images/logo_club_foot/real.png", answer: "madrid" }
    ],

    logos_rugby: [
        { image: "images/logos_rugby/stade_toulousain.jpg", answer: "stade toulousain" },
        { image: "images/logos_rugby/clermont.jpg", answer: "clermont" }
    ],
    logos_nba: [
        { image: "images/logos_nba/bucks.png", answer: "bucks" },
        { image: "images/logos_nba/bulls.png", answer: "bulls" },
        { image: "images/logos_nba/cavaliers.png", answer: "cavaliers" },
        { image: "images/logos_nba/celtics.png", answer: "celtics" },
        { image: "images/logos_nba/clippers.png", answer: "clippers" },
        { image: "images/logos_nba/grizzlies.png", answer: "grizzlies" },
        { image: "images/logos_nba/hawks.png", answer: "hawks" },
        { image: "images/logos_nba/heat.png", answer: "heat" },
        { image: "images/logos_nba/hornets.png", answer: "hornets" },
        { image: "images/logos_nba/jazz.png", answer: "jazz" },
        { image: "images/logos_nba/kings.png", answer: "kings" },
        { image: "images/logos_nba/knicks.png", answer: "knicks" },
        { image: "images/logos_nba/lakers.png", answer: "lakers" },
        { image: "images/logos_nba/magic.png", answer: "magic" },
        { image: "images/logos_nba/mavericks.png", answer: "mavericks" },
        { image: "images/logos_nba/nets.png", answer: "nets" },
        { image: "images/logos_nba/nuggets.png", answer: "nuggets" },
        { image: "images/logos_nba/pacers.png", answer: "pacers" },
        { image: "images/logos_nba/pelicans.png", answer: "pelicans" },
        { image: "images/logos_nba/pistons.png", answer: "pistons" },
        { image: "images/logos_nba/raptors.png", answer: "raptors" },
        { image: "images/logos_nba/rockets.png", answer: "rockets" },
        { image: "images/logos_nba/sixers.png", answer: "sixers" },
        { image: "images/logos_nba/spurs.png", answer: "spurs" },
        { image: "images/logos_nba/suns.png", answer: "suns" },
        { image: "images/logos_nba/thunder.png", answer: "thunder" },
        { image: "images/logos_nba/timberwolves.png", answer: "timberwolves" },
        { image: "images/logos_nba/trail_blazers.png", answer: "trail_blazers" },
        { image: "images/logos_nba/warriors.png", answer: "warriors" },
        { image: "images/logos_nba/wizards.png", answer: "wizards" }
    ],
    logos_nfl: [
        { image: "images/logos_nfl/bears.png", answer: "bears" },
        { image: "images/logos_nfl/bengals.png", answer: "bengals" },
        { image: "images/logos_nfl/bills.png", answer: "bills" },
        { image: "images/logos_nfl/broncos.png", answer: "broncos" },
        { image: "images/logos_nfl/browns.png", answer: "browns" },
        { image: "images/logos_nfl/bucaneers.png", answer: "bucaneers" },
        { image: "images/logos_nfl/cardinals.png", answer: "cardinals" },
        { image: "images/logos_nfl/chargers.png", answer: "chargers" },
        { image: "images/logos_nfl/chiefs.png", answer: "chiefs" },
        { image: "images/logos_nfl/colts.png", answer: "colts" },
        { image: "images/logos_nfl/commanders.png", answer: "commanders" },
        { image: "images/logos_nfl/cowboys.png", answer: "cowboys" },
        { image: "images/logos_nfl/dolphins.png", answer: "dolphins" },
        { image: "images/logos_nfl/eagles.png", answer: "eagles" },
        { image: "images/logos_nfl/falcons.png", answer: "falcons" },
        { image: "images/logos_nfl/giants.png", answer: "giants" },
        { image: "images/logos_nfl/jaguars.png", answer: "jaguars" },
        { image: "images/logos_nfl/jets.png", answer: "jets" },
        { image: "images/logos_nfl/lions.png", answer: "lions" },
        { image: "images/logos_nfl/niners.png", answer: "niners" },
        { image: "images/logos_nfl/packers.png", answer: "packers" },
        { image: "images/logos_nfl/panthers.png", answer: "panthers" },
        { image: "images/logos_nfl/patriots.png", answer: "patriots" },
        { image: "images/logos_nfl/raiders.png", answer: "raiders" },
        { image: "images/logos_nfl/rams.png", answer: "rams" },
        { image: "images/logos_nfl/ravens.png", answer: "ravens" },
        { image: "images/logos_nfl/saints.png", answer: "saints" },
        { image: "images/logos_nfl/seahawks.png", answer: "seahawks" },
        { image: "images/logos_nfl/steelers.png", answer: "steelers" },
        { image: "images/logos_nfl/texans.png", answer: "texans" },
        { image: "images/logos_nfl/titans.png", answer: "titans" },
        { image: "images/logos_nfl/vikings.png", answer: "vikings" }
    ],
    voitures: [
        { image: "images/logos_cars/acura.png", answer: "acura" },
        { image: "images/logos_cars/alfa_romeo.png", answer: "alfa_romeo" },
        { image: "images/logos_cars/aston_martin.png", answer: "aston_martin" },
        { image: "images/logos_cars/audi.png", answer: "audi" },
        { image: "images/logos_cars/bentley.png", answer: "bentley" },
        { image: "images/logos_cars/bmw.png", answer: "bmw" },
        { image: "images/logos_cars/bugatti.png", answer: "bugatti" },
        { image: "images/logos_cars/buick.png", answer: "buick" },
        { image: "images/logos_cars/cadillac.png", answer: "cadillac" },
        { image: "images/logos_cars/chery.png", answer: "chery" },
        { image: "images/logos_cars/chevrolet.png", answer: "chevrolet" },
        { image: "images/logos_cars/chrysler.png", answer: "chrysler" },
        { image: "images/logos_cars/citroen.png", answer: "citroen" },
        { image: "images/logos_cars/corvette.png", answer: "corvette" },
        { image: "images/logos_cars/cupra.png", answer: "cupra" },
        { image: "images/logos_cars/daihatsu.png", answer: "daihatsu" },
        { image: "images/logos_cars/ferrari.png", answer: "ferrari" },
        { image: "images/logos_cars/fiat.png", answer: "fiat" },
        { image: "images/logos_cars/ford.png", answer: "ford" },
        { image: "images/logos_cars/holden.png", answer: "holden" },
        { image: "images/logos_cars/honda.png", answer: "honda" },
        { image: "images/logos_cars/hyundai.png", answer: "hyundai" },
        { image: "images/logos_cars/infinity.png", answer: "infinity" },
        { image: "images/logos_cars/jaguar.png", answer: "jaguar" },
        { image: "images/logos_cars/jeep.png", answer: "jeep" },
        { image: "images/logos_cars/kia.png", answer: "kia" },
        { image: "images/logos_cars/koenigsegg.png", answer: "koenigsegg" },
        { image: "images/logos_cars/lamborghini.png", answer: "lamborghini" },
        { image: "images/logos_cars/landrover.png", answer: "landrover" },
        { image: "images/logos_cars/ldv.png", answer: "ldv" },
        { image: "images/logos_cars/lexus.png", answer: "lexus" },
        { image: "images/logos_cars/lincoln.png", answer: "lincoln" },
        { image: "images/logos_cars/lotus.png", answer: "lotus" },
        { image: "images/logos_cars/mahindra.png", answer: "mahindra" },
        { image: "images/logos_cars/maserati.png", answer: "maserati" },
        { image: "images/logos_cars/mazda.png", answer: "mazda" },
        { image: "images/logos_cars/mclaren.png", answer: "mclaren" },
        { image: "images/logos_cars/mercedes.png", answer: "mercedes" },
        { image: "images/logos_cars/mg.png", answer: "mg" },
        { image: "images/logos_cars/mini.png", answer: "mini" },
        { image: "images/logos_cars/mitsubishi.png", answer: "mitsubishi" },
        { image: "images/logos_cars/mustang.png", answer: "mustang" },
        { image: "images/logos_cars/nissan.png", answer: "nissan" },
        { image: "images/logos_cars/opel.png", answer: "opel" },
        { image: "images/logos_cars/peugeot.png", answer: "peugeot" },
        { image: "images/logos_cars/polestar.png", answer: "polestar" },
        { image: "images/logos_cars/pontiac.png", answer: "pontiac" },
        { image: "images/logos_cars/porsche.png", answer: "porsche" },
        { image: "images/logos_cars/renault.png", answer: "renault" },
        { image: "images/logos_cars/rollsroyce.png", answer: "rollsroyce" },
        { image: "images/logos_cars/scion.png", answer: "scion" },
        { image: "images/logos_cars/seat.png", answer: "seat" },
        { image: "images/logos_cars/skoda.png", answer: "skoda" },
        { image: "images/logos_cars/ssangyong.png", answer: "ssangyong" },
        { image: "images/logos_cars/subaru.png", answer: "subaru" },
        { image: "images/logos_cars/suzuki.png", answer: "suzuki" },
        { image: "images/logos_cars/tesla.png", answer: "tesla" },
        { image: "images/logos_cars/toyota.png", answer: "toyota" },
        { image: "images/logos_cars/volkswagen.png", answer: "volkswagen" },
        { image: "images/logos_cars/volvo.png", answer: "volvo" }
    ],
    
    politique_fr: [
        { image: "images/politique_fr/macron.jpg", answer: "macron" }
    ],
    hommes_etat: [
        { image: "images/hommes_etat/obama.jpg", answer: "obama" }
    ],
    drapeaux: [
            { image: "images/drapeaux/ad.png", answer: "andorre" },
            { image: "images/drapeaux/ae.png", answer: "emirats arabes unis" },
            { image: "images/drapeaux/af.png", answer: "afghanistan" },
            { image: "images/drapeaux/ag.png", answer: "antigua et barbuda" },
            { image: "images/drapeaux/al.png", answer: "albanie" },
            { image: "images/drapeaux/am.png", answer: "armenie" },
            { image: "images/drapeaux/ao.png", answer: "angola" },
            { image: "images/drapeaux/ar.png", answer: "argentine" },
            { image: "images/drapeaux/at.png", answer: "autriche" },
            { image: "images/drapeaux/au.png", answer: "australie" },
            { image: "images/drapeaux/az.png", answer: "azerbaidjan" },
            { image: "images/drapeaux/ba.png", answer: "bosnie" },
            { image: "images/drapeaux/bb.png", answer: "barbade" },
            { image: "images/drapeaux/bd.png", answer: "bangladesh" },
            { image: "images/drapeaux/be.png", answer: "belgique" },
            { image: "images/drapeaux/bf.png", answer: "burkina faso" },
            { image: "images/drapeaux/bg.png", answer: "bulgarie" },
            { image: "images/drapeaux/bh.png", answer: "bahrein" },
            { image: "images/drapeaux/bi.png", answer: "burundi" },
            { image: "images/drapeaux/bj.png", answer: "benin" },
            { image: "images/drapeaux/bn.png", answer: "brunei" },
            { image: "images/drapeaux/bo.png", answer: "bolivie" },
            { image: "images/drapeaux/br.png", answer: "bresil" },
            { image: "images/drapeaux/bs.png", answer: "bahamas" },
            { image: "images/drapeaux/bt.png", answer: "bhoutan" },
            { image: "images/drapeaux/bw.png", answer: "botswana" },
            { image: "images/drapeaux/by.png", answer: "bielorussie" },
            { image: "images/drapeaux/bz.png", answer: "belize" },
            { image: "images/drapeaux/ca.png", answer: "canada" },
            { image: "images/drapeaux/cd.png", answer: "congo" },
            { image: "images/drapeaux/cf.png", answer: "centrafrique" },
            { image: "images/drapeaux/cg.png", answer: "congo" },
            { image: "images/drapeaux/ch.png", answer: "suisse" },
            { image: "images/drapeaux/ci.png", answer: "cote d'ivoire" },
            { image: "images/drapeaux/cl.png", answer: "chili" },
            { image: "images/drapeaux/cm.png", answer: "cameroun" },
            { image: "images/drapeaux/cn.png", answer: "chine" },
            { image: "images/drapeaux/co.png", answer: "colombie" },
            { image: "images/drapeaux/cr.png", answer: "costa rica" },
            { image: "images/drapeaux/cu.png", answer: "cuba" },
            { image: "images/drapeaux/cv.png", answer: "cap vert" },
            { image: "images/drapeaux/cy.png", answer: "chypre" },
            { image: "images/drapeaux/cz.png", answer: "republique tcheque" },
            { image: "images/drapeaux/de.png", answer: "allemagne" },
            { image: "images/drapeaux/dj.png", answer: "djibouti" },
            { image: "images/drapeaux/dk.png", answer: "danemark" },
            { image: "images/drapeaux/dm.png", answer: "dominique" },
            { image: "images/drapeaux/do.png", answer: "republique dominicaine" },
            { image: "images/drapeaux/dz.png", answer: "algerie" },
            { image: "images/drapeaux/ec.png", answer: "equateur" },
            { image: "images/drapeaux/ee.png", answer: "estonie" },
            { image: "images/drapeaux/eg.png", answer: "egypte" },
            { image: "images/drapeaux/er.png", answer: "erythree" },
            { image: "images/drapeaux/es.png", answer: "espagne" },
            { image: "images/drapeaux/et.png", answer: "ethiopie" },
            { image: "images/drapeaux/fi.png", answer: "finlande" },
            { image: "images/drapeaux/fj.png", answer: "fidji" },
            { image: "images/drapeaux/fm.png", answer: "micronesie" },
            { image: "images/drapeaux/fr.png", answer: "france" },
            { image: "images/drapeaux/ga.png", answer: "gabon" },
            { image: "images/drapeaux/gb.png", answer: "royaume uni" },
            { image: "images/drapeaux/gd.png", answer: "grenade" },
            { image: "images/drapeaux/ge.png", answer: "georgie" },
            { image: "images/drapeaux/gh.png", answer: "ghana" },
            { image: "images/drapeaux/gm.png", answer: "gambie" },
            { image: "images/drapeaux/gn.png", answer: "guinee" },
            { image: "images/drapeaux/gq.png", answer: "guinee equatoriale" },
            { image: "images/drapeaux/gr.png", answer: "grece" },
            { image: "images/drapeaux/gt.png", answer: "guatemala" },
            { image: "images/drapeaux/gw.png", answer: "guinee bissau" },
            { image: "images/drapeaux/gy.png", answer: "guyana" },
            { image: "images/drapeaux/hn.png", answer: "honduras" },
            { image: "images/drapeaux/hr.png", answer: "croatie" },
            { image: "images/drapeaux/ht.png", answer: "haiti" },
            { image: "images/drapeaux/hu.png", answer: "hongrie" },
            { image: "images/drapeaux/id.png", answer: "indonesie" },
            { image: "images/drapeaux/ie.png", answer: "irlande" },
            { image: "images/drapeaux/il.png", answer: "israel" },
            { image: "images/drapeaux/in.png", answer: "inde" },
            { image: "images/drapeaux/iq.png", answer: "irak" },
            { image: "images/drapeaux/ir.png", answer: "iran" },
            { image: "images/drapeaux/is.png", answer: "islande" },
            { image: "images/drapeaux/it.png", answer: "italie" },
            { image: "images/drapeaux/jm.png", answer: "jamaique" },
            { image: "images/drapeaux/jo.png", answer: "jordanie" },
            { image: "images/drapeaux/jp.png", answer: "japon" },
            { image: "images/drapeaux/ke.png", answer: "kenya" },
            { image: "images/drapeaux/kg.png", answer: "kirghizistan" },
            { image: "images/drapeaux/kh.png", answer: "cambodge" },
            { image: "images/drapeaux/km.png", answer: "comores" },
            { image: "images/drapeaux/kn.png", answer: "saint kitts et nevis" },
            { image: "images/drapeaux/kp.png", answer: "coree du nord" },
            { image: "images/drapeaux/kr.png", answer: "coree du sud" },
            { image: "images/drapeaux/kw.png", answer: "koweit" },
            { image: "images/drapeaux/kz.png", answer: "kazakhstan" },
            { image: "images/drapeaux/la.png", answer: "laos" },
            { image: "images/drapeaux/lb.png", answer: "liban" },
            { image: "images/drapeaux/lc.png", answer: "sainte lucie" },
            { image: "images/drapeaux/li.png", answer: "liechtenstein" },
            { image: "images/drapeaux/lk.png", answer: "sri lanka" },
            { image: "images/drapeaux/lr.png", answer: "liberia" },
            { image: "images/drapeaux/ls.png", answer: "lesotho" },
            { image: "images/drapeaux/lt.png", answer: "lituanie" },
            { image: "images/drapeaux/lu.png", answer: "luxembourg" },
            { image: "images/drapeaux/lv.png", answer: "lettonie" },
            { image: "images/drapeaux/ly.png", answer: "libye" },
            { image: "images/drapeaux/ma.png", answer: "maroc" },
            { image: "images/drapeaux/mc.png", answer: "monaco" },
            { image: "images/drapeaux/md.png", answer: "moldavie" },
            { image: "images/drapeaux/me.png", answer: "montenegro" },
            { image: "images/drapeaux/mg.png", answer: "madagascar" },
            { image: "images/drapeaux/mh.png", answer: "iles marshall" },
            { image: "images/drapeaux/mk.png", answer: "macedoine" },
            { image: "images/drapeaux/ml.png", answer: "mali" },
            { image: "images/drapeaux/mm.png", answer: "myanmar" },
            { image: "images/drapeaux/mn.png", answer: "mongolie" },
            { image: "images/drapeaux/mr.png", answer: "mauritanie" },
            { image: "images/drapeaux/mt.png", answer: "malte" },
            { image: "images/drapeaux/mu.png", answer: "maurice" },
            { image: "images/drapeaux/mv.png", answer: "maldives" },
            { image: "images/drapeaux/mw.png", answer: "malawi" },
            { image: "images/drapeaux/mx.png", answer: "mexique" },
            { image: "images/drapeaux/my.png", answer: "malaisie" },
            { image: "images/drapeaux/mz.png", answer: "mozambique" },
            { image: "images/drapeaux/na.png", answer: "namibie" },
            { image: "images/drapeaux/ne.png", answer: "niger" },
            { image: "images/drapeaux/ng.png", answer: "nigeria" },
            { image: "images/drapeaux/ni.png", answer: "nicaragua" },
            { image: "images/drapeaux/nl.png", answer: "pays bas" },
            { image: "images/drapeaux/no.png", answer: "norvege" },
            { image: "images/drapeaux/np.png", answer: "nepal" },
            { image: "images/drapeaux/nz.png", answer: "nouvelle zelande" },
            { image: "images/drapeaux/om.png", answer: "oman" },
            { image: "images/drapeaux/pa.png", answer: "panama" },
            { image: "images/drapeaux/pe.png", answer: "perou" },
            { image: "images/drapeaux/pg.png", answer: "papouasie" },
            { image: "images/drapeaux/ph.png", answer: "philippines" },
            { image: "images/drapeaux/pk.png", answer: "pakistan" },
            { image: "images/drapeaux/pl.png", answer: "pologne" },
            { image: "images/drapeaux/pt.png", answer: "portugal" },
            { image: "images/drapeaux/pw.png", answer: "palaos" },
            { image: "images/drapeaux/py.png", answer: "paraguay" },
            { image: "images/drapeaux/qa.png", answer: "qatar" },
            { image: "images/drapeaux/ro.png", answer: "roumanie" },
            { image: "images/drapeaux/rs.png", answer: "serbie" },
            { image: "images/drapeaux/ru.png", answer: "russie" },
            { image: "images/drapeaux/rw.png", answer: "rwanda" },
            { image: "images/drapeaux/sa.png", answer: "arabie saoudite" },
            { image: "images/drapeaux/sc.png", answer: "seychelles" },
            { image: "images/drapeaux/sd.png", answer: "soudan" },
            { image: "images/drapeaux/se.png", answer: "suede" },
            { image: "images/drapeaux/sg.png", answer: "singapour" },
            { image: "images/drapeaux/si.png", answer: "slovenie" },
            { image: "images/drapeaux/sk.png", answer: "slovaquie" },
            { image: "images/drapeaux/sl.png", answer: "sierra leone" },
            { image: "images/drapeaux/sm.png", answer: "saint marin" },
            { image: "images/drapeaux/sn.png", answer: "senegal" },
            { image: "images/drapeaux/so.png", answer: "somalie" },
            { image: "images/drapeaux/sr.png", answer: "suriname" },
            { image: "images/drapeaux/ss.png", answer: "soudan du sud" },
            { image: "images/drapeaux/st.png", answer: "sao tome" },
            { image: "images/drapeaux/sv.png", answer: "salvador" },
            { image: "images/drapeaux/sy.png", answer: "syrie" },
            { image: "images/drapeaux/sz.png", answer: "eswatini" },
            { image: "images/drapeaux/td.png", answer: "tchad" },
            { image: "images/drapeaux/tg.png", answer: "togo" },
            { image: "images/drapeaux/th.png", answer: "thailande" },
            { image: "images/drapeaux/tj.png", answer: "tadjikistan" },
            { image: "images/drapeaux/tl.png", answer: "timor oriental" },
            { image: "images/drapeaux/tm.png", answer: "turkmenistan" },
            { image: "images/drapeaux/tn.png", answer: "tunisie" },
            { image: "images/drapeaux/to.png", answer: "tonga" },
            { image: "images/drapeaux/tr.png", answer: "turquie" },
            { image: "images/drapeaux/tt.png", answer: "trinite et tobago" },
            { image: "images/drapeaux/tv.png", answer: "tuvalu" },
            { image: "images/drapeaux/tw.png", answer: "taiwan" },
            { image: "images/drapeaux/tz.png", answer: "tanzanie" },
            { image: "images/drapeaux/ua.png", answer: "ukraine" },
            { image: "images/drapeaux/ug.png", answer: "ouganda" },
            { image: "images/drapeaux/us.png", answer: "etats unis" },
            { image: "images/drapeaux/uy.png", answer: "uruguay" },
            { image: "images/drapeaux/uz.png", answer: "ouzbekistan" },
            { image: "images/drapeaux/vc.png", answer: "saint vincent" },
            { image: "images/drapeaux/ve.png", answer: "venezuela" },
            { image: "images/drapeaux/vn.png", answer: "vietnam" },
            { image: "images/drapeaux/vu.png", answer: "vanuatu" },
            { image: "images/drapeaux/ws.png", answer: "samoa" },
            { image: "images/drapeaux/ye.png", answer: "yemen" },
            { image: "images/drapeaux/za.png", answer: "afrique du sud" },
            { image: "images/drapeaux/zm.png", answer: "zambie" },
            { image: "images/drapeaux/zw.png", answer: "zimbabwe" }
        ]
};


// On mélange les questions dès que le serveur s'allume
shuffle(questions);

// let currentTheme = null;
let currentQuestionIndex = 0;
// let players = {}; // Pour stocker les infos des joueurs
// let activePlayerId = null;
let gameInterval = null;

io.on('connection', (socket) => {
    console.log(`Joueur connecté : ${socket.id}`);

    // --- MATCHMAKING ---
    socket.on('join-matchmaking', () => {
        // On simule un pseudo et un elo (en attendant ton système de compte)
        socket.nickname = "Joueur #" + socket.id.substring(0, 4);
        socket.elo = 1000;

        matchmakingQueue.push(socket);
        console.log(`File d'attente : ${matchmakingQueue.length} joueurs`);

        if (matchmakingQueue.length >= 2) {
            // On sort les deux premiers
            const p1 = matchmakingQueue.shift();
            const p2 = matchmakingQueue.shift();

            const code = "MATCH-" + generateRoomCode();
            p1.join(code);
            p2.join(code);

            // Choix aléatoire du thème et de celui qui commence
            const themes = Object.keys(allQuestions);
            const selectedTheme = themes[Math.floor(Math.random() * themes.length)];
            const players = [p1.id, p2.id].sort(() => Math.random() - 0.5);

            rooms[code] = {
                players: players,
                settings: { theme: selectedTheme, timer: 45 },
                gameState: {
                    questions: shuffle([...allQuestions[selectedTheme]]),
                    currentQuestionIndex: 0,
                    activePlayerId: players[0],
                    times: { [players[0]]: 45, [players[1]]: 45 }
                }
            };

            // On envoie les infos aux deux joueurs
            io.to(code).emit('match-found', {
                p1Name: p1.nickname,
                p2Name: p2.nickname,
                theme: selectedTheme,
                activePlayerId: players[0],
                roomCode: code
            });
        }
    });

    // --- 1. CRÉER UNE PARTIE ---
    socket.on('create-room', () => {
        const code = generateRoomCode();
        socket.join(code);

        rooms[code] = {
            host: socket.id,
            players: [socket.id],
            settings: { theme: 'athletes', timer: 45 },
            gameState: {} // On stockera les infos de la partie ici
        };

        socket.emit('room-created', code);
    });

    // --- 2. REJOINDRE UNE PARTIE ---
    socket.on('join-room', (code) => {
        code = code.toUpperCase();

        if (rooms[code]) {
            if (rooms[code].players.length < 2) {
                socket.join(code);
                rooms[code].players.push(socket.id);

                socket.emit('room-joined', code);
                io.to(code).emit('room-update', rooms[code].players.length);
            } else {
                socket.emit('error-message', "Cette partie est déjà pleine !");
            }
        } else {
            socket.emit('error-message', "Code invalide ou partie introuvable.");
        }
    });

    // --- 3. LANCER LA PARTIE DEPUIS LE LOBBY ---
    /* socket.on('start-custom-game', (data) => {
        const room = rooms[data.code];

        // On s'assure que c'est bien l'hôte qui lance la partie
        if (room && room.host === socket.id) {
            room.settings.theme = data.theme;
            room.settings.timer = data.timer;

            // On prépare le jeu spécifique à cette Room
            room.gameState = {
                questions: shuffle([...allQuestions[data.theme]]),
                currentQuestionIndex: 0,
                activePlayerId: room.players[0], // L'hôte commence
                times: {}
            };

            // On attribue le temps choisi aux deux joueurs
            room.players.forEach(pId => {
                room.gameState.times[pId] = data.timer;
            });

            // On prévient les deux joueurs que la partie démarre
            io.to(data.code).emit('init-game', {
                theme: data.theme,
                question: room.gameState.questions[0],
                times: room.gameState.times,
                activePlayerId: room.gameState.activePlayerId
            });

            // --- LANCEMENT DU CHRONO DE LA ROOM ---
            room.gameState.timerInterval = setInterval(() => {
                const activeId = room.gameState.activePlayerId;

                if (activeId && room.gameState.times[activeId] > 0) {
                    room.gameState.times[activeId] -= 1;

                    // Si le temps est écoulé
                    if (room.gameState.times[activeId] <= 0) {
                        clearInterval(room.gameState.timerInterval);
                        const winnerId = room.players.find(id => id !== activeId);
                        io.to(data.code).emit('game-over', { winnerId: winnerId });
                    } else {
                        // Mise à jour de l'affichage
                        io.to(data.code).emit('timer-update', room.gameState.times);
                    }
                }
            }, 1000);

        }
    });*/

    // --- 3. LANCER LA PARTIE (Lobby Privé) ---
    socket.on('start-game', (data) => {
        const room = rooms[data.code];
        if (room) {
            // On garde la configuration de la room (Thème et Temps)
            room.settings.theme = data.theme;
            room.settings.timer = parseInt(data.timer);

            const selectedTheme = allQuestions[data.theme] ? data.theme : 'athletes';
            const roomQuestions = shuffle([...allQuestions[selectedTheme]]);

            room.gameState = {
                questions: roomQuestions,
                currentQuestionIndex: 0,
                activePlayerId: room.players[0],
                times: {
                    [room.players[0]]: room.settings.timer,
                    [room.players[1]]: room.settings.timer
                }
            };

            // AU LIEU DE RÉÉCRIRE LE TIMER ICI, ON APPELLE LA FONCTION COMMUNE :
            startGame(data.code);
        }
    });

    // Petite fonction pour trouver la room d'un joueur
    function getPlayerRoom(socketId) {
        for (const code in rooms) {
            if (rooms[code].players.includes(socketId)) return code;
        }
        return null;
    }

    // --- 3.1 RÉPONDRE À UNE QUESTION ---
    socket.on('submit-answer', (guess) => {
        const code = getPlayerRoom(socket.id);
        if (!code) return;

        const room = rooms[code];
        const state = room.gameState;

        // On vérifie que c'est bien son tour
        if (state.activePlayerId !== socket.id) return;
        if (state.activePlayerId !== socket.id || state.isPassing) return;

        const correct = state.questions[state.currentQuestionIndex].answer;

        if (normalize(guess) === normalize(correct)) {
            state.currentQuestionIndex++;

            // Changement de joueur
            state.activePlayerId = room.players.find(id => id !== socket.id);

            io.to(code).emit('next-round', {
                nextQuestion: state.questions[state.currentQuestionIndex],
                activePlayerId: state.activePlayerId,
                times: state.times
            });
        }
    });

    // --- 3.2 PASSER LA QUESTION ---
    socket.on('pass-question', () => {
        const code = getPlayerRoom(socket.id);
        if (!code) return;

        const room = rooms[code];
        const state = room.gameState;

        // Sécurité : si ce n'est pas son tour ou s'il est déjà en train de passer, on bloque
        if (state.activePlayerId !== socket.id) return;
        if (state.isPassing) return;

        // 1. On verrouille les réponses côté serveur
        state.isPassing = true;

        // 2. On attend 3 secondes AVANT de changer la question
        setTimeout(() => {
            // On vérifie que la partie n'est pas terminée (temps écoulé) pendant l'attente
            if (state.times && state.times[socket.id] > 0) {
                state.currentQuestionIndex++;
                state.isPassing = false; // On déverrouille

                // 3. On envoie enfin la nouvelle image !
                io.to(code).emit('next-round', {
                    nextQuestion: state.questions[state.currentQuestionIndex],
                    activePlayerId: state.activePlayerId,
                    times: state.times
                });
            }
        }, 3000);
    });

    // --- 3.3 DÉMARRAGE APRÈS MATCHMAKING ---
    socket.on('matchmaking-ready', (data) => {
        const room = rooms[data.code];

        // Sécurité : Seul le joueur qui doit commencer peut déclencher le départ 
        // pour éviter que l'événement soit reçu deux fois.
        if (room && room.gameState.activePlayerId === socket.id) {
            console.log(`Le match ${data.code} commence !`);
            startGame(data.code);
        }
    });

    // --- 4. DÉCONNEXION ---
    socket.on('disconnect', () => {
        for (const code in rooms) {
            const room = rooms[code];
            const index = room.players.indexOf(socket.id);

            if (index !== -1) {
                room.players.splice(index, 1);
                io.to(code).emit('room-update', room.players.length);

                if (room.players.length === 0) {
                    delete rooms[code];
                }
                break;
            }
            if (room.gameState && room.gameState.timerInterval)
                clearInterval(room.gameState.timerInterval);
        }
        console.log(`Joueur déconnecté : ${socket.id}`);
    });
});

// On récupère le port donné par Render, ou 3000 par défaut
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Le serveur tourne sur le port ${PORT}`);
});