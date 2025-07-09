// --- 初期設定 ---
const { Engine, Render, Runner, Bodies, Composite, Body, Events } = Matter;

// --- ゲーム画面のサイズ設定 ---
const canvasWidth = Math.min(window.innerWidth, 480);
const canvasHeight = Math.min(window.innerHeight * 0.8, 800);

// --- DOM要素 ---
const gameCanvas = document.getElementById('game-canvas'); // ★ canvasを取得
const resultScreen = document.getElementById('result-screen');
const finalScoreElement = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');
const nextBlockCanvas = document.getElementById('next-block-canvas');
const nextBlockCtx = nextBlockCanvas.getContext('2d');

// --- 物理エンジンのセットアップ ---
const engine = Engine.create();
const world = engine.world;
const render = Render.create({
    canvas: gameCanvas, // ★ 変数を使用
    engine: engine, options: { width: canvasWidth, height: canvasHeight, wireframes: false, background: '#cceeff' }
});
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// --- グローバル変数 ---
let currentBlock = null, nextBlock = null;
let isBlockSettled = true, score = 0, settleTimer = 0;
const SETTLE_THRESHOLD_FRAMES = 30;
let gameOver = false;
let highestY = canvasHeight;
const UNIT_HEIGHT = 80;

// ★★★ タッチ操作用の変数を追加 ★★★
let isDragging = false;
let touchStartX = 0;
let blockStartX = 0;
let touchStartTime = 0;


const blockOptions = { label: 'block', restitution: 0, friction: 0.9 };
const blockTypes = [
    () => Bodies.rectangle(0, 0, 80, 80, { ...blockOptions }),
    () => Bodies.rectangle(0, 0, 160, 40, { ...blockOptions }),
    () => Bodies.rectangle(0, 0, 40, 160, { ...blockOptions, density: 0.002 }),
    () => Body.create({ ...blockOptions, parts: [ Bodies.rectangle(0, 0, 120, 40), Bodies.rectangle(-40, -40, 40, 40) ] })
];
const ground = Bodies.rectangle(canvasWidth / 2, canvasHeight - 30, canvasWidth * 0.9, 60, { isStatic: true, label: 'ground', friction: 1.0 });
Composite.add(world, [ground]);

// (createNewBlock, drawNextBlockなどの関数は変更なし)
function generateNextBlock() { const randomType = blockTypes[Math.floor(Math.random() * blockTypes.length)]; nextBlock = randomType(); }
function drawNextBlock() { nextBlockCtx.clearRect(0, 0, nextBlockCanvas.width, nextBlockCanvas.height); if (!nextBlock) return; const parts = nextBlock.parts.length > 1 ? nextBlock.parts.slice(1) : [nextBlock]; const bounds = nextBlock.bounds; const blockWidth = bounds.max.x - bounds.min.x; const blockHeight = bounds.max.y - bounds.min.y; const scale = Math.min(90 / blockWidth, 90 / blockHeight); const offsetX = nextBlockCanvas.width / 2; const offsetY = nextBlockCanvas.height / 2; parts.forEach(part => { nextBlockCtx.beginPath(); part.vertices.forEach((v, i) => { const x = (v.x - nextBlock.position.x) * scale + offsetX; const y = (v.y - nextBlock.position.y) * scale + offsetY; if (i === 0) { nextBlockCtx.moveTo(x, y); } else { nextBlockCtx.lineTo(x, y); } }); nextBlockCtx.closePath(); nextBlockCtx.fillStyle = '#95a5a6'; nextBlockCtx.fill(); nextBlockCtx.strokeStyle = '#34495e'; nextBlockCtx.stroke(); }); }
function createNewBlock() { if (!isBlockSettled || gameOver) return; isBlockSettled = false; currentBlock = nextBlock; generateNextBlock(); drawNextBlock(); const spawnY = render.bounds.min.y + 100; Body.setPosition(currentBlock, { x: canvasWidth / 2, y: spawnY }); Body.setStatic(currentBlock, true); Composite.add(world, currentBlock); }
function drawHeightRuler() { const ctx = render.context; ctx.font = '16px Arial'; ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.textAlign = 'left'; const groundTopY = ground.position.y - 30; const screenYForZero = groundTopY - render.bounds.min.y; ctx.beginPath(); ctx.moveTo(0, screenYForZero); ctx.lineTo(20, screenYForZero); ctx.stroke(); ctx.fillText('0', 25, screenYForZero + 5); for (let i = 1; i < 200; i++) { const worldY = groundTopY - (i * UNIT_HEIGHT); if (worldY < render.bounds.min.y - 20) break; if (worldY > render.bounds.max.y) continue; const screenY = worldY - render.bounds.min.y; ctx.beginPath(); ctx.moveTo(0, screenY); ctx.lineTo(20, screenY); ctx.stroke(); ctx.fillText(i, 25, screenY + 5); } }
function updateScore() { const groundTopY = ground.position.y - 30; const currentHeight = Math.floor((groundTopY - highestY) / UNIT_HEIGHT); score = Math.max(0, currentHeight); }
function dropBlock() { if (currentBlock) { Body.setStatic(currentBlock, false); currentBlock = null; } }
function triggerGameOver() { if (gameOver) return; gameOver = true; Runner.stop(runner); updateScore(); finalScoreElement.textContent = score; resultScreen.style.display = 'flex'; }
function checkGameOver() { const droppedBlocks = Composite.allBodies(world).filter(b => b.label === 'block' && !b.isStatic); for (const block of droppedBlocks) { if (block.position.y > ground.position.y + 20) { if(block.position.x < ground.bounds.min.x || block.position.x > ground.bounds.max.x) { triggerGameOver(); return; } } } }
function updateCamera() { const allBlocks = Composite.allBodies(world).filter(b => b.label === 'block' && !b.isStatic); if (allBlocks.length === 0) return; highestY = canvasHeight; allBlocks.forEach(block => { if (block.bounds.min.y < highestY) { highestY = block.bounds.min.y; } }); if (highestY < canvasHeight / 2) { const targetY = highestY - canvasHeight / 4; render.bounds.min.y += (targetY - render.bounds.min.y) * 0.05; render.bounds.max.y = render.bounds.min.y + canvasHeight; } }


