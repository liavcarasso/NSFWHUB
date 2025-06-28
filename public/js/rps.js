document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    const socket = io();

    const modal = document.getElementById('endGameModal');
    const modalResultText = document.getElementById('modalResultText');
    const backToHomeButton = document.getElementById('backToHomeButton');

    backToHomeButton.addEventListener('click', () => {
        window.location.href = '../main.html';
    });


    const board = document.getElementById('rps-board');
    const readyButton = document.createElement('button');
    readyButton.id = 'ready-button';
    readyButton.innerText = 'im ready!';
    readyButton.style.display = 'none';
    document.body.appendChild(readyButton);

    const rpsemoji = [
        '✊','✋','✌️'
    ]
    let lockBoard = false;
    let myId = null;
    let choose = 0;

    if (!sessionId) {
        alert('Missing session ID. Returning to home.');
        window.location.href = '../main.html';
        return;
    }

    socket.emit('joinSession', { sessionId });

    socket.on('sessionJoined', (data) => {
        console.log('✅ Joined session:', data.sessionId);
        myId = socket.id;
        readyButton.style.display = 'block';
    });

    readyButton.addEventListener('click', () => {
        socket.emit('playerReady');
        readyButton.style.backgroundColor = 'gray';
        readyButton.style.cursor = 'not-allowed';
        console.log('sent ready to server');
    });

    socket.on('gameStart', (sessionState) => {
        console.log('🎉 Game is starting!');
        if (readyButton.style.display !== 'none') {
            readyButton.style.display = 'none';
        }
        renderBoard();
    });

    socket.on('endrps', ({ winnerId }) => {
        lockBoard = true;
        let resultMessage = '';
        if (winnerId === socket.id) {
            resultMessage = '🎉 You Won! 🎉';
        } else if (winnerId === null) {
            resultMessage = '🤝 It\'s a Tie! 🤝';
        } else {
            resultMessage = '😢 You Lost 😢';
        }
        modalResultText.textContent = resultMessage;
        modal.classList.add('show');
    });

    function renderBoard() {
        board.innerHTML = '';
        rpsemoji.forEach((emoji, index) => {
          const card_rps = document.createElement('div');
          card_rps.className = 'card_rps';
          card_rps.dataset.index = index;
          card_rps.dataset.emoji = emoji;
          card_rps.innerText = emoji;

          card_rps.addEventListener('click', () => {
            if (lockBoard) return;
            socket.emit('rpsClick', index , socket.id);
            board.children[choose].style.backgroundColor = '#eee';
            card_rps.style.backgroundColor = '#8e8c8c';
            choose = index;
          });

          board.appendChild(card_rps);
        });
    }
});