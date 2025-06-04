document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // UI Elements
    const hpDisplay = document.getElementById('hpLabel');
    const scoreDisplay = document.getElementById('scoreLabel');
    const highScoreDisplay = document.getElementById('highScoreLabel');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const finalScoreText = document.getElementById('finalScoreText');
    const restartButton = document.getElementById('restartButton');

    // Game Constants
    const PLAYER_MAX_HP = 100;
    const PLAYER_DEFAULT_COLOR = '#3498db';
    const PLAYER_HIT_COLOR = '#e74c3c';
    const PLAYER_HIT_DURATION = 200; // ms
    
    const MULTIPLIER_INTERVAL = 15000; // 15 detik
    const SPAWN_INTERVAL_DIVISOR = 1.1; // Untuk mengurangi interval spawn
    const OBSTACLE_SPEED_MULTIPLIER = 1.075; // Untuk meningkatkan speed range

    // Batas untuk multiplier agar game tidak menjadi tidak mungkin
    const MIN_SPAWN_INTERVAL_CAP = 40; // ms (batas bawah interval spawn minimal)
    const MIN_SPAWN_DIFFERENCE_CAP = 30; // ms (perbedaan minimal antara min dan max spawn interval)
    const MAX_OBSTACLE_SPEED_PPS_CAP = 6000; // PPS (batas atas kecepatan maksimal obstacle)


    const OBSTACLE_TYPES = [
        { name: 'lingkaran', sides: 0, damage: 3, baseColor: [255, 255, 0], points: 1 },
        { name: 'segitiga', sides: 3, damage: 6, baseColor: [255, 195, 0], points: 2 },
        { name: 'segiempat', sides: 4, damage: 10, baseColor: [255, 135, 0], points: 3 },
        { name: 'segilima', sides: 5, damage: 15, baseColor: [255, 75, 0], points: 4 },
        { name: 'segienam', sides: 6, damage: 20, baseColor: [255, 0, 0], points: 5 }
    ];

    // Game Variables
    let playerSize, playerX, playerY, playerVelocityX, playerSpeed;
    let playerColor = PLAYER_DEFAULT_COLOR;
    let playerHitEndTime = 0;

    let obstacles = [];
    let obstacleBaseRadius;

    // Initial dynamic game parameters (akan diubah oleh multiplier)
    let currentMinSpawnInterval;
    let currentMaxSpawnInterval;
    let currentMinObstacleSpeedPPS; // Pixels Per Second
    let currentMaxObstacleSpeedPPS;

    let score, playerHP;
    let highScore = localStorage.getItem('obstacleProRevampedHighScore') || 0;
    let gameOver;
    let lastObstacleSpawnTime;
    let animationFrameId;
    let isPointerDown = false;
    let gameStartTime;
    let lastMultiplierTime;

    function initializeGameParameters() {
        playerSize = canvas.height * 0.04 > 25 ? canvas.height * 0.04 : 25;
        playerX = canvas.width / 2 - playerSize / 2;
        playerY = canvas.height - playerSize - 20;
        playerVelocityX = 0; // Penting untuk reset saat game dimulai/diulang
        playerSpeed = canvas.width * 0.012 > 8 ? canvas.width * 0.012 : 8; // Kecepatan player sedikit ditingkatkan

        obstacleBaseRadius = canvas.height * 0.02 > 12 ? canvas.height * 0.02 : 12;

        // 1. Awal permainan (sesuai permintaan baru)
        currentMinSpawnInterval = 100; // ms
        currentMaxSpawnInterval = 750; // ms
        currentMinObstacleSpeedPPS = 100; // pixels per second
        currentMaxObstacleSpeedPPS = 1000; // pixels per second
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Panggil initializeGameParameters SETELAH ukuran canvas diatur
        // agar parameter yang bergantung ukuran (playerSize, playerSpeed, obstacleBaseRadius) benar
        initializeGameParameters(); 
        
        // Pastikan player Y selalu benar setelah resize
        playerY = canvas.height - playerSize - 20;

        if (!gameOver) {
            // Reposisi player jika masih dalam permainan dan mungkin keluar batas X
            playerX = Math.max(0, Math.min(playerX, canvas.width - playerSize));
        }
    }

    function drawPlayer() {
        if (Date.now() < playerHitEndTime) {
            ctx.fillStyle = PLAYER_HIT_COLOR;
        } else {
            ctx.fillStyle = playerColor;
        }
        ctx.beginPath();
        ctx.moveTo(playerX + playerSize / 2, playerY);
        ctx.lineTo(playerX, playerY + playerSize);
        ctx.lineTo(playerX + playerSize, playerY + playerSize);
        ctx.closePath();
        ctx.fill();
    }

    function drawPolygon(x, y, radius, sides, colorStr, rotation) {
        ctx.beginPath();
        // Mulai dari sudut atas (atau sedikit berotasi agar alas datar jika diinginkan untuk beberapa poligon)
        const startAngle = rotation - Math.PI / 2 + (sides % 2 === 0 ? Math.PI / sides : 0);
        ctx.moveTo(x + radius * Math.cos(startAngle), y + radius * Math.sin(startAngle));
        for (let i = 1; i <= sides; i++) {
            ctx.lineTo(
                x + radius * Math.cos(startAngle + (i * 2 * Math.PI / sides)),
                y + radius * Math.sin(startAngle + (i * 2 * Math.PI / sides))
            );
        }
        ctx.closePath();
        ctx.fillStyle = colorStr;
        ctx.fill();
    }

    function drawObstacles() {
        obstacles.forEach(obstacle => {
            ctx.save();
            ctx.translate(obstacle.x, obstacle.y);
            ctx.rotate(obstacle.rotation);

            const type = obstacle.type;
            const colorStr = `rgb(${type.baseColor[0]}, ${type.baseColor[1]}, ${type.baseColor[2]})`;

            if (type.sides === 0) { // Lingkaran
                ctx.beginPath();
                ctx.arc(0, 0, obstacle.radius, 0, Math.PI * 2);
                ctx.fillStyle = colorStr;
                ctx.fill();
            } else { // Poligon
                drawPolygon(0, 0, obstacle.radius, type.sides, colorStr, 0);
            }
            ctx.restore();
        });
    }

    function updatePlayerPosition() {
        playerX += playerVelocityX;
        // playerY sudah fixed, diset di resizeCanvas dan initializeGameParameters
        // playerY = canvas.height - playerSize - 20; // Tidak perlu di sini lagi

        // Batasan gerak player di canvas
        if (playerX < 0) {
            playerX = 0;
            // playerVelocityX = 0; // Opsional: Hentikan jika mentok (sudah otomatis berhenti jika pointer dilepas)
        }
        if (playerX + playerSize > canvas.width) {
            playerX = canvas.width - playerSize;
            // playerVelocityX = 0; // Opsional
        }
    }

    function spawnObstacle() {
        const randomTypeIndex = Math.floor(Math.random() * OBSTACLE_TYPES.length);
        const type = OBSTACLE_TYPES[randomTypeIndex];
        
        const radius = obstacleBaseRadius * (1 + (type.sides === 0 ? 0 : type.sides) * 0.05);
        const x = Math.random() * (canvas.width - radius * 2) + radius;
        const y = -radius;
        
        const speedPPS = Math.random() * (currentMaxObstacleSpeedPPS - currentMinObstacleSpeedPPS) + currentMinObstacleSpeedPPS;
        const speedPPF = speedPPS / 60; 

        const rotationSpeed = (Math.random() - 0.5) * 0.07 * (type.sides > 0 ? (6 / (type.sides +1)) : 1); 

        obstacles.push({ x, y, radius, type, speed: speedPPF, rotation: Math.random() * Math.PI * 2, rotationSpeed });
        lastObstacleSpawnTime = Date.now();
    }

    function updateObstacles() {
        const currentTime = Date.now();
        const nextSpawnDelay = Math.random() * (currentMaxSpawnInterval - currentMinSpawnInterval) + currentMinSpawnInterval;

        if (!gameOver && (currentTime - lastObstacleSpawnTime) > nextSpawnDelay) {
            spawnObstacle();
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.y += obs.speed;
            obs.rotation += obs.rotationSpeed;

            if (obs.y - obs.radius > canvas.height) {
                obstacles.splice(i, 1);
                if (!gameOver) {
                    score += obs.type.points;
                    updateScoreDisplay();
                }
            }
        }
    }
    
    function checkCollision() {
        if (gameOver) return;

        obstacles.forEach((obstacle, index) => {
            const playerCenterX = playerX + playerSize / 2;
            const playerEffectiveRadius = playerSize * 0.45; // Sedikit lebih kecil untuk collision yg lebih forgiving
            // Perkiraan pusat vertikal player (disesuaikan untuk bentuk segitiga)
            const playerCenterY = playerY + playerSize * 0.60; 


            const dx = obstacle.x - playerCenterX;
            const dy = obstacle.y - playerCenterY; // Hitung jarak ke pusat massa player
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < obstacle.radius + playerEffectiveRadius) {
                obstacles.splice(index, 1);
                playerHP -= obstacle.type.damage;
                playerHitEndTime = Date.now() + PLAYER_HIT_DURATION;
                
                if (playerHP <= 0) {
                    playerHP = 0;
                    endGame();
                }
                updateHpDisplay();
            }
        });
    }

    function applyMultiplier() {
        // Mengurangi interval spawn
        currentMinSpawnInterval = Math.max(MIN_SPAWN_INTERVAL_CAP, currentMinSpawnInterval / SPAWN_INTERVAL_DIVISOR);
        currentMaxSpawnInterval = Math.max(currentMinSpawnInterval + MIN_SPAWN_DIFFERENCE_CAP, currentMaxSpawnInterval / SPAWN_INTERVAL_DIVISOR);

        // Meningkatkan speed range (sesuai permintaan baru: dikali 1.075)
        currentMinObstacleSpeedPPS *= OBSTACLE_SPEED_MULTIPLIER;
        currentMaxObstacleSpeedPPS *= OBSTACLE_SPEED_MULTIPLIER;

        // Pastikan kecepatan tidak melebihi batas atas
        currentMinObstacleSpeedPPS = Math.min(currentMinObstacleSpeedPPS, MAX_OBSTACLE_SPEED_PPS_CAP - 500); // Min speed tidak boleh terlalu dekat dengan max cap
        currentMaxObstacleSpeedPPS = Math.min(currentMaxObstacleSpeedPPS, MAX_OBSTACLE_SPEED_PPS_CAP);
        if (currentMinObstacleSpeedPPS > currentMaxObstacleSpeedPPS - 100) { // Jaga rentang minimal
            currentMinObstacleSpeedPPS = currentMaxObstacleSpeedPPS -100;
        }


        console.log(`Multiplier Applied: Spawn [${currentMinSpawnInterval.toFixed(0)}-${currentMaxSpawnInterval.toFixed(0)}ms], Speed [${currentMinObstacleSpeedPPS.toFixed(0)}-${currentMaxObstacleSpeedPPS.toFixed(0)}PPS]`);
        lastMultiplierTime = Date.now();
    }

    function updateDisplays() {
        updateHpDisplay();
        updateScoreDisplay();
        highScoreDisplay.textContent = `Skor Tertinggi: ${highScore}`;
    }

    function updateHpDisplay() {
        hpDisplay.textContent = `HP: ${playerHP}`;
    }

    function updateScoreDisplay() {
        scoreDisplay.textContent = `Skor: ${score}`;
    }

    function endGame() {
        gameOver = true;
        isPointerDown = false; // Pastikan status pointer direset
        playerVelocityX = 0;  // Hentikan player
        cancelAnimationFrame(animationFrameId);

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('obstacleProRevampedHighScore', highScore);
            // highScoreDisplay sudah diupdate di updateDisplays, tapi bisa juga di sini
        }
        updateDisplays(); // Pastikan high score terupdate jika baru saja dipecahkan
        finalScoreText.textContent = `Skor Akhir: ${score}`;
        gameOverScreen.style.display = 'flex';
    }

    function resetGame() {
        // Panggil resizeCanvas() dulu untuk set ukuran dan panggil initializeGameParameters()
        // Ini memastikan semua parameter awal, termasuk kecepatan dan interval spawn,
        // diset ke nilai default sebelum game loop dimulai.
        resizeCanvas(); 
        
        score = 0;
        playerHP = PLAYER_MAX_HP;
        obstacles = [];
        playerColor = PLAYER_DEFAULT_COLOR;
        playerHitEndTime = 0;
        gameOver = false;
        isPointerDown = false; // Penting untuk reset status pointer
        // playerVelocityX sudah direset ke 0 di initializeGameParameters()
        
        lastObstacleSpawnTime = Date.now();
        gameStartTime = Date.now();
        lastMultiplierTime = gameStartTime;

        updateDisplays();
        gameOverScreen.style.display = 'none';
        
        // Hapus frame animasi sebelumnya jika ada (walaupun endGame sudah melakukan ini)
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        gameLoop();
    }

    function gameLoop() {
        if (gameOver) {
            // Jika game over, pastikan tidak ada loop animasi yang berjalan.
            // cancelAnimationFrame(animationFrameId) sudah dipanggil di endGame.
            return;
        }

        const currentTime = Date.now();

        if (currentTime - lastMultiplierTime > MULTIPLIER_INTERVAL) {
            applyMultiplier();
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        updatePlayerPosition();
        updateObstacles(); 
        checkCollision();

        drawObstacles();
        drawPlayer();

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // Player Controls (Diperbarui sesuai permintaan)
    function handlePointerDown(event) {
        event.preventDefault();
        if (gameOver) return;
        isPointerDown = true;
        processPointerMove(event.clientX || (event.touches && event.touches[0].clientX));
    }

    function handlePointerMove(event) {
        event.preventDefault();
        if (gameOver || !isPointerDown) return;
        processPointerMove(event.clientX || (event.touches && event.touches[0].clientX));
    }

    function handlePointerUp(event) {
        event.preventDefault();
        // Tidak peduli game over atau tidak, jika pointer diangkat, hentikan gerakan
        isPointerDown = false;
        playerVelocityX = 0;
    }
    
    function processPointerMove(pointerClientX) {
        if (pointerClientX === undefined) return; // Tidak ada data posisi X

        const rect = canvas.getBoundingClientRect();
        const pointerXCanvas = pointerClientX - rect.left;

        // Kontrol baru: kiri/kanan layar
        if (pointerXCanvas < canvas.width / 2) {
            playerVelocityX = -playerSpeed; // Bergerak ke kiri
        } else {
            playerVelocityX = playerSpeed;  // Bergerak ke kanan
        }
    }

    // Event Listeners
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    
    // Listener untuk pointer up harus di document atau window agar terdeteksi
    // bahkan jika pointer dilepas di luar canvas.
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchend', handlePointerUp);
    document.addEventListener('touchcancel', handlePointerUp);


    window.addEventListener('resize', () => {
        resizeCanvas(); 
        if (gameOver) { 
            // Jika game over, pastikan UI tetap terpusat (CSS handles this)
        } else {
            // Filter obstacles lagi jika ada perubahan ukuran canvas drastis saat game berjalan
             obstacles = obstacles.filter(obs => obs.y < canvas.height + obs.radius * 2 && obs.x > -obs.radius*2 && obs.x < canvas.width + obs.radius*2 );
        }
    });

    restartButton.addEventListener('click', () => {
        // Memastikan tidak ada state lingering dari pointer sebelum reset
        isPointerDown = false;
        playerVelocityX = 0;
        resetGame();
    });

    // Initial Setup
    resizeCanvas(); 
    resetGame();    
});
