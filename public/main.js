// public/main.js
document.addEventListener('DOMContentLoaded', () => {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const gameSelectionScreen = document.getElementById('gameSelectionScreen');
    const nameForm = document.getElementById('nameForm');
    const playerNameInput = document.getElementById('playerNameInput'); // שינינו את ה-ID כאן
    const welcomePlayerText = document.getElementById('welcomePlayerText');
    const gameButtons = document.querySelectorAll('.play-game-button');
    const changeNameButton = document.getElementById('changeNameButton');

    // פונקציה להצגת מסך הכניסה ולהסתרת מסך בחירת המשחקים
    function showWelcomeScreen() {
        welcomeScreen.style.display = 'block';
        gameSelectionScreen.style.display = 'none';
        playerNameInput.value = ''; // נקה את שדה השם
        localStorage.removeItem('playerName'); // נקה את השם מ-localStorage
    }

    // פונקציה להצגת מסך בחירת המשחקים ולהסתרת מסך הכניסה
    function showGameSelectionScreen(playerName) {
        welcomeScreen.style.display = 'none';
        gameSelectionScreen.style.display = 'block';
        welcomePlayerText.textContent = `Hello, ${playerName}!`;
    }

    // בדוק אם שם השחקן כבר קיים ב-localStorage
    const storedPlayerName = localStorage.getItem('playerName');
    if (storedPlayerName) {
        // אם השם קיים, הצג ישירות את מסך בחירת המשחקים
        showGameSelectionScreen(storedPlayerName);
    } else {
        // אחרת, הצג את מסך הכניסה
        showWelcomeScreen();
    }

    // טיפול בשליחת טופס השם
    if (nameForm) {
        nameForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const playerName = playerNameInput.value.trim();

            if (playerName) {
                localStorage.setItem('playerName', playerName);
                console.log(`Player name saved: ${playerName}`);
                showGameSelectionScreen(playerName);
            } else {
                alert('Please enter your name to start!');
            }
        });
    }

    // טיפול בלחיצה על כפתורי המשחקים
    gameButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const gameType = event.target.dataset.gameType; // נשתמש ב-data-game-type
            if (gameType) {
                // מפנים לדף בחירת סשנים, ומעבירים את gameType כפרמטר ב-URL
                window.location.href = `session-selection.html?game=${gameType}`;
            }
        });
    });

    if (changeNameButton) {
        changeNameButton.addEventListener('click', () => {
            showWelcomeScreen();
        });
    }
});