// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// השתמש ב-main.html כקובץ הראשי כברירת מחדל
app.use(express.static('public', { index: 'main.html' }));

const PORT = process.env.PORT || 3000;

// *** ניהול סשנים גלובלי ***
const activeSessions = {}; // אובייקט שיחזיק את כל הסשנים הפעילים
const playersData = {}; // אובייקט שיחזיק את שם השחקן לפי socket.id

// פונקציית עזר ליצירת מצב משחק חדש (לכל סשן)
function createNewGameSessionState(gameType) {
    // ניתן להוסיף כאן לוגיקה שונה לכל סוג משחק
    if (gameType === 'memory') {
        const emojis = ['🐶','🍕','🚗','🎈','🐱','🌈','⚽','🎮'];
        const board = [...emojis, ...emojis].sort(() => 0.5 - Math.random());
        return {
            gameType: 'memory',
            board: board,
            players: {}, // שחקנים בסשן ספציפי (key: socketId, value: {name, score})
            turn: null, // מי תורו, כ-socketId
            matched: [],
            flipped: [],
            maxPlayers: 2, // לדוגמה, הגבל ל-2 שחקנים למשחק זיכרון
            status: 'waiting' // waiting, in_progress, ended
        };
    }
    // ניתן להוסיף כאן else if עבור משחקים אחרים
    return null; // סוג משחק לא נתמך
}

