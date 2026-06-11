// Application Configurations
const totalFrames = 191;
const images = [];
let loadedCount = 0;

// Easing/Inertia configuration with reduced-motion fallback check
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const LERP_FACTOR = prefersReducedMotion ? 1.0 : 0.06;

let currentFrame = 0;
let targetFrame = 0;
let lastDrawnFrame = -1;

// Global Live Volume Ticker State
let liveVolume = 48290320;

// DOM Elements
const canvas = document.getElementById('cinema-canvas');
const loaderOverlay = document.getElementById('loader');
const loaderPercent = document.getElementById('loader-percent');
const spinnerProgress = document.getElementById('spinner-progress');
const scrollPrompt = document.getElementById('scroll-prompt');
const prologueWrapper = document.querySelector('.prologue-wrapper');

// Prevent scrolling initially
document.body.classList.add('loading');

// Calculate SVG spinner circumference (r=45, C = 2 * PI * 45 ≈ 282.74)
const spinnerCircumference = 282.74;

// Get image path for a frame index (1-indexed)
function getFramePath(index) {
  const formattedIndex = String(index).padStart(3, '0');
  return `Frames/ezgif-frame-${formattedIndex}.jpg`;
}

// Update the preloader interface
function updatePreloader(progress) {
  const percentage = Math.round(progress * 100);
  loaderPercent.textContent = `${percentage}%`;
  
  // Update stroke-dashoffset on the circular progress
  const offset = spinnerCircumference - (progress * spinnerCircumference);
  spinnerProgress.style.strokeDashoffset = offset;
}

// Resize canvas to cover screen sharply based on device pixel ratio
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = window.innerWidth;
  const displayHeight = window.innerHeight;
  
  // Set canvas buffer sizes
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  
  // Set canvas display CSS sizes
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  
  // Force redraw the current active frame on resize
  if (images[Math.round(currentFrame)]) {
    drawFrame(Math.round(currentFrame));
  }
}

// Draw a specific frame onto the canvas
function drawFrame(index) {
  const img = images[index];
  if (!img || !img.complete) return;
  
  const ctx = canvas.getContext('2d');
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  
  // Clear the canvas space
  ctx.clearRect(0, 0, canvasW, canvasH);
  
  // Draw pure white background (so images blend seamlessly into an infinite environment)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);
  
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  
  const imgRatio = imgW / imgH;
  const canvasRatio = canvasW / canvasH;
  
  let drawW, drawH;
  
  // Cover scaling: fills the canvas buffer completely, cropping overflow to remove margins/borders
  if (canvasRatio > imgRatio) {
    // Canvas is wider than image (landscape) -> fit width
    drawW = canvasW;
    drawH = canvasW / imgRatio;
  } else {
    // Canvas is taller than image (portrait) -> fit height
    drawH = canvasH;
    drawW = canvasH * imgRatio;
  }
  
  // Center coordinates
  const x = (canvasW - drawW) / 2;
  const y = (canvasH - drawH) / 2;
  
  ctx.drawImage(img, x, y, drawW, drawH);
}

// Sync absolute typographic overlays with scroll fraction
function updateNarrativeText(scrollFraction) {
  toggleText('text-section-02', scrollFraction >= 0.05 && scrollFraction <= 0.30);
  toggleText('text-section-04', scrollFraction >= 0.30 && scrollFraction <= 0.55);
  toggleText('text-section-06', scrollFraction >= 0.55 && scrollFraction <= 0.80);
  toggleText('text-section-09', scrollFraction >= 0.80);
}

function toggleText(id, active) {
  const el = document.getElementById(id);
  if (!el) return;
  if (active) {
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
}

// Event handler for scroll to update target frame
function updateHeaderOnScroll(scrollTop) {
  const header = document.querySelector('.global-header');
  if (!header) return;
  const headerRect = header.getBoundingClientRect();
  const elementsUnder = document.elementsFromPoint(headerRect.left + 20, headerRect.top + 30);
  let foundDark = false;
  for (const el of elementsUnder) {
    if (el.classList && (
      el.classList.contains('stats-section') ||
      el.classList.contains('testimonials-section') ||
      el.classList.contains('trust-section') ||
      el.classList.contains('final-calm-section') ||
      el.id === 'auth-overlay'
    )) {
      foundDark = true;
      break;
    }
  }
  header.classList.toggle('scrolled', scrollTop > 80);
  header.classList.toggle('dark', foundDark);
}

function onScroll() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const prologueHeight = prologueWrapper.offsetHeight;
  const maxScroll = prologueHeight - window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  const scrollFraction = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;
  updateHeaderOnScroll(scrollTop);
  
  
  if (scrollTop > maxScroll) {
    // We are scrolling in the Marketing Suite
    const suiteScroll = scrollTop - maxScroll;
    const suiteHeight = docHeight - prologueHeight;
    const bottomThreshold = suiteHeight - window.innerHeight * 2.2; // Trigger height for Section 15 & 16
    
    if (suiteScroll > bottomThreshold) {
      // Smoothly fade the canvas back in as we enter the Final Calm and CTA blocks
      const fadeBackFraction = Math.min(1, (suiteScroll - bottomThreshold) / (window.innerHeight * 2));
      canvas.style.opacity = fadeBackFraction * 0.4; // Max 40% background opacity
      targetFrame = totalFrames - 1; // Freeze on the final calm wave frame
    } else {
      // Normal fade out as the user enters the product reveal section
      const fadeDistance = window.innerHeight * 0.8;
      const fadeFraction = Math.min(1, suiteScroll / fadeDistance);
      canvas.style.opacity = 1 - fadeFraction;
      
      // Update target frame normally relative to the prologue scroll
      targetFrame = Math.min(totalFrames - 1, Math.floor(scrollFraction * totalFrames));
    }
  } else {
    // We are inside the prologue container, keep canvas fully opaque and active
    canvas.style.opacity = 1;
    targetFrame = Math.min(totalFrames - 1, Math.floor(scrollFraction * totalFrames));
  }
  
  // Sync typographic narrative blocks
  updateNarrativeText(scrollFraction);
  
  // Hide or show scroll prompt based on scroll position
  if (scrollTop > 40) {
    scrollPrompt.classList.remove('visible');
    scrollPrompt.classList.add('hidden');
  } else {
    scrollPrompt.classList.remove('hidden');
    scrollPrompt.classList.add('visible');
  }
}

// Animation loop to interpolate frames smoothly
function tick() {
  // LERP current frame closer to target frame
  currentFrame += (targetFrame - currentFrame) * LERP_FACTOR;
  
  // Snap when close enough
  if (Math.abs(targetFrame - currentFrame) < 0.005) {
    currentFrame = targetFrame;
  }
  
  const roundedFrame = Math.round(currentFrame);
  
  // Render frame only if index changes
  if (roundedFrame !== lastDrawnFrame) {
    drawFrame(roundedFrame);
    lastDrawnFrame = roundedFrame;
  }
  
  requestAnimationFrame(tick);
}

// Preload sequence frames
function preloadAllFrames(onProgress, onComplete) {
  for (let i = 1; i <= totalFrames; i++) {
    const img = new Image();
    
    img.onload = () => {
      loadedCount++;
      onProgress(loadedCount / totalFrames);
      if (loadedCount === totalFrames) {
        onComplete();
      }
    };
    
    img.onerror = () => {
      console.warn(`Could not load frame at index: ${i}`);
      loadedCount++;
      onProgress(loadedCount / totalFrames);
      if (loadedCount === totalFrames) {
        onComplete();
      }
    };
    
    img.src = getFramePath(i);
    images.push(img);
  }
}

// Global Floating Header Volume Ticker Functions
function initHeaderTicker() {
  const tickerEl = document.getElementById('header-ticker');
  if (!tickerEl) return;
  
  // Count up loading animation from baseline to current state
  let start = 48200000;
  const end = liveVolume;
  const duration = 2200; // 2.2 seconds
  const startTime = performance.now();
  
  function update(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const ease = 1 - Math.pow(1 - progress, 3); // ease out cubic
    const current = Math.floor(start + (end - start) * ease);
    tickerEl.textContent = `₹${current.toLocaleString('en-IN')}`;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      // Once loading animation completes, start ticking in reality
      startLiveVolumeTicker();
    }
  }
  requestAnimationFrame(update);
}

function startLiveVolumeTicker() {
  const tickerEl = document.getElementById('header-ticker');
  if (!tickerEl) return;
  
  setInterval(() => {
    // Add random incremental value to represent live transactions
    const increment = Math.floor(Math.random() * 3200) + 800;
    liveVolume += increment;
    tickerEl.textContent = `₹${liveVolume.toLocaleString('en-IN')}`;
  }, 2000);
}

// Interactive Dashboard & Counter Animations
function animateBalanceCard() {
  const balanceEl = document.getElementById('balance-counter');
  if (!balanceEl || balanceEl.dataset.animated) return;
  balanceEl.dataset.animated = 'true';
  
  let start = 0;
  const end = 824350;
  const duration = 2200; // 2.2 seconds
  const startTime = performance.now();
  
  function update(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const ease = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    const current = Math.floor(start + (end - start) * ease);
    balanceEl.textContent = `₹${current.toLocaleString('en-IN')}`;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

// Budget ring animation details
function animateBudgetRings() {
  const workspaceRing = document.getElementById('budget-ring-workspace');
  const assetsRing = document.getElementById('budget-ring-assets');
  
  if (workspaceRing && !workspaceRing.dataset.animated) {
    workspaceRing.dataset.animated = 'true';
    workspaceRing.setAttribute('stroke-dasharray', '85, 100');
  }
  if (assetsRing && !assetsRing.dataset.animated) {
    assetsRing.dataset.animated = 'true';
    assetsRing.setAttribute('stroke-dasharray', '60, 100');
  }
}

function animateCounter(id, start, end, duration, prefix = '', suffix = '', decimals = 0) {
  const el = document.getElementById(id);
  if (!el || el.dataset.animated) return;
  el.dataset.animated = 'true';
  
  const startTime = performance.now();
  
  function update(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const ease = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    const current = (start + (end - start) * ease).toFixed(decimals);
    el.textContent = `${prefix}${parseFloat(current).toLocaleString('en-IN')}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

function animateStats() {
  animateCounter('stat-transactions', 0, 720, 2000, '₹', 'M+');
  animateCounter('stat-csat', 0, 99.4, 2000, '', '%', 1);
  animateCounter('stat-insights', 0, 4.8, 2000, '', 'M+', 1);
}

// Intersection Observer Setup
function setupIntersectionObserver() {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };
  
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Reveal cards with standard opacity classes
        entry.target.classList.add('revealed');
        
        // Trigger specific animations based on class type
        if (entry.target.classList.contains('main-balance-card')) {
          animateBalanceCard();
        }
        
        if (entry.target.classList.contains('chart-card')) {
          entry.target.classList.add('active');
        }
        
        if (entry.target.classList.contains('budget-card')) {
          animateBudgetRings();
        }
        
        if (entry.target.classList.contains('stats-grid')) {
          animateStats();
        }
        
        // Target sub progress bars inside cards
        const progressBar = entry.target.querySelector('.progress-bar-fill');
        if (progressBar) {
          const styleWidth = progressBar.style.width;
          progressBar.style.width = '0%';
          setTimeout(() => {
            progressBar.style.width = styleWidth;
          }, 50);
        }
      }
    });
  }, observerOptions);
  
  // Observe all revealable items
  document.querySelectorAll('.fade-up-card, .stats-grid').forEach(item => {
    observer.observe(item);
  });
}

// ===== Auth Modal =====
const authOverlay = document.getElementById('auth-overlay');
const authClose = document.getElementById('auth-close');
const btnGetStarted = document.getElementById('btn-get-started');
const authTabs = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const switchLinks = document.querySelectorAll('[data-switch]');

btnGetStarted.addEventListener('click', openAuth);
document.querySelectorAll('.btn-get-started').forEach(el => {
  if (el !== btnGetStarted) el.addEventListener('click', openAuth);
});
document.querySelectorAll('.btn.btn-primary, .btn.btn-secondary').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); openAuth(); });
});

function openAuth() {
  authOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAuth() {
  authOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

authClose.addEventListener('click', closeAuth);
authOverlay.addEventListener('click', (e) => {
  if (e.target === authOverlay) closeAuth();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAuth();
});

// Tab switching
authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    authTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    loginForm.classList.toggle('hidden', target !== 'login');
    signupForm.classList.toggle('hidden', target !== 'signup');
  });
});

switchLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = link.dataset.switch;
    authTabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${target}"]`).classList.add('active');
    loginForm.classList.toggle('hidden', target !== 'login');
    signupForm.classList.toggle('hidden', target !== 'signup');
  });
});

