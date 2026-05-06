const socket = io();
const displayArea = document.getElementById('display-area');
const answerInput = document.getElementById('answer-input');
const passBtn = document.getElementById('pass-btn');

// answerInput.disabled = true; // Personne ne tape avant le début officiel

// Au début de script.js, on garde en mémoire le code de notre partie
let myRoomCode = null;

// --- BOUTONS D'ACCUEIL ---
document.getElementById('btn-create-room').addEventListener('click', () => {
    socket.emit('create-room');
});

document.getElementById('btn-join-room').addEventListener('click', () => {
    const code = document.getElementById('input-room-code').value;
    if (code.length > 0) socket.emit('join-room', code);
});

document.getElementById('btn-matchmaking').addEventListener('click', () => {
    document.getElementById('home-container').style.display = 'none';
    document.getElementById('matchmaking-container').style.display = 'block';
    socket.emit('join-matchmaking');
});

socket.on('match-found', (data) => {
    myRoomCode = data.roomCode;
    document.getElementById('queue-status').style.display = 'none';
    document.getElementById('vs-screen').style.display = 'block';
    
    // Remplir les infos
    document.getElementById('p1-name').innerText = data.p1Name;
    document.getElementById('p2-name').innerText = data.p2Name;
    document.getElementById('match-theme').innerText = data.theme.toUpperCase();

    // Lancer le décompte de 3 secondes
    let count = 3;
    const countEl = document.getElementById('match-countdown');
    const timer = setInterval(() => {
        count--;
        countEl.innerText = count;
        if (count <= 0) {
            clearInterval(timer);
            // On réutilise la logique d'init-game existante
            // Le serveur doit envoyer init-game après les 3s
            if (data.activePlayerId === socket.id) {
                socket.emit('matchmaking-ready', { code: myRoomCode });
            }
        }
    }, 1000);
});

// --- RETOURS DU SERVEUR ---
socket.on('room-created', (code) => {
    myRoomCode = code;
    document.getElementById('home-container').style.display = 'none';
    document.getElementById('lobby-container').style.display = 'block';
    document.getElementById('display-room-code').innerText = code;
    
    // L'hôte voit les paramètres
    document.getElementById('host-settings').style.display = 'block';
    document.getElementById('guest-waiting').style.display = 'none';
});

socket.on('room-joined', (code) => {
    myRoomCode = code;
    document.getElementById('home-container').style.display = 'none';
    document.getElementById('lobby-container').style.display = 'block';
    document.getElementById('display-room-code').innerText = code;
    
    // L'invité voit l'écran d'attente
    document.getElementById('host-settings').style.display = 'none';
    document.getElementById('guest-waiting').style.display = 'block';
});

socket.on('room-update', (playerCount) => {
    document.getElementById('room-player-count').innerText = playerCount;
    
    // Si la room est pleine, l'hôte peut lancer
    if (playerCount === 2) {
        const startBtn = document.getElementById('btn-start-custom');
        if(startBtn) {
            startBtn.disabled = false;
            startBtn.innerText = "LANCER LE DUEL !";
            startBtn.style.backgroundColor = "#28a745"; // Petit effet vert
        }
    }
});

// --- BOUTON LANCER LE DUEL (HÔTE) ---
document.getElementById('btn-start-custom').addEventListener('click', () => {
    const theme = document.getElementById('select-theme').value;
    const timer = document.getElementById('select-timer').value;
    
    socket.emit('start-game', { 
        code: myRoomCode, 
        theme: theme, 
        timer: parseInt(timer) 
    });
});

socket.on('error-message', (msg) => {
    alert(msg); // Une simple alerte navigateur fera l'affaire pour commencer
});

socket.on('update-player-count', (count) => {
    document.getElementById('player-count').innerText = `Joueurs en ligne : ${count}`;
});

