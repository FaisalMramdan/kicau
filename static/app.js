// ============================================================
//  KICAU MANIA - Web Hand Tracker
//  MediaPipe Hands JS + Motion Detection
//  Trigger: Hand MOVEMENT (gerak-gerak tangan)
// ============================================================

// --- DOM Elements ---
const landingPage = document.getElementById('landingPage');
const startBtn = document.getElementById('startBtn');
const trackingPage = document.getElementById('trackingPage');

const cameraFrame = document.getElementById('cameraFrame');
const camLoading = document.getElementById('camLoading');
const cameraFeed = document.getElementById('cameraFeed');
const handCanvas = document.getElementById('handCanvas');
const particleCanvas = document.getElementById('particleCanvas');
const handCtx = handCanvas.getContext('2d');
const particleCtx = particleCanvas.getContext('2d');

const detectBadge = document.getElementById('detectBadge');
const detectText = document.getElementById('detectText');
const motionBarWrap = document.getElementById('motionBarWrap');
const motionBarFill = document.getElementById('motionBarFill');
const instructionBanner = document.getElementById('instructionBanner');

const kicauPopup = document.getElementById('kicauPopup');
const kicauVideo = document.getElementById('kicauVideo');
const kicauCloseBtn = document.getElementById('kicauCloseBtn');
const kicauActiveBanner = document.getElementById('kicauActiveBanner');

const switchCamBtn = document.getElementById('switchCamBtn');
const soundBtn = document.getElementById('soundBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

// --- State ---
let currentFacing = 'user';
let isMuted = false;
let kicauTimer = 0;
const TIMER_DURATION = 90;
let particles = [];
let videoManualClosed = false;
let mpCamera = null;
let handsInstance = null;

// --- Motion Detection ---
let prevLandmarks = null;
let motionHistory = [];
const MOTION_HISTORY_SIZE = 10;
const MOTION_THRESHOLD = 0.02;
let isHandMoving = false;
let motionLevel = 0;
let wasKicauActive = false;

// --- Particles ---
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 5;
        this.speedY = (Math.random() - 0.5) * 5;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
        this.hue = 160 + Math.random() * 20;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.size *= 0.98;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = `hsl(${this.hue}, 80%, 65%)`;
        ctx.shadowColor = `hsl(${this.hue}, 80%, 65%)`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function spawnParticles(x, y, count = 5) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function tickParticles() {
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.update(); p.draw(particleCtx); });
    requestAnimationFrame(tickParticles);
}

// --- Motion Calculation ---
function calcMotion(curr, prev) {
    if (!prev || !curr) return 0;
    let total = 0;
    const keys = [0, 4, 5, 8, 9, 12, 13, 16, 17, 20];
    for (const i of keys) {
        const dx = curr[i].x - prev[i].x;
        const dy = curr[i].y - prev[i].y;
        total += Math.sqrt(dx * dx + dy * dy);
    }
    return total / keys.length;
}

