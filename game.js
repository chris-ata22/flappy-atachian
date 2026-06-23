(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start-btn');
  const scoreDisplay = document.getElementById('score-display');
  const instructions = document.getElementById('instructions');

  const GAME_WIDTH = 400;
  const GAME_HEIGHT = 600;

  const GRAVITY = 0.42;
  const FLAP = -7.5;
  const PIPE_SPEED = 2.4;
  const PIPE_GAP = 155;
  const PIPE_WIDTH = 72;
  const PIPE_INTERVAL = 1800;
  const PLAYER_SIZE = 52;

  const COLORS = {
    skyTop: '#c9b8a8',
    skyMid: '#d4c4b0',
    skyBottom: '#e8dcc8',
    brickDark: '#6b3a2a',
    brickMid: '#8b4513',
    brickLight: '#a0522d',
    mortar: '#c4a882',
    stone: '#9a8b7a',
    stoneLight: '#b8a898',
    archShadow: '#4a2c1f',
    gold: '#c4a060',
  };

  let playerImage = new Image();
  playerImage.src = 'assets/player.png';

  let state = 'ready';
  let score = 0;
  let bestScore = parseInt(localStorage.getItem('flappyAtachianBest') || '0', 10);
  let lastPipeTime = 0;
  let frameCount = 0;

  const player = {
    x: 90,
    y: GAME_HEIGHT / 2,
    vy: 0,
    rotation: 0,
  };

  let pipes = [];
  let particles = [];
  let parallaxOffset = 0;
  let arches = [];

  function resizeCanvas() {
    const aspect = GAME_WIDTH / GAME_HEIGHT;
    let w = window.innerWidth;
    let h = window.innerHeight;

    if (w / h > aspect) {
      w = h * aspect;
    } else {
      h = w / aspect;
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  function initArches() {
    arches = [];
    for (let i = 0; i < 8; i++) {
      arches.push({
        x: i * 120 - 40,
        y: GAME_HEIGHT * 0.55 + (i % 3) * 15,
        width: 80 + (i % 2) * 20,
        height: 100 + (i % 3) * 30,
        depth: 0.3 + (i % 4) * 0.15,
      });
    }
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: 1 + Math.random() * 2.5,
        speed: 0.2 + Math.random() * 0.5,
        opacity: 0.15 + Math.random() * 0.35,
        drift: (Math.random() - 0.5) * 0.3,
      });
    }
  }

  function resetGame() {
    player.y = GAME_HEIGHT / 2;
    player.vy = 0;
    player.rotation = 0;
    pipes = [];
    score = 0;
    lastPipeTime = 0;
    frameCount = 0;
    parallaxOffset = 0;
    initArches();
    initParticles();
  }

  function flap() {
    if (state === 'ready') {
      state = 'playing';
      overlay.classList.add('hidden');
      player.vy = FLAP;
      return;
    }
    if (state === 'playing') {
      player.vy = FLAP;
    }
    if (state === 'over') {
      resetGame();
      state = 'playing';
      overlay.classList.add('hidden');
      player.vy = FLAP;
    }
  }

  function spawnPipe() {
    const minTop = 80;
    const maxTop = GAME_HEIGHT - PIPE_GAP - 120;
    const topHeight = minTop + Math.random() * (maxTop - minTop);

    pipes.push({
      x: GAME_WIDTH + 20,
      topHeight,
      passed: false,
      capHeight: 28,
    });
  }

  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, COLORS.skyTop);
    grad.addColorStop(0.45, COLORS.skyMid);
    grad.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  function drawBrickPattern(x, y, w, h, scale) {
    const rowH = 10 * scale;
    const colW = 22 * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    for (let row = 0; row < h / rowH + 1; row++) {
      const offset = (row % 2) * (colW / 2);
      for (let col = -1; col < w / colW + 2; col++) {
        const bx = x + col * colW + offset;
        const by = y + row * rowH;
        const shade = (row + col) % 3;
        ctx.fillStyle = shade === 0 ? COLORS.brickDark : shade === 1 ? COLORS.brickMid : COLORS.brickLight;
        ctx.fillRect(bx + 1, by + 1, colW - 2, rowH - 2);
        ctx.strokeStyle = COLORS.mortar;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, colW, rowH);
      }
    }
    ctx.restore();
  }

  function drawDistantBuildings() {
    const offset = (parallaxOffset * 0.15) % 200;

    for (let layer = 0; layer < 3; layer++) {
      const depth = 0.2 + layer * 0.12;
      const alpha = 0.15 + layer * 0.08;
      const yBase = GAME_HEIGHT * (0.35 + layer * 0.08);

      ctx.fillStyle = `rgba(74, 44, 31, ${alpha})`;

      for (let i = -1; i < 6; i++) {
        const bx = i * 180 - offset * depth - layer * 30;
        const bh = 80 + layer * 40 + (i % 3) * 25;
        ctx.fillRect(bx, yBase - bh, 100, bh);

        ctx.beginPath();
        ctx.arc(bx + 50, yBase - bh, 35, Math.PI, 0);
        ctx.fill();

        if (layer === 1) {
          ctx.fillStyle = `rgba(107, 58, 42, ${alpha * 0.7})`;
          for (let win = 0; win < 3; win++) {
            ctx.fillRect(bx + 15 + win * 25, yBase - bh + 20, 12, 18);
          }
          ctx.fillStyle = `rgba(74, 44, 31, ${alpha})`;
        }
      }
    }
  }

  function drawParallaxArches() {
    arches.forEach((arch) => {
      const x = ((arch.x - parallaxOffset * arch.depth) % (GAME_WIDTH + 160)) - 80;
      const alpha = 0.12 + arch.depth * 0.15;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.archShadow;
      ctx.fillRect(x, arch.y, arch.width, arch.height);

      ctx.beginPath();
      ctx.arc(x + arch.width / 2, arch.y, arch.width / 2, Math.PI, 0);
      ctx.fill();

      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 1;
      ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath();
      ctx.arc(x + arch.width / 2, arch.y, arch.width / 2 - 3, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawCourtyardFloor() {
    const floorY = GAME_HEIGHT - 60;
    const grad = ctx.createLinearGradient(0, floorY, 0, GAME_HEIGHT);
    grad.addColorStop(0, '#7a6a5a');
    grad.addColorStop(1, '#5a4a3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, floorY, GAME_WIDTH, 60);

    drawBrickPattern(0, floorY - 8, GAME_WIDTH, 68, 0.8);

    ctx.strokeStyle = 'rgba(196, 160, 130, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(GAME_WIDTH, floorY);
    ctx.stroke();
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 235, 224, ${p.opacity})`;
      ctx.fill();
    });
  }

  function updateParticles() {
    particles.forEach((p) => {
      p.x -= p.speed;
      p.y += p.drift;
      if (p.x < -5) {
        p.x = GAME_WIDTH + 5;
        p.y = Math.random() * GAME_HEIGHT * 0.7;
      }
    });
  }

  function drawColumn(x, y, w, h, isTop) {
    const capH = 28;

    ctx.save();

    if (isTop) {
      drawBrickPattern(x - 4, y, w + 8, capH, 1);
      ctx.fillStyle = COLORS.stone;
      ctx.fillRect(x - 6, y + capH - 4, w + 12, 8);
      drawBrickPattern(x, y + capH, w, h - capH, 1);

      ctx.fillStyle = COLORS.stoneLight;
      ctx.fillRect(x + 4, y + capH, 6, h - capH);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x + w - 10, y + capH, 6, h - capH);
    } else {
      drawBrickPattern(x, y, w, h - capH, 1);
      ctx.fillStyle = COLORS.stone;
      ctx.fillRect(x - 6, y + h - capH - 4, w + 12, 8);
      drawBrickPattern(x - 4, y + h - capH, w + 8, capH, 1);

      ctx.fillStyle = COLORS.stoneLight;
      ctx.fillRect(x + 4, y, 6, h - capH);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x + w - 10, y, 6, h - capH);
    }

    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    if (isTop) {
      ctx.strokeRect(x - 4, y, w + 8, capH);
    } else {
      ctx.strokeRect(x - 4, y + h - capH, w + 8, capH);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawPipes() {
    pipes.forEach((pipe) => {
      drawColumn(pipe.x, 0, PIPE_WIDTH, pipe.topHeight, true);
      const bottomY = pipe.topHeight + PIPE_GAP;
      const bottomH = GAME_HEIGHT - bottomY - 60;
      drawColumn(pipe.x, bottomY, PIPE_WIDTH, bottomH, false);
    });
  }

  function drawPlayer() {
    const cx = player.x;
    const cy = player.y;
    const r = PLAYER_SIZE / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.rotation);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.gold;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    if (playerImage.complete && playerImage.naturalWidth) {
      const imgAspect = playerImage.width / playerImage.height;
      let sw, sh, sx, sy;
      if (imgAspect > 1) {
        sh = playerImage.height * 0.55;
        sw = sh;
        sx = (playerImage.width - sw) / 2;
        sy = playerImage.height * 0.05;
      } else {
        sw = playerImage.width * 0.85;
        sh = sw;
        sx = (playerImage.width - sw) / 2;
        sy = playerImage.height * 0.02;
      }
      ctx.drawImage(playerImage, sx, sy, sw, sh, -r, -r, PLAYER_SIZE, PLAYER_SIZE);
    } else {
      ctx.fillStyle = '#8b7355';
      ctx.fill();
    }

    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.rotation);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawScore() {
    if (state === 'playing' || state === 'over') {
      ctx.save();
      ctx.font = 'bold 36px "Playfair Display", serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = 'rgba(74, 44, 31, 0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(String(score), GAME_WIDTH / 2, 55);
      ctx.fillText(String(score), GAME_WIDTH / 2, 55);
      ctx.restore();
    }
  }

  function drawReadyHint() {
    if (state === 'ready') {
      ctx.save();
      ctx.font = '600 14px "Source Sans 3", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(74, 44, 31, 0.7)';
      const bounce = Math.sin(frameCount * 0.08) * 4;
      ctx.fillText('Tap to begin', GAME_WIDTH / 2, player.y + PLAYER_SIZE + 30 + bounce);
      ctx.restore();
    }
  }

  function checkCollision() {
    const cx = player.x;
    const cy = player.y;
    const r = PLAYER_SIZE / 2 - 4;

    if (cy - r < 0 || cy + r > GAME_HEIGHT - 60) {
      return true;
    }

    for (const pipe of pipes) {
      const inX = cx + r > pipe.x && cx - r < pipe.x + PIPE_WIDTH;
      if (!inX) continue;

      const hitTop = cy - r < pipe.topHeight;
      const hitBottom = cy + r > pipe.topHeight + PIPE_GAP;
      if (hitTop || hitBottom) return true;
    }

    return false;
  }

  function gameOver() {
    state = 'over';
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('flappyAtachianBest', String(bestScore));
    }

    overlay.classList.remove('hidden');
    instructions.textContent = 'Tap, click, or press Space to try again';
    scoreDisplay.textContent = `Score: ${score}  ·  Best: ${bestScore}`;
    startBtn.textContent = 'Play Again';
    startBtn.style.display = 'inline-block';
  }

  function update(timestamp) {
    frameCount++;
    parallaxOffset += PIPE_SPEED * 0.5;
    updateParticles();

    if (state === 'playing') {
      player.vy += GRAVITY;
      player.y += player.vy;
      player.rotation = Math.max(-0.4, Math.min(0.6, player.vy * 0.06));

      if (timestamp - lastPipeTime > PIPE_INTERVAL) {
        spawnPipe();
        lastPipeTime = timestamp;
      }

      pipes.forEach((pipe) => {
        pipe.x -= PIPE_SPEED;
        if (!pipe.passed && pipe.x + PIPE_WIDTH < player.x) {
          pipe.passed = true;
          score++;
        }
      });

      pipes = pipes.filter((p) => p.x + PIPE_WIDTH > -20);

      if (checkCollision()) {
        gameOver();
      }
    } else if (state === 'ready') {
      player.y = GAME_HEIGHT / 2 + Math.sin(frameCount * 0.05) * 8;
      player.rotation = Math.sin(frameCount * 0.05) * 0.08;
    }

    drawSky();
    drawDistantBuildings();
    drawParallaxArches();
    drawCourtyardFloor();
    drawParticles();
    drawPipes();
    drawPlayer();
    drawScore();
    drawReadyHint();

    requestAnimationFrame(update);
  }

  function showStartScreen() {
    overlay.classList.remove('hidden');
    instructions.textContent = 'Tap, click, or press Space to fly';
    scoreDisplay.textContent = bestScore > 0 ? `Best: ${bestScore}` : '';
    startBtn.textContent = 'Start Game';
    startBtn.style.display = 'inline-block';
  }

  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetGame();
    state = 'playing';
    overlay.classList.add('hidden');
    player.vy = FLAP;
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    flap();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      flap();
    }
  });

  window.addEventListener('resize', resizeCanvas);

  resizeCanvas();
  resetGame();
  showStartScreen();

  playerImage.onload = () => requestAnimationFrame(update);
  if (playerImage.complete) requestAnimationFrame(update);
})();
