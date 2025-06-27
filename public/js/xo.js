document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('xo-board');
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('sessionId');
  const socket = io();

  let myTurn = false;
  let lockBoard = false;
  let placed = [];

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
    renderBoard(sessionState.board);
    myTurn = (sessionState.turn === socket.id);
    highlightTurn(myTurn);
  });

  socket.on('nextTurn', turnId => {
    myTurn = (turnId === socket.id);
    highlightTurn(myTurn);
  });

  socket.on('xoRerender', (index, emoji) => {
    placed.push(index)
    const card = board.children[index];
    if (card) card.innerText = emoji;
  });

  socket.on('endXo', ({ winnerId }) => {
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

  function renderBoard(xob) {
    board.innerHTML = '';
    xob.forEach((emoji, index) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.index = index;
      card.dataset.emoji = emoji;
      card.innerText = emoji;

      card.addEventListener('click', () => {
        if (!myTurn || lockBoard || placed.includes(index)) return;
        socket.emit('clickCardXo', index, socket.id);
      });

      board.appendChild(card);
    });
  }

  function highlightTurn(isMine) {
    document.body.style.backgroundColor = isMine ? '#ddffdd' : '#ffdddd';
  }
});