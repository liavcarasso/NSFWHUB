// ✅ server.js מתוקן עם לוגיקת סשנים פשוטה וברורה
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public', { index: 'main.html' }));

const PORT = process.env.PORT || 3000;

// 🧠 כל הסשנים הפעילים
const activeSessions = {};

function createMemoryBoard() {
    const emojis = ['🐶','🍕','🚗','🎈','🐱','🌈','⚽','🎮'];
    return [...emojis, ...emojis].sort(() => 0.5 - Math.random());
}

io.on('connection', socket => {
    console.log(`✅ Socket connected: ${socket.id}`);

    socket.on('createSession', ({ gameType }) => {
        const sessionId = `session-${Math.random().toString(36).substring(2, 9)}`;

        if (gameType !== 'memory') return;

        activeSessions[sessionId] = {
            gameType,
            board: createMemoryBoard(),
            players: {},
            turn: null,
            matched: [],
            flipped: [],
            maxPlayers: 2,
            status: 'waiting'
        };

        joinSession(socket, sessionId);
    });

    socket.on('joinSession', ({ sessionId }) => {
        if (!activeSessions[sessionId]) return;
        joinSession(socket, sessionId);

        const session = activeSessions[sessionId];
        if (Object.keys(session.players).length === session.maxPlayers) {
            session.status = 'in_progress';
            session.turn = Object.keys(session.players)[0];
            io.to(sessionId).emit('gameStart', session);
        }
    });

    socket.on('flip', index => {
        let turn = true;
        const sessionId = socket.sessionId;
        const session = activeSessions[sessionId];
        if (!session || session.turn !== socket.id) return;

        if (session.flipped.includes(index) || session.matched.includes(index)) return;
        if (session.flipped.length >= 2) return;

        session.flipped.push(index);
        io.to(sessionId).emit('flip', index);

        if (session.flipped.length === 2) {
            const [i1, i2] = session.flipped;
            const e1 = session.board[i1];
            const e2 = session.board[i2];

            if (e1 === e2) {
                turn = false;
                session.matched.push(i1, i2);
                io.to(sessionId).emit('match', [i1, i2]);

                if (session.matched.length === session.board.length) {
                    io.to(sessionId).emit('endmemory', { winnerId: socket.id });
                    return;
                }
            }

            setTimeout(() => {
                const ids = Object.keys(session.players);
                const current = ids.indexOf(session.turn);
                if (turn){
                    session.turn = ids[(current + 1) % ids.length];
                }
                session.flipped = [];
                io.to(sessionId).emit('unflip');
                io.to(sessionId).emit('nextTurn', session.turn);
            }, 1000);
        }
    });

    socket.on('disconnect', () => {
        const sessionId = socket.sessionId;
        if (!sessionId || !activeSessions[sessionId]) return;

        delete activeSessions[sessionId].players[socket.id];
        io.to(sessionId).emit('playerLeft', socket.id);

        if (Object.keys(activeSessions[sessionId].players).length === 0) {
            console.log(`⚠️ Session ${sessionId} is empty. Waiting before deletion...`);
            setTimeout(() => {
                if (
                    activeSessions[sessionId] &&
                    Object.keys(activeSessions[sessionId].players).length === 0
                ) {
                    delete activeSessions[sessionId];
                    console.log(`❌ Deleted session ${sessionId} after timeout.`);
                }
            }, 5000); // מחכה 5 שניות לפני מחיקה
        }
    });

    function joinSession(socket, sessionId) {
        const session = activeSessions[sessionId];
        socket.join(sessionId);
        socket.sessionId = sessionId;
        session.players[socket.id] = { id: socket.id, name: `Player-${socket.id.substring(0, 4)}` };

        console.log(`👤 ${socket.id} joined session ${sessionId}`);
        socket.emit('sessionJoined', { sessionId });
        io.to(sessionId).emit('updatePlayersInSession', session.players);

        if (!session.turn) {
            session.turn = socket.id;
        }
    }

    socket.on('requestPublicSessions', (data) => {
        socket.emit('publicSessions', getPublicSessions(data.gameType));
    });

});

http.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});

function getPublicSessions(gameTypeFilter = null) {
    const publicSessions = {};
    for (const id in activeSessions) {
        const session = activeSessions[id];
        if (
            session.status === 'waiting' &&
            (!gameTypeFilter || session.gameType === gameTypeFilter)
        ) {
            publicSessions[id] = {
                gameType: session.gameType,
                players: session.players,
                maxPlayers: session.maxPlayers
            };
        }
    }
    return publicSessions;
}