// ===== Sidebar Quote Rotation =====
const quoteItems = document.querySelectorAll('.quote-item');
const quoteDots = document.querySelectorAll('.quote-dot');
let currentQuote = 0;
let quoteInterval;

function showQuote(index) {
  quoteItems.forEach(q => q.classList.remove('active'));
  quoteDots.forEach(d => d.classList.remove('active'));
  quoteItems[index].classList.add('active');
  quoteDots[index].classList.add('active');
  currentQuote = index;
}

function startQuoteRotation() {
  quoteInterval = setInterval(() => {
    const next = (currentQuote + 1) % quoteItems.length;
    showQuote(next);
  }, 4000);
}

quoteDots.forEach(dot => {
  dot.addEventListener('click', () => {
    clearInterval(quoteInterval);
    showQuote(parseInt(dot.dataset.index));
    startQuoteRotation();
  });
});

// ===== Golden Coin 3D Parallax =====
const coin = document.getElementById('golden-coin');
const coinContainer = document.getElementById('coin-container');
const coinShadow = document.getElementById('coin-shadow');
const coinShine = document.getElementById('coin-shine');

if (coin && coinContainer) {
  coinContainer.addEventListener('mousemove', (e) => {
    const rect = coinContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const deltaX = (x - centerX) / centerX;
    const deltaY = (y - centerY) / centerY;
    const rotateX = deltaY * -20;
    const rotateY = deltaX * 20;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    coin.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${1 + distance * 0.08})`;

    if (coinShadow) {
      coinShadow.style.transform = `translateX(${-50 + deltaX * 15}%) translateY(${deltaY * 6}px)`;
      coinShadow.style.opacity = 0.3 + distance * 0.15;
    }

    if (coinShine) {
      const shineX = 50 + deltaX * 30;
      const shineY = 50 + deltaY * 30;
      coinShine.style.background = `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.35) 0%, transparent 50%)`;
    }
  });

  coinContainer.addEventListener('mouseleave', () => {
    coin.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
    if (coinShadow) {
      coinShadow.style.transform = 'translateX(-50%) translateY(0px)';
      coinShadow.style.opacity = '';
    }
    if (coinShine) {
      coinShine.style.background = '';
    }
  });
}

// ===== Init Quotes =====
startQuoteRotation();

// ===== Dashboard JavaScript =====
const dashboard = document.getElementById('app-dashboard');
const sidebar = document.getElementById('dash-sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const navItems = document.querySelectorAll('.sw-nav-item');
const dashSections = document.querySelectorAll('.dash-section');

function animateValue(el, start, end, duration, prefix = '₹') {
  if (!el || el.dataset.animated) return;
  el.dataset.animated = 'true';
  const s = performance.now();
  function f(now) {
    const p = Math.min(1, (now - s) / duration);
    const e = 1 - Math.pow(1 - p, 3);
    const v = Math.floor(start + (end - start) * e);
    el.textContent = prefix + v.toLocaleString('en-IN');
    if (p < 1) requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
}

function drawIncomeExpenseChart() {
  const canvas = document.getElementById('income-expense-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 220 * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = '220px';
  ctx.scale(dpr, dpr);
  const w = rect.width, h = 220;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const currentMonth = now.getMonth();
  const income = months.map((_,i) => {
    const m = (currentMonth - 11 + i + 12) % 12;
    const tx = txData.filter(t => t.type==='income');
    return Math.round(tx.reduce((s,t) => s + t.amount, 0) / Math.max(1, tx.length) * (0.6 + 0.3 * Math.sin(i * 1.2)));
  });
  const expenses = months.map((_,i) => {
    const tx = txData.filter(t => t.type==='expense');
    return Math.round(tx.reduce((s,t) => s + Math.abs(t.amount), 0) / Math.max(1, tx.length) * (0.4 + 0.25 * Math.cos(i * 1.1)));
  });
  const max = Math.max(...income, ...expenses) * 1.3;
  const pad = { top: 12, bottom: 28, left: 40, right: 16 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const stepX = chartW / (months.length - 1);

  function drawLine(data, color) {
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (v / max) * chartH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    data.forEach((v, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (v / max) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i * 35 / max) * chartH;
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = '#86868b';
    ctx.font = '10px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('₹' + (i * 35) + 'K', pad.left - 8, y + 3);
  }
  months.forEach((l, i) => {
    ctx.fillStyle = '#86868b';
    ctx.font = '10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(l, pad.left + i * stepX, h - 6);
  });
  drawLine(income, '#305CDE');
  drawLine(expenses, '#ff3b30');
}

function drawDonutChart() {
  const canvas = document.getElementById('donut-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 200 * dpr;
  canvas.height = 200 * dpr;
  canvas.style.width = '200px';
  canvas.style.height = '200px';
  ctx.scale(dpr, dpr);
  const cx = 100, cy = 100, r = 70, w = 28;
  const cats = {};
  txData.filter(t => t.type==='expense').forEach(t => { cats[t.cat] = (cats[t.cat] || 0) + Math.abs(t.amount); });
  const totalCat = Object.values(cats).reduce((s,v) => s + v, 0) || 1;
  const catColors = { Food:'#ff9500', Transport:'#34c759', Shopping:'#ff3b30', Bills:'#305CDE', Entertainment:'#7C3AED', Income:'#34c759', Others:'#86868b' };
  const data = Object.entries(cats).map(([label, val]) => ({ label, pct: Math.round((val / totalCat) * 100), color: catColors[label] || '#86868b' }));
  if (data.length === 0) data.push({ label: 'No data', pct: 100, color: '#e5e5ea' });
  let startAngle = -Math.PI / 2;
  data.forEach(d => {
    const endAngle = startAngle + (d.pct / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.arc(cx, cy, r - w, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    startAngle = endAngle;
  });
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.fillStyle = '#1d1d1f';
  ctx.font = 'bold 14px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('100%', cx, cy);
}

function updateAllStats() {
  const totalIncome = txData.filter(t => t.type==='income').reduce((s,t) => s + t.amount, 0);
  const totalExpense = txData.filter(t => t.type==='expense').reduce((s,t) => s + Math.abs(t.amount), 0);
  const netBalance = totalIncome - totalExpense;
  const pending = txData.filter(t => t.status==='Pending').length;
  const totalBudget = budgetData.reduce((s,b) => s + b.total, 0);
  const totalSpentBudget = budgetData.reduce((s,b) => s + b.spent, 0);
  const overspent = budgetData.filter(b => (b.spent / b.total) >= 0.9).length;
  const subMonthly = subData.filter(s => s.cycle==='Monthly' && !s.cancelled).reduce((s,su) => s + su.cost, 0);
  const subYearly = subData.filter(s => s.cycle==='Yearly' && !s.cancelled).reduce((s,su) => s + su.cost, 0);
  const subAnnual = subMonthly * 12 + subYearly;
  const activeGoals = goalData.filter(g => g.saved < g.target).length;
  const completedGoals = goalData.filter(g => g.saved >= g.target).length;
  const totalSaved = goalData.reduce((s,g) => s + g.saved, 0);
  const totalTarget = goalData.reduce((s,g) => s + g.target, 0);

  const el = (id,v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  el('tx-total-spent', '₹' + totalExpense.toLocaleString('en-IN'));
  el('tx-total-received', '₹' + totalIncome.toLocaleString('en-IN'));

  const txTotalEl = document.querySelector('.tx-count-badge');
  if (txTotalEl && document.getElementById('section-transactions')?.classList.contains('active'))
    el('tx-count-badge', txData.length + ' this month');
  el('tx-count-badge', txData.length + ' this month');
  
  // Hero counters
  animateValue(document.getElementById('dash-total-balance'), 0, netBalance, 2200);
  animateValue(document.getElementById('dash-income'), 0, totalIncome, 2000);
  animateValue(document.getElementById('dash-expenses'), 0, totalExpense, 2000);
  animateValue(document.getElementById('dash-savings'), 0, totalIncome - totalExpense > 0 ? totalIncome - totalExpense : 0, 2000);
  
  // Budget overview card
  el('b-ov-amount', '₹' + totalBudget.toLocaleString('en-IN'));
  const spentEl = document.querySelector('.b-ov-stat-value');
  // Subscriptions summary
  el('s-monthly', '₹' + subMonthly.toLocaleString('en-IN'));
  el('s-annual', '₹' + subAnnual.toLocaleString('en-IN'));
  // Goal stats
  el('g-active-count', activeGoals);
  el('g-completed-count', completedGoals);
  el('g-total-saved', '₹' + totalSaved.toLocaleString('en-IN'));
  el('g-projected', '₹' + (totalTarget - totalSaved > 0 ? (totalTarget - totalSaved) : 0).toLocaleString('en-IN'));
  // Pending
  el('tx-pending-count', pending);
}

function animateDashboardCounters() { updateAllStats(); }

// ===== SHARED DATA STORES =====
let txData = [
  { date:'12 Jun', desc:'Salary Credit', merchant:'Acme Corp', cat:'Income', pay:'Bank Transfer', status:'Completed', amount:85000, type:'income' },
  { date:'11 Jun', desc:'Swiggy Order', merchant:'Swiggy', cat:'Food', pay:'UPI', status:'Completed', amount:-450, type:'expense' },
  { date:'10 Jun', desc:'Electricity Bill', merchant:'BSES', cat:'Bills', pay:'AutoPay', status:'Completed', amount:-2340, type:'expense' },
  { date:'09 Jun', desc:'Uber Ride', merchant:'Uber', cat:'Transport', pay:'Credit Card', status:'Completed', amount:-280, type:'expense' },
  { date:'08 Jun', desc:'Freelance Payment', merchant:'Upwork', cat:'Income', pay:'Bank Transfer', status:'Completed', amount:12000, type:'income' },
  { date:'07 Jun', desc:'Zomato Order', merchant:'Zomato', cat:'Food', pay:'UPI', status:'Completed', amount:-620, type:'expense' },
  { date:'06 Jun', desc:'Amazon Purchase', merchant:'Amazon', cat:'Shopping', pay:'Credit Card', status:'Pending', amount:-3299, type:'expense' },
  { date:'05 Jun', desc:'Netflix Renewal', merchant:'Netflix', cat:'Entertainment', pay:'AutoPay', status:'Completed', amount:-649, type:'expense' },
];
let budgetData = [
  { name:'Shopping', spent:13800, total:15000, color:'danger' },
  { name:'Food & Dining', spent:10200, total:12000, color:'warn' },
  { name:'Transport', spent:3600, total:8000, color:'safe' },
  { name:'Entertainment', spent:1500, total:5000, color:'safe' },
  { name:'Bills & Utilities', spent:6600, total:12000, color:'safe' },
  { name:'Healthcare', spent:1000, total:5000, color:'safe' },
];
let goalData = [
  { name:'Emergency Fund', saved:65000, target:100000, icon:'🏠', circle:'#34c759', date:'Dec 2025' },
  { name:'New Laptop', saved:40000, target:100000, icon:'💻', circle:'#305CDE', date:'Mar 2026' },
  { name:'Europe Trip', saved:55000, target:250000, icon:'✈️', circle:'#7C3AED', date:'Dec 2026' },
  { name:'Down Payment', saved:120000, target:1000000, icon:'🏡', circle:'#ff9500', date:'Jun 2028' },
];
let subData = [
  { icon:'🎵', name:'Spotify Premium', cost:119, cycle:'Monthly', renewal:'12 days', color:'#1DB954' },
  { icon:'📺', name:'Netflix', cost:649, cycle:'Monthly', renewal:'5 days', color:'#E50914' },
  { icon:'☁️', name:'iCloud+ 200GB', cost:249, cycle:'Monthly', renewal:'20 days', color:'#007AFF' },
  { icon:'🛒', name:'Amazon Prime', cost:1499, cycle:'Yearly', renewal:'45 days', color:'#FF9900' },
  { icon:'🎮', name:'Xbox Game Pass', cost:349, cycle:'Monthly', renewal:'18 days', color:'#00A8E1' },
  { icon:'🏋️', name:'Cult.fit Elite', cost:799, cycle:'Monthly', renewal:'8 days', color:'#FF2D55' },
];
let cardData = loadData('fw_cards', [
  { number:'4111 1111 1111 1111', expiry:'12/28', holderName:'ARJUN REDDY', network:'visa' },
  { number:'5500 0000 0000 0004', expiry:'09/27', holderName:'ARJUN REDDY', network:'mastercard' },
  { number:'6011 0000 0000 0004', expiry:'03/29', holderName:'ARJUN REDDY', network:'discover' },
]);
let settingsData = loadData('fw_settings', { theme:'light', lang:'English', currency:'₹ INR', defaultView:'overview', compactSidebar:true, showCharts:true });

function saveData(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {} }
function loadData(key, def) { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : def; } catch(e) { return def; } }

function persistAll() {
  saveData('fw_tx', txData); saveData('fw_budget', budgetData); saveData('fw_goals', goalData);
  saveData('fw_subs', subData); saveData('fw_cards', cardData); saveData('fw_settings', settingsData);
}

// Override data mutators to auto-save and re-render
const origPushTx = txData.push; txData.push = function(...args) { const r = origPushTx.apply(this, args); persistAll(); renderAll(); return r; };
const origUnshiftTx = txData.unshift; txData.unshift = function(...args) { const r = origUnshiftTx.apply(this, args); persistAll(); renderAll(); return r; };

// Load persisted data
try {
  const savedTx = loadData('fw_tx', null); if (savedTx) { txData.length = 0; txData.push(...savedTx); }
  const savedBudget = loadData('fw_budget', null); if (savedBudget) { budgetData.length = 0; budgetData.push(...savedBudget); }
  const savedGoals = loadData('fw_goals', null); if (savedGoals) { goalData.length = 0; goalData.push(...savedGoals); }
  const savedSubs = loadData('fw_subs', null); if (savedSubs) { subData.length = 0; subData.push(...savedSubs); }
} catch(e) {}

function catBadge(cat) {
  const m = { Income:'income-badge', Food:'food-badge', Bills:'bills-badge', Transport:'transport-badge', Shopping:'shopping-badge', Entertainment:'entertainment-badge' };
  return `<span class="tx-cat-badge ${m[cat]||''}">${cat}</span>`;
}

let txPage = 0;
const TX_PAGE_SIZE = 10;

function renderTxTable() {
  const body = document.getElementById('tx-table-body');
  if (!body) return;
  const start = txPage * TX_PAGE_SIZE;
  const pageData = txData.slice(start, start + TX_PAGE_SIZE);
  body.innerHTML = pageData.map((t, i) => {
    const amtClass = t.type === 'income' ? 'positive' : 'negative';
    const sign = t.type === 'income' ? '+' : '-';
    return `<tr class="tx-row" data-tx-index="${start + i}">
      <td class="tx-td-date">${t.date}</td>
      <td><span class="tx-desc">${t.desc}</span><span class="tx-merchant">${t.merchant}</span></td>
      <td>${catBadge(t.cat)}</td>
      <td>${t.pay}</td>
      <td><span class="tx-status ${t.status.toLowerCase()}">${t.status}</span></td>
      <td class="tx-td-amount ${amtClass}">${sign}₹${Math.abs(t.amount).toLocaleString('en-IN')}</td>
      <td class="tx-td-action"><button class="tx-row-btn" title="Edit" data-tx-edit="${start + i}">✏️</button><button class="tx-row-del" title="Delete" data-tx-del="${start + i}">🗑️</button></td>
    </tr>`;
  }).join('');
  
  // Edit buttons
  document.querySelectorAll('[data-tx-edit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.txEdit);
      const t = txData[idx];
      if (!t) return;
      openModal('form-transaction', 'Edit Transaction');
      const f = document.getElementById('form-transaction');
      document.getElementById('tx-amount').value = Math.abs(t.amount);
      document.getElementById('tx-desc').value = t.desc;
      document.getElementById('tx-merchant-input').value = t.merchant;
      document.getElementById('tx-cat').value = t.cat;
      document.getElementById('tx-pay').value = t.pay;
      const dateInput = document.getElementById('tx-date');
      if (dateInput) dateInput.value = t.date;
      const type = t.type;
      document.getElementById('tx-type').value = type;
      document.querySelectorAll('.mf-type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mft === type);
      });
      f.dataset.editIndex = idx;
      f.querySelector('.mf-submit').textContent = 'Update Transaction';
    });
  });
  
  // Delete buttons
  document.querySelectorAll('[data-tx-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.txDel);
      if (confirm('Delete this transaction?')) {
        txData.splice(idx, 1);
        persistAll();
        renderAll();
        showToast('Transaction deleted');
      }
    });
  });
  
  updateTxSummary();
  updatePagination();
  updateTxCountBadge();
}

function updatePagination() {
  const pag = document.getElementById('tx-pagination');
  if (!pag) return;
  const total = txData.length;
  const pages = Math.max(1, Math.ceil(total / TX_PAGE_SIZE));
  if (total > TX_PAGE_SIZE) { pag.style.display = 'flex'; } else { pag.style.display = 'none'; }
  document.getElementById('tx-page-info').textContent = `Page ${txPage + 1} of ${pages}`;
  document.getElementById('tx-page-prev').disabled = txPage <= 0;
  document.getElementById('tx-page-next').disabled = txPage >= pages - 1;
}
document.getElementById('tx-page-prev')?.addEventListener('click', () => {
  if (txPage > 0) { txPage--; applyAllTxFiltersOrRender(); }
});
document.getElementById('tx-page-next')?.addEventListener('click', () => {
  const pages = Math.ceil(txData.length / TX_PAGE_SIZE);
  if (txPage < pages - 1) { txPage++; applyAllTxFiltersOrRender(); }
});

function updateTxCountBadge() {
  const badge = document.getElementById('tx-count-badge');
  if (badge) badge.textContent = txData.length + ' this month';
}

function updateTxSummary() {
  const spent = txData.filter(t => t.type==='expense').reduce((s,t) => s + Math.abs(t.amount), 0);
  const received = txData.filter(t => t.type==='income').reduce((s,t) => s + t.amount, 0);
  const pending = txData.filter(t => t.status==='Pending').length;
  const el = (id,v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  el('tx-total-spent', '₹' + spent.toLocaleString('en-IN'));
  el('tx-total-received', '₹' + received.toLocaleString('en-IN'));
}

function renderTxOverview() {
  const list = document.getElementById('tx-list');
  if (!list) return;
  const bg = { Food:'rgba(255,149,0,0.08)', Transport:'rgba(48,92,222,0.08)', Shopping:'rgba(255,59,48,0.08)', Bills:'rgba(48,92,222,0.08)', Entertainment:'rgba(124,58,237,0.08)', Income:'rgba(52,199,89,0.08)' };
  const dotColors = { Food:'#ff9500', Transport:'#305CDE', Shopping:'#ff3b30', Bills:'#305CDE', Entertainment:'#7C3AED', Income:'#34c759' };
  list.innerHTML = txData.slice(0,5).map(t => {
    const dc = dotColors[t.cat] || '#86868b';
    return `<div class="tx-item"><div class="tx-icon-box" style="background:${bg[t.cat]||'rgba(0,0,0,0.03)'}"><div style="width:8px;height:8px;border-radius:50%;background:${dc}"></div></div>
      <div class="tx-info"><div class="tx-name">${t.desc}</div><div class="tx-meta">${t.cat} · ${t.date}</div></div>
      <div class="tx-amount ${t.type==='income'?'positive':'negative'}">${t.type==='income'?'+':'-'}₹${Math.abs(t.amount).toLocaleString('en-IN')}</div></div>`;
  }).join('');
}

function renderBudgetOverview() {
  const list = document.getElementById('budget-list');
  if (!list) return;
  const totalBudget = budgetData.reduce((s,b) => s + b.total, 0);
  const totalSpent = budgetData.reduce((s,b) => s + b.spent, 0);
  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const remaining = totalBudget - totalSpent;
  const overspent = budgetData.filter(b => (b.spent / b.total) >= 1).length;
  
  list.innerHTML = budgetData.map(b => {
    const pct = Math.round((b.spent / b.total) * 100);
    return `<div class="budget-item"><div class="budget-top"><span class="budget-name">${b.name}</span>
      <span class="budget-remaining">₹${(b.total - b.spent).toLocaleString('en-IN')} left</span></div>
      <div class="budget-bar"><div class="budget-bar-fill ${b.color}" style="width:${Math.min(pct,100)}%"></div></div></div>`;
  }).join('');
  
  // Update budget page overview card
  const ovAmount = document.querySelector('.b-ov-amount');
  if (ovAmount) ovAmount.textContent = '₹' + totalBudget.toLocaleString('en-IN');
  const ovFill = document.querySelector('.b-ov-fill');
  if (ovFill) ovFill.style.width = Math.min(totalPct, 100) + '%';
  const ovPct = document.querySelector('.b-ov-pct');
  if (ovPct) ovPct.textContent = totalPct + '% used';
  const spentStat = document.querySelector('.b-ov-stat .b-ov-stat-value');
  if (spentStat) spentStat.textContent = '₹' + totalSpent.toLocaleString('en-IN');
  const remainingEls = document.querySelectorAll('.b-ov-stat .b-ov-stat-value');
  if (remainingEls[1]) remainingEls[1].textContent = '₹' + remaining.toLocaleString('en-IN');
  const alertEl = document.querySelector('.b-ov-alert');
  if (alertEl) alertEl.innerHTML = `<span class="b-ov-alert-icon">⚠️</span> ${overspent > 0 ? overspent + ' categories overspent' : 'All budgets on track'}`;
  
  // Render budget page cards
  const bGrid = document.querySelector('.b-cards-grid');
  if (bGrid) {
    bGrid.innerHTML = budgetData.map((b, i) => {
      const pct = Math.round((b.spent / b.total) * 100);
      const cardClass = pct >= 90 ? 'danger-card' : pct >= 70 ? 'warn-card' : 'safe-card';
      return `<div class="b-card ${cardClass}" style="position:relative"><div class="b-card-top"><span class="b-card-name">${b.name}</span><span class="b-card-pct">${Math.min(pct,100)}%</span></div>
      <div class="b-card-bar"><div class="b-card-fill ${b.color}" style="width:${Math.min(pct,100)}%"></div></div>
      <div class="b-card-bottom"><span>₹${b.spent.toLocaleString('en-IN')} of ₹${b.total.toLocaleString('en-IN')}</span>
      <span class="b-card-remaining">₹${(b.total - b.spent).toLocaleString('en-IN')} left</span></div>
      <button class="b-card-del" data-b-del="${i}" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;font-size:14px;color:#86868b">🗑️</button></div>`;
    }).join('');
    bGrid.querySelectorAll('[data-b-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.bDel);
        if (confirm(`Delete "${budgetData[idx].name}" budget?`)) {
          budgetData.splice(idx, 1);
          persistAll();
          renderAll();
          showToast('Budget deleted');
        }
      });
    });
  }
}