io.on('connection', socket => {
    console.log('Player connected:', socket.id);
    playersData[socket.id] = { name: `Guest_${socket.id.substring(0,4)}`, score: 0, currentSessionId: null };

    // קבל את שם השחקן מהקליינט
    socket.on('setPlayerName', (data) => {
        if (data.name && playersData[socket.id]) {
            playersData[socket.id].name = data.name;
            console.log(`Player ${socket.id} set name to: ${data.name}`);
        }
    });

    // *** ניהול סשנים מהקליינט ***

    // קליינט מבקש רשימת סשנים פתוחים
    socket.on('requestPublicSessions', (data) => {
        const publicSessions = {};
        for (const id in activeSessions) {
            const session = activeSessions[id];
            // רק סשנים שעדיין לא התחילו
            if (session.status === 'waiting' && session.gameType === data.gameType) {
                 publicSessions[id] = {
                     gameType: session.gameType,
                     players: session.players,
                     maxPlayers: session.maxPlayers
                 };
            }
        }
        socket.emit('publicSessions', publicSessions);
    });

    // קליינט מבקש ליצור סשן חדש
    socket.on('createSession', (data) => {
        const { gameType, sessionName } = data;
        const sessionId = `session-${Math.random().toString(36).substring(2, 9)}`; // ID ייחודי לסשן

        const newGameState = createNewGameSessionState(gameType);
        if (!newGameState) {
            socket.emit('error', 'Invalid game type.');
            return;
        }

        activeSessions[sessionId] = newGameState;
        console.log(`Session ${sessionId} created for ${gameType} by ${playersData[socket.id].name}`);

        // הצטרף אוטומטית ליוצר הסשן
        joinPlayerToSession(socket, sessionId, gameType);
        // עדכן את כל הקליינטים (במיוחד אלו בדף בחירת הסשנים)
        io.emit('publicSessions', getPublicSessions(gameType)); // שלח רשימה מעודכנת
    });

    // קליינט מבקש להצטרף לסשן קיים
    socket.on('joinSession', (data) => {
        const { sessionId } = data;
        const session = activeSessions[sessionId];

        if (!session) {
            socket.emit('error', 'Session not found.');
            return;
        }
        if (Object.keys(session.players).length >= session.maxPlayers) {
            socket.emit('error', 'Session is full.');
            return;
        }
        if (session.status !== 'waiting') {
             socket.emit('error', 'Session already in progress.');
             return;
        }

        joinPlayerToSession(socket, sessionId, session.gameType);
        io.emit('publicSessions', getPublicSessions(session.gameType)); // עדכן את כל הקליינטים

        // אם הסשן מלא, התחל את המשחק
        if (Object.keys(session.players).length === session.maxPlayers) {
            session.status = 'in_progress';
            session.turn = Object.keys(session.players)[0]; // השחקן הראשון בתור
            // שלח הודעת התחלה לכל השחקנים בסשן
            for (const playerId in session.players) {
                io.to(playerId).emit('gameStart', session);
            }
        }
    });

    // פונקציית עזר לצירוף שחקן לסשן
    function joinPlayerToSession(socket, sessionId, gameType) {
        // אם השחקן כבר בסשן כלשהו, צא ממנו קודם
        if (playersData[socket.id] && playersData[socket.id].currentSessionId) {
            leavePlayerFromSession(socket);
        }

        activeSessions[sessionId].players[socket.id] = {
            name: playersData[socket.id].name,
            score: 0
        };
        playersData[socket.id].currentSessionId = sessionId; // עדכן את השחקן באיזה סשן הוא
        socket.join(sessionId); // צרף את הסוקט ל"חדר" של הסשן

        console.log(`Player ${playersData[socket.id].name} joined session ${sessionId} (${gameType})`);
        socket.emit('sessionJoined', { sessionId: sessionId, gameType: gameType }); // אשר לקליינט
        io.to(sessionId).emit('playerJoinedSession', activeSessions[sessionId].players); // עדכן שחקנים אחרים בסשן

        // אם יש רק שחקן אחד, הגדר אותו כתור הראשון
        if (Object.keys(activeSessions[sessionId].players).length === 1) {
            activeSessions[sessionId].turn = socket.id;
        }
    }

    // פונקציית עזר לעזיבת סשן
    function leavePlayerFromSession(socket) {
        const currentSessionId = playersData[socket.id].currentSessionId;
        if (currentSessionId && activeSessions[currentSessionId]) {
            delete activeSessions[currentSessionId].players[socket.id];
            socket.leave(currentSessionId);
            console.log(`Player ${playersData[socket.id].name} left session ${currentSessionId}`);

            // אם הסשן התרוקן, מחק אותו
            if (Object.keys(activeSessions[currentSessionId].players).length === 0) {
                delete activeSessions[currentSessionId];
                console.log(`Session ${currentSessionId} deleted as it's empty.`);
            } else {
                 io.to(currentSessionId).emit('playerLeftSession', activeSessions[currentSessionId].players);
                 // אם מי שעזב היה בתור, העבר תור לשחקן הבא
                 if (activeSessions[currentSessionId].turn === socket.id) {
                     const remainingPlayers = Object.keys(activeSessions[currentSessionId].players);
                     if (remainingPlayers.length > 0) {
                        activeSessions[currentSessionId].turn = remainingPlayers[0]; // העבר לראשון ברשימה
                        io.to(currentSessionId).emit('nextTurn', activeSessions[currentSessionId].turn);
                     } else {
                        activeSessions[currentSessionId].turn = null;
                     }
                 }
            }
            playersData[socket.id].currentSessionId = null; // נקה את פרטי הסשן של השחקן
            io.emit('publicSessions', getPublicSessions()); // עדכן את כל הקליינטים ברשימת הסשנים
        }
    }

    function getPublicSessions(gameTypeFilter = null) {
        const publicSessions = {};
        for (const id in activeSessions) {
            const session = activeSessions[id];
            if (session.status === 'waiting' && (!gameTypeFilter || session.gameType === gameTypeFilter)) {
                 publicSessions[id] = {
                     gameType: session.gameType,
                     players: session.players,
                     maxPlayers: session.maxPlayers
                 };
            }
        }
        return publicSessions;
    }


    // *** לוגיקת המשחק עצמה (מועברת לסשן ספציפי) ***
    socket.on('flip', index => {
        const currentSessionId = playersData[socket.id].currentSessionId;
        if (!currentSessionId || !activeSessions[currentSessionId]) return;

        const session = activeSessions[currentSessionId];

        if (socket.id !== session.turn) return;
        if (session.flipped.includes(index) || session.matched.includes(index)) return;
        if (session.flipped.length >= 2) return;

        session.flipped.push(index);
        io.to(currentSessionId).emit('flip', index); // שלח רק לשחקני הסשן

        if (session.flipped.length === 2) {
            const [i1, i2] = session.flipped;
            const e1 = session.board[i1];
            const e2 = session.board[i2];

            if (e1 === e2) {
                session.matched.push(i1, i2);
                session.players[socket.id].score = (session.players[socket.id].score || 0) + 1; // עדכן ניקוד לשחקן הנוכחי
                io.to(currentSessionId).emit('match', [i1, i2]);
                io.to(currentSessionId).emit('updatePlayersInSession', session.players); // עדכן ניקוד לשחקנים בסשן

                if (session.matched.length === session.board.length) {
                    console.log(`Game Over for session ${currentSessionId}!`);
                    session.status = 'ended';
                    let winnerId = null;
                    let maxScore = -1;
                    let isTie = false;

                    for (const playerId in session.players) {
                        const playerScore = session.players[playerId].score;
                        if (playerScore > maxScore) {
                            maxScore = playerScore;
                            winnerId = playerId;
                            isTie = false;
                        } else if (playerScore === maxScore) {
                            isTie = true; // יש תיקו
                        }
                    }

                    let winnerName = null;
                    if (winnerId && !isTie) {
                         winnerName = session.players[winnerId].name;
                    } else if (isTie) {
                        winnerName = "It's a Tie!";
                        winnerId = null; // כדי לציין שאין מנצח יחיד
                    } else {
                        winnerName = "No winner (game ended unexpectedly)";
                    }

                    io.to(currentSessionId).emit('endmemory', { winnerId: winnerId, winnerName: winnerName });

                    // אופציונלי: מחק את הסשן לאחר שהמשחק נגמר וחלון הניצחון הוצג (או לאחר זמן מה)
                    // setTimeout(() => {
                    //     delete activeSessions[currentSessionId];
                    //     io.emit('publicSessions', getPublicSessions()); // עדכן את כולם שהסשן נמחק
                    // }, 10000); // מחק לאחר 10 שניות
                }
            }

            setTimeout(() => {
                // העברת תור
                const playerIds = Object.keys(session.players);
                if (playerIds.length > 0 && session.status === 'in_progress') {
                    const currentIndex = playerIds.indexOf(session.turn);
                    session.turn = playerIds[(currentIndex + 1) % playerIds.length];
                    io.to(currentSessionId).emit('nextTurn', session.turn);
                }

                session.flipped = [];
                io.to(currentSessionId).emit('unflip');
            }, 1000);
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const disconnectedPlayerName = playersData[socket.id] ? playersData[socket.id].name : socket.id;

        // הסר את השחקן מהסשן הנוכחי שלו
        leavePlayerFromSession(socket);

        // מחק את נתוני השחקן הגלובליים
        delete playersData[socket.id];
        console.log(`Player ${disconnectedPlayerName} data removed.`);

        // עדכן את כולם ברשימת הסשנים הפתוחים
        io.emit('publicSessions', getPublicSessions());
    });
});

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});