document.addEventListener('DOMContentLoaded', () => { // Pastikan DOM sudah siap
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('score');
    const highScoreDisplay = document.getElementById('highScore');
    const livesDisplay = document.getElementById('lives');
    const gameOverText = document.getElementById('gameOverText');
    const restartButton = document.getElementById('restartButton');

    let canvasWidth = Math.min(window.innerWidth * 0.9, 400);
    let canvasHeight = Math.min(window.innerHeight * 0.8, 600);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Player
    const playerSize = 20;
    let playerX = canvas.width / 2 - playerSize / 2;
    const playerY = canvas.height - playerSize - 10;
    let playerVelocityX = 0;
    const playerSpeed = 4;

    // Obstacles
    const obstacleRadius = 10;
    const obstacleSpeed = 2;
    const obstacleSpawnInterval = 1200; // ms
    let obstacles = [];

    // Game State
    let score = 0;
    let highScore = localStorage.getItem('highScore') || 0;
    let lives = 5;
    let gameOver = false;
    let lastObstacleSpawnTime = 0;
    let animationFrameId;

    highScoreDisplay.textContent = `Skor Tertinggi: ${highScore}`;

    function drawPlayer() {
        ctx.fillStyle = 'black';
        ctx.fillRect(playerX, playerY, playerSize, playerSize);
    }

    function drawObstacles() {
        ctx.fillStyle = 'red';
        obstacles.forEach(obstacle => {
            ctx.beginPath();
            ctx.arc(obstacle.x, obstacle.y, obstacleRadius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function updatePlayerPosition() {
        playerX += playerVelocityX;

        if (playerX < 0) {
            playerX = 0;
        }
        if (playerX + playerSize > canvas.width) {
            playerX = canvas.width - playerSize;
        }
    }

    function updateObstacles() {
        const currentTime = Date.now();
        if (currentTime - lastObstacleSpawnTime > obstacleSpawnInterval && !gameOver) {
            const x = Math.random() * (canvas.width - obstacleRadius * 2) + obstacleRadius;
            obstacles.push({ x: x, y: -obstacleRadius });
            lastObstacleSpawnTime = currentTime;
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].y += obstacleSpeed;

            if (obstacles[i].y - obstacleRadius > canvas.height) {
                obstacles.splice(i, 1);
                if (!gameOver) {
                    score++;
                    scoreDisplay.textContent = `Skor: ${score}`;
                }
            }
        }
    }

    function checkCollision() {
        obstacles.forEach((obstacle, index) => {
            const distX = Math.abs(obstacle.x - (playerX + playerSize / 2));
            const distY = Math.abs(obstacle.y - (playerY + playerSize / 2));

            if (distX < (playerSize / 2 + obstacleRadius) && distY < (playerSize / 2 + obstacleRadius)) {
                obstacles.splice(index, 1);
                lives--;
                livesDisplay.textContent = `Nyawa: ${lives}`;
                if (lives <= 0) {
                    endGame();
                }
            }
        });
    }

    function endGame() {
        gameOver = true;
        cancelAnimationFrame(animationFrameId);
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('highScore', highScore);
            highScoreDisplay.textContent = `Skor Tertinggi: ${highScore}`;
        }
        gameOverText.style.display = 'block';
        restartButton.style.display = 'block';
        playerVelocityX = 0;
    }

    function restartGame() {
        score = 0;
        lives = 5;
        obstacles = [];
        playerX = canvas.width / 2 - playerSize / 2;
        playerVelocityX = 0;
        gameOver = false;

        scoreDisplay.textContent = `Skor: ${score}`;
        livesDisplay.textContent = `Nyawa: ${lives}`;
        gameOverText.style.display = 'none';
        restartButton.style.display = 'none';

        gameLoop();
    }

    function gameLoop() {
        if (gameOver) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        updatePlayerPosition();
        updateObstacles();
        checkCollision();

        drawPlayer();
        drawObstacles();

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function handleStart(event) {
        if (gameOver) return;
        const touchX = event.touches ? event.touches[0].clientX : event.clientX;
        const rect = canvas.getBoundingClientRect();
        const clickX = touchX - rect.left;

        if (clickX < canvas.width / 2) {
            playerVelocityX = -playerSpeed;
        } else {
            playerVelocityX = playerSpeed;
        }
        event.preventDefault(); // Mencegah default behavior seperti seleksi teks atau zoom saat sentuh
    }


    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('touchstart', handleStart, { passive: false });


    window.addEventListener('resize', () => {
        canvasWidth = Math.min(window.innerWidth * 0.9, 400);
        canvasHeight = Math.min(window.innerHeight * 0.8, 600);
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        playerX = Math.max(0, Math.min(playerX, canvas.width - playerSize));
        obstacles = obstacles.filter(obs => obs.y < canvas.height);
        if (!gameOver) {
            drawPlayer();
            drawObstacles();
        }
    });

    restartButton.addEventListener('click', restartGame);

    gameLoop();
});