function renderGoalOverview() {
  const grid = document.getElementById('goals-grid');
  if (!grid) return;
  const circumference = 2 * Math.PI * 24;
  grid.innerHTML = goalData.map(g => {
    const pct = Math.round((g.saved / g.target) * 100);
    const offset = circumference - (pct / 100) * circumference;
    return `<div class="goal-card"><div class="goal-ring"><svg viewBox="0 0 54 54">
      <circle class="goal-ring-bg" cx="27" cy="27" r="24"/>
      <circle class="goal-ring-fg" cx="27" cy="27" r="24" stroke="${g.circle}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/></svg>
      <span class="goal-ring-text">${pct}%</span></div><div class="goal-name">${g.name}</div>
      <div class="goal-meta">₹${g.saved.toLocaleString('en-IN')} of ₹${g.target.toLocaleString('en-IN')}</div></div>`;
  }).join('');
}

function renderGoalPage() {
  const grid = document.querySelector('#section-goals .g-full-grid');
  if (!grid) return;
  grid.innerHTML = goalData.map(g => {
    const pct = Math.round((g.saved / g.target) * 100);
    const circumference = 2 * Math.PI * 26;
    const offset = circumference - (pct / 100) * circumference;
    const highlight = pct >= 60 ? 'highlight-card' : '';
    return `<div class="g-goal-card ${highlight}" style="position:relative"><div class="g-goal-left"><span class="g-goal-icon">${g.icon}</span></div>
      <div class="g-goal-mid"><span class="g-goal-name">${g.name}</span>
      <span class="g-goal-desc">₹${g.saved.toLocaleString('en-IN')} saved of ₹${g.target.toLocaleString('en-IN')} target</span>
      <div class="g-goal-bar"><div class="g-goal-fill" style="width:${pct}%;background:${g.circle}"></div></div>
      <span class="g-goal-meta">${pct}% achieved · Target: ${g.date}</span></div>
      <div class="g-goal-right"><div class="g-goal-ring"><svg viewBox="0 0 60 60">
      <circle class="g-ring-bg" cx="30" cy="30" r="26"/><circle class="g-ring-fg" cx="30" cy="30" r="26" stroke="${g.circle}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/></svg>
      <span class="g-ring-value">${pct}%</span></div></div>
      <button class="g-del" data-g-del="${i}" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;font-size:14px;color:#86868b;z-index:5">🗑️</button></div>`;
  }).join('');
  grid.querySelectorAll('[data-g-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.gDel);
      if (confirm(`Delete "${goalData[idx].name}" goal?`)) {
        goalData.splice(idx, 1);
        persistAll();
        renderAll();
        showToast('Goal deleted');
      }
    });
  });
  const active = goalData.filter(g => g.saved < g.target).length;
  const completed = goalData.filter(g => g.saved >= g.target).length;
  const saved = goalData.reduce((s,g) => s + g.saved, 0);
  const projected = goalData.reduce((s,g) => s + (g.target - g.saved > 0 ? g.target - g.saved : 0), 0);
  const gEl = (id,v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  // Use querySelector for stat values since they don't have IDs
  const statCards = document.querySelectorAll('#section-goals .g-stat-card .g-stat-value');
  if (statCards[0]) statCards[0].textContent = active;
  if (statCards[1]) statCards[1].textContent = completed;
  if (statCards[2]) statCards[2].textContent = '₹' + saved.toLocaleString('en-IN');
  if (statCards[3]) statCards[3].textContent = '₹' + projected.toLocaleString('en-IN');
}

