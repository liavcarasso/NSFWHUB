document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    const socket = io();

    const board = document.getElementById('rps-board');
    const readyButton = document.createElement('button');
    readyButton.id = 'ready-button';
    readyButton.innerText = 'im ready!';
    readyButton.style.display = 'none';
    document.body.appendChild(readyButton);

    const rpsemoji = [
        '✊',
        '✋',
        '✌️'
    ]
    let lockBoard = false;

    let myId = null;


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
        let msg
        if (winnerId === socket.id)
            msg = 'you won'
        else if (winnerId === null)
            msg = 'tie'
        else
            msg = 'you lost'
        alert(msg);
        window.location.href = '../main.html';
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
          });

          board.appendChild(card_rps);
        });
    }
});