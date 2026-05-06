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
    console.log(`Joueur connecté : ${socket.id}`);

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
    socket.on('start-custom-game', (data) => {
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