function renderSubPage() {
  const grid = document.querySelector('#section-subscriptions .s-manage-grid');
  if (!grid) return;
  const cycleLabel = s => s.cycle === 'Yearly' ? `/yr` : `/mo`;
  grid.innerHTML = subData.map(s => {
    const cancelled = s.cancelled || false;
    return `<div class="s-card" style="${cancelled?'opacity:0.4':''}"><div class="s-card-icon" style="background:${s.color}20;color:${s.color}">${s.icon}</div>
      <span class="s-card-name">${s.name}</span><span class="s-card-cost">₹${s.cost.toLocaleString('en-IN')}${cycleLabel(s)}</span>
      <span class="s-card-renewal">${cancelled ? 'Cancelled' : 'Renews in ' + s.renewal}</span>
      ${cancelled ? '' : '<button class="s-card-btn">Cancel</button>'}
      ${cancelled ? '' : `<button class="s-card-del" data-s-del="${i}" style="background:none;border:none;cursor:pointer;font-size:14px;color:#86868b;padding:4px 8px">🗑️</button>`}</div>`;
  }).join('');
  document.querySelectorAll('.s-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.s-card');
      const name = card?.querySelector('.s-card-name')?.textContent || '';
      if (confirm(`Cancel ${name}?`)) {
        const idx = subData.findIndex(s => s.name === name);
        if (idx >= 0) { subData[idx].cancelled = true; renderSubPage(); }
        showToast(`${name} cancelled`);
      }
    });
  });
  grid.querySelectorAll('[data-s-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.sDel);
      if (confirm(`Delete "${subData[idx].name}" subscription?`)) {
        subData.splice(idx, 1);
        persistAll();
        renderAll();
        showToast('Subscription deleted');
      }
    });
  });
  const monthly = subData.filter(s => s.cycle==='Monthly' && !s.cancelled).reduce((s,su) => s + su.cost, 0);
  const yearly = subData.filter(s => s.cycle==='Yearly' && !s.cancelled).reduce((s,su) => s + su.cost, 0);
  const annual = monthly * 12 + yearly;
  const activeCount = subData.filter(s => !s.cancelled).length;
  const renewingSoon = subData.filter(s => !s.cancelled && parseInt(s.renewal) <= 12 && s.renewal.includes('days')).length;
  const sEls = document.querySelectorAll('#section-subscriptions .s-stat-card .s-stat-value');
  if (sEls[0]) sEls[0].textContent = '₹' + monthly.toLocaleString('en-IN');
  if (sEls[1]) sEls[1].textContent = '₹' + annual.toLocaleString('en-IN');
  if (sEls[2]) sEls[2].textContent = activeCount;
  if (sEls[3]) sEls[3].textContent = renewingSoon;
}

function renderSubOverview() {
  const grid = document.getElementById('subs-grid');
  if (!grid) return;
  const active = subData.filter(s => !s.cancelled);
  const cycleLabel = s => s.cycle === 'Yearly' ? `/yr` : `/mo`;
  grid.innerHTML = active.slice(0,4).map(s =>
    `<div class="sub-card"><div class="sub-icon">${s.icon}</div><div class="sub-name">${s.name}</div>
    <div class="sub-cost">₹${s.cost.toLocaleString('en-IN')}${cycleLabel(s)}</div><div class="sub-renewal">Renews in ${s.renewal}</div></div>`
  ).join('');
}

function detectCardNetwork(num) {
  const n = num.replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6011/.test(n)) return 'discover';
  if (/^6[0-5]/.test(n)) return 'rupay';
  return 'default';
}

function formatCardNumber(num) {
  return num.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim().substring(0, 19);
}

function maskCardNumber(num) {
  const n = num.replace(/\s/g, '');
  if (n.length <= 4) return n;
  return n.slice(0, 4) + '  ••••  ••••  ' + n.slice(-4);
}

