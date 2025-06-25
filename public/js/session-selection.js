// ✅ public/js/session-selection.js - גרסה פשוטה ותואמת לשרת החדש

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const urlParams = new URLSearchParams(window.location.search);
    const gameType = urlParams.get('game') || 'memory';

    const gameTitleElement = document.getElementById('gameTitle');
    const sessionsListElement = document.getElementById('sessionsList');
    const createSessionButton = document.getElementById('createSessionButton');
    const backToHomeButton = document.getElementById('backToGameSelectionButton');

    gameTitleElement.textContent = `Choose a Session for ${gameType}`;

    socket.emit('requestPublicSessions', { gameType });

    socket.on('publicSessions', (sessions) => {
        sessionsListElement.innerHTML = '';
        const entries = Object.entries(sessions).filter(([_, s]) => s.gameType === gameType);

        if (entries.length === 0) {
            sessionsListElement.innerHTML = '<p>No sessions available. Create one!</p>';
        } else {
            for (const [sessionId, session] of entries) {
                const item = document.createElement('div');
                item.className = 'session-item';
                item.innerHTML = `
                    <h3>Session ID: ${sessionId}</h3>
                    <p>Players: ${Object.keys(session.players).length} / ${session.maxPlayers}</p>
                    <button class="join-session-button" data-id="${sessionId}">Join</button>
                `;
                sessionsListElement.appendChild(item);
            }
        }
    });

    createSessionButton.addEventListener('click', () => {
        socket.emit('createSession', { gameType });
    });

    sessionsListElement.addEventListener('click', (e) => {
        if (e.target.classList.contains('join-session-button')) {
            const sessionId = e.target.dataset.id;
            socket.emit('joinSession', { sessionId });
        }
    });

    socket.on('sessionJoined', ({ sessionId }) => {
        window.location.href = `games/${gameType}.html?sessionId=${sessionId}`;
    });

    backToHomeButton.addEventListener('click', () => {
        window.location.href = 'main.html';
    });
});
