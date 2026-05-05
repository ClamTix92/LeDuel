const socket = io();
const displayArea = document.getElementById('display-area');
const answerInput = document.getElementById('answer-input');
const passBtn = document.getElementById('pass-btn');

// answerInput.disabled = true; // Personne ne tape avant le début officiel

socket.on('error-message', (msg) => {
    alert(msg); // Une simple alerte navigateur fera l'affaire pour commencer
});

socket.on('update-player-count', (count) => {
    document.getElementById('player-count').innerText = `Joueurs en ligne : ${count}`;
});

function chooseTheme(theme) {
    socket.emit('select-theme', theme);
}

socket.on('theme-chosen', (theme) => {
    document.getElementById('menu-container').style.display = "none";
    document.getElementById('game-container').style.display = "block";

    const hint = document.querySelector('.hint-text');
    if (theme === 'athletes') {
        hint.innerHTML = "Les accents ne sont pas nécessaires<br>Tapez uniquement les noms de famille !";
    } else if (theme === 'stades') {
        hint.innerHTML = "Les accents ne sont pas nécessaires<br>Le nom le plus populaire est attendu.";
    } else {
        hint.innerHTML = "Les accents ne sont pas nécessaires<br>Seulement le nom de la ville du club est attendu.";
    }
});


socket.on('init-game', (data) => {
    document.getElementById('menu-container').style.display = "none";
    document.getElementById('game-container').style.display = "block";
    
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
        answerInput.style.backgroundColor = "#e94560"; 
        answerInput.disabled = false;
        answerInput.focus();
        passBtn.disabled = false;
        passBtn.style.opacity = "1";
    } else {
        answerInput.style.backgroundColor = "#555"; 
        answerInput.disabled = true;
        passBtn.disabled = true;
        passBtn.style.opacity = "0.5";
    }
});


passBtn.addEventListener('click', () => {
    socket.emit('pass-question');
});



socket.on('game-over', (data) => {
    // 1. On cache la zone de jeu
    displayArea.style.display = "none";
    document.querySelector('.hint-text').style.display = "none";
    answerInput.style.display = "none";
    
    // 2. On affiche l'écran de fin
    const screen = document.getElementById('game-over-screen');
    const msg = document.getElementById('winner-message');
    screen.style.display = "block";

    // 3. On personnalise le message
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