const cardNetworkColors = {
  visa: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
  mastercard: 'linear-gradient(135deg,#1a1a2e,#2a1a2e,#1f1f2e)',
  rupay: 'linear-gradient(135deg,#0b3b2c,#1a6b4a,#2d8f5e)',
  amex: 'linear-gradient(135deg,#1a3a6b,#2b5ca8,#4a7fc7)',
  discover: 'linear-gradient(135deg,#3a1a1a,#6b2a2a,#8f3a3a)',
  default: 'linear-gradient(135deg,#2a2a3e,#3a3a5e,#4a4a7e)'
};

const cardNetworkNames = {
  visa: 'VISA', mastercard: 'Mastercard', rupay: 'RuPay', amex: 'American Express', discover: 'Discover', default: 'BANK CARD'
};

function updateCardPositions() {
  const cards = document.querySelectorAll('.cc-card');
  const len = cards.length;
  cards.forEach((card, i) => {
    const diff = i - cardIndex;
    if (diff === 0) {
      card.style.transform = 'translateY(0) scale(1)';
      card.style.opacity = '1';
      card.style.zIndex = 20;
      card.style.pointerEvents = 'auto';
    } else if (diff > 0) {
      const offset = diff * 20 + 30;
      const scale = Math.max(0.7, 1 - diff * 0.06);
      card.style.transform = `translateY(${offset}px) scale(${scale})`;
      card.style.opacity = Math.max(0.15, 1 - diff * 0.22);
      card.style.zIndex = 20 - diff;
      card.style.pointerEvents = 'none';
    } else {
      const offset = diff * 20 - 30;
      card.style.transform = `translateY(${offset}px) scale(0.8)`;
      card.style.opacity = '0';
      card.style.zIndex = 1;
      card.style.pointerEvents = 'none';
    }
  });
}

function renderCards() {
  const viewport = document.getElementById('cards-viewport');
  if (!viewport) return;
  
  if (cardData.length === 0) {
    viewport.innerHTML = `<div class="cards-empty"><span class="cards-empty-icon">💳</span><span class="cards-empty-text">No cards yet. Add your first card!</span></div>`;
    return;
  }
  
  viewport.innerHTML = cardData.map((c, i) => {
    const network = detectCardNetwork(c.number);
    const gradient = c.gradient || cardNetworkColors[network];
    const netName = cardNetworkNames[network];
    const maskedNum = maskCardNumber(c.number);
    return `<div class="cc-card ${network}" style="background:${gradient};position:relative">
      <div class="cc-top">
        <div class="cc-top-left"><div class="cc-chip"></div><span class="cc-type-text">${netName}</span></div>
        <div class="cc-top-right"><span class="cc-network-logo">${netName.substring(0,2)}</span></div>
      </div>
      <div class="cc-number">${maskedNum}</div>
      <div class="cc-bottom">
        <div class="cc-holder">Card Holder<span>${c.holderName || 'Cardholder'}</span></div>
        <div class="cc-expiry">Expires<span>${c.expiry || '12/28'}</span></div>
      </div>
      <button class="c-del" data-c-del="${i}" style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:12px;color:#fff;z-index:10;display:flex;align-items:center;justify-content:center">✕</button>
    </div>`;
  }).join('');
  
  cardIndex = Math.min(cardIndex, cardData.length - 1);
  updateCardPositions();
  
  viewport.querySelectorAll('[data-c-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.cDel);
      if (confirm('Delete this card?')) {
        cardData.splice(idx, 1);
        persistAll();
        renderCards();
        showToast('Card deleted');
      }
    });
  });
  
  // Update summary
  const totalCards = cardData.length;
  document.getElementById('cs-total').textContent = totalCards;
  document.getElementById('cs-limit').textContent = '₹' + (totalCards * 50000).toLocaleString('en-IN');
  document.getElementById('cs-used').textContent = '₹' + (totalCards * 15000).toLocaleString('en-IN');
  document.getElementById('cs-avail').textContent = '₹' + (totalCards * 35000).toLocaleString('en-IN');
  const cardsCount = document.getElementById('cards-count');
  if (cardsCount) cardsCount.textContent = totalCards + ' card' + (totalCards !== 1 ? 's' : '');
}

// Cards drag/swipe navigation
let cardIndex = 0;
let dragStartY = 0;
let isDraggingCard = false;
const cardsVp = document.getElementById('cards-viewport');
if (cardsVp) {
  function cardDragStart(y) {
    if (cardData.length < 2) return;
    dragStartY = y;
    isDraggingCard = true;
    cardsVp.style.cursor = 'grabbing';
    document.querySelectorAll('.cc-card').forEach(c => c.style.transition = 'none');
  }
  function cardDragMove(y) {
    if (!isDraggingCard) return;
    const dy = y - dragStartY;
    const active = document.querySelector('.cc-card[style*="pointer-events: auto"]');
    if (active) active.style.transform = `translateY(${dy * 0.4}px) scale(${1 - Math.abs(dy) * 0.0008})`;
  }
  function cardDragEnd(y) {
    if (!isDraggingCard) return;
    isDraggingCard = false;
    cardsVp.style.cursor = 'grab';
    const dy = y - dragStartY;
    const active = document.querySelector('.cc-card[style*="pointer-events: auto"]');
    document.querySelectorAll('.cc-card').forEach(c => c.style.transition = '');
    if (Math.abs(dy) > 40) {
      const dir = dy < 0 ? -1 : 1;
      if (active) {
        active.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        active.style.transform = `translateY(${dir * 60}px) scale(0.85)`;
        active.style.zIndex = '1';
      }
      setTimeout(() => {
        if (dy < 0) cardIndex = Math.min(cardData.length - 1, cardIndex + 1);
        else cardIndex = Math.max(0, cardIndex - 1);
        updateCardPositions();
      }, 400);
    } else {
      if (active) {
        active.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        active.style.transform = '';
        active.style.opacity = '';
      }
      setTimeout(() => updateCardPositions(), 50);
    }
  }
  cardsVp.addEventListener('mousedown', (e) => cardDragStart(e.clientY));
  document.addEventListener('mousemove', (e) => cardDragMove(e.clientY));
  document.addEventListener('mouseup', (e) => cardDragEnd(e.clientY));
  cardsVp.addEventListener('touchstart', (e) => cardDragStart(e.touches[0].clientY), { passive: true });
  cardsVp.addEventListener('touchmove', (e) => cardDragMove(e.touches[0].clientY), { passive: true });
  cardsVp.addEventListener('touchend', (e) => cardDragEnd(e.changedTouches[0].clientY), { passive: true });
}

// Card form submission - Enter key support
document.getElementById('cards-add-form')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('cf-submit')?.click(); }
});
document.getElementById('cf-submit')?.addEventListener('click', () => {
  const num = document.getElementById('cf-number').value;
  const expiry = document.getElementById('cf-expiry').value;
  const cvv = document.getElementById('cf-cvv').value;
  const name = document.getElementById('cf-name').value.trim();
  
  const cleanNum = num.replace(/\s/g, '');
  if (cleanNum.length < 15) { showToast('Enter a valid 15-16 digit card number'); return; }
  if (!/^\d{15,16}$/.test(cleanNum)) { showToast('Card number must be digits only'); return; }
  if (!expiry) { showToast('Enter expiry date (MM/YY)'); return; }
  if (!/^\d{2}\/\d{2}$/.test(expiry)) { showToast('Expiry must be MM/YY format'); return; }
  const mm = parseInt(expiry.split('/')[0]);
  if (mm < 1 || mm > 12) { showToast('Month must be 01-12'); return; }
  if (cvv && !/^\d{3,4}$/.test(cvv)) { showToast('CVV must be 3-4 digits'); return; }
  if (!name) { showToast('Enter cardholder name'); return; }
  
  const network = detectCardNetwork(num);
  cardData.push({ number: formatCardNumber(num), expiry, holderName: name, network });
  persistAll();
  renderCards();
  document.getElementById('cf-number').value = '';
  document.getElementById('cf-expiry').value = '';
  document.getElementById('cf-cvv').value = '';
  document.getElementById('cf-name').value = '';
  showToast(`${cardNetworkNames[network]} card added!`);
});

// Card number auto-format
document.getElementById('cf-number')?.addEventListener('input', function() {
  this.value = formatCardNumber(this.value.replace(/[^\d]/g, ''));
});

// Card expiry auto-format
document.getElementById('cf-expiry')?.addEventListener('input', function() {
  let v = this.value.replace(/[^\d]/g, '');
  if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2);
  this.value = v.substring(0,5);
});

function renderInsights() {
  const stack = document.getElementById('insights-stack');
  if (!stack) return;
  const foodTx = txData.filter(t => t.cat==='Food' && t.type==='expense');
  const foodTotal = foodTx.reduce((s,t) => s + Math.abs(t.amount), 0);
  const savings = txData.filter(t => t.type==='income').reduce((s,t) => s + t.amount, 0) - txData.filter(t => t.type==='expense').reduce((s,t) => s + Math.abs(t.amount), 0);
  const subCost = subData.filter(s => !s.cancelled && s.cycle==='Monthly').reduce((s,su) => s + su.cost, 0);
  const transportTx = txData.filter(t => t.cat==='Transport');
  const transportTotal = transportTx.reduce((s,t) => s + Math.abs(t.amount), 0);
  const insights = [
    { text:`You spent ₹${foodTotal.toLocaleString('en-IN')} on food this month${foodTx.length > 0 ? ' across ' + foodTx.length + ' orders' : ''}.`, tag:'Spending Alert', icon:'i1', bg:'rgba(255,149,0,0.08)' },
    { text:savings > 0 ? `You saved ₹${savings.toLocaleString('en-IN')} this month. Keep it up!` : `Try to save more this month.`, tag:'Savings Milestone', icon:'i2', bg:'rgba(52,199,89,0.08)' },
    { text:`Subscription costs: ₹${subCost.toLocaleString('en-IN')}/mo across ${subData.filter(s=>!s.cancelled).length} services.`, tag:'Subscription Insight', icon:'i3', bg:'rgba(48,92,222,0.08)' },
    { text:`Transport spend: ₹${transportTotal.toLocaleString('en-IN')} this month.`, tag:'Transport', icon:'i4', bg:'rgba(124,58,237,0.08)' },
  ];
  stack.innerHTML = insights.map(i => `<div class="insight-card"><div class="insight-icon" style="background:${i.bg}">${i.icon}</div><div><div class="insight-text">${i.text}</div><div class="insight-tag">${i.tag}</div></div></div>`).join('');
}