// --- Draw Hands ---
function drawHands(results) {
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        prevLandmarks = null;
        return 0;
    }

    let maxMotion = 0;
    const w = handCanvas.width;
    const h = handCanvas.height;

    results.multiHandLandmarks.forEach((landmarks) => {
        const motion = calcMotion(landmarks, prevLandmarks);
        maxMotion = Math.max(maxMotion, motion);

        const glow = Math.min(1, motionLevel * 3);
        const conns = [
            [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
            [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
            [13,17],[17,18],[18,19],[19,20],[0,17]
        ];

        // Lines
        handCtx.save();
        handCtx.strokeStyle = isHandMoving
            ? `rgba(45, 212, 168, ${0.6 + glow * 0.4})`
            : 'rgba(45, 212, 168, 0.4)';
        handCtx.lineWidth = isHandMoving ? 3 : 2;
        handCtx.shadowColor = 'rgba(45, 212, 168, 0.6)';
        handCtx.shadowBlur = isHandMoving ? 18 + glow * 15 : 6;
        handCtx.lineCap = 'round';

        conns.forEach(([s, e]) => {
            const x1 = (1 - landmarks[s].x) * w, y1 = landmarks[s].y * h;
            const x2 = (1 - landmarks[e].x) * w, y2 = landmarks[e].y * h;
            handCtx.beginPath();
            handCtx.moveTo(x1, y1);
            handCtx.lineTo(x2, y2);
            handCtx.stroke();
        });
        handCtx.restore();

        // Dots
        landmarks.forEach((lm, idx) => {
            const x = (1 - lm.x) * w, y = lm.y * h;
            const isTip = [4, 8, 12, 16, 20].includes(idx);
            handCtx.save();
            handCtx.fillStyle = isTip ? '#22d3ee' : '#2dd4a8';
            handCtx.shadowColor = isTip ? 'rgba(34,211,238,0.8)' : 'rgba(45,212,168,0.8)';
            handCtx.shadowBlur = isTip ? 14 : 6;
            handCtx.beginPath();
            handCtx.arc(x, y, isTip ? 5 : 3.5, 0, Math.PI * 2);
            handCtx.fill();
            handCtx.restore();

            if (isTip && isHandMoving && Math.random() < 0.3) spawnParticles(x, y, 2);
        });
    });

    if (results.multiHandLandmarks.length > 0) {
        prevLandmarks = results.multiHandLandmarks[0].map(l => ({x: l.x, y: l.y, z: l.z}));
    }

    return maxMotion;
}

// --- On Detection Results ---
function onResults(results) {
    const vw = cameraFeed.videoWidth, vh = cameraFeed.videoHeight;
    if (vw && vh) {
        if (handCanvas.width !== vw) { handCanvas.width = vw; particleCanvas.width = vw; }
        if (handCanvas.height !== vh) { handCanvas.height = vh; particleCanvas.height = vh; }
    }

    const numHands = results.multiHandLandmarks?.length || 0;
    const motion = drawHands(results);

    // Motion analysis
    if (numHands > 0) {
        motionHistory.push(motion);
        if (motionHistory.length > MOTION_HISTORY_SIZE) motionHistory.shift();
        motionLevel = motionHistory.reduce((a, b) => a + b, 0) / motionHistory.length;
        isHandMoving = motionLevel > MOTION_THRESHOLD;
        motionBarWrap.classList.add('visible');
    } else {
        motionHistory = [];
        motionLevel = 0;
        isHandMoving = false;
        motionBarWrap.classList.remove('visible');
    }

    // Motion bar UI
    const barPercent = Math.min(100, motionLevel * 2000);
    motionBarFill.style.width = `${barPercent}%`;

    // Camera frame border
    if (isHandMoving) {
        cameraFrame.classList.add('active', 'kicau-active');
    } else if (numHands > 0) {
        cameraFrame.classList.add('active');
        cameraFrame.classList.remove('kicau-active');
    } else {
        cameraFrame.classList.remove('active', 'kicau-active');
    }

    // Trigger logic
    if (isHandMoving) {
        detectBadge.className = 'detect-badge active';
        detectText.textContent = 'KICAU DETECTED!';

        if (kicauTimer <= 0) {
            cameraFrame.classList.add('flash');
            setTimeout(() => cameraFrame.classList.remove('flash'), 400);
        }

        kicauTimer = TIMER_DURATION;
        videoManualClosed = false;

        // Instruction update
        instructionBanner.textContent = 'Tangan terdeteksi bergerak! Video kicau aktif! 🐦';
        instructionBanner.classList.add('active');
    } else if (numHands > 0) {
        detectBadge.className = 'detect-badge warning';
        detectText.textContent = 'GERAKKAN TANGAN!';
        if (kicauTimer > 0) kicauTimer--;
        instructionBanner.textContent = 'Tangan terdeteksi! Gerakkan lebih cepat! 👋';
        instructionBanner.classList.remove('active');
    } else {
        if (kicauTimer > 0) kicauTimer--;
        instructionBanner.textContent = 'Ayo mulai! Gerakkan tangan kamu di depan kamera 👋';
        instructionBanner.classList.remove('active');
    }

    if (kicauTimer <= 0) {
        detectBadge.className = 'detect-badge idle';
        detectText.textContent = 'SCANNING...';
    }

    // Video popup
    const isKicauActive = kicauTimer > 0 && !videoManualClosed;
    if (isKicauActive && !wasKicauActive) {
        kicauPopup.classList.remove('hidden');
        kicauActiveBanner.classList.remove('hidden');
        kicauVideo.currentTime = 0;
        kicauVideo.muted = isMuted;
        kicauVideo.play().catch(() => {});
    } else if (!isKicauActive && wasKicauActive) {
        kicauPopup.classList.add('hidden');
        kicauActiveBanner.classList.add('hidden');
        kicauVideo.pause();
    }
    wasKicauActive = isKicauActive;
}

// --- Init MediaPipe ---
async function initHands() {
    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5
    });
    hands.onResults(onResults);
    return hands;
}

// --- Start Camera ---
async function startCamera(hands) {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
    });

    cameraFeed.srcObject = stream;
    await cameraFeed.play();

    mpCamera = new Camera(cameraFeed, {
        onFrame: async () => { await hands.send({ image: cameraFeed }); },
        width: 1280, height: 720
    });
    await mpCamera.start();

    camLoading.classList.add('hidden');
}

// --- Switch Camera ---
async function switchCamera() {
    const stream = cameraFeed.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (mpCamera) mpCamera.stop();

    currentFacing = currentFacing === 'user' ? 'environment' : 'user';
    cameraFeed.style.transform = currentFacing === 'user' ? 'scaleX(-1)' : 'scaleX(1)';

    try {
        await startCamera(handsInstance);
    } catch (e) {
        currentFacing = currentFacing === 'user' ? 'environment' : 'user';
        cameraFeed.style.transform = currentFacing === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    }
}

// --- Landing → Tracking ---
async function beginExperience() {
    landingPage.classList.add('hidden');
    trackingPage.classList.remove('hidden');

    try {
        handsInstance = await initHands();
        await startCamera(handsInstance);
    } catch (err) {
        console.error(err);
        camLoading.querySelector('.cam-loading-text').textContent = 'CAMERA ERROR - REFRESH';
    }
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => {
    tickParticles();

    startBtn.addEventListener('click', beginExperience);

    switchCamBtn.addEventListener('click', switchCamera);

    soundBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        kicauVideo.muted = isMuted;
        soundBtn.classList.toggle('muted', isMuted);
    });

    kicauCloseBtn.addEventListener('click', () => {
        videoManualClosed = true;
        kicauPopup.classList.add('hidden');
        kicauActiveBanner.classList.add('hidden');
        kicauVideo.pause();
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)?.call(document.documentElement);
        } else {
            (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
        }
    });

    kicauVideo.load();
});
