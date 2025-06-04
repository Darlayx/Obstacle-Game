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
    const PLAYER_DEFAULT_COLOR = '#3498db'; // Biru modern untuk player
    const PLAYER_HIT_COLOR = '#e74c3c'; // Merah untuk damage
    const PLAYER_HIT_DURATION = 200; // ms
    const MULTIPLIER_INTERVAL = 15000; // 15 detik
    const SPAWN_INTERVAL_MULTIPLIER = 1.1;
    const SPEED_RANGE_MULTIPLIER = 0.75; // Ini akan *mengurangi* rentang, yang mungkin berarti mempercepat batas bawah atau memperlambat batas atas.
                                        // Saya akan menginterpretasikannya sebagai: minSpeed *= (1/SPEED_RANGE_MULTIPLIER), maxSpeed *= (1/SPEED_RANGE_MULTIPLIER)
                                        // Ini berarti kecepatan akan meningkat. Jika maksudnya lain, perlu diklarifikasi.
                                        // Berdasarkan "meningkatkan speed range", saya asumsikan speednya jadi lebih tinggi.
                                        // Jadi, speed akan dikali dengan (1 / 0.75) = 1.333...

    const OBSTACLE_TYPES = [
        { name: 'lingkaran', sides: 0, damage: 3, baseColor: [255, 255, 0], points: 1 }, // Kuning
        { name: 'segitiga', sides: 3, damage: 6, baseColor: [255, 195, 0], points: 2 },   // Orange-Kuning
        { name: 'segiempat', sides: 4, damage: 10, baseColor: [255, 135, 0], points: 3 }, // Oranye
        { name: 'segilima', sides: 5, damage: 15, baseColor: [255, 75, 0], points: 4 },    // Merah-Oranye
        { name: 'segienam', sides: 6, damage: 20, baseColor: [255, 0, 0], points: 5 }      // Merah
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
        playerY = canvas.height - playerSize - 20; // Posisi Y player
        playerVelocityX = 0;
        playerSpeed = canvas.width * 0.01 > 7 ? canvas.width * 0.01 : 7; // Kecepatan player responsif

        obstacleBaseRadius = canvas.height * 0.02 > 12 ? canvas.height * 0.02 : 12;

        // Initial game settings from requirements
        currentMinSpawnInterval = 100; // ms
        currentMaxSpawnInterval = 750; // ms
        currentMinObstacleSpeedPPS = 100; // pixels per second
        currentMaxObstacleSpeedPPS = 1000; // pixels per second
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initializeGameParameters(); // Re-initialize parameters that depend on canvas size
        
        // Recalculate player Y position
        playerY = canvas.height - playerSize - 20;

        if (!gameOver) {
            playerX = Math.max(0, Math.min(playerX, canvas.width - playerSize));
        }
    }

    function drawPlayer() {
        if (Date.now() < playerHitEndTime) {
            ctx.fillStyle = PLAYER_HIT_COLOR;
        } else {
            ctx.fillStyle = playerColor;
        }
        // Menggambar player sebagai segitiga modern
        ctx.beginPath();
        ctx.moveTo(playerX + playerSize / 2, playerY);
        ctx.lineTo(playerX, playerY + playerSize);
        ctx.lineTo(playerX + playerSize, playerY + playerSize);
        ctx.closePath();
        ctx.fill();
    }

    function drawPolygon(x, y, radius, sides, color, rotation) {
        ctx.beginPath();
        ctx.moveTo(x + radius * Math.cos(rotation), y + radius * Math.sin(rotation));
        for (let i = 1; i <= sides; i++) {
            ctx.lineTo(
                x + radius * Math.cos(rotation + (i * 2 * Math.PI / sides)),
                y + radius * Math.sin(rotation + (i * 2 * Math.PI / sides))
            );
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Optional: Tambahkan stroke untuk memperjelas bentuk
        // ctx.strokeStyle = `rgba(${Math.max(0,colorRGB[0]-50)}, ${Math.max(0,colorRGB[1]-50)}, ${Math.max(0,colorRGB[2]-50)}, 1)`;
        // ctx.lineWidth = 2;
        // ctx.stroke();
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
                drawPolygon(0, 0, obstacle.radius, type.sides, colorStr, 0); // rotasi utama sudah di handle translate & rotate
            }
            ctx.restore();
        });
    }

    function updatePlayerPosition() {
        playerX += playerVelocityX;
        playerY = canvas.height - playerSize - 20; // Pastikan player tetap di bawah

        if (playerX < 0) playerX = 0;
        if (playerX + playerSize > canvas.width) playerX = canvas.width - playerSize;
    }

    function spawnObstacle() {
        const randomTypeIndex = Math.floor(Math.random() * OBSTACLE_TYPES.length);
        const type = OBSTACLE_TYPES[randomTypeIndex];
        
        const radius = obstacleBaseRadius * (1 + (type.sides === 0 ? 0 : type.sides) * 0.05); // Sedikit variasi ukuran
        const x = Math.random() * (canvas.width - radius * 2) + radius;
        const y = -radius;
        
        // Kecepatan dalam pixels per frame (assuming 60 FPS, fallback to 16.66ms per frame)
        const speedPPS = Math.random() * (currentMaxObstacleSpeedPPS - currentMinObstacleSpeedPPS) + currentMinObstacleSpeedPPS;
        const speedPPF = speedPPS / 60; // Roughly, for requestAnimationFrame timing

        const rotationSpeed = (Math.random() - 0.5) * 0.1 * (type.sides > 0 ? (6 / type.sides) : 1); // Radian per frame, lebih cepat untuk sisi lebih sedikit

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
                    score += obs.type.points; // Skor berdasarkan tipe obstacle
                    updateScoreDisplay();
                }
            }
        }
    }
    
    function checkCollision() {
        if (gameOver) return;

        obstacles.forEach((obstacle, index) => {
            // Deteksi tabrakan player (segitiga) dengan obstacle (lingkaran/poligon - disimplifikasi ke lingkaran)
            // Titik-titik penting pada player (segitiga):
            const pPoints = [
                { x: playerX + playerSize / 2, y: playerY }, // Puncak
                { x: playerX, y: playerY + playerSize },     // Kiri bawah
                { x: playerX + playerSize, y: playerY + playerSize } // Kanan bawah
            ];
            
            let collided = false;

            // 1. Cek vertex player di dalam obstacle (jika obstacle adalah lingkaran)
            for (const p of pPoints) {
                const distSq = (p.x - obstacle.x)**2 + (p.y - obstacle.y)**2;
                if (distSq < obstacle.radius**2) {
                    collided = true;
                    break;
                }
            }

            // 2. Cek pusat obstacle di dalam bounding box player (penyederhanaan, bisa lebih akurat)
            // dan jika obstacle cukup dekat dengan garis-garis sisi player.
            // Untuk simplifikasi, kita gunakan deteksi tabrakan lingkaran-lingkaran
            // dengan menganggap player sebagai lingkaran dengan radius playerSize / 2
            // dan pusat di tengah alas segitiga.
            if (!collided) {
                const playerCenterX = playerX + playerSize / 2;
                const playerCenterY = playerY + playerSize * 0.66; // Perkiraan pusat massa vertikal segitiga
                const playerEffectiveRadius = playerSize * 0.5; 

                const dx = obstacle.x - playerCenterX;
                const dy = obstacle.y - playerCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < obstacle.radius + playerEffectiveRadius) {
                    collided = true;
                }
            }


            if (collided) {
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
        currentMinSpawnInterval = Math.max(50, currentMinSpawnInterval / SPAWN_INTERVAL_MULTIPLIER); // Batas minimal 50ms
        currentMaxSpawnInterval = Math.max(currentMinSpawnInterval + 50, currentMaxSpawnInterval / SPAWN_INTERVAL_MULTIPLIER); // Max harus > Min

        // "meningkatkan speed range obstacle dengan dikali 0,75"
        // Saya interpretasikan ini sebagai faktor pembagi untuk meningkatkan kecepatan (1/0.75 = 1.333)
        const speedIncreaseFactor = 1 / SPEED_RANGE_MULTIPLIER;
        currentMinObstacleSpeedPPS *= speedIncreaseFactor;
        currentMaxObstacleSpeedPPS *= speedIncreaseFactor;

        // Batasan atas untuk kecepatan agar tidak terlalu gila
        currentMinObstacleSpeedPPS = Math.min(currentMinObstacleSpeedPPS, 3000);
        currentMaxObstacleSpeedPPS = Math.min(currentMaxObstacleSpeedPPS, 5000);


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
        isPointerDown = false;
        playerVelocityX = 0;
        cancelAnimationFrame(animationFrameId);

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('obstacleProRevampedHighScore', highScore);
            highScoreDisplay.textContent = `Skor Tertinggi: ${highScore}`;
        }
        finalScoreText.textContent = `Skor Akhir: ${score}`;
        gameOverScreen.style.display = 'flex';
    }

    function resetGame() {
        score = 0;
        playerHP = PLAYER_MAX_HP;
        obstacles = [];
        playerColor = PLAYER_DEFAULT_COLOR;
        playerHitEndTime = 0;
        gameOver = false;
        
        resizeCanvas(); // Ini akan memanggil initializeGameParameters() juga

        lastObstacleSpawnTime = Date.now();
        gameStartTime = Date.now();
        lastMultiplierTime = gameStartTime;

        updateDisplays();
        gameOverScreen.style.display = 'none';
        
        gameLoop();
    }

    function gameLoop() {
        if (gameOver) return;

        const currentTime = Date.now();

        // Apply multiplier
        if (currentTime - lastMultiplierTime > MULTIPLIER_INTERVAL) {
            applyMultiplier();
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        updatePlayerPosition();
        updateObstacles(); // Termasuk spawn
        checkCollision();

        drawObstacles();
        drawPlayer();

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // Player Controls
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
        if (gameOver && !isPointerDown) return; // Fix: Hanya reset velocity jika game tidak over ATAU pointer masih ditekan
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

        // Kontrol yang lebih intuitif: bergerak ke arah pointer relatif terhadap posisi player
        const playerCenterX = playerX + playerSize / 2;
        if (pointerX < playerCenterX - playerSize * 0.2) { // Ada deadzone kecil di tengah
            playerVelocityX = -playerSpeed;
        } else if (pointerX > playerCenterX + playerSize * 0.2) {
            playerVelocityX = playerSpeed;
        } else {
            playerVelocityX = 0;
        }
    }

    // Event Listeners
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    document.addEventListener('mouseup', handlePointerUp); // Gunakan document agar mouse up di luar canvas terdeteksi
    document.addEventListener('touchend', handlePointerUp);
    document.addEventListener('touchcancel', handlePointerUp);
    // canvas.addEventListener('mouseleave', handlePointerUp); // Dihapus karena document.mouseup lebih baik

    window.addEventListener('resize', () => {
        resizeCanvas(); // Ini akan menginisialisasi ulang parameter dan posisi player
        if (gameOver) { // Jika game over, pastikan tampilan game over tetap di tengah
            // CSS flexbox sudah menangani ini.
        } else {
            // Hapus rintangan yang mungkin di luar batas setelah resize
            obstacles = obstacles.filter(obs => obs.y < canvas.height + obs.radius * 2 && obs.x > -obs.radius*2 && obs.x < canvas.width + obs.radius*2 );
        }
    });

    restartButton.addEventListener('click', resetGame);

    // Initial Setup
    resizeCanvas(); // Initial canvas sizing and parameter setup
    resetGame();    // Start the game
});