function initDashboard() {
  renderAll();
  const savedSection = localStorage.getItem('fw_active_section');
  if (savedSection) {
    const navItem = document.querySelector(`.sw-nav-item[data-section="${savedSection}"]`);
    if (navItem) navItem.click();
  }
  setTimeout(() => { drawIncomeExpenseChart(); drawDonutChart(); drawAnalyticsChart(); }, 100);
}
function renderAll() {
  updateAllStats();
  renderTxOverview(); renderBudgetOverview(); renderGoalOverview(); renderInsights(); renderSubOverview();
  renderTxTable(); renderGoalPage(); renderSubPage(); renderCards();
  renderAnalyticsStats(); renderCategoryBreakdown(); renderTopMerchants(); renderMonthlyTrends();
  renderProfile(); renderNotifications();
  // Update badges
  const txBadge = document.getElementById('tx-count-badge');
  if (txBadge) txBadge.textContent = txData.length + ' this month';
  // Update header greeting with time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetEl = document.querySelector('.dash-greeting');
  if (greetEl && greetEl.closest('#section-overview')) greetEl.textContent = greeting + ', Arjun';
  // Cards count
  const cardsCount = document.getElementById('cards-count');
  if (cardsCount) cardsCount.textContent = cardData.length + ' card' + (cardData.length !== 1 ? 's' : '');
  // Sidebar count badges
  document.querySelectorAll('.sw-count').forEach(el => { if(el) el.textContent = ''; });
}

// Override persist for budget, goal, sub changes
const origBudgetPush = budgetData.push; budgetData.push = function(...args) { const r = origBudgetPush.apply(this, args); persistAll(); renderAll(); return r; };

function drawAnalyticsChart() {
  const canvas = document.getElementById('analytics-main-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 260 * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = '260px';
  ctx.scale(dpr, dpr);
  const w = rect.width, h = 260;
  const months = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
  const totalIncome = txData.filter(t => t.type==='income').reduce((s,t) => s + t.amount, 0);
  const totalExpense = txData.filter(t => t.type==='expense').reduce((s,t) => s + Math.abs(t.amount), 0);
  const avgIncome = totalIncome / Math.max(1, txData.filter(t => t.type==='income').length) || 85000;
  const avgExpense = totalExpense / Math.max(1, txData.filter(t => t.type==='expense').length) || 65000;
  const incomeData = months.map((_,i) => {
    const mTx = txData.filter(t => t.type==='income');
    return mTx.length > 0 ? mTx.reduce((s,t) => s + t.amount, 0) / mTx.length / 100000 * (0.7 + 0.3 * Math.sin(i)) : 0.8 + 0.2 * Math.sin(i);
  });
  const expenseData = months.map((_,i) => {
    const mTx = txData.filter(t => t.type==='expense');
    return mTx.length > 0 ? mTx.reduce((s,t) => s + Math.abs(t.amount), 0) / mTx.length / 100000 * (0.6 + 0.3 * Math.cos(i)) : 0.6 + 0.2 * Math.cos(i);
  });
  const max = Math.max(...incomeData, ...expenseData) * 1.3;
  const pad = { top: 16, bottom: 32, left: 50, right: 20 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const stepX = chartW / (months.length - 1);

  ctx.clearRect(0, 0, w, h);

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i * 0.45 / max) * chartH;
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = '#86868b';
    ctx.font = '10px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('₹' + (i * 0.45).toFixed(2) + 'L', pad.left - 8, y + 3);
  }

  // X-axis labels
  months.forEach((m, i) => {
    ctx.fillStyle = '#86868b';
    ctx.font = '10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m, pad.left + i * stepX, h - 8);
  });

  // Areas
  function drawArea(data, color) {
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (v / max) * chartH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + (data.length - 1) * stepX, pad.top + chartH);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.05;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawLine(data, color) {
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (v / max) * chartH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    data.forEach((v, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (v / max) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  drawArea(incomeData, '#305CDE');
  drawArea(expenseData, '#ff3b30');
  drawLine(incomeData, '#305CDE');
  drawLine(expenseData, '#ff3b30');

  // Legend
  const lx = w - 140, ly = 10;
  ctx.fillStyle = '#305CDE';
  ctx.fillRect(lx, ly + 3, 10, 3);
  ctx.fillStyle = '#86868b';
  ctx.font = '10px Outfit, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Income', lx + 16, ly + 7);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(lx + 60, ly + 3, 10, 3);
  ctx.fillStyle = '#86868b';
  ctx.fillText('Expenses', lx + 76, ly + 7);
}

// Redraw analytics chart when section becomes visible
const analyticsObserver = new MutationObserver(() => {
  const analyticsSection = document.getElementById('section-analytics');
  if (analyticsSection && analyticsSection.classList.contains('active')) {
    setTimeout(drawAnalyticsChart, 50);
  }
});
const dashSections2 = document.querySelectorAll('.dash-section');
dashSections2.forEach(s => analyticsObserver.observe(s, { attributes: true, attributeFilter: ['class'] }));

// Canvas resize handler for all charts
window.addEventListener('resize', () => {
  const active = document.querySelector('.dash-section.active');
  if (active) {
    const id = active.id;
    if (id === 'section-overview') { drawIncomeExpenseChart(); drawDonutChart(); }
    if (id === 'section-analytics') drawAnalyticsChart();
  }
});

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const sectionId = item.dataset.section;
    dashSections.forEach(s => s.classList.remove('active'));
    const target = document.getElementById('section-' + sectionId);
    if (target) target.classList.add('active');
    if (window.innerWidth <= 768) sidebar.classList.add('collapsed');
    localStorage.setItem('fw_active_section', sectionId);
  });
});

document.addEventListener('submit', (e) => {
  if (e.target.matches('#login-form') || e.target.matches('#signup-form')) {
    e.preventDefault();
    closeAuth();
    dashboard.classList.add('active');
    document.body.style.overflow = '';
    localStorage.setItem('fw_loggedIn', 'true');
    initDashboard();
  }
});

// ===== MODAL SYSTEM =====
const modalOverlay = document.getElementById('modal-overlay');
const modalBox = document.getElementById('modal-box');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.getElementById('modal-close');
const modalForms = document.querySelectorAll('.modal-form');

function openModal(formId, title) {
  modalTitle.textContent = title;
  modalForms.forEach(f => f.classList.remove('active'));
  const form = document.getElementById(formId);
  if (form) {
    form.classList.add('active');
    form.reset();
    // Reset icon pickers
    form.querySelectorAll('.mf-icon-picker').forEach(p => {
      const first = p.querySelector('.mf-icon-btn');
      if (first) { p.querySelectorAll('.mf-icon-btn').forEach(b => b.classList.remove('active')); first.classList.add('active'); }
    });
    const hidden = form.querySelector('input[type="hidden"]');
    const firstIcon = form.querySelector('.mf-icon-btn.active');
    if (hidden && firstIcon) hidden.value = firstIcon.textContent.trim();
  }
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  const dateInput = form?.querySelector('input[type="date"]');
  if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// Transaction type toggle
document.querySelectorAll('.mf-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mf-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tx-type').value = btn.dataset.mft;
  });
});

// Icon pickers
document.querySelectorAll('.mf-icon-picker').forEach(picker => {
  const form = picker.closest('.modal-form');
  const hiddenInput = form ? form.querySelector('input[type="hidden"]') : null;
  picker.querySelectorAll('.mf-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.mf-icon-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (hiddenInput) hiddenInput.value = btn.textContent.trim();
    });
  });
});

// Form submissions
document.getElementById('form-transaction')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const editIdx = f.dataset.editIndex;
  const type = document.getElementById('tx-type').value;
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const desc = document.getElementById('tx-desc').value;
  const merchant = document.getElementById('tx-merchant-input').value || 'Manual';
  const cat = document.getElementById('tx-cat').value;
  const pay = document.getElementById('tx-pay').value;
  const date = document.getElementById('tx-date').value || new Date().toISOString().split('T')[0];
  const d = new Date(date);
  const dateStr = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
  
  if (editIdx !== undefined && editIdx !== '') {
    txData[editIdx] = { date:dateStr, desc, merchant, cat, pay, status:'Completed', amount: type==='income' ? amount : -amount, type };
    showToast(`${desc} updated!`);
    delete f.dataset.editIndex;
    f.querySelector('.mf-submit').textContent = 'Add Transaction';
  } else {
    txData.unshift({ date:dateStr, desc, merchant, cat, pay, status:'Completed', amount: type==='income' ? amount : -amount, type });
    showToast(`${desc} added!`);
  }
  renderTxTable(); renderTxOverview();
  closeModal(); e.target.reset();
  document.getElementById('tx-type').value = 'expense';
  document.querySelectorAll('.mf-type-btn')[0].click();
});

document.getElementById('form-budget')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('b-cat').value;
  const total = parseFloat(document.getElementById('b-amount').value);
  const existing = budgetData.findIndex(b => b.name === name);
  if (existing >= 0) { budgetData[existing].total = total; budgetData[existing].spent = 0; budgetData[existing].color = 'safe'; }
  else { budgetData.push({ name, spent:0, total, color:'safe' }); }
  delete e.target.dataset.editIndex;
  renderBudgetOverview();
  closeModal(); e.target.reset();
  showToast(`Budget set for ${name}: ₹${total.toLocaleString('en-IN')}`);
});

document.getElementById('form-goal')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('g-name').value;
  const target = parseFloat(document.getElementById('g-target').value);
  const saved = parseFloat(document.getElementById('g-saved').value) || 0;
  const dateInput = document.getElementById('g-date').value;
  const icon = document.getElementById('g-icon').value;
  const d = dateInput ? new Date(dateInput) : new Date();
  const dateStr = d.toLocaleDateString('en-IN', { month:'short', year:'numeric' });
  const colors = ['#34c759','#305CDE','#7C3AED','#ff9500','#ff3b30','#00A8E1','#FF2D55','#1DB954'];
  const circle = colors[goalData.length % colors.length];
  goalData.push({ name, saved, target, icon, circle, date: dateStr });
  renderGoalOverview(); renderGoalPage();
  closeModal(); e.target.reset();
  document.getElementById('g-icon').value = '🏠';
  showToast(`Goal "${name}" created!`);
});

document.getElementById('form-subscription')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('s-name').value;
  const cost = parseFloat(document.getElementById('s-cost').value);
  const cycle = document.getElementById('s-cycle').value;
  const renewalDate = document.getElementById('s-renewal').value;
  const icon = document.getElementById('s-icon').value;
  const colors = ['#1DB954','#E50914','#007AFF','#FF9900','#00A8E1','#FF2D55','#FF6B35','#86868b'];
  const color = colors[subData.length % colors.length];
  const d = renewalDate ? new Date(renewalDate) : new Date(Date.now() + 30*86400000);
  const diffDays = Math.ceil((d - new Date()) / 86400000);
  const renewal = diffDays > 0 ? `${diffDays} days` : 'Today';
  subData.push({ icon, name, cost, cycle, renewal, color });
  renderSubPage(); renderSubOverview();
  closeModal(); e.target.reset();
  document.getElementById('s-icon').value = '🎵';
  showToast(`Subscription "${name}" added!`);
});

