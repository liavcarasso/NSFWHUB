// public/js/memory.js (פשוט, ברור ומתאים לשרת החדש)
document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('game-board');
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('sessionId');
  const socket = io();

  let myId = null;
  let myTurn = false;
  let matched = [];
  let lockBoard = false;

  const readyButton = document.createElement('button');
  readyButton.id = 'ready-button';
  readyButton.innerText = 'im ready!';
  readyButton.style.display = 'none';
  document.body.appendChild(readyButton);

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
    matched = sessionState.matched;
    renderBoard(sessionState.board);
    myTurn = (sessionState.turn === socket.id);
    highlightTurn(myTurn);
  });

  socket.on('flip', index => {
    const card = board.children[index];
    if (card) card.innerText = card.dataset.emoji;
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
    myTurn = (turnId === socket.id);
    highlightTurn(myTurn);
  });

  socket.on('endmemory', ({ winnerId }) => {
    const msg = winnerId === socket.id ? '🎉 You won!' : '😢 You lost.';
    alert(msg);
    window.location.href = '../main.html';
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
        if (!myTurn || lockBoard || matched.includes(index)) return;
        socket.emit('flip', index);
      });

      board.appendChild(card);
    });
  }

  function highlightTurn(isMine) {
    document.body.style.backgroundColor = isMine ? '#ddffdd' : '#ffdddd';
  }
});