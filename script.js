document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // UI Elements
    const mainMenuScreen = document.getElementById('mainMenuScreen');
    const startGameButton = document.getElementById('startGameButton');
    const menuHighScoreText = document.getElementById('menuHighScoreText');
    
    const uiContainer = document.getElementById('uiContainer');
    const hpDisplay = document.getElementById('hpLabel');
    const scoreDisplay = document.getElementById('scoreLabel');
    const highScoreDisplay = document.getElementById('highScoreLabel'); // HUD high score

    const gameOverScreen = document.getElementById('gameOverScreen');
    const finalScoreText = document.getElementById('finalScoreText');
    const gameOverHighScoreText = document.getElementById('gameOverHighScoreText'); // Game Over high score
    const restartButton = document.getElementById('restartButton');
    const returnToMenuButton = document.getElementById('returnToMenuButton');

    let gameState = 'mainMenu';

    const PLAYER_MAX_HP = 100;
    const PLAYER_DEFAULT_COLOR = '#4a90e2';
    const PLAYER_HIT_COLOR = '#e74c3c';
    const PLAYER_HIT_DURATION = 200;
    const MULTIPLIER_INTERVAL = 15000; 
    const SPAWN_INTERVAL_DIVISOR = 1.1;
    const SPEED_RANGE_MULTIPLIER_INCREASE = 1.075;

    const OBSTACLE_TYPES = [
        { name: 'lingkaran', sides: 0, damage: 3, baseColor: [255, 255, 0], points: 1 },
        { name: 'segitiga', sides: 3, damage: 6, baseColor: [255, 195, 0], points: 2 },
        { name: 'segiempat', sides: 4, damage: 10, baseColor: [255, 135, 0], points: 3 },
        { name: 'segilima', sides: 5, damage: 15, baseColor: [255, 75, 0], points: 4 },
        { name: 'segienam', sides: 6, damage: 20, baseColor: [255, 0, 0], points: 5 }
    ];

    let playerSize, playerX, playerY, playerVelocityX, playerActualSpeedPPS;
    let playerColor = PLAYER_DEFAULT_COLOR;
    let playerHitEndTime = 0;

    let obstacles = [];
    let obstacleBaseRadius;

    let initialMinSpawnInterval = 100;
    let initialMaxSpawnInterval = 1000;
    let initialMinObstacleSpeedPPS = 30;
    let initialMaxObstacleSpeedPPS = 300;

    let currentMinSpawnInterval;
    let currentMaxSpawnInterval;
    let currentMinObstacleSpeedPPS;
    let currentMaxObstacleSpeedPPS;

    let score, playerHP;
    let highScore = localStorage.getItem('obstacleProRevampedHighScore') || 0;
    
    let lastObstacleSpawnTime;
    let animationFrameId;
    let isPointerDown = false;
    let gameStartTime;
    let lastMultiplierTime;
    let lastFrameTime = 0; // Inisialisasi penting untuk delta time

    function updateHighScoreDisplays() {
        const hsText = `Skor Tertinggi: ${highScore}`;
        highScoreDisplay.textContent = hsText;
        menuHighScoreText.textContent = hsText;
        gameOverHighScoreText.textContent = hsText;
    }

    function initializeGameParameters() {
        playerSize = canvas.height * 0.025 > 12 ? canvas.height * 0.025 : 12;
        playerX = canvas.width / 2 - playerSize / 2;
        playerY = canvas.height - playerSize - 15;
        playerVelocityX = 0; 
        playerActualSpeedPPS = 300; // Contoh: 300 PPS, sesuaikan feel-nya

        obstacleBaseRadius = canvas.height * 0.012 > 6 ? canvas.height * 0.012 : 6;

        currentMinSpawnInterval = initialMinSpawnInterval;
        currentMaxSpawnInterval = initialMaxSpawnInterval;
        currentMinObstacleSpeedPPS = initialMinObstacleSpeedPPS;
        currentMaxObstacleSpeedPPS = initialMaxObstacleSpeedPPS;
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initializeGameParameters(); 
        playerY = canvas.height - playerSize - 15;
        if (gameState === 'playing') {
            playerX = Math.max(0, Math.min(playerX, canvas.width - playerSize));
        }
    }

    function drawPlayer() {
        // ... (kode drawPlayer tidak berubah)
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
        // ... (kode drawPolygon tidak berubah)
        ctx.beginPath();
        ctx.moveTo(x + radius * Math.cos(rotation), y + radius * Math.sin(rotation));
        for (let i = 1; i <= sides; i++) {
            ctx.lineTo(
                x + radius * Math.cos(rotation + (i * 2 * Math.PI / sides)),
                y + radius * Math.sin(rotation + (i * 2 * Math.PI / sides))
            );
        }
        ctx.closePath();
        ctx.fillStyle = colorStr;
        ctx.fill();
    }

    function drawObstacles() {
        // ... (kode drawObstacles tidak berubah)
        obstacles.forEach(obstacle => {
            ctx.save();
            ctx.translate(obstacle.x, obstacle.y);
            ctx.rotate(obstacle.rotation);
            const type = obstacle.type;
            const colorStr = `rgb(${type.baseColor[0]}, ${type.baseColor[1]}, ${type.baseColor[2]})`;
            if (type.sides === 0) {
                ctx.beginPath();
                ctx.arc(0, 0, obstacle.radius, 0, Math.PI * 2);
                ctx.fillStyle = colorStr;
                ctx.fill();
            } else {
                drawPolygon(0, 0, obstacle.radius, type.sides, colorStr, 0);
            }
            ctx.restore();
        });
    }

    function updatePlayerPosition(deltaTime) { 
        playerX += playerVelocityX * deltaTime; 
        if (playerX < 0) {
            playerX = 0;
            if(playerVelocityX < 0) playerVelocityX = 0; 
        }
        if (playerX + playerSize > canvas.width) {
            playerX = canvas.width - playerSize;
            if(playerVelocityX > 0) playerVelocityX = 0;
        }
    }

    function spawnObstacle() {
        // ... (kode spawnObstacle tidak berubah signifikan, pastikan speed dan rotationSpeed adalah PPS/RPS)
        const randomTypeIndex = Math.floor(Math.random() * OBSTACLE_TYPES.length);
        const type = OBSTACLE_TYPES[randomTypeIndex];
        
        const radiusFactor = (type.sides === 0 || type.sides === 4) ? 1.0 : (type.sides === 3 ? 1.1 : (type.sides === 5 ? 1.2 : 1.3));
        const radius = obstacleBaseRadius * radiusFactor;
        const x = Math.random() * (canvas.width - radius * 2) + radius;
        const y = -radius;
        
        const speedPPS = Math.random() * (currentMaxObstacleSpeedPPS - currentMinObstacleSpeedPPS) + currentMinObstacleSpeedPPS;
        const rotationSpeedRPS = ((Math.random() - 0.5) * 0.05) * 60; 

        obstacles.push({ x, y, radius, type, 
            speed: speedPPS, 
            rotation: Math.random() * Math.PI * 2, 
            rotationSpeed: rotationSpeedRPS 
        });
        lastObstacleSpawnTime = performance.now();
    }

    function updateObstacles(deltaTime) {
        // ... (kode updateObstacles tidak berubah signifikan)
        const currentTime = performance.now();
        const nextSpawnDelay = Math.random() * (currentMaxSpawnInterval - currentMinSpawnInterval) + currentMinSpawnInterval;

        if (gameState === 'playing' && (currentTime - lastObstacleSpawnTime) > nextSpawnDelay) {
            spawnObstacle();
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.y += obs.speed * deltaTime; 
            obs.rotation += obs.rotationSpeed * deltaTime;

            if (obs.y - obs.radius > canvas.height) {
                obstacles.splice(i, 1);
                if (gameState === 'playing') {
                    score += obs.type.points;
                    updateScoreDisplay();
                }
            }
        }
    }
    
    function checkCollision() {
        // ... (kode checkCollision tidak berubah)
        if (gameState !== 'playing') return;

        obstacles.forEach((obstacle, index) => {
            const playerCenterX = playerX + playerSize / 2;
            const playerEffectiveRadius = playerSize * 0.40; 
            const playerCenterY = playerY + playerSize * 0.5; 

            const dx = obstacle.x - playerCenterX;
            const dy = obstacle.y - playerCenterY; 
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
        // ... (kode applyMultiplier tidak berubah)
        currentMinSpawnInterval = Math.max(40, currentMinSpawnInterval / SPAWN_INTERVAL_DIVISOR);
        currentMaxSpawnInterval = Math.max(currentMinSpawnInterval + 50, currentMaxSpawnInterval / SPAWN_INTERVAL_DIVISOR);
        currentMinObstacleSpeedPPS *= SPEED_RANGE_MULTIPLIER_INCREASE;
        currentMaxObstacleSpeedPPS *= SPEED_RANGE_MULTIPLIER_INCREASE;
        currentMinObstacleSpeedPPS = Math.min(currentMinObstacleSpeedPPS, 1500); 
        currentMaxObstacleSpeedPPS = Math.min(currentMaxObstacleSpeedPPS, 2500);
        console.log(`Multiplier: Spawn [${currentMinSpawnInterval.toFixed(0)}-${currentMaxSpawnInterval.toFixed(0)}ms], Speed [${currentMinObstacleSpeedPPS.toFixed(0)}-${currentMaxObstacleSpeedPPS.toFixed(0)}PPS]`);
        lastMultiplierTime = performance.now();
    }

    function updateScoreAndHpDisplays() {
        updateHpDisplay();
        updateScoreDisplay();
    }
    function updateHpDisplay() {
        hpDisplay.textContent = `HP: ${playerHP}`;
    }
    function updateScoreDisplay() {
        scoreDisplay.textContent = `Skor: ${score}`;
    }

    function transitionToState(newState) {
        gameState = newState;
        mainMenuScreen.style.display = (newState === 'mainMenu') ? 'flex' : 'none';
        uiContainer.style.display = (newState === 'playing') ? 'block' : 'none';
        canvas.style.display = (newState === 'mainMenu') ? 'none' : 'block';
        gameOverScreen.style.display = (newState === 'gameOver') ? 'flex' : 'none';

        if (animationFrameId && (newState === 'mainMenu' || newState === 'gameOver')) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (newState === 'mainMenu' || newState === 'gameOver') {
             updateHighScoreDisplays();
        }
    }

    function endGame() {
        transitionToState('gameOver'); // Ini sudah membatalkan frame jika perlu
        isPointerDown = false; 
        playerVelocityX = 0;   
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('obstacleProRevampedHighScore', highScore);
        }
        finalScoreText.textContent = `Skor Akhir: ${score}`;
        updateHighScoreDisplays(); // Memastikan high score di game over screen terupdate
    }

    function resetGame() {
        score = 0;
        playerHP = PLAYER_MAX_HP;
        obstacles = [];
        playerColor = PLAYER_DEFAULT_COLOR;
        playerHitEndTime = 0;
        isPointerDown = false; 
        playerVelocityX = 0; // Pastikan velocity player juga reset
        
        resizeCanvas(); 

        lastObstacleSpawnTime = performance.now();
        gameStartTime = performance.now();
        lastMultiplierTime = gameStartTime;
        
        lastFrameTime = 0; // ***PERBAIKAN PENTING***: Reset untuk frame pertama gameLoop

        updateScoreAndHpDisplays();
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        // ***PERBAIKAN PENTING***: Hanya jadwalkan gameLoop, jangan panggil langsung
        animationFrameId = requestAnimationFrame(gameLoop); 
    }

    function gameLoop(currentTime) { 
        if (gameState !== 'playing') {
            // Jika ada frame yang 'lolos' setelah state berubah, batalkan.
            // Seharusnya transitionToState sudah menangani ini.
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            return;
        }

        // ***PERBAIKAN PENTING***: Logika untuk frame pertama / setelah reset
        if (lastFrameTime === 0) { 
            lastFrameTime = currentTime; // Inisialisasi untuk membuat deltaTime pertama valid (atau 0)
        }
        const deltaTime = (currentTime - lastFrameTime) / 1000; 
        lastFrameTime = currentTime;
        const effectiveDeltaTime = Math.min(deltaTime, 1 / 30);

        if (performance.now() - lastMultiplierTime > MULTIPLIER_INTERVAL) {
            applyMultiplier();
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        updatePlayerPosition(effectiveDeltaTime); 
        updateObstacles(effectiveDeltaTime); 
        checkCollision();
        drawObstacles();
        drawPlayer();

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // Player Controls
    function handlePointerDown(event) {
        // ... (kode handlePointerDown tidak berubah)
        event.preventDefault();
        if (gameState !== 'playing') return;
        isPointerDown = true;
        const rect = canvas.getBoundingClientRect();
        let pointerX;
        if (event.touches && event.touches.length > 0) {
            pointerX = event.touches[0].clientX - rect.left;
        } else {
            pointerX = event.clientX - rect.left;
        }
        if (pointerX < canvas.width / 2) {
            playerVelocityX = -playerActualSpeedPPS; 
        } else {
            playerVelocityX = playerActualSpeedPPS; 
        }
    }

    function handlePointerMove(event) {
        // ... (kode handlePointerMove tidak berubah)
        event.preventDefault();
        if (gameState !== 'playing' || !isPointerDown) return;
    }

    function handlePointerUp(event) {
        // ... (kode handlePointerUp tidak berubah)
        event.preventDefault();
        isPointerDown = false;
        if (gameState === 'playing') {
             playerVelocityX = 0;
        }
    }
    
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    canvas.addEventListener('mousemove', handlePointerMove, { passive: false });
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchend', handlePointerUp);
    document.addEventListener('touchcancel', handlePointerUp);

    window.addEventListener('resize', () => {
        const oldGameState = gameState;
        resizeCanvas(); 
        if (oldGameState !== 'playing') {
            transitionToState(oldGameState); 
        }
    });

    startGameButton.addEventListener('click', () => {
        transitionToState('playing');
        resetGame(); // resetGame sekarang akan memulai gameLoop via requestAnimationFrame
    });

    restartButton.addEventListener('click', () => {
        // transitionToState('playing'); // Tidak perlu jika resetGame dipanggil dari gameOver
        resetGame(); // Langsung reset dan mulai lagi
    });

    returnToMenuButton.addEventListener('click', () => {
        transitionToState('mainMenu');
    });

    updateHighScoreDisplays(); 
    resizeCanvas();          
    transitionToState('mainMenu');
});
