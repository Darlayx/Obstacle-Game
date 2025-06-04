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

    const playerBaseColor = '#6272a4'; // Warna player (biru keabuan)
    const playerDamageColor = '#ff5555'; // Merah untuk damage flash

    let playerSize, playerX, playerY, playerVelocityX, playerHP;
    const playerSpeed = 8;
    let playerDamageFlashTimer = 0;
    const PLAYER_DAMAGE_FLASH_DURATION = 10; // frames

    const obstacleTypes = [
        { shape: 'circle', sides: 0, damage: 3, color: '#f1fa8c', baseRotSpeed: 0.01 }, // Kuning
        { shape: 'triangle', sides: 3, damage: 6, color: '#ffb86c', baseRotSpeed: -0.015 }, // Oranye
        { shape: 'square', sides: 4, damage: 10, color: '#ff79c6', baseRotSpeed: 0.02 }, // Pink
        { shape: 'pentagon', sides: 5, damage: 15, color: '#bd93f9', baseRotSpeed: -0.025 }, // Ungu
        { shape: 'hexagon', sides: 6, damage: 20, color: '#ff5555', baseRotSpeed: 0.03 }  // Merah
    ];
    let obstacles = [];

    // Game State
    let score = 0;
    let highScore = localStorage.getItem('obstacleEvaderHighScore') || 0; // Update nama highscore
    let gameOver = true; // Mulai dengan game over (di start screen)
    let animationFrameId;
    let isPointerDown = false;

    // Initial Game Parameters
    const initialMinSpawnInterval = 750; // ms
    const initialMaxSpawnInterval = 1500; // ms (dulu 100-750, diubah agar lebih mudah di awal)
    const initialMinSpeedBase = 1; // pixels per frame
    const initialMaxSpeedBase = 3; // pixels per frame

    let currentMinSpawnInterval, currentMaxSpawnInterval;
    let currentMinSpeedBase, currentMaxSpeedBase;
    let speedMultiplier; // Untuk peningkatan kecepatan global

    let lastObstacleSpawnTime = 0;
    let nextSpawnDelay = 0;

    // Multiplier Feature
    const multiplierInterval = 15000; // 15 detik
    let lastMultiplierTime = 0;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        playerSize = canvas.height * 0.035 > 20 ? canvas.height * 0.035 : 20;
        if (!gameOver || playerX === undefined) { // Atur posisi awal saat resize atau pertama kali
            playerX = canvas.width / 2 - playerSize / 2;
        } else { // Jaga player tetap dalam batas
             playerX = Math.max(0, Math.min(playerX, canvas.width - playerSize));
        }
        playerY = canvas.height - playerSize - 20;
    }

    function drawPlayer() {
        let currentColor = playerBaseColor;
        if (playerDamageFlashTimer > 0) {
            // Efek flash: ganti warna jika timer ganjil/genap, atau cukup satu warna damage
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
        if (sides === 0) { // Lingkaran
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
        playerY = canvas.height - playerSize - 20; // Jaga posisi Y tetap

        if (playerX < 0) playerX = 0;
        if (playerX + playerSize > canvas.width) playerX = canvas.width - playerSize;
    }

    function spawnObstacle() {
        const currentTime = Date.now();
        if (currentTime - lastObstacleSpawnTime > nextSpawnDelay) {
            const typeIndex = Math.floor(Math.random() * obstacleTypes.length);
            const type = obstacleTypes[typeIndex];
            const radius = canvas.width * 0.02 + Math.random() * (canvas.width * 0.015); // Ukuran rintangan bervariasi

            const x = Math.random() * (canvas.width - radius * 2) + radius;
            const speed = (Math.random() * (currentMaxSpeedBase - currentMinSpeedBase) + currentMinSpeedBase) * speedMultiplier;
            
            obstacles.push({
                x: x,
                y: -radius,
                radius: radius,
                type: type,
                speed: speed,
                angle: Math.random() * Math.PI * 2, // Sudut awal acak
                rotationSpeed: type.baseRotSpeed * (Math.random() * 0.5 + 0.75) // Variasi kecepatan rotasi
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
                    score += 10; // Skor per rintangan dihindari
                    scoreDisplay.textContent = `Skor: ${score}`;
                }
            }
        }
    }

    function checkCollision() {
        if (gameOver) return;
        obstacles.forEach((obstacle, index) => {
            // Perhitungan jarak antara pusat player (persegi) dan pusat obstacle (poligon)
            // Ini adalah deteksi sederhana berbasis lingkaran, bisa ditingkatkan untuk poligon vs persegi
            const playerCenterX = playerX + playerSize / 2;
            const playerCenterY = playerY + playerSize / 2;

            const distDX = playerCenterX - obstacle.x;
            const distDY = playerCenterY - obstacle.y;
            // Menggunakan jarak antar pusat, ditambah buffer playerSize/2 dan obstacle.radius
            const distance = Math.sqrt(distDX * distDX + distDY * distDY);

            if (distance < obstacle.radius + playerSize / 2 * 0.8) { // 0.8 faktor toleransi
                obstacles.splice(index, 1);
                playerHP -= obstacle.type.damage;
                hpDisplay.textContent = `HP: ${playerHP}`;
                playerDamageFlashTimer = PLAYER_DAMAGE_FLASH_DURATION;

                // Efek getar sederhana (opsional)
                // canvas.style.transform = `translateX(${Math.random() > 0.5 ? 5 : -5}px)`;
                // setTimeout(() => canvas.style.transform = '', 50);


                if (playerHP <= 0) {
                    playerHP = 0;
                    hpDisplay.textContent = `HP: ${playerHP}`;
                    triggerEndGame();
                }
            }
        });
    }
    
    function applyMultiplier() {
        const currentTime = Date.now();
        if (currentTime - lastMultiplierTime > multiplierInterval) {
            currentMinSpawnInterval = Math.max(50, currentMinSpawnInterval / 1.1);
            currentMaxSpawnInterval = Math.max(100, currentMaxSpawnInterval / 1.11); // Sedikit perbedaan agar range tetap ada
            if (currentMinSpawnInterval > currentMaxSpawnInterval) currentMaxSpawnInterval = currentMinSpawnInterval + 50;

            speedMultiplier *= 1.075; // Meningkatkan kecepatan global (dulu 0.75, ini salah tafsir, seharusnya meningkatkan)
            
            console.log(`Multiplier Applied: Spawn [${currentMinSpawnInterval.toFixed(0)}-${currentMaxSpawnInterval.toFixed(0)}ms], Speed Multi: ${speedMultiplier.toFixed(2)}x`);
            lastMultiplierTime = currentTime;
        }
    }

    function triggerEndGame() {
        gameOver = true;
        isPointerDown = false;
        playerVelocityX = 0;
        cancelAnimationFrame(animationFrameId);
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('obstacleEvaderHighScore', highScore);
        }
        finalScoreText.textContent = `Skor Akhir: ${score}`;
        gameOverScreen.style.display = 'flex';
    }

    function resetGame() {
        playerHP = 100;
        score = 0;
        obstacles = [];
        playerX = canvas.width / 2 - playerSize / 2;
        playerY = canvas.height - playerSize - 20;
        playerVelocityX = 0;
        playerDamageFlashTimer = 0;
        isPointerDown = false;

        hpDisplay.textContent = `HP: ${playerHP}`;
        scoreDisplay.textContent = `Skor: ${score}`;

        // Reset parameter game ke awal
        currentMinSpawnInterval = initialMinSpawnInterval;
        currentMaxSpawnInterval = initialMaxSpawnInterval;
        currentMinSpeedBase = initialMinSpeedBase;
        currentMaxSpeedBase = initialMaxSpeedBase;
        speedMultiplier = 1.0;

        lastObstacleSpawnTime = Date.now(); // Reset agar tidak langsung spawn banyak
        nextSpawnDelay = Math.random() * (currentMaxSpawnInterval - currentMinSpawnInterval) + currentMinSpawnInterval;
        lastMultiplierTime = Date.now(); // Reset timer multiplier
    }

    function startGame() {
        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
        gameOver = false;
        resetGame();
        gameLoop();
    }


    function gameLoop() {
        if (gameOver) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!gameOver) { // Hanya update jika game berjalan
            applyMultiplier();
            spawnObstacle();
            updatePlayerPosition();
            updateObstacles();
            checkCollision();
        }
        
        drawObstacles(); // Gambar rintangan dulu agar player di atas
        drawPlayer();

        animationFrameId = requestAnimationFrame(gameLoop);
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
        // if (gameOver) return; // Hapus ini agar player berhenti meski game over saat pointer masih di atas
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

        if (pointerX < canvas.width / 2) {
            playerVelocityX = -playerSpeed;
        } else {
            playerVelocityX = playerSpeed;
        }
    }

    // Event Listeners
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp); // Ganti ke window agar berhenti meski mouse di luar canvas
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('touchcancel', handlePointerUp);
    // canvas.addEventListener('mouseleave', handlePointerUp); // Bisa jadi masalah jika mouse cepat keluar masuk

    window.addEventListener('resize', () => {
        resizeCanvas();
        // Tidak perlu redraw manual di sini jika game over, karena loop sudah berhenti
        // Jika game berjalan, loop berikutnya akan menyesuaikan
    });

    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);

    // Inisialisasi awal
    resizeCanvas();
    startScreen.style.display = 'flex'; // Tampilkan layar mulai
    // Game tidak langsung dimulai, menunggu klik tombol start
});

