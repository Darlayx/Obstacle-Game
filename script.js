document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const hpDisplay = document.getElementById('hpDisplay');
    const scoreDisplay = document.getElementById('scoreDisplay');

    const startScreen = document.getElementById('startScreen');
    const startButton = document.getElementById('startButton');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const finalScoreText = document.getElementById('finalScoreText');
    const restartButton = document.getElementById('restartButton');

    const playerBaseColor = '#6272a4';
    const playerDamageColor = '#ff5555';

    let playerSize, playerX, playerY, playerVelocityX, playerHP;
    const playerSpeed = 8;
    let playerDamageFlashTimer = 0;
    const PLAYER_DAMAGE_FLASH_DURATION = 10;

    const obstacleTypes = [
        { shape: 'circle', sides: 0, damage: 3, color: '#f1fa8c', baseRotSpeed: 0.01 },
        { shape: 'triangle', sides: 3, damage: 6, color: '#ffb86c', baseRotSpeed: -0.015 },
        { shape: 'square', sides: 4, damage: 10, color: '#ff79c6', baseRotSpeed: 0.02 },
        { shape: 'pentagon', sides: 5, damage: 15, color: '#bd93f9', baseRotSpeed: -0.025 },
        { shape: 'hexagon', sides: 6, damage: 20, color: '#ff5555', baseRotSpeed: 0.03 }
    ];
    let obstacles = [];

    let score = 0;
    let highScore = localStorage.getItem('obstacleEvaderHighScore') || 0;
    let gameOver = true;
    let animationFrameId;
    let isPointerDown = false;

    const initialMinSpawnInterval = 750;
    const initialMaxSpawnInterval = 1500;
    const initialMinSpeedBase = 1;
    const initialMaxSpeedBase = 3;

    let currentMinSpawnInterval, currentMaxSpawnInterval;
    let currentMinSpeedBase, currentMaxSpeedBase;
    let speedMultiplier;

    let lastObstacleSpawnTime = 0;
    let nextSpawnDelay = 0;

    const multiplierInterval = 15000;
    let lastMultiplierTime = 0;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        playerSize = canvas.height * 0.035 > 20 ? canvas.height * 0.035 : 20;
        if (playerX === undefined || gameOver) { 
            playerX = canvas.width / 2 - playerSize / 2;
        } else {
             playerX = Math.max(0, Math.min(playerX, canvas.width - playerSize));
        }
        playerY = canvas.height - playerSize - 20;
    }

    function drawPlayer() {
        let currentColor = playerBaseColor;
        if (playerDamageFlashTimer > 0) {
            currentColor = (playerDamageFlashTimer % 4 < 2) ? playerDamageColor : playerBaseColor;
            playerDamageFlashTimer--;
        }
        ctx.fillStyle = currentColor;
        ctx.fillRect(playerX, playerY, playerSize, playerSize);
    }

    function drawPolygon(x, y, radius, sides, color, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        if (sides === 0) {
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
        } else {
            ctx.moveTo(radius, 0);
            for (let i = 1; i < sides; i++) {
                ctx.lineTo(radius * Math.cos(i * 2 * Math.PI / sides),
                           radius * Math.sin(i * 2 * Math.PI / sides));
            }
            ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
    }

    function drawObstacles() {
        obstacles.forEach(obstacle => {
            drawPolygon(obstacle.x, obstacle.y, obstacle.radius, obstacle.type.sides, obstacle.type.color, obstacle.angle);
        });
    }

    function updatePlayerPosition() {
        if (gameOver) return;
        playerX += playerVelocityX;
        playerY = canvas.height - playerSize - 20;

        if (playerX < 0) playerX = 0;
        if (playerX + playerSize > canvas.width) playerX = canvas.width - playerSize;
    }

    function spawnObstacle() {
        if (gameOver) return; // Jangan spawn jika game over
        const currentTime = Date.now();
        if (currentTime - lastObstacleSpawnTime > nextSpawnDelay) {
            const typeIndex = Math.floor(Math.random() * obstacleTypes.length);
            const type = obstacleTypes[typeIndex];
            const radius = canvas.width * 0.02 + Math.random() * (canvas.width * 0.015);
            const x = Math.random() * (canvas.width - radius * 2) + radius;
            const speed = (Math.random() * (currentMaxSpeedBase - currentMinSpeedBase) + currentMinSpeedBase) * speedMultiplier;
            
            obstacles.push({
                x: x, y: -radius, radius: radius, type: type, speed: speed,
                angle: Math.random() * Math.PI * 2,
                rotationSpeed: type.baseRotSpeed * (Math.random() * 0.5 + 0.75)
            });
            lastObstacleSpawnTime = currentTime;
            nextSpawnDelay = Math.random() * (currentMaxSpawnInterval - currentMinSpawnInterval) + currentMinSpawnInterval;
        }
    }

    function updateObstacles() {
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.y += obs.speed;
            obs.angle += obs.rotationSpeed;

            if (obs.y - obs.radius > canvas.height) {
                obstacles.splice(i, 1);
                if (!gameOver) {
                    score += 10;
                    scoreDisplay.textContent = `Skor: ${score}`;
                }
            }
        }
    }

    function checkCollision() {
        if (gameOver) return;
        obstacles.forEach((obstacle, index) => {
            const playerCenterX = playerX + playerSize / 2;
            const playerCenterY = playerY + playerSize / 2;
            const distDX = playerCenterX - obstacle.x;
            const distDY = playerCenterY - obstacle.y;
            const distance = Math.sqrt(distDX * distDX + distDY * distDY);

            if (distance < obstacle.radius + playerSize / 2 * 0.8) {
                obstacles.splice(index, 1);
                playerHP -= obstacle.type.damage;
                hpDisplay.textContent = `HP: ${playerHP}`;
                playerDamageFlashTimer = PLAYER_DAMAGE_FLASH_DURATION;

                if (playerHP <= 0) {
                    playerHP = 0;
                    hpDisplay.textContent = `HP: ${playerHP}`;
                    triggerEndGame();
                }
            }
        });
    }
    
    function applyMultiplier() {
        if (gameOver) return; // Jangan terapkan jika game over
        const currentTime = Date.now();
        if (currentTime - lastMultiplierTime > multiplierInterval) {
            currentMinSpawnInterval = Math.max(50, currentMinSpawnInterval / 1.1);
            currentMaxSpawnInterval = Math.max(100, currentMaxSpawnInterval / 1.11);
            if (currentMinSpawnInterval >= currentMaxSpawnInterval) currentMaxSpawnInterval = currentMinSpawnInterval + 50;

            speedMultiplier *= 1.075;
            lastMultiplierTime = currentTime;
        }
    }

    function triggerEndGame() {
        gameOver = true;
        isPointerDown = false;
        playerVelocityX = 0;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null; // Reset ID
        }
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('obstacleEvaderHighScore', highScore);
        }
        finalScoreText.textContent = `Skor Akhir: ${score}`;
        startScreen.style.display = 'none'; // Pastikan start screen tersembunyi
        gameOverScreen.style.display = 'flex'; // Tampilkan game over
    }

    function resetGame() {
        playerHP = 100;
        score = 0;
        obstacles = [];
        
        // Panggil resizeCanvas untuk posisi player yang benar berdasarkan ukuran layar saat ini
        // playerX dan playerY akan diatur ulang di dalam resizeCanvas jika gameOver true
        // atau jika playerX undefined, yang akan terjadi pada pemanggilan pertama resetGame.
        // resizeCanvas(); // Tidak perlu eksplisit di sini jika startGame memanggilnya atau sudah dipanggil

        playerVelocityX = 0;
        playerDamageFlashTimer = 0;
        isPointerDown = false;

        hpDisplay.textContent = `HP: ${playerHP}`;
        scoreDisplay.textContent = `Skor: ${score}`;

        currentMinSpawnInterval = initialMinSpawnInterval;
        currentMaxSpawnInterval = initialMaxSpawnInterval;
        currentMinSpeedBase = initialMinSpeedBase;
        currentMaxSpeedBase = initialMaxSpeedBase;
        speedMultiplier = 1.0;

        lastObstacleSpawnTime = Date.now();
        nextSpawnDelay = Math.random() * (currentMaxSpawnInterval - currentMinSpawnInterval) + currentMinSpawnInterval;
        lastMultiplierTime = Date.now();
    }

    function startGame() {
        // Pastikan kontrol dan state bersih sebelum mulai
        isPointerDown = false;
        playerVelocityX = 0;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
        
        gameOver = false; // Set game state menjadi tidak game over
        resizeCanvas(); // Atur ukuran canvas & posisi awal player
        resetGame(); // Reset semua variabel game ke kondisi awal
        
        // Pastikan lastMultiplierTime diset ke waktu sekarang agar tidak langsung trigger multiplier
        lastMultiplierTime = Date.now();
        lastObstacleSpawnTime = Date.now(); // Juga untuk spawn awal
        nextSpawnDelay = Math.random() * (currentMaxSpawnInterval - currentMinSpawnInterval) + currentMinSpawnInterval;


        gameLoop(); // Mulai game loop
    }

    function gameLoop() {
        if (gameOver) {
            // Jika game over dipanggil di tengah loop (misal dari checkCollision),
            // pastikan loop berhenti dan tidak request frame baru.
            if (animationFrameId) {
                 cancelAnimationFrame(animationFrameId);
                 animationFrameId = null;
            }
            return;
        }

        applyMultiplier(); // Terapkan multiplier jika waktunya
        spawnObstacle();   // Spawn rintangan baru
        updatePlayerPosition(); // Update posisi player
        updateObstacles();      // Update posisi semua rintangan
        checkCollision();       // Cek tabrakan

        ctx.clearRect(0, 0, canvas.width, canvas.height); // Bersihkan canvas
        drawObstacles();   // Gambar rintangan
        drawPlayer();      // Gambar player

        animationFrameId = requestAnimationFrame(gameLoop); // Lanjutkan loop
    }

    function handlePointerDown(event) {
        event.preventDefault();
        if (gameOver) return;
        isPointerDown = true;
        processPointerMove(event);
    }

    function handlePointerMove(event) {
        event.preventDefault();
        if (gameOver || !isPointerDown) return;
        processPointerMove(event);
    }

    function handlePointerUp(event) {
        event.preventDefault();
        isPointerDown = false;
        if (!gameOver) { // Hanya hentikan player jika game tidak sedang game over
            playerVelocityX = 0;
        }
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
            playerVelocityX = -playerSpeed;
        } else {
            playerVelocityX = playerSpeed;
        }
    }

    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('touchcancel', handlePointerUp);

    window.addEventListener('resize', () => {
        const wasGameOver = gameOver; // Simpan state gameOver sebelum resize
        resizeCanvas();
        // Jika game tidak sedang berjalan (misalnya di start/game over screen),
        // tidak perlu melakukan redraw game elements, cukup canvas size.
        if (!wasGameOver && !gameOver) { // Jika game sedang berjalan aktif
            // Mungkin perlu redraw atau biarkan gameLoop berikutnya
        }
    });

    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);

    // Inisialisasi awal tampilan
    resizeCanvas(); // Panggil resize untuk set ukuran awal canvas dan posisi player
    startScreen.style.display = 'flex';
    gameOverScreen.style.display = 'none';
    gameOver = true; // Set game over true agar loop tidak jalan sebelum start
});
