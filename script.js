document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('score');
    const highScoreDisplay = document.getElementById('highScore');
    const livesDisplay = document.getElementById('lives');
    const gameOverScreen = document.getElementById('gameOverScreen'); // Diperbarui
    // gameOverText dan restartButton akan diakses melalui gameOverScreen jika perlu
    const restartButton = document.getElementById('restartButton');


    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Atur ulang posisi player jika diperlukan saat resize, terutama jika game sedang berjalan
        if (!gameOver) {
            playerX = Math.max(0, Math.min(playerX, canvas.width - playerSize));
            // playerY dihitung ulang di gameLoop berdasarkan canvas.height yang baru
        }
    }

    // Player
    const playerSize = canvas.height * 0.03 > 20 ? canvas.height * 0.03 : 20; // Ukuran player sedikit responsif
    let playerX = canvas.width / 2 - playerSize / 2;
    let playerY = canvas.height - playerSize - 10; // Akan diupdate di gameLoop
    let playerVelocityX = 0;
    const playerSpeed = 7; // Bisa disesuaikan

    // Obstacles
    let obstacleRadius = canvas.height * 0.015 > 10 ? canvas.height * 0.015 : 10; // Ukuran rintangan sedikit responsif
    let obstacleSpeed = canvas.height * 0.003 > 2 ? canvas.height * 0.003 : 2; // Kecepatan rintangan disesuaikan dengan tinggi layar
    const obstacleSpawnInterval = 1000; // ms (lebih cepat sedikit)
    let obstacles = [];

    // Game State
    let score = 0;
    let highScore = localStorage.getItem('highScorePro') || 0; // Ganti key localStorage jika ada versi lama
    let lives = 5;
    let gameOver = false;
    let lastObstacleSpawnTime = 0;
    let animationFrameId;
    let isPointerDown = false; // Untuk melacak status sentuhan/klik

    highScoreDisplay.textContent = `Skor Tertinggi: ${highScore}`;

    function updateGameElementSizesAndSpeeds() {
        // Player
        // playerSize sudah diinisialisasi dengan nilai responsif,
        // playerY akan diupdate terus di gameLoop.

        // Obstacles
        obstacleRadius = canvas.height * 0.015 > 10 ? canvas.height * 0.015 : 10;
        obstacleSpeed = canvas.height * 0.003 > 2 ? canvas.height * 0.003 : 2;
    }


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
        playerY = canvas.height - playerSize - 10; // Pastikan player tetap di bawah

        if (playerX < 0) {
            playerX = 0;
            // playerVelocityX = 0; // Opsional: hentikan jika mentok
        }
        if (playerX + playerSize > canvas.width) {
            playerX = canvas.width - playerSize;
            // playerVelocityX = 0; // Opsional: hentikan jika mentok
        }
    }

    function updateObstacles() {
        const currentTime = Date.now();
        if (!gameOver && currentTime - lastObstacleSpawnTime > obstacleSpawnInterval) {
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
        if (gameOver) return;
        obstacles.forEach((obstacle, index) => {
            // Deteksi tabrakan antara persegi (player) dan lingkaran (obstacle)
            const closestX = Math.max(playerX, Math.min(obstacle.x, playerX + playerSize));
            const closestY = Math.max(playerY, Math.min(obstacle.y, playerY + playerSize));

            const distanceX = obstacle.x - closestX;
            const distanceY = obstacle.y - closestY;
            const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

            if (distanceSquared < (obstacleRadius * obstacleRadius)) {
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
        isPointerDown = false; // Pastikan pointer tidak dianggap aktif
        playerVelocityX = 0; // Hentikan player
        cancelAnimationFrame(animationFrameId);
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('highScorePro', highScore);
            highScoreDisplay.textContent = `Skor Tertinggi: ${highScore}`;
        }
        gameOverScreen.style.display = 'flex'; // Tampilkan game over screen
    }

    function resetGame() { // Dulu bernama restartGame
        score = 0;
        lives = 5;
        obstacles = [];
        playerX = canvas.width / 2 - playerSize / 2;
        playerVelocityX = 0;
        isPointerDown = false;
        gameOver = false;
        lastObstacleSpawnTime = Date.now(); // Reset waktu spawn

        scoreDisplay.textContent = `Skor: ${score}`;
        livesDisplay.textContent = `Nyawa: ${lives}`;
        gameOverScreen.style.display = 'none'; // Sembunyikan game over screen

        updateGameElementSizesAndSpeeds(); // Update ukuran elemen jika canvas size berubah
        gameLoop();
    }

    function gameLoop() {
        if (gameOver) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        updatePlayerPosition();
        updateObstacles();
        checkCollision(); // Harus setelah update posisi

        drawPlayer();
        drawObstacles();

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- KONTROL PLAYER BARU ---
    function handlePointerDown(event) {
        event.preventDefault();
        if (gameOver) return;
        isPointerDown = true;
        processPointerMove(event); // Langsung proses posisi awal
    }

    function handlePointerMove(event) {
        event.preventDefault();
        if (gameOver || !isPointerDown) return;
        processPointerMove(event);
    }

    function handlePointerUp(event) {
        event.preventDefault();
        if (gameOver) return; // Jangan hentikan player jika game sudah over sebelum pointer up
        isPointerDown = false;
        playerVelocityX = 0; // Hentikan player
    }

    function processPointerMove(event) {
        const rect = canvas.getBoundingClientRect();
        let pointerX;
        if (event.touches && event.touches.length > 0) {
            pointerX = event.touches[0].clientX - rect.left;
        } else {
            pointerX = event.clientX - rect.left;
        }

        if (pointerX < canvas.width / 2) {
            playerVelocityX = -playerSpeed; // Bergerak ke kiri
        } else {
            playerVelocityX = playerSpeed; // Bergerak ke kanan
        }
    }

    // Event Listeners
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });

    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });

    canvas.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('touchend', handlePointerUp);
    canvas.addEventListener('touchcancel', handlePointerUp); // Jika sentuhan dibatalkan
    canvas.addEventListener('mouseleave', handlePointerUp); // Jika mouse keluar dari canvas saat ditekan


    // Resize listener
    window.addEventListener('resize', () => {
        resizeCanvas();
        updateGameElementSizesAndSpeeds(); // Update ukuran elemen berdasarkan ukuran canvas baru
        // Jika game sedang berjalan, redraw
        if (!gameOver) {
            // Hapus rintangan yang mungkin di luar batas setelah resize
            obstacles = obstacles.filter(obs => obs.y < canvas.height + obs.radius * 2 && obs.x > -obs.radius*2 && obs.x < canvas.width + obs.radius*2 );
            // Mungkin perlu redraw manual sekali di sini atau biarkan gameLoop berikutnya yang handle
            playerY = canvas.height - playerSize - 10; // Recalculate playerY
        } else {
            // Jika game over, pastikan tombol dan teks tetap terlihat baik
            // (CSS clamp dan flexbox sudah membantu di sini)
        }
    });

    restartButton.addEventListener('click', resetGame);

    // Inisialisasi awal
    resizeCanvas(); // Panggil sekali untuk set ukuran awal
    updateGameElementSizesAndSpeeds();
    resetGame(); // Mulai game (ini akan memanggil gameLoop)
    // gameLoop(); // Tidak perlu dipanggil lagi karena resetGame sudah memanggilnya
});