// --- イベントリスナー ---
// PCのキーボード操作
document.addEventListener('keydown', (e) => {
    if (!currentBlock || gameOver) return;
    if (e.key === 'ArrowLeft') {
        Body.setPosition(currentBlock, { x: currentBlock.position.x - 20, y: currentBlock.position.y });
    } else if (e.key === 'ArrowRight') {
        Body.setPosition(currentBlock, { x: currentBlock.position.x + 20, y: currentBlock.position.y });
    } else if (e.key === 'ArrowDown' || e.key === ' ') {
        dropBlock();
    }
});

// ★★★ スマホ・タブレットのタッチ操作 ★★★
gameCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!currentBlock || gameOver) return;

    isDragging = true;
    touchStartX = e.touches[0].clientX;
    blockStartX = currentBlock.position.x;
    touchStartTime = Date.now();
}, { passive: false });

gameCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDragging || !currentBlock) return;

    const touchX = e.touches[0].clientX;
    const deltaX = touchX - touchStartX;
    Body.setPosition(currentBlock, {
        x: blockStartX + deltaX,
        y: currentBlock.position.y
    });
}, { passive: false });

gameCanvas.addEventListener('touchend', (e) => {
    if (!isDragging || !currentBlock) return;
    
    const touchDuration = Date.now() - touchStartTime;
    const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX);

    // 短い時間（200ms以内）で、移動距離が少ない（10px未満）場合は「タップ」と判断
    if (touchDuration < 200 && deltaX < 10) {
        dropBlock();
    }
    
    isDragging = false;
}, { passive: false });


// (他のイベントリスナーは変更なし)
restartButton.addEventListener('click', () => location.reload());
Events.on(engine, 'afterUpdate', () => { if (gameOver) return; updateCamera(); checkGameOver(); if (!currentBlock && !isBlockSettled) { const droppedBlocks = Composite.allBodies(world).filter(b => b.label === 'block' && !b.isStatic); const allBlocksSettled = droppedBlocks.every(b => b.speed < 0.25 && b.angularSpeed < 0.25); if (allBlocksSettled && droppedBlocks.length > 0) { settleTimer++; } else { settleTimer = 0; } if (settleTimer > SETTLE_THRESHOLD_FRAMES) { settleTimer = 0; isBlockSettled = true; updateScore(); createNewBlock(); } } });
Events.on(render, 'afterRender', drawHeightRuler);
// --- ゲーム開始 ---
generateNextBlock();
createNewBlock();