// Wire quick action menu to modals
document.querySelector('.qa-menu')?.addEventListener('click', (e) => {
  const item = e.target.closest('.qa-item');
  if (!item) return;
  document.getElementById('qa-menu').classList.remove('open');
  const action = item.dataset.qa;
  const mapping = { transaction:['form-transaction','Add Transaction'], budget:['form-budget','Set Budget'], goal:['form-goal','New Goal'], subscription:['form-subscription','Add Subscription'] };
  if (mapping[action]) openModal(...mapping[action]);
});

// ===== TOAST SYSTEM =====
function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-text">${message}</span><button class="toast-close">✕</button>`;
  container.appendChild(toast);
  toast.querySelector('.toast-close').addEventListener('click', () => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); });
  setTimeout(() => { if (toast.parentNode) { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); } }, duration);
}

// ===== NOTIFICATION BELL =====
const ntBell = document.querySelector('.tn-notification');
const ntDropdown = document.getElementById('nt-dropdown');
const ntMarkRead = document.getElementById('nt-mark-read');
ntBell.addEventListener('click', (e) => {
  e.stopPropagation();
  ntDropdown.classList.toggle('open');
  document.getElementById('qa-menu').classList.remove('open');
});
ntMarkRead.addEventListener('click', () => {
  document.querySelectorAll('.nt-dd-item.unread').forEach(i => i.classList.remove('unread'));
  document.querySelector('.tn-badge').style.display = 'none';
  showToast('All notifications marked as read');
});
document.addEventListener('click', (e) => {
  if (!ntDropdown.contains(e.target) && !ntBell.contains(e.target)) ntDropdown.classList.remove('open');
});

// ===== QUICK ACTION MENU =====
const qaBtn = document.querySelector('.tn-quick-action');
const qaMenu = document.getElementById('qa-menu');
qaBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  qaMenu.classList.toggle('open');
  ntDropdown.classList.remove('open');
});
document.addEventListener('click', (e) => {
  if (!qaMenu.contains(e.target) && !qaBtn.contains(e.target)) qaMenu.classList.remove('open');
});
// QA menu click handled in modal system above

// ===== THEME TOGGLE =====
const themeBtn = document.querySelector('.tn-theme');
const themes = ['light', 'system', 'dark'];
let themeIndex = 0;
themeBtn.addEventListener('click', () => {
  themeIndex = (themeIndex + 1) % themes.length;
  const t = themes[themeIndex];
  document.documentElement.style.colorScheme = t === 'dark' ? 'dark' : 'light';
  document.querySelector('.app-dashboard').style.filter = t === 'dark' ? 'invert(1) hue-rotate(180deg)' : 'none';
  const labels = { light: '☀️', system: '💻', dark: '🌙' };
  showToast(`Theme: ${t.charAt(0).toUpperCase() + t.slice(1)}`);
});

// ===== TRANSACTION FILTERS =====
document.querySelectorAll('.tx-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tx-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.textContent.trim().toLowerCase();
    document.querySelectorAll('.tx-row').forEach(row => {
      const status = row.querySelector('.tx-status')?.textContent.trim().toLowerCase() || '';
      const amount = row.querySelector('.tx-td-amount')?.textContent.trim() || '';
      const isIncome = amount.startsWith('+') || amount.includes('positive');
      if (filter === 'all') { row.style.display = ''; }
      else if (filter === 'income') { row.style.display = isIncome ? '' : 'none'; }
      else if (filter === 'expenses') { row.style.display = (!isIncome && status !== 'pending') ? '' : 'none'; }
      else if (filter === 'pending') { row.style.display = status === 'pending' ? '' : 'none'; }
    });
    showToast(`Showing ${filter} transactions`);
  });
});

// ===== TX CATEGORY/DATE SELECTS =====
function applyAllTxFilters() {
  const catFilter = document.getElementById('tx-cat-filter')?.value || 'all';
  const dateFilter = document.getElementById('tx-date-filter')?.value || 'all';
  const searchQ = document.querySelector('.search-input')?.value.toLowerCase() || '';
  document.querySelectorAll('.tx-row').forEach(row => {
    const cat = row.querySelector('.tx-cat-badge')?.textContent.trim() || '';
    const date = row.querySelector('.tx-td-date')?.textContent.trim() || '';
    const text = row.textContent.toLowerCase();
    const catOk = catFilter === 'all' || cat === catFilter;
    const dateOk = dateFilter === 'all' || date === dateFilter || (dateFilter === 'week' && true) || (dateFilter === 'month' && true);
    const searchOk = !searchQ || text.includes(searchQ);
    row.style.display = (catOk && dateOk && searchOk) ? '' : 'none';
  });
  updateEmptyState();
}
function updateEmptyState() {
  let visible = 0;
  document.querySelectorAll('.tx-row').forEach(r => { if (r.style.display !== 'none') visible++; });
  const all = document.querySelectorAll('.tx-row').length;
  const empty = document.querySelector('.tx-empty');
  if (empty) {
    if (visible === 0 && all > 0) { empty.style.display = 'block'; } else { empty.style.display = 'none'; }
  }
}
document.querySelectorAll('.tx-select').forEach(sel => {
  sel.addEventListener('change', applyAllTxFilters);
});

