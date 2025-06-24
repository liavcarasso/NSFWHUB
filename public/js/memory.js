// public/js/memory.js

document.addEventListener('DOMContentLoaded', () => { // הוסף את זה
    const socket = io('https://nsfwhub-ktdb.onrender.com');
    const board = document.getElementById('game-board');
    let myId = null;
    let players = [];
    let myTurn = false;
    let matched = [];
    let lockBoard = false;
    const gameOverModal = document.getElementById('gameOverModal');
    const winnerMessageElement = document.getElementById('winnerMessage');
    const restartButton = document.getElementById('restartButton'); // הוסף הפניות לכפתורים
    const backToHomeButton = document.getElementById('backToHomeButton'); // הוסף הפניות לכפתורים
    const playerName = localStorage.getItem('playerName');

    socket.on('init', (state) => {
        myId = state.yourId;
        players = state.players;
        matched = state.matched;
        renderBoard(state.board);
        myTurn = (players[state.turn] === myId);
        highlightTurn(myTurn);
    });

    socket.on('flip', index => {
        const card = board.children[index];
        card.innerText = card.dataset.emoji;
    });

    socket.on('match', indexes => {
        matched.push(...indexes);
    });

    socket.on('nextTurn', turnIndex => {
        myTurn = (players[turnIndex] === myId);
        highlightTurn(myTurn);
    });

    function renderBoard(shuffled) {
        board.innerHTML = '';
        shuffled.forEach((emoji, index) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.index = index;
            card.dataset.emoji = emoji;
            card.innerText = '❓';

            card.addEventListener('click', () => {
                if (!myTurn || matched.includes(index) || lockBoard) return; // הוסף lockBoard לבדיקה
                socket.emit('flip', index);
            });

            board.appendChild(card);
        });
    }

    socket.on('unflip', () => {
        const cards = document.querySelectorAll('.card');
        for (const card of cards) {
            const i = parseInt(card.dataset.index);
            if (!matched.includes(i)) {
                card.innerText = '❓';
            }
        }
    });

    socket.on('endmemory', data => {
        const { winnerId, winnerName } = data; // winnerName צריך להגיע מהשרת

        let displayMessage = '';

        if (winnerId === myId) {
            displayMessage = `The winner is ${playerName}! 🎉`;
        } else {
            displayMessage = `The winner is ${winnerName || winnerId}! 🎉`; // fallback ל-winnerId אם winnerName לא קיים
        }

        winnerMessageElement.textContent = displayMessage;
        gameOverModal.classList.add('show');
    });

    function highlightTurn(isMine) {
        document.body.style.backgroundColor = isMine ? '#ddffdd' : '#ffdddd';
    }

    if (restartButton) {
        restartButton.addEventListener('click', () => {
            // רענן את העמוד כדי להתחיל משחק חדש (יש איפוס בשרת)
            location.reload();
            // hideGameOverModal(); // אם תהיה לך פונקציה כזו
        });
    }

    if (backToHomeButton) {
        backToHomeButton.addEventListener('click', () => {
            window.location.href = '../main.html'; // חזרה לדף הבית שלך
            // hideGameOverModal(); // אם תהיה לך פונקציה כזו
        });
    }

    // פונקציית הסתרה אם אתה צריך אותה:
    // function hideGameOverModal() {
    //     gameOverModal.classList.remove('show');
    //     setTimeout(() => {
    //         gameOverModal.style.display = 'none';
    //     }, 300);
    // }

}); // סיום ה-DOMContentLoaded event listener