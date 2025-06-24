// public/js/memory.js
document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const board = document.getElementById('game-board');
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId'); // קבל את ה-sessionId מה-URL

    let myId = null;
    let myTurn = false;
    let matched = [];
    let lockBoard = false;
    const gameOverModal = document.getElementById('gameOverModal');
    const winnerMessageElement = document.getElementById('winnerMessage');
    const restartButton = document.getElementById('restartButton');
    const backToHomeButton = document.getElementById('backToHomeButton');

    // אם אין sessionId, כנראה שהגיעו לדף המשחק לא דרך בחירת סשן
    if (!sessionId) {
        alert('Invalid session. Please choose a session from the main hub.');
        window.location.href = '../main.html';
        return;
    }

    // שלח את ה-sessionId לשרת ברגע שהקליינט מתחבר לדף המשחק
    // (השרת ידע לשייך את הסוקט לסשן הנכון)
    // הערה: למעשה, השרת כבר שייך אותו לחדר כשלוחצים joinSession, אבל זה מוודא שאנחנו בצד הלקוח יודעים את ה-sessionId
    // וגם שהשרת יכול לוודא שזה סשן קיים וכו'.
    // נסתמך על אירוע 'gameStart' מהשרת
    // השרת צריך לשלוח את המצב ההתחלתי של הסשן רק לחדר הספציפי.

    socket.on('gameStart', (sessionState) => {
        // המצב ההתחלתי של המשחק נשלח רק לשחקני הסשן
        myId = socket.id; // myId צריך להיות זמין כבר
        // players = Object.keys(sessionState.players); // אם תרצה רשימת ID-ים
        matched = sessionState.matched;
        renderBoard(sessionState.board);
        myTurn = (sessionState.turn === myId);
        highlightTurn(myTurn);
        console.log(`Game started for session ${sessionId}. My turn: ${myTurn}`);
    });

    socket.on('flip', index => {
        const card = board.children[index];
        if (card) { // ודא שהכרטיס קיים
            card.innerText = card.dataset.emoji;
        }
    });

    socket.on('match', indexes => {
        matched.push(...indexes);
    });

    socket.on('unflip', () => {
        const cards = document.querySelectorAll('.card');
        for (const card of cards) {
            const i = parseInt(card.dataset.index);
            if (!matched.includes(i)) {
                card.innerText = '❓';
            }
        }
    });

    socket.on('nextTurn', turnId => {
        myTurn = (turnId === myId);
        highlightTurn(myTurn);
    });

    socket.on('updatePlayersInSession', (playersDataInSession) => {
        console.log('Players in session updated:', playersDataInSession);
        // כאן תוכל לעדכן UI שמציג את רשימת השחקנים והניקוד שלהם בתוך המשחק
        // לדוגמה, ליצור לוח תוצאות קטן
    });

    socket.on('endmemory', data => {
        const { winnerId, winnerName } = data;

        let displayMessage = '';
        if (winnerId === myId) {
            const localPlayerName = localStorage.getItem('playerName');
            displayMessage = `You win, ${localPlayerName}! 🎉`;
        } else if (winnerName === "It's a Tie!") {
            displayMessage = "It's a Tie! No single winner. 🤝";
        } else {
            displayMessage = `The winner is ${winnerName || winnerId}! 🎉`;
        }

        winnerMessageElement.textContent = displayMessage;
        gameOverModal.classList.add('show');
    });

    function renderBoard(shuffled) {
        board.innerHTML = '';
        shuffled.forEach((emoji, index) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.index = index;
            card.dataset.emoji = emoji;
            // אם הקלף כבר נמצא, הצג אותו פתוח
            if (matched.includes(index)) {
                card.innerText = emoji;
                card.classList.add('matched'); // אופציונלי: סמן קלפים תואמים
            } else {
                card.innerText = '❓';
            }

            card.addEventListener('click', () => {
                if (!myTurn || matched.includes(index) || lockBoard) return;
                socket.emit('flip', index);
            });

            board.appendChild(card);
        });
    }

    function highlightTurn(isMine) {
        document.body.style.backgroundColor = isMine ? '#ddffdd' : '#ffdddd';
    }

    // טיפול בכפתורי המודאל (אותו דבר כמו קודם)
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            // השרת יטפל באיפוס הסשן או יצירת חדש
            // נחזור לדף בחירת סשנים כדי לבחור או ליצור סשן חדש
            window.location.href = `session-selection.html?game=${urlParams.get('game')}`;
        });
    }

    if (backToHomeButton) {
        backToHomeButton.addEventListener('click', () => {
            window.location.href = '../main.html'; // חזרה לדף הבית הראשי
        });
    }

    // אם השחקן כבר בסשן (מגיע מריענון לדוגמה), בקש מהשרת את מצב הסשן הנוכחי
    // אם לא נשלח gameStart בהתחלה (כי אולי הסשן כבר התחיל)
    socket.emit('requestSessionState', { sessionId: sessionId });
    socket.on('currentSessionState', (sessionState) => {
        if (sessionState) {
            myId = socket.id;
            matched = sessionState.matched;
            renderBoard(sessionState.board);
            myTurn = (sessionState.turn === myId);
            highlightTurn(myTurn);
            console.log(`Received current session state for ${sessionId}. My turn: ${myTurn}`);
        } else {
            alert('Could not load session state. It might have ended or been removed.');
            window.location.href = '../main.html';
        }
    });

}); // סוף DOMContentLoaded