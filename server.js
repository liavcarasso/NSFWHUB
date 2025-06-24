// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public', { index: 'main.html' }));

let game = {
  board: [],
  players: [],
  points: [],
  turn: 0,
  matched: [],
  flipped: []
};

function generateBoard() {
  const emojis = ['🐶','🍕','🚗','🎈','🐱','🌈','⚽','🎮'];
  return [...emojis, ...emojis].sort(() => 0.5 - Math.random());
}

io.on('connection', socket => {
  console.log('Player connected:', socket.id);
  game.players.push(socket.id);
  game.points.push(0);

  // Create board if it's the first player
  if (game.board.length === 0) {
    game.board = generateBoard();
  }

  socket.emit('init', {
    board: game.board,
    matched: game.matched,
    turn: game.turn,
    yourId: socket.id,
    players: game.players
  });

  socket.broadcast.emit('playerJoined', game.players);

  socket.on('flip', index => {
    if (socket.id !== game.players[game.turn]) return;
    if (game.flipped.includes(index) || game.matched.includes(index)) return;
    if (game.flipped.length >= 2) return;

    game.flipped.push(index);
    io.emit('flip', index);

    if (game.flipped.length === 2) {
      const [i1, i2] = game.flipped;
      const e1 = game.board[i1];
      const e2 = game.board[i2];

      if (e1 === e2) {
        game.matched.push(i1, i2);
        game.points[game.turn] += 1;
        io.emit('match', [i1, i2]);

        if (game.matched.length === game.board.length) {
          let winnerIndex = 0;
          if (game.points.length > 1) {
            for (let i = 1; i < game.points.length; i++){
                if (game.points[i] > game.points[winnerIndex]) {
                  winnerIndex = i;
                } else if (game.points[i] === game.points[winnerIndex] && i !== winnerIndex) {
                    // tie . need to code...
                }
            }
          }
          let winnerId = game.players[winnerIndex];
          io.emit('endmemory', { winnerId: winnerId, winnerName: "other player" });
          console.log("game ended")
          game = { board: [], players: [], points: [], turn: 0, matched: [], flipped: [] };
        }
      }

      setTimeout(() => {
        game.turn = (game.turn + 1) % game.players.length;
        console.log(game.turn)
        game.flipped = [];
        io.emit('unflip');
        io.emit('nextTurn', game.turn);
      }, 1000);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    game.players = game.players.filter(id => id !== socket.id);
    if (game.players.length === 0) {
       game = { board: [], players: [], points: [], turn: 0, matched: [], flipped: [] };
    }
  });
});

http.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
