const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

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
    logos: [
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
    io.emit('update-player-count', Object.keys(players).length);
    // On initialise le joueur avec 45 secondes
    players[socket.id] = { time: 45, score: 0 };
    console.log(`Joueur connecté : ${socket.id}`);
    console.log("Nouveau joueur : " + socket.id); // Modifie la connexion pour gérer le choix du thème

    // --- CRÉER UNE PARTIE ---
    socket.on('create-room', () => {
        const code = generateRoomCode();
        socket.join(code); // Le joueur rejoint "sa" room
        
        rooms[code] = {
            host: socket.id,
            players: [socket.id],
            settings: { theme: 'athletes', timer: 45 }
        };

        socket.emit('room-created', code);
    });

    // --- REJOINDRE UNE PARTIE ---
    socket.on('join-room', (code) => {
        code = code.toUpperCase();
        
        if (rooms[code]) {
            if (rooms[code].players.length < 2) {
                socket.join(code);
                rooms[code].players.push(socket.id);
                
                // On prévient l'invité qu'il est rentré
                socket.emit('room-joined', code);
                
                // On prévient tout le monde dans la room qu'ils sont 2
                io.to(code).emit('room-update', rooms[code].players.length);
            } else {
                socket.emit('error-message', "Cette partie est déjà pleine !");
            }
        } else {
            socket.emit('error-message', "Code invalide ou partie introuvable.");
        }
    });
    
    socket.on('select-theme', (themeChoice) => {
    const playerIds = Object.keys(players);

    // VÉRIFICATION : Y a-t-il au moins 2 joueurs ?
    if (playerIds.length < 2) {
        // On envoie un message d'alerte uniquement à celui qui a cliqué
        socket.emit('error-message', "En attente d'un adversaire pour commencer...");
        return;
    }

    if (!currentTheme) {
        currentTheme = themeChoice;
        currentQuestionIndex = 0;
        questions = shuffle([...allQuestions[themeChoice]]);
        
        activePlayerId = playerIds[0]; 

        io.emit('theme-chosen', themeChoice); 
        
        io.emit('init-game', { 
            question: questions[currentQuestionIndex],
            times: getTimes(),
            activePlayerId: activePlayerId 
        });

        clearInterval(gameInterval); 
        startTimer();
    }
});

    socket.on('pass-question', () => {
    // On vérifie que c'est bien le tour du joueur qui demande
    if (socket.id !== activePlayerId) return;

    // Appliquer la pénalité
    players[socket.id].time -= 3;
    if (players[socket.id].time < 0) players[socket.id].time = 0;

    // Passer à la question suivante
    currentQuestionIndex++;

    // Prévenir tout le monde du changement
    io.emit('next-round', {
        nextQuestion: questions[currentQuestionIndex],
        activePlayerId: activePlayerId, // Le tour ne change pas !
        times: getTimes()
    });
    });

    socket.on('submit-answer', (guess) => {
        // Seul le joueur actif peut répondre
        if (socket.id !== activePlayerId) return;

        const correct = questions[currentQuestionIndex].answer;
        if (normalize(guess) === normalize(correct)) {
            currentQuestionIndex++;
            
            // Changement de tour : l'autre joueur devient actif
            const playerIds = Object.keys(players);
            activePlayerId = playerIds.find(id => id !== socket.id);

            io.emit('next-round', {
                nextQuestion: questions[currentQuestionIndex],
                activePlayerId: activePlayerId,
                times: getTimes()
            });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('update-player-count', Object.keys(players).length);
        clearInterval(gameInterval);
    });
});

function startTimer() {
    gameInterval = setInterval(() => {
        if (activePlayerId && players[activePlayerId]) {
            players[activePlayerId].time -= 1;
            
            if (players[activePlayerId].time <= 0) {
                players[activePlayerId].time = 0;

                currentQuestionIndex = 0;
                shuffle(questions);
    
                // On cherche l'ID du gagnant (celui qui n'est pas le joueur actif)
                const winnerId = Object.keys(players).find(id => id !== activePlayerId);
    
                io.emit('game-over', { winnerId: winnerId });
                clearInterval(gameInterval);
}

            io.emit('timer-update', getTimes());
        }
    }, 1000);
}

function getTimes() {
    let times = {};
    for (let id in players) { times[id] = players[id].time; }
    return times;
}

// On récupère le port donné par Render, ou 3000 par défaut
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Le serveur tourne sur le port ${PORT}`);
});