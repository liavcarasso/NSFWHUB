// public/js/session-selection.js
document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // התחברות ל-Socket.IO
    const urlParams = new URLSearchParams(window.location.search);
    const gameType = urlParams.get('game'); // קבל את סוג המשחק מה-URL
    const playerName = localStorage.getItem('playerName'); // קבל את שם השחקן מ-localStorage

    const gameTitleElement = document.getElementById('gameTitle');
    const playerGreetingElement = document.getElementById('playerGreeting');
    const sessionsListElement = document.getElementById('sessionsList');
    const createSessionButton = document.getElementById('createSessionButton');
    const backToGameSelectionButton = document.getElementById('backToGameSelectionButton');

    // הצגת פרטי הדף
    if (gameType) {
        gameTitleElement.textContent = `Choose a Session for ${gameType.charAt(0).toUpperCase() + gameType.slice(1)} Game`;
    } else {
        gameTitleElement.textContent = `Choose a Session`;
    }

    if (playerName) {
        playerGreetingElement.textContent = `Hello, ${playerName}!`;
        // שלח את שם השחקן לשרת ברגע ההתחברות
        socket.emit('setPlayerName', { name: playerName, socketId: socket.id });
    } else {
        playerGreetingElement.textContent = `Hello!`;
        // אם אין שם, החזר לדף הראשי
        window.location.href = 'main.html';
        return;
    }

    // ** אירועים מהשרת **

    // קבלת רשימת הסשנים הפתוחים
    socket.on('publicSessions', (sessions) => {
        sessionsListElement.innerHTML = ''; // נקה את הרשימה הקיימת
        if (Object.keys(sessions).length === 0) {
            sessionsListElement.innerHTML = '<p>No public sessions available. Be the first to create one!</p>';
        } else {
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.gameType === gameType) { // הצג רק סשנים של המשחק הנוכחי
                    const sessionItem = document.createElement('div');
                    sessionItem.className = 'session-item';
                    sessionItem.innerHTML = `
                        <h3>Session ID: ${sessionId}</h3>
                        <p>Game: ${session.gameType}</p>
                        <p>Players: ${Object.keys(session.players).length} / ${session.maxPlayers || 'N/A'}</p>
                        <button class="join-session-button" data-session-id="${sessionId}">Join Session</button>
                    `;
                    sessionsListElement.appendChild(sessionItem);
                }
            }
        }
    });

    // טיפול ביצירת סשן חדש
    createSessionButton.addEventListener('click', () => {
        // שאל את המשתמש לשם הסשן (אופציונלי)
        const sessionName = prompt('Enter a name for your new session (optional):');
        socket.emit('createSession', { gameType: gameType, sessionName: sessionName });
    });

    // טיפול בהצטרפות לסשן קיים
    sessionsListElement.addEventListener('click', (event) => {
        if (event.target.classList.contains('join-session-button')) {
            const sessionId = event.target.dataset.sessionId;
            socket.emit('joinSession', { sessionId: sessionId });
        }
    });

    // השרת יאשר את ההצטרפות ויפנה לדף המשחק
    socket.on('sessionJoined', (data) => {
        // השרת יצטרך להפנות אותנו ישירות לדף המשחק עם פרטי הסשן
        // לדוגמה: /games/memory.html?sessionId=xyz
        window.location.href = `games/${data.gameType}.html?sessionId=${data.sessionId}`;
    });

    // כפתור חזרה לדף בחירת המשחקים
    backToGameSelectionButton.addEventListener('click', () => {
        window.location.href = 'main.html';
    });

    // בקש מהשרת את רשימת הסשנים הפתוחים ברגע הטעינה
    socket.emit('requestPublicSessions', { gameType: gameType });
});