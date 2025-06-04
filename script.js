document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const scoreDisplay = document.getElementById('scoreDisplay');
    const highScoreDisplay = document.getElementById('highScoreDisplay');
    const hpDisplay = document.getElementById('hpDisplay'); // Menggantikan livesDisplay
    const gameOverScreen = document.getElementById('gameOverScreen');
    const finalScoreText = document.getElementById('finalScoreText');
    const restartButton = document.getElementById('restartButton');

    // --- Konfigurasi Game ---
    const PLAYER_MAX_HP = 100;
    const OBSTACLE_SHAPES = [
        { name: 'lingkaran', sides: 0, damage: 3, color: '#f1c40f' }, // Kuning
        { name: 'segitiga', sides: 3, damage: 6, color: '#e67e22' }, // Oranye
        { name: 'segiempat', sides: 4, damage: 10, color: '#e74c3c' }, // Merah-Oranye
        { name: 'segilima', sides: 5, damage: 15, color: '#c0392b' }, // Merah
        { name: 'segienam', sides: 6, damage: 20, color: '#922b21' }  // Merah Tua
    ];

    const INITIAL_MIN_SPAWN_INTERVAL = 100; // ms
    const INITIAL_MAX_SPAWN_INTERVAL = 750; // ms
    const INITIAL_MIN_OBSTACLE_SPEED = 100; // unit kecepatan
    const INITIAL_MAX_OBSTACLE_SPEED = 1000; // unit kecepatan
    const SPEED_SCALE_FACTOR = 0.005; // Faktor untuk menyesuaikan unit kecepatan ke piksel/frame

    const MULTIPLIER_INTERVAL_SECONDS = 15; // Detik
    const SPAWN_INTERVAL_MULTIPLIER = 1.1;
    const SPEED_RANGE_MULTIPLIER = 0.75; // Sesuai permintaan (ini akan membuat rintangan lebih lambat)

    // --- Variabel Game State ---
    let playerSize, playerX, playerY, playerVelocityX, playerSpeed;
    let playerHP;
    let isPlayerHit = false;
    let playerHitFlashDuration = 0; // Durasi flash merah dalam frame
    const PLAYER_HIT_FLASH_FRAMES = 15; // Berapa lama player berkedip merah

    let obstacles = [];
    let baseObstacleSize;

    let score;
    let highScore = localStorage.getItem('obstacleGameProModernHS') || 0;
    let gameOver;
    let animationFrameId;

    let currentMinSpawnInterval, currentMaxSpawnInterval;
    let currentMinObstacleSpeed, currentMaxObstacleSpeed;
    let lastObstacleSpawnTime;
    let gameStartTime; // Untuk melacak waktu permainan untuk multiplier
    let lastMultiplierApplyTime;

    let isPointerDown = false;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initializeGameDimensions();
        if (!gameOver) {
            playerX = Math.max(0, Math.min(playerX, canvas.width - playerSize));
            playerY = canvas.height - playerSize - 20; // Sedikit lebih tinggi dari bawah
        }
    }

    function initializeGameDimensions() {
        playerSize = Math.max(25, canvas.height * 0.04);
        playerSpeed = Math.max(5, canvas.width * 0.006);
        baseObstacleSize = Math.max(12, canvas.height * 0.02);
    }

    // --- Fungsi Menggambar ---
    function drawPlayer() {
        if (isPlayerHit && playerHitFlashDuration > 0) {
            ctx.fillStyle = '#e74c3c'; // Warna merah saat kena damage
            playerHitFlashDuration--;
            if (playerHitFlashDuration === 0) {
                isPlayerHit = false;
            }
        } else {
            ctx.fillStyle = '#3498db'; // Warna biru modern untuk player
        }
        ctx.beginPath();
        // Menggambar player sebagai segitiga menghadap ke atas (lebih dinamis)
        ctx.moveTo(playerX + playerSize / 2, playerY);
        ctx.lineTo(playerX, playerY + playerSize);
        ctx.lineTo(playerX + playerSize, playerY + playerSize);
        ctx.closePath();
        ctx.fill();
    }

    function drawPolygon(x, y, radius, sides, angle, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
        for (let i = 1; i <= sides; i++) {
            ctx.lineTo(x + radius * Math.cos(angle + i * 2 * Math.PI / sides),
                       y + radius * Math.sin(angle + i * 2 * Math.PI / sides));
        }
        ctx.closePath();
        ctx.fill();
    }

    function drawObstacles() {
        obstacles.forEach(obstacle => {
            ctx.save();
            ctx.translate(obstacle.x, obstacle.y);
            ctx.rotate(obstacle.angle);

            if (obstacle.shape.sides === 0) { // Lingkaran
                ctx.fillStyle = obstacle.shape.color;
                ctx.beginPath();
                ctx.arc(0, 0, obstacle.size, 0, Math.PI * 2);
                ctx.fill();
            } else { // Poligon
                drawPolygon(0, 0, obstacle.size, obstacle.shape.sides, 0, obstacle.shape.color);
            }
            ctx.restore();
        });
    }

    // --- Fungsi Update Game Logic ---
    function updatePlayerPosition() {
        playerX += playerVelocityX;
        playerY = canvas.height - playerSize - 20; // Posisi Y tetap

        if (playerX < 0) playerX = 0;
        if (playerX + playerSize > canvas.width) playerX = canvas.width - playerSize;
    }

    function spawnObstacle() {
        const randomShapeIndex = Math.floor(Math.random() * OBSTACLE_SHAPES.length);
        const shapeInfo = OBSTACLE_SHAPES[randomShapeIndex];
        const x = Math.random() * (canvas.width - baseObstacleSize * 2) + baseObstacleSize;
        const speedValue = Math.random() * (currentMaxObstacleSpeed - currentMinObstacleSpeed) + currentMinObstacleSpeed;
        
        obstacles.push({
            x: x,
            y: -baseObstacleSize, // Muncul dari atas layar
            size: baseObstacleSize * (1 + Math.random() * 0.2), // Variasi ukuran kecil
            shape: shapeInfo,
            speed: speedValue * SPEED_SCALE_FACTOR * (canvas.height / 800), // Skala kecepatan
            angle: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.1 // Kecepatan rotasi acak
        });
        lastObstacleSpawnTime = Date.now();
    }

    function updateObstacles() {
        const currentTime = Date.now();
        const nextSpawnDelay = Math.random() * (currentMaxSpawnInterval - currentMinSpawnInterval) + currentMinSpawnInterval;

        if (!gameOver && currentTime - lastObstacleSpawnTime > nextSpawnDelay) {
            spawnObstacle();
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.y += obs.speed;
            obs.angle += obs.rotationSpeed;

            if (obs.y - obs.size > canvas.height) {
                obstacles.splice(i, 1);
                if (!gameOver) {
                    score++;
                    updateScoreDisplay();
                }
            }
        }
    }

    function checkCollision() {
        if (gameOver) return;

        obstacles.forEach((obstacle, index) => {
            // Deteksi tabrakan sederhana berbasis jarak antara pusat player dan pusat obstacle
            // Untuk player segitiga, kita anggap pusatnya di tengah alas dan sedikit ke atas
            const playerCenterX = playerX + playerSize / 2;
            const playerCenterY = playerY + playerSize / 2;

            const dx = obstacle.x - playerCenterX;
            const dy = obstacle.y - playerCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Jika jarak lebih kecil dari ukuran obstacle + setengah ukuran player (rata-rata)
            if (distance < obstacle.size + playerSize / 2 * 0.8) { // 0.8 faktor toleransi
                obstacles.splice(index, 1);
                playerHP -= obstacle.shape.damage;
                isPlayerHit = true;
                playerHitFlashDuration = PLAYER_HIT_FLASH_FRAMES;

                if (playerHP <= 0) {
                    playerHP = 0;
                    endGame();
                }
                updateHpDisplay();
            }
        });
    }
    
    function applyMultiplier() {
        currentMinSpawnInterval = Math.max(50, currentMinSpawnInterval / SPAWN_INTERVAL_MULTIPLIER); // Batas minimal 50ms
        currentMaxSpawnInterval = Math.max(100, currentMaxSpawnInterval / SPAWN_INTERVAL_MULTIPLIER); // Batas minimal 100ms

        // Pastikan min tidak melebihi max
        if (currentMinSpawnInterval > currentMaxSpawnInterval) {
            currentMinSpawnInterval = currentMaxSpawnInterval * 0.8;
        }
        
        // Seperti yang diminta, speed range dikali 0.75 (membuat rintangan lebih lambat)
        // Ini mungkin berlawanan dengan intuisi increase difficulty, tapi sesuai permintaan.
        // Jika ingin lebih cepat, gunakan faktor > 1 (misal 1.1 atau 1.05)
        currentMinObstacleSpeed *= SPEED_RANGE_MULTIPLIER;
        currentMaxObstacleSpeed *= SPEED_RANGE_MULTIPLIER;

        // Tambahkan batas bawah agar kecepatan tidak terlalu lambat
        currentMinObstacleSpeed = Math.max(INITIAL_MIN_OBSTACLE_SPEED * 0.1, currentMinObstacleSpeed);
        currentMaxObstacleSpeed = Math.max(INITIAL_MAX_OBSTACLE_SPEED * 0.1, currentMaxObstacleSpeed);


        console.log(`Multiplier Applied: Spawn Interval (${currentMinSpawnInterval.toFixed(0)}-${currentMaxSpawnInterval.toFixed(0)}ms), Speed Range (${currentMinObstacleSpeed.toFixed(0)}-${currentMaxObstacleSpeed.toFixed(0)})`);
    }

    function updateGameDifficulty() {
        const elapsedTimeSeconds = (Date.now() - gameStartTime) / 1000;
        if (elapsedTimeSeconds - (lastMultiplierApplyTime - gameStartTime)/1000 >= MULTIPLIER_INTERVAL_SECONDS) {
            applyMultiplier();
            lastMultiplierApplyTime = Date.now();
        }
    }

    // --- UI Update Functions ---
    function updateScoreDisplay() {
        scoreDisplay.textContent = `Skor: ${score}`;
    }

    function updateHpDisplay() {
        hpDisplay.textContent = `HP: ${playerHP}`;
    }

    function updateHighScoreDisplay() {
        highScoreDisplay.textContent = `Skor Tertinggi: ${highScore}`;
    }

    // --- Game State Functions ---
    function endGame() {
        gameOver = true;
        isPointerDown = false;
        playerVelocityX = 0;
        cancelAnimationFrame(animationFrameId);

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('obstacleGameProModernHS', highScore);
            updateHighScoreDisplay();
        }
        finalScoreText.textContent = `Skor Akhir: ${score}`;
        gameOverScreen.style.display = 'flex';
    }

    function resetGame() {
        score = 0;
        playerHP = PLAYER_MAX_HP;
        obstacles = [];
        playerX = canvas.width / 2 - playerSize / 2;
        playerVelocityX = 0;
        isPointerDown = false;
        gameOver = false;
        isPlayerHit = false;
        playerHitFlashDuration = 0;

        currentMinSpawnInterval = INITIAL_MIN_SPAWN_INTERVAL;
        currentMaxSpawnInterval = INITIAL_MAX_SPAWN_INTERVAL;
        currentMinObstacleSpeed = INITIAL_MIN_OBSTACLE_SPEED;
        currentMaxObstacleSpeed = INITIAL_MAX_OBSTACLE_SPEED;
        
        lastObstacleSpawnTime = Date.now();
        gameStartTime = Date.now();
        lastMultiplierApplyTime = gameStartTime; // Atur waktu apply multiplier pertama

        updateScoreDisplay();
        updateHpDisplay();
        updateHighScoreDisplay(); // Update high score display saat reset
        gameOverScreen.style.display = 'none';

        if (animationFrameId) cancelAnimationFrame(animationFrameId); // Hentikan loop lama jika ada
        gameLoop();
    }

    function gameLoop() {
        if (gameOver) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        updatePlayerPosition();
        updateObstacles();
        checkCollision();
        if(!gameOver) updateGameDifficulty(); // Hanya update jika game belum berakhir

        drawPlayer();
        drawObstacles();

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- Kontrol Player ---
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
        if (gameOver) return;
        isPointerDown = false;
        playerVelocityX = 0;
    }

    function processPointerMove(event) {
        const rect = canvas.getBoundingClientRect();
        let pointerX;
        if (event.touches && event.touches.length > 0) {
            pointerX = event.touches[0].clientX - rect.left;
        } else {
            pointerX = event.clientX - rect.left;
        }

        // Kontrol yang lebih responsif: target posisi player adalah posisi pointer
        const targetPlayerX = pointerX - playerSize / 2;
        // Pergerakan gradual, bukan instan
        const moveDirection = targetPlayerX - playerX;
        if (Math.abs(moveDirection) > playerSpeed / 2) { // Hanya bergerak jika ada perbedaan signifikan
             playerVelocityX = Math.sign(moveDirection) * playerSpeed;
        } else {
             playerVelocityX = 0; // Hentikan jika sudah dekat target
        }
    }

    // --- Event Listeners ---
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    canvas.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('touchend', handlePointerUp);
    canvas.addEventListener('touchcancel', handlePointerUp);
    // canvas.addEventListener('mouseleave', handlePointerUp); // Opsional, bisa jadi mengganggu

    window.addEventListener('resize', () => {
        resizeCanvas();
        // Jika game sedang berjalan, redraw
        if (!gameOver) {
            obstacles = obstacles.filter(obs => obs.y < canvas.height + obs.size * 2 && obs.x > -obs.size*2 && obs.x < canvas.width + obs.size*2 );
            playerY = canvas.height - playerSize - 20;
        }
    });

    restartButton.addEventListener('click', resetGame);

    // --- Inisialisasi Game ---
    resizeCanvas(); // Panggil sekali untuk set ukuran awal dan variabel dependen
    updateHighScoreDisplay(); // Tampilkan high score awal dari localStorage
    resetGame(); // Mulai game
});