socket.on('init-game', (data) => {
    // On cache le lobby et on affiche le jeu
    document.getElementById('matchmaking-container').style.display = 'none';
    document.getElementById('lobby-container').style.display = "none";
    document.getElementById('game-container').style.display = "block";
    
    // --- DICTIONNAIRE DES INDICES PAR THÈME ---
    const hintMessages = {
        athletes: "Les accents ne sont pas nécessaires<br>Tapez uniquement les noms de famille !",
        stades: "Les accents ne sont pas nécessaires<br>Le nom le plus populaire est attendu.",
        logos_clubs_foot: "Les accents ne sont pas nécessaires<br>Seulement le nom de la ville du club est attendu.",
        logos_rugby: "Les accents ne sont pas nécessaires<br>Seulement le nom de la ville ou du club est attendu.",
        logos_nba: "Les accents ne sont pas nécessaires<br>Seulement le nom de la franchise est attendu, pas celui de la ville.",
        logos_nfl: "Les accents ne sont pas nécessaires<br>Seulement le nom de la franchise est attendu, pas celui de la ville.",
        drapeaux: "Les accents ne sont pas nécessaires", // Sans la phrase supplémentaire
        // Tu peux ajouter tous les autres thèmes ici au fur et à mesure !
        // capitales: "...",
        // acteurs: "..."
    };

    // Mise à jour de l'indice
    const hint = document.querySelector('.hint-text');
    // On cherche si un message spécifique existe pour le thème choisi.
    // Sinon (grâce à ||), on affiche un message par défaut.
    hint.innerHTML = hintMessages[data.theme] || "Les accents ne sont pas nécessaires";

    if (data.question) {
        displayArea.innerHTML = `<img src="${data.question.image}" style="max-width:100%; border-radius:10px;">`;
    }

    // --- LOGIQUE DE TOUR ---
    if (data.activePlayerId === socket.id) {
        answerInput.disabled = false;
        answerInput.style.backgroundColor = "#e94560"; // Rouge
        answerInput.focus();
        passBtn.disabled = false;
    } else {
        answerInput.disabled = true;
        answerInput.style.backgroundColor = "#555"; // Gris
        passBtn.disabled = true;
    }

    // Mise à jour des chronos
    for (let id in data.times) {
        const target = (id === socket.id) ? 'my-time' : 'opponent-time';
        document.getElementById(target).innerText = data.times[id];
    }
});

socket.on('timer-update', (times) => {
    for (let id in times) {
        if (id === socket.id) {
            document.getElementById('my-time').innerText = times[id];
        } else {
            document.getElementById('opponent-time').innerText = times[id];
        }
    }
});

socket.on('next-round', (data) => {
    if (data.nextQuestion) {
        displayArea.innerHTML = `<img src="${data.nextQuestion.image}" style="max-width:100%; border-radius:10px;">`;
    }

    if (data.activePlayerId === socket.id) {
        // Nettoyage de l'animation pour un retour au rouge standard
        answerInput.style.background = ""; 
        answerInput.style.backgroundSize = "";
        answerInput.style.backgroundPosition = "";
        answerInput.style.transition = "border-color 0.3s";
        answerInput.style.backgroundColor = "#e94560";
        answerInput.placeholder = "Tape ta réponse ici...";
        
        answerInput.disabled = false;
        answerInput.focus();
        
        // On réactive le bouton Passer
        passBtn.disabled = false;
        passBtn.style.opacity = "1";
    } else {
        // Tour de l'adversaire
        answerInput.style.background = "";
        answerInput.style.backgroundColor = "#555"; 
        answerInput.placeholder = "Au tour de l'adversaire...";
        answerInput.disabled = true;
        
        // On grise le bouton Passer
        passBtn.disabled = true;
        passBtn.style.opacity = "0.5";
    }
});


passBtn.addEventListener('click', () => {
    // 1. On bloque immédiatement l'input et le bouton
    answerInput.disabled = true;
    passBtn.disabled = true;
    answerInput.value = "";
    answerInput.placeholder = "PÉNALITÉ EN COURS...";

    // 2. Animation Magique : Gris vers Rouge de droite à gauche
    answerInput.style.transition = "none";
    // On crée un fond 50% gris à gauche, 50% rouge à droite
    answerInput.style.background = "linear-gradient(to right, #555 50%, #e94560 50%)";
    answerInput.style.backgroundSize = "200% 100%";
    answerInput.style.backgroundPosition = "0% 0"; // On commence sur la partie grise

    // Petite astuce pour forcer le navigateur à comprendre le point de départ
    void answerInput.offsetWidth;

    // On lance le défilement pendant 3 secondes
    answerInput.style.transition = "background-position 3s linear";
    answerInput.style.backgroundPosition = "100% 0"; // On glisse vers la partie rouge

    // 3. On informe le serveur (qui va attendre 3s avant d'envoyer la suite)
    socket.emit('pass-question');
});



socket.on('game-over', (data) => {
    // 1. On cache TOUTE la zone de jeu proprement
    displayArea.style.display = "none";
    document.querySelector('.hint-text').style.display = "none";
    document.getElementById('input-area').style.display = "none"; // <--- On cache tout le bloc (input + bouton pass)
    document.getElementById('scoreboard').style.display = "none"; // Optionnel : cacher aussi les scores

    // 2. On affiche l'écran de fin
    const screen = document.getElementById('game-over-screen');
    const msg = document.getElementById('winner-message');
    screen.style.display = "block";

    if (data.winnerId === socket.id) {
        msg.innerText = "VICTOIRE ! 🏆";
        msg.style.color = "#4dd0e1";
    } else {
        msg.innerText = "DÉFAITE... 💀";
        msg.style.color = "#e94560";
    }
});

answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        socket.emit('submit-answer', answerInput.value);
        answerInput.value = "";
    }
});