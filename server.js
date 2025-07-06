// ✅ server.js מתוקן עם לוגיקת סשנים פשוטה וברורה
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public', { index: 'main.html' }));

const PORT = process.env.PORT || 3000;

console.log('PORT from env:', process.env.PORT);

// 🧠 כל הסשנים הפעילים
const activeSessions = {};

function createMemoryBoard() {
    const emojis = ['🐶','🍕','🚗','🎈','🐱','🌈','⚽','🎮'];
    return [...emojis, ...emojis].sort(() => 0.5 - Math.random());
}

const xoEmoji = [
        '❌',
        '⭕'
]
function randomRolesXo(players){
    const [p1, p2] = Object.keys(players);
    let roles = {
        [p1] : "",
        [p2] : ""
    }
    xoEmoji.sort(() => Math.random() - 0.5);
    roles[p1] = xoEmoji[0];
    roles[p2] = xoEmoji[1];
    return roles;
}

io.on('connection', socket => {
    console.log(`✅ Socket connected: ${socket.id}`);

    socket.on('createSession', ({ gameType }) => {
        console.log("game type:" + gameType)
        const sessionId = `session-${Math.random().toString(36).substring(2, 9)}`;

        if (gameType === 'memory') {
            activeSessions[sessionId] = {
                gameType,
                board: createMemoryBoard(),
                players: {},
                turn: null,
                matched: [],
                flipped: [],
                score: {},
                maxPlayers: 2,
                minPlayers: 2,
                status: 'waiting',
                readyPlayers: new Set()
            };
        }
        else if (gameType === 'rps'){
            activeSessions[sessionId] = {
                gameType,
                players: {},
                maxPlayers: 2,
                minPlayers: 2,
                choose: {},
                status: 'waiting',
                readyPlayers: new Set()
            };
        }
        else if (gameType === 'xo') {
            activeSessions[sessionId] = {
                gameType,
                board: [
                    '','','',
                    '','','',
                    '','',''
                ],
                players: {},
                turn: null,
                maxPlayers: 2,
                minPlayers: 2,
                status: 'waiting',
                placed: {},
                roles: {},
                readyPlayers: new Set()
            };
        }
        else if (gameType === 'hangman') {
            activeSessions[sessionId] = {
                gameType,
                board: [],
                latters: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"],
                players: {},
                turn: null,
                maxPlayers: 4,
                minPlayers: 2,
                status: 'waiting',
                guessed: [],
                fails: 0,
                host: "",
                readyPlayers: new Set()
            };
        }

        joinSession(socket, sessionId);
    });

    socket.on('joinSession', ({ sessionId}) => {
        const session = activeSessions[sessionId];
        if (!activeSessions[sessionId]) return;
        joinSession(socket, sessionId);
    });

    socket.on('playerReady', () => {
        const sessionId = socket.sessionId;
        const session = activeSessions[sessionId];

        if (!session) return;

        session.readyPlayers.add(socket.id); // Add the player to the ready set
        console.log(`Player ${socket.id} is ready in session ${sessionId}. Ready players: ${session.readyPlayers.size}/${session.maxPlayers}`);

        // Check if all players are ready
        if (session.readyPlayers.size >= session.minPlayers && session.status === 'waiting') {
            session.status = 'in_progress';
            if (session.gameType === "memory"){
                session.turn = Object.keys(session.players)[0];
                session.score[Object.keys(session.players)[0]] = 0;
                session.score[Object.keys(session.players)[1]] = 0;
            }
            else if (session.gameType === "xo"){
                session.roles = randomRolesXo(session.players);
                if (session.roles[Object.keys(session.players)[0]] === '❌'){
                    session.turn = Object.keys(session.players)[0];
                }
                else {
                    session.turn = Object.keys(session.players)[1];
                }
            }
            else if (session.gameType === "hangman"){
                session.turn = Object.keys(session.players)[1];
                session.host = Object.keys(session.players)[0];
                console.log("the host: " + session.host);
            }
            io.to(sessionId).emit('gameStart', session);
            console.log(`Game started in session ${sessionId}!`);
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
                session.score[socket.id] += 1;
                turn = false;
                session.matched.push(i1, i2);
                io.to(sessionId).emit('match', [i1, i2]);

                if (session.matched.length === session.board.length) {

                    let players = Object.keys(session.players);
                    if (session.score[players[0]] === session.score[players[1]]){
                        io.to(sessionId).emit('endmemory', { winnerId: null});
                        return;
                    }
                    else if (session.score[players[0]] > session.score[players[1]]){
                        io.to(sessionId).emit('endmemory', { winnerId: players[0]});
                        return;
                    }
                    else {
                        io.to(sessionId).emit('endmemory', { winnerId: players[1]});
                        return;
                    }
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

    socket.on('rpsClick', (index, playerId) => {
        const sessionId = socket.sessionId;
        const session = activeSessions[sessionId];
        if (!session) return;

        if (Object.keys(session.choose).length >= 2) return;

        session.choose[playerId] = index;

        if (Object.keys(session.choose).length === 2) {
            let winner;
            const [[i1key, i1], [i2key, i2]] = Object.entries(session.choose);

             if (
                (i1 === 0 && i2 === 2) || // Rock (0) beats Scissors (2)
                (i1 === 1 && i2 === 0) || // Paper (1) beats Rock (0)
                (i1 === 2 && i2 === 1)    // Scissors (2) beats Paper (1)
            ) {
                 winner = i1key;
             }
            else if (i1 === i2){
                winner = null;
             }
            else {
                winner = i2key;
             }
            io.to(sessionId).emit('endrps', { winnerId: winner });
        }
    });

    socket.on('clickCardXo', (index, playerId) => {
        const sessionId = socket.sessionId;
        const session = activeSessions[sessionId];
        if (!session) return;

        console.log(`player:${playerId} press ${index} in session:${sessionId}`)

        const winningCombinations = [
            [0, 1, 2], // שורה עליונה
            [3, 4, 5], // שורה אמצעית
            [6, 7, 8], // שורה תחתונה
            [0, 3, 6], // עמודה שמאלית
            [1, 4, 7], // עמודה אמצעית
            [2, 5, 8], // עמודה ימנית
            [0, 4, 8], // אלכסון משמאל למעלה לימין למטה
            [2, 4, 6]  // אלכסון מימין למעלה לשמאל למטה
        ];
        let winnerFound = false;

        //if (Object.keys(session.placed).length >= 2) return;
        if (session.turn === playerId) {
            if (session.placed.hasOwnProperty(playerId)) {
                session.placed[playerId].push(index);
            } else {
                session.placed[playerId] = [index];
            }

            session.board[index] = session.roles[playerId];
            io.to(sessionId).emit('xoRerender', index, session.roles[playerId]);

            if (Object.keys(session.placed).length === 2) {
                const allPlayerIds = Object.keys(session.placed);

                for (const player in session.placed) {
                    const playerMoves = session.placed[player];

                    for (const combination of winningCombinations) {
                        const hasWon = combination.every(index => playerMoves.includes(index));

                        if (hasWon) {
                            console.log("winner has been found")
                            winnerFound = true;
                            io.to(sessionId).emit('endXo', {winnerId: player});
                        }
                        if (winnerFound) {
                            break;
                        }
                    }
                }
                if (!winnerFound) {
                    if (allPlayerIds.length === 2) {
                        const player1Moves = session.placed[allPlayerIds[0]] || [];
                        const player2Moves = session.placed[allPlayerIds[1]] || [];
                        const totalMoves = player1Moves.length + player2Moves.length;

                        if (totalMoves === 9) {
                            console.log("tie")
                            io.to(sessionId).emit('endXo', {winnerId: null});
                        }
                    }
                }
            }
            if (!winnerFound) {
                const ids = Object.keys(session.players);
                const current = ids.indexOf(session.turn);
                session.turn = ids[(current + 1) % ids.length];
                io.to(sessionId).emit('nextTurn', session.turn);
            }
        }
    });

    socket.on('hmEnter', (word) => {
        const sessionId = socket.sessionId;
        const session = activeSessions[sessionId];

        if (!session) return;
        word.split('').forEach(char =>{
            session.board.push(char);
        })
        io.to(sessionId).emit('gameStartHm', session);
    });

    socket.on('hmGuessClick', (index) => {
        const sessionId = socket.sessionId;
        const session = activeSessions[sessionId];

        if (!session) return;
        let winnerFound = false;
        let latter = session.latters[index];
        if (session.board.includes(latter)) {
            const indexes = [];
            session.board.forEach((char, idx) => {
                if (char === latter) {
                    session.guessed.push(char);
                    indexes.push(idx);
                }
            });
            io.to(sessionId).emit('guessHm', indexes, true, session.guessed);
        }
        else{
            session.guessed.push(latter)
            session.fails += 1;
            io.to(sessionId).emit('guessHm', [], false, session.guessed);
        }
        if (session.fails >= 5){
            console.log(session.host);
            io.to(sessionId).emit('endHm', session.host);
            winnerFound = true;
        }
        if (session.board.every(char => session.guessed.includes(char))) {
            io.to(sessionId).emit('endHm', "!host");
            winnerFound = true;
        }
        if (!winnerFound) {
            const ids = Object.keys(session.players);
            const current = ids.indexOf(session.turn);
            session.turn = ids[(current + 1) % ids.length];
            if(session.turn === session.host){
                const current = ids.indexOf(session.turn);
                session.turn = ids[(current + 1) % ids.length];
            }
            io.to(sessionId).emit('nextTurn', session.turn);
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
