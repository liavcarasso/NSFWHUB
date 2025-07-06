document.addEventListener('DOMContentLoaded', () => {
    const wordBoard = document.getElementById('hmword-board');
    const exBoard = document.getElementById('hmex-board');
    const guessBoard = document.getElementById('hmguess-board');
    const hostBoard = document.getElementById('hmhost-board');
    const wordInput = document.getElementById('hmword-input');
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    const socket = io();

    const boardexemoji = ['❌','❌','❌','❌','❌']

    let myId = null;
    let myTurn = false;
    let guessed = [];
    let fails = 0;
    let lockBoard = false;
    let host = false;

    const modal = document.getElementById('endGameModal');
    const modalResultText = document.getElementById('modalResultText');
    const backToHomeButton = document.getElementById('backToHomeButton');

    backToHomeButton.addEventListener('click', () => {
        window.location.href = '../main.html';
    });

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
        if (sessionState.host === socket.id){
            host = true;
            hostWordChoose()
        }
    });

    socket.on('gameStartHm', (sessionState) => {
        renderBoard(sessionState.board, sessionState.latters);
        if (!host){
            myTurn = (sessionState.turn === socket.id);
            highlightTurn(myTurn);
        }
    });

    socket.on('guessHm', (indexes , isTrue, guessedLetters) => {
        const allLetterCards = Array.from(guessBoard.children);

        guessedLetters.forEach(letter => {
            const targetCard = allLetterCards.find(card => card.dataset.word === letter);
            if (targetCard) {

                const guessIndex = parseInt(targetCard.dataset.index, 10);
                if (!guessed.includes(guessIndex)) {
                    guessed.push(guessIndex);
                    targetCard.classList.add('guessed');
                }
            }
        });

        if (isTrue) {
            indexes.forEach((index) => {
                const card = wordBoard.children[index];
                if (card){
                    card.classList.add('revealed');
                    setTimeout(() => {
                        card.innerText = card.dataset.word;
                    }, 200);
                }
            })
        }
        else {
            fails++;
            const card = exBoard.children[(fails-1)];
            if (card) card.innerText = card.dataset.emoji;
        }
    })

    socket.on('nextTurn', turnId => {
        if (!host){
            myTurn = (turnId === socket.id);
            highlightTurn(myTurn);
        }
    });

    socket.on('endHm', (winner) => {
        lockBoard = true;
        let resultMessage = '';
        console.log("my id:" + socket.id + "message:",winner);
        if (winner === "!host" && !host || winner === socket.id) {
            resultMessage = '🎉 You Won! 🎉';
        } else {
            resultMessage = '😢 You Lost 😢';
        }
        modalResultText.textContent = resultMessage;
        modal.classList.add('show');
    });

    function hostWordChoose(){
        hostBoard.classList.toggle('visible');
        wordInput.style.display = 'block';  // 👈 זה מוסיף את שדה הקלט!
        wordInput.addEventListener('input', (event) => {
            const currentText = event.target.value;
            renderCards(currentText);
        });

        wordInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                const submittedWord = wordInput.value;
                hostBoard.classList.toggle('visible');
                wordInput.style.display = 'none';
                socket.emit('hmEnter', submittedWord);
            }
        });
    }


    function renderCards(text) {
        hostBoard.innerHTML = '';
        const letters = text.split('');
        letters.forEach(letter => {
            if (letter.trim() === '') {
                return;
            }
            const card = document.createElement('div');
            card.className = 'card_letter';
            card.innerText = letter.toUpperCase();
            hostBoard.appendChild(card);
        });
    }


    function renderBoard(board1, board2) {
        wordBoard.innerHTML = '';
        board1.forEach((word, index) => {
            const card = document.createElement('div');
            card.className = 'hm-card';
            card.dataset.index = index;
            card.dataset.word = word;
            card.innerText = '❓';

            wordBoard.appendChild(card);
        });

        exBoard.innerHTML = '';
        boardexemoji.forEach((emoji, index) => {
            const card = document.createElement('div');
            card.className = 'hm-card';
            card.dataset.index = index;
            card.dataset.emoji = emoji;
            card.innerText = '';

            exBoard.appendChild(card);
        });

        guessBoard.innerHTML = '';
        board2.forEach((word, index) => {
            const card = document.createElement('div');
            card.className = 'hm-card';
            card.dataset.index = index;
            card.dataset.word = word;
            card.innerText = word;

            card.addEventListener('click', () => {
            if (!myTurn || lockBoard || guessed.includes(index)) return;
                guessed.push(word);
                card.classList.add('guessed');
                socket.emit('hmGuessClick', index);
            });

            guessBoard.appendChild(card);
        });
    }

    function highlightTurn(isMine) {
        const status = document.getElementById('status');
        if (isMine) {
            document.body.classList.add('my-turn');
            document.body.classList.remove('opponent-turn');
            status.textContent = "Your Turn!";
        } else {
            document.body.classList.add('opponent-turn');
            document.body.classList.remove('my-turn');
            status.textContent = "Opponent's Turn...";
        }
    }
});