// ===== EXPORT BUTTON =====
document.querySelector('.tx-export-btn')?.addEventListener('click', () => {
  let csv = 'Date,Description,Merchant,Category,Payment,Status,Amount\n';
  document.querySelectorAll('.tx-row').forEach(row => {
    if (row.style.display === 'none') return;
    const cells = row.querySelectorAll('td');
    const date = cells[0]?.textContent.trim() || '';
    const desc = cells[1]?.querySelector('.tx-desc')?.textContent.trim() || '';
    const merchant = cells[1]?.querySelector('.tx-merchant')?.textContent.trim() || '';
    const cat = cells[2]?.textContent.trim() || '';
    const pay = cells[3]?.textContent.trim() || '';
    const status = cells[4]?.textContent.trim() || '';
    const amt = cells[5]?.textContent.trim() || '';
    csv += `${date},"${desc}","${merchant}","${cat}","${pay}","${status}","${amt}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'FinWave_Transactions.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('Transactions exported!');
});

// ===== TX ROW ⋯ BUTTONS (handled in renderTxTable) =====

// ===== SEARCH BAR =====
document.querySelector('.search-input')?.addEventListener('input', applyAllTxFilters);

// ===== ⌘K / CTRL+K SEARCH FOCUS =====
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    const input = document.querySelector('.search-input');
    if (input) { input.focus(); input.select(); }
  }
});

// ===== LOGOUT BUTTONS =====
function handleLogout() {
  if (confirm('Are you sure you want to sign out?')) {
    localStorage.removeItem('fw_loggedIn');
    dashboard.classList.remove('active');
    document.body.style.overflow = '';
    authOverlay.classList.add('active');
    showToast('Signed out successfully');
  }
}
document.getElementById('sidebar-logout')?.addEventListener('click', handleLogout);
document.getElementById('av-logout')?.addEventListener('click', handleLogout);

// ===== AVATAR DROPDOWN =====
const avatarBtn = document.querySelector('.tn-avatar');
const avatarDropdown = document.getElementById('av-dropdown');
if (avatarBtn && avatarDropdown) {
  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    avatarDropdown.classList.toggle('open');
    ntDropdown.classList.remove('open');
    document.getElementById('qa-menu').classList.remove('open');
  });
  document.addEventListener('click', (e) => {
    if (!avatarDropdown.contains(e.target) && !avatarBtn.contains(e.target)) avatarDropdown.classList.remove('open');
  });
  avatarDropdown.querySelectorAll('[data-nav]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      avatarDropdown.classList.remove('open');
      const section = item.dataset.section;
      if (section === 'logout') {
        handleLogout();
        return;
      }
      const navItem = document.querySelector(`.sw-nav-item[data-section="${section}"]`);
      if (navItem) navItem.click();
    });
  });
}

// ===== SETTINGS SAVE TO LOCALSTORAGE =====
document.querySelectorAll('.set-toggle input').forEach(toggle => {
  toggle.addEventListener('change', () => {
    const key = toggle.id || toggle.dataset.key;
    if (key) { settingsData[key] = toggle.checked; persistAll(); }
  });
});
document.querySelectorAll('.set-select').forEach(sel => {
  sel.addEventListener('change', () => {
    const key = sel.id || sel.dataset.key;
    if (key) { settingsData[key] = sel.value; persistAll(); }
  });
});
document.querySelectorAll('.set-theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    settingsData.theme = btn.dataset.theme; persistAll();
  });
});

// ===== NOTIFICATION BADGE DYNAMIC =====
function updateNotifBadge() {
  const unread = document.querySelectorAll('.nt-dd-item.unread').length;
  const badge = document.querySelector('.tn-badge');
  if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? '' : 'none'; }
}
const notifObserver = new MutationObserver(() => updateNotifBadge());
document.querySelectorAll('.nt-dd-item').forEach(item => notifObserver.observe(item, { attributes: true, attributeFilter: ['class'] }));
setTimeout(updateNotifBadge, 500);

// ===== AUTH FORM VALIDATION =====
function validateAuthForm(form) {
  let valid = true;
  form.querySelectorAll('.auth-field-error').forEach(e => e.textContent = '');
  form.querySelectorAll('.auth-input').forEach(input => {
    const error = input.parentElement.querySelector('.auth-field-error');
    if (!error) return;
    if (input.value.trim() === '') { error.textContent = 'This field is required'; valid = false; }
    else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) { error.textContent = 'Invalid email address'; valid = false; }
    else if (input.type === 'password' && input.value.length < 6) { error.textContent = 'Password must be at least 6 characters'; valid = false; }
    else if (input.name === 'confirmPassword') {
      const pw = form.querySelector('input[type="password"]');
      if (pw && input.value !== pw.value) { error.textContent = 'Passwords do not match'; valid = false; }
    }
  });
  return valid;
}
document.getElementById('login-form')?.addEventListener('submit', function(e) {
  if (!validateAuthForm(this)) e.preventDefault();
});
document.getElementById('signup-form')?.addEventListener('submit', function(e) {
  if (!validateAuthForm(this)) e.preventDefault();
});

// ===== MOBILE SIDEBAR OVERLAY =====
document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
  sidebar.classList.add('collapsed');
});

// ===== RENDER ALL AFTER DATA CHANGES =====
const origGoalPush = goalData.push; goalData.push = function(...args) { const r = origGoalPush.apply(this, args); persistAll(); renderAll(); return r; };
const origSubPush = subData.push; subData.push = function(...args) { const r = origSubPush.apply(this, args); persistAll(); renderAll(); return r; };
const origCardPush = cardData.push; cardData.push = function(...args) { const r = origCardPush.apply(this, args); persistAll(); renderAll(); return r; };

// ===== VIEW ALL / MANAGE / PANEL ACTION BUTTONS =====
document.querySelectorAll('.panel-action').forEach(btn => {
  btn.addEventListener('click', () => {
    const panel = btn.closest('.split-panel, .full-panel, .a-panel');
    const title = panel?.querySelector('.panel-title')?.textContent || 'Section';
    showToast(`Opening full ${title} view...`);
  });
});

// ===== ADJUST BUDGETS BUTTON =====
document.querySelector('.b-ov-btn')?.addEventListener('click', () => {
  showToast('Budget adjustment panel opening...');
});

// ===== SUBSCRIPTION CANCEL BUTTONS =====
document.querySelectorAll('.s-card-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const card = btn.closest('.s-card');
    const name = card?.querySelector('.s-card-name')?.textContent || 'subscription';
    if (confirm(`Are you sure you want to cancel ${name}?`)) {
      btn.textContent = 'Cancelled ✓';
      btn.style.background = 'rgba(255,59,48,0.1)';
      btn.style.color = '#ff3b30';
      btn.style.borderColor = 'rgba(255,59,48,0.2)';
      btn.disabled = true;
      showToast(`${name} has been cancelled`);
    }
  });
});

// ===== SETTINGS TABS =====
document.querySelectorAll('.set-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.set-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.set-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById('set-' + tab.dataset.stab);
    if (target) target.classList.add('active');
  });
});

// ===== SETTINGS THEME BUTTONS =====
document.querySelectorAll('.set-theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.set-theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const t = btn.dataset.theme;
    document.documentElement.style.colorScheme = t === 'dark' ? 'dark' : 'light';
    document.querySelector('.app-dashboard').style.filter = t === 'dark' ? 'invert(1) hue-rotate(180deg)' : 'none';
    showToast(`Theme set to ${t}`);
  });
});

// ===== SETTINGS TOGGLES =====
document.querySelectorAll('.set-toggle input').forEach(toggle => {
  toggle.addEventListener('change', () => {
    const label = toggle.closest('.set-row')?.querySelector('.set-label')?.textContent || 'Setting';
    showToast(`${label}: ${toggle.checked ? 'ON' : 'OFF'}`);
  });
});

// ===== SETTINGS SELECTS =====
document.querySelectorAll('.set-select').forEach(sel => {
  sel.addEventListener('change', () => {
    showToast(`Updated: ${sel.options[sel.selectedIndex].text}`);
  });
});

// ===== SETTINGS ACTION BUTTONS =====
document.querySelectorAll('.set-action-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.textContent.trim();
    if (text.includes('Clear')) {
      if (confirm('Are you sure? This will permanently delete ALL your data.')) {
        txData.length = 0; budgetData.length = 0; goalData.length = 0;
        subData.length = 0; cardData.length = 0;
        localStorage.clear();
        renderAll();
        showToast('All data cleared');
      }
    } else if (text.includes('Export')) {
      showToast('Exporting all data...');
    } else if (text.includes('Download')) {
      showToast('Generating report...');
    } else {
      showToast(`${text} initiated...`);
    }
  });
});

// ===== PROFILE EDIT BUTTON =====
document.querySelector('.p-edit-btn')?.addEventListener('click', () => {
  showToast('Edit profile mode activated');
});

// ===== PROFILE LINK ACCOUNT =====
document.querySelector('.p-link-btn')?.addEventListener('click', () => {
  showToast('Account linking wizard...');
});

// Close sidebar overlay on mobile after nav click

// Built By Priyansh watermark close
document.getElementById('built-by-close')?.addEventListener('click', () => {
  document.getElementById('built-by')?.classList.add('hidden');
});

function applyAllTxFiltersOrRender() {
  renderTxTable();
}

function renderAnalyticsStats() {
  const totalIncome = txData.filter(t => t.type==='income').reduce((s,t) => s + t.amount, 0);
  const totalExpense = txData.filter(t => t.type==='expense').reduce((s,t) => s + Math.abs(t.amount), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100) : 0;
  const netWorth = totalIncome - totalExpense;
  
  const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const el = (id,v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  el('a-total-income', fmt(totalIncome));
  el('a-total-expenses', fmt(totalExpense));
  el('a-savings-rate', savingsRate.toFixed(1) + '%');
  el('a-net-worth', fmt(netWorth));
  
  const trendEl = document.getElementById('a-net-trend');
  if (trendEl) trendEl.textContent = netWorth > 0 ? '↑ Growing' : '↓ Declining';
}

function renderCategoryBreakdown() {
  const list = document.getElementById('a-category-list');
  if (!list) return;
  const cats = {};
  txData.filter(t => t.type==='expense').forEach(t => { cats[t.cat] = (cats[t.cat] || 0) + Math.abs(t.amount); });
  const total = Object.values(cats).reduce((s,v) => s + v, 0) || 1;
  const catColors = { Food:'#ff9500', Transport:'#34c759', Shopping:'#ff3b30', Bills:'#305CDE', Entertainment:'#7C3AED', Income:'#007AFF', Others:'#86868b' };
  list.innerHTML = Object.entries(cats).sort((a,b) => b[1] - a[1]).map(([name, val]) => {
    const pct = Math.round(val / total * 100);
    const color = catColors[name] || '#86868b';
    return `<div class="a-cat-item"><div class="a-cat-dot" style="background:${color}"></div><span class="a-cat-name">${name}</span><span class="a-cat-pct">${pct}%</span><div class="a-cat-bar"><div class="a-cat-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
  }).join('');
}

function renderTopMerchants() {
  const list = document.getElementById('a-merchant-list');
  if (!list) return;
  const merchants = {};
  txData.filter(t => t.type==='expense').forEach(t => { merchants[t.merchant] = (merchants[t.merchant] || 0) + Math.abs(t.amount); });
  const sorted = Object.entries(merchants).sort((a,b) => b[1] - a[1]).slice(0, 5);
  list.innerHTML = sorted.map(([name, val], i) => {
    return `<div class="a-merchant-item"><span class="a-merchant-rank">${i+1}</span><span class="a-merchant-name">${name}</span><span class="a-merchant-spent">₹${Math.round(val).toLocaleString('en-IN')}</span></div>`;
  }).join('');
}

function renderMonthlyTrends() {
  const grid = document.getElementById('a-trend-grid');
  if (!grid) return;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const currentMonth = now.getMonth();
  const rows = [];
  for (let i = 5; i >= 0; i--) {
    const m = (currentMonth - i + 12) % 12;
    const monthTx = txData.filter(t => {
      const d = new Date(t.date + ' 2026');
      return d.getMonth() === m || t.date.includes(months[m]);
    });
    const inc = monthTx.filter(t => t.type==='income').reduce((s,t) => s + t.amount, 0);
    const exp = monthTx.filter(t => t.type==='expense').reduce((s,t) => s + Math.abs(t.amount), 0);
    const maxVal = Math.max(inc, exp, 1);
    const incPct = Math.round(inc / maxVal * 80);
    const expPct = Math.round(exp / maxVal * 80);
    const fmt = (n) => '₹' + Math.round(n / 1000).toLocaleString('en-IN') + 'K';
    rows.push(`<div class="a-trend-item"><span class="a-month-label">${months[m]}</span><div class="a-month-bar-wrap"><div class="a-month-bar"><div class="a-month-fill income-fill" style="width:${incPct}%"></div><div class="a-month-fill expense-fill" style="width:${expPct}%"></div></div></div><span class="a-month-income">${fmt(inc)}</span></div>`);
  }
  grid.innerHTML = rows.join('');
}

function renderProfile() {
  const pName = document.getElementById('p-name');
  if (pName) pName.textContent = 'Priyansh';
  const pEmail = document.getElementById('p-email');
  if (pEmail) pEmail.textContent = 'priyansh@finwave.in';
  const pSince = document.getElementById('p-since');
  if (pSince) pSince.textContent = 'Since ' + new Date().getFullYear();
  const pActivity = document.getElementById('p-activity');
  if (pActivity) {
    const recent = txData.slice(0, 5);
    const icons = { Food:'🍔', Transport:'🚗', Shopping:'🛍️', Bills:'💡', Entertainment:'📺', Income:'💰' };
    pActivity.innerHTML = recent.map(t => {
      const ic = icons[t.cat] || '💳';
      return `<div class="p-activity-item"><span class="p-act-icon">${ic}</span><div class="p-act-info"><span class="p-act-text">${t.desc}</span><span class="p-act-time">${t.date}</span></div></div>`;
    }).join('');
  }
}

function renderNotifications() {
  const list = document.getElementById('nt-dd-list');
  if (!list) return;
  const notifs = [];
  const overspent = budgetData.filter(b => (b.spent / b.total) >= 1);
  overspent.forEach(b => { notifs.push({ icon:'!', text:`${b.name} overspent! ₹${Math.round(b.spent - b.total).toLocaleString('en-IN')} over limit`, time:'Now', bg:'rgba(255,59,48,0.1)', unread:true }); });
  const nearGoals = goalData.filter(g => g.saved >= g.target * 0.8 && g.saved < g.target);
  nearGoals.forEach(g => { notifs.push({ icon:'~', text:`"${g.name}" is ${Math.round(g.saved/g.target*100)}% complete!`, time:'Today', bg:'rgba(52,199,89,0.1)', unread:true }); });
  const dueSubs = subData.filter(s => !s.cancelled && parseInt(s.renewal) <= 5);
  dueSubs.forEach(s => { notifs.push({ icon:'#', text:`${s.name} renews in ${s.renewal} — ₹${s.cost}`, time:'Soon', bg:'rgba(255,149,0,0.1)', unread:true }); });
  notifs.push({ icon:'$', text: txData.length > 0 ? `${txData.length} transactions this month` : 'No transactions yet', time:'Today', bg:'rgba(48,92,222,0.1)', unread:false });
  list.innerHTML = notifs.map(n => `<div class="nt-dd-item${n.unread ? ' unread' : ''}"><div class="nt-dd-icon" style="background:${n.bg}">${n.icon}</div><div class="nt-dd-content"><span class="nt-dd-text">${n.text}</span><span class="nt-dd-time">${n.time}</span></div></div>`).join('');
  const badge = document.querySelector('.tn-badge');
  if (badge) {
    const unreadCount = notifs.filter(n => n.unread).length;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? '' : 'none';
  }
}

// Init sequence on document load
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('fw_loggedIn') === 'true') {
    authOverlay.classList.remove('active');
    document.body.style.overflow = '';
    dashboard.classList.add('active');
    document.body.classList.remove('loading');
    loaderOverlay.classList.add('loaded');
    initDashboard();
    return;
  }
  preloadAllFrames(
    (progress) => { updatePreloader(progress); },
    () => {
      setTimeout(() => {
        document.body.classList.remove('loading');
        loaderOverlay.classList.add('loaded');
        scrollPrompt.classList.add('visible');
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', resizeCanvas, { passive: true });
        resizeCanvas();
        onScroll();
        currentFrame = targetFrame;
        requestAnimationFrame(tick);
        setupIntersectionObserver();
        initHeaderTicker();
      }, 600);
    }
  );
});
