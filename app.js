(() => {
  'use strict';

  const STORAGE_KEY = '08-web-v2';
  const PREVIOUS_STORAGE_KEY = '08-web-v1';
  const SESSION_KEY = '08-sessions-v1';
  const LEGACY_STORAGE_KEY = 'wahrnehmungstest-web-v1';
  const LEGACY_SESSION_KEY = 'wahrnehmungstest-sessions-v1';

  const GRID_PRESETS = {
    large:  { cols: 16, rows: 9,  font: 52 },
    medium: { cols: 24, rows: 14, font: 36 },
    small:  { cols: 32, rows: 18, font: 28 }
  };

  const DEFAULTS = {
    durationMinutes: 5,
    gridSize: 'medium',
    outerKey: 'Space',
    centerKey: 'Enter',
    darkMode: true,
    showIntro: true
  };

  const SWAP_INTERVAL_MS = 120;
  const OUTER_STIMULUS_MS = 260;
  const RESPONSE_WINDOW_MS = 1500;
  const OUTER_WAIT_MIN_MS = 1200;
  const OUTER_WAIT_MAX_MS = 3200;
  const CENTRAL_WAIT_MIN_MS = 6000;
  const CENTRAL_WAIT_MAX_MS = 12000;
  const HOME_DIGIT_SWAP_MS = 1200;

  const state = {
    settings: loadSettings(),
    phase: false,
    cells: [],
    availableOuter: [],
    testedOuter: new Set(),
    currentSymbol: 'circle',
    running: false,
    paused: false,
    countingDown: false,
    keyCaptureTarget: null,
    startedAt: 0,
    endAt: 0,
    pauseStartedAt: 0,
    pausedTotalMs: 0,
    swapTimer: null,
    clockTimer: null,
    outerWaitTimer: null,
    centralWaitTimer: null,
    outerResponseTimer: null,
    centralResponseTimer: null,
    countdownTimer: null,
    outerActive: null,
    centralActive: null,
    results: [],
    falsePositives: 0,
    lastSession: null
  };

  const el = {
    screens: [...document.querySelectorAll('.screen')],
    home: document.getElementById('home-screen'),
    intro: document.getElementById('intro-screen'),
    settings: document.getElementById('settings-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen'),
    startBtn: document.getElementById('start-btn'),
    introStartBtn: document.getElementById('intro-start-btn'),
    introBackBtn: document.getElementById('intro-back-btn'),
    introOuterKey: document.getElementById('intro-outer-key'),
    introCenterKey: document.getElementById('intro-center-key'),
    introShowBtn: document.getElementById('intro-show-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    resultsBtn: document.getElementById('results-btn'),
    duration: document.getElementById('duration-input'),
    gridButtons: [...document.querySelectorAll('[data-grid]')],
    outerKeyBtn: document.getElementById('outer-key-btn'),
    centerKeyBtn: document.getElementById('center-key-btn'),
    keyHint: document.getElementById('key-hint'),
    darkModeBtn: document.getElementById('dark-mode-btn'),
    settingsIntroBtn: document.getElementById('settings-intro-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    cancelSettingsBtn: document.getElementById('cancel-settings-btn'),
    grid: document.getElementById('grid'),
    centerZone: document.getElementById('center-zone'),
    centerSymbol: document.getElementById('center-symbol'),
    gameTime: document.getElementById('game-time'),
    countdownOverlay: document.getElementById('countdown-overlay'),
    countdownNumber: document.getElementById('countdown-number'),
    pauseOverlay: document.getElementById('pause-overlay'),
    continueBtn: document.getElementById('continue-btn'),
    pauseOuterKey: document.getElementById('pause-outer-key'),
    pauseCenterKey: document.getElementById('pause-center-key'),
    endBtn: document.getElementById('end-btn'),
    stats: document.getElementById('stats'),
    resultMap: document.getElementById('result-map'),
    resultBackBtn: document.getElementById('result-back-btn'),
    downloadResultBtn: document.getElementById('download-result-btn'),
    replayBtn: document.getElementById('replay-btn')
  };

  function loadSettings() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return { ...DEFAULTS, ...JSON.parse(current) };

      const previousRaw = localStorage.getItem(PREVIOUS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      const previous = previousRaw ? JSON.parse(previousRaw) : {};
      const settings = { ...DEFAULTS, ...previous, darkMode: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      return settings;
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  }

  function loadSessions() {
    try {
      const raw = localStorage.getItem(SESSION_KEY) ?? localStorage.getItem(LEGACY_SESSION_KEY) ?? '[]';
      const value = JSON.parse(raw);
      if (!localStorage.getItem(SESSION_KEY) && Array.isArray(value)) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveSession(session) {
    const sessions = loadSessions();
    sessions.unshift(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions.slice(0, 20)));
  }

  function showScreen(target) {
    el.screens.forEach(screen => screen.classList.toggle('active', screen === target));
  }

  function applyTheme() {
    document.body.classList.toggle('dark-mode', Boolean(state.settings.darkMode));
    if (el.darkModeBtn) {
      el.darkModeBtn.setAttribute('aria-checked', String(Boolean(state.settings.darkMode)));
    }
  }

  function toggleDarkMode() {
    state.settings.darkMode = !state.settings.darkMode;
    applyTheme();
  }

  function syncIntroPreferenceToggles() {
    const checked = state.settings.showIntro !== false;
    if (el.introShowBtn) el.introShowBtn.setAttribute('aria-checked', String(checked));
    if (el.settingsIntroBtn) el.settingsIntroBtn.setAttribute('aria-checked', String(checked));
  }

  function toggleIntroFromIntro() {
    state.settings.showIntro = !(state.settings.showIntro !== false);
    syncIntroPreferenceToggles();
    saveSettings();
  }

  function toggleIntroFromSettings() {
    state.settings.showIntro = !(state.settings.showIntro !== false);
    syncIntroPreferenceToggles();
  }

  const floatingDigits = [...document.querySelectorAll('.floating-digits span')];
  let floatingDigitPhase = false;

  function swapFloatingDigits() {
    floatingDigitPhase = !floatingDigitPhase;
    floatingDigits.forEach((digit, index) => {
      const startsZero = index % 2 === 0;
      const showZero = startsZero !== floatingDigitPhase;
      digit.textContent = showZero ? '0' : '8';
    });
  }

  window.setInterval(swapFloatingDigits, HOME_DIGIT_SWAP_MS);

  function randomBetween(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function displayKey(code) {
    const names = {
      Space: 'SPACE', Enter: 'ENTER', NumpadEnter: 'ENTER',
      ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
      Backspace: 'BACKSPACE', Delete: 'ENTF', Tab: 'TAB'
    };
    if (names[code]) return names[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
    return code.replace(/^(Left|Right)/, '');
  }

  function refreshKeyButtons() {
    el.outerKeyBtn.textContent = state.keyCaptureTarget === 'outer' ? 'Taste drücken …' : displayKey(state.settings.outerKey);
    el.centerKeyBtn.textContent = state.keyCaptureTarget === 'center' ? 'Taste drücken …' : displayKey(state.settings.centerKey);
    el.outerKeyBtn.classList.toggle('listening', state.keyCaptureTarget === 'outer');
    el.centerKeyBtn.classList.toggle('listening', state.keyCaptureTarget === 'center');
  }

  function refreshInstructionKeys() {
    const outer = displayKey(state.settings.outerKey);
    const center = displayKey(state.settings.centerKey);
    if (el.introOuterKey) el.introOuterKey.textContent = outer;
    if (el.introCenterKey) el.introCenterKey.textContent = center;
    if (el.pauseOuterKey) el.pauseOuterKey.textContent = outer;
    if (el.pauseCenterKey) el.pauseCenterKey.textContent = center;
  }

  function openIntro() {
    refreshInstructionKeys();
    syncIntroPreferenceToggles();
    showScreen(el.intro);
  }

  function startFromHome() {
    if (state.settings.showIntro !== false) openIntro();
    else startTest();
  }

  function startFromIntro() {
    saveSettings();
    startTest();
  }

  function startKeyCapture(target) {
    state.keyCaptureTarget = target;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    el.keyHint.textContent = 'Jetzt gewünschte Taste drücken';
    refreshKeyButtons();
  }

  function captureKey(event) {
    if (!state.keyCaptureTarget) return false;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return true;
    if (event.code === 'Escape') {
      el.keyHint.textContent = 'ESC ist für Pause reserviert';
      return true;
    }
    if (['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight','CapsLock'].includes(event.code)) {
      return true;
    }

    const target = state.keyCaptureTarget;
    const other = target === 'outer' ? 'center' : 'outer';
    const targetProp = target === 'outer' ? 'outerKey' : 'centerKey';
    const otherProp = other === 'outer' ? 'outerKey' : 'centerKey';
    const oldTarget = state.settings[targetProp];
    const newCode = event.code === 'NumpadEnter' ? 'Enter' : event.code;

    if (newCode === state.settings[otherProp]) state.settings[otherProp] = oldTarget;
    state.settings[targetProp] = newCode;
    state.keyCaptureTarget = null;
    el.keyHint.textContent = '';
    refreshKeyButtons();
    refreshInstructionKeys();
    return true;
  }

  function openSettings() {
    el.duration.value = state.settings.durationMinutes;
    el.gridButtons.forEach(btn => {
      const selected = btn.dataset.grid === state.settings.gridSize;
      btn.classList.toggle('selected', selected);
      btn.setAttribute('aria-checked', String(selected));
    });
    state.keyCaptureTarget = null;
    el.keyHint.textContent = '';
    refreshKeyButtons();
    refreshInstructionKeys();
    applyTheme();
    syncIntroPreferenceToggles();
    showScreen(el.settings);
  }

  function selectGrid(size) {
    state.settings.gridSize = size;
    el.gridButtons.forEach(btn => {
      const selected = btn.dataset.grid === size;
      btn.classList.toggle('selected', selected);
      btn.setAttribute('aria-checked', String(selected));
    });
  }

  function applySettings() {
    const minutes = Math.max(1, Math.min(60, Number.parseInt(el.duration.value, 10) || 5));
    state.settings.durationMinutes = minutes;
    saveSettings();
    refreshInstructionKeys();
    showScreen(el.home);
  }

  function symbolSvg(symbol) {
    if (symbol === 'square') {
      return '<rect x="19" y="19" width="62" height="62" rx="1" />';
    }
    if (symbol === 'triangle') {
      return '<polygon points="50,15 84,78 16,78" />';
    }
    return '<circle cx="50" cy="50" r="34" />';
  }

  function setCenterSymbol(symbol) {
    state.currentSymbol = symbol;
    el.centerSymbol.innerHTML = symbolSvg(symbol);
    el.centerSymbol.setAttribute('aria-label', symbol === 'circle' ? 'Kreis' : symbol === 'triangle' ? 'Dreieck' : 'Quadrat');
  }

  function gridPreset() {
    return GRID_PRESETS[state.settings.gridSize] || GRID_PRESETS.medium;
  }

  function buildGrid() {
    const { cols, rows, font } = gridPreset();
    el.grid.innerHTML = '';
    el.grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    el.grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    state.cells = [];
    state.availableOuter = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.fontSize = `${font}px`;
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        cell.dataset.id = String(row * cols + col);
        el.grid.appendChild(cell);
        state.cells.push(cell);
      }
    }

    updateHiddenCenterCells();
    renderGridDigits();
  }

  function updateHiddenCenterCells() {
    const { cols, rows } = gridPreset();
    const w = Math.max(1, el.game.clientWidth || window.innerWidth);
    const h = Math.max(1, el.game.clientHeight || window.innerHeight);
    const centerWidth = el.centerZone.offsetWidth || 116;
    const centerHeight = el.centerZone.offsetHeight || 112;
    const left = (w - centerWidth) / 2;
    const right = left + centerWidth;
    const top = (h - centerHeight) / 2;
    const bottom = top + centerHeight;
    const cw = w / cols;
    const ch = h / rows;

    state.availableOuter = [];
    state.cells.forEach(cell => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const cellLeft = col * cw;
      const cellRight = cellLeft + cw;
      const cellTop = row * ch;
      const cellBottom = cellTop + ch;
      const intersects = cellLeft < right && cellRight > left && cellTop < bottom && cellBottom > top;
      cell.classList.toggle('hidden-cell', intersects);
      if (!intersects) state.availableOuter.push(Number(cell.dataset.id));
    });
  }

  function renderGridDigits() {
    const { cols } = gridPreset();
    state.cells.forEach(cell => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const baseZero = ((row + col) % 2 === 0);
      const zeroNow = baseZero !== state.phase;
      cell.textContent = zeroNow ? '0' : '8';
    });
  }

  async function requestFullScreen() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browser preview still works without fullscreen permission.
    }
  }

  function startTest() {
    requestFullScreen();
    clearAllTimers();
    state.phase = false;
    state.running = true;
    state.paused = false;
    state.countingDown = true;
    state.testedOuter = new Set();
    state.results = [];
    state.falsePositives = 0;
    state.outerActive = null;
    state.centralActive = null;
    state.pausedTotalMs = 0;
    state.startedAt = 0;
    state.endAt = 0;
    setCenterSymbol('circle');
    buildGrid();
    el.gameTime.textContent = '';
    el.pauseOverlay.classList.add('hidden');
    showScreen(el.game);
    startCountdown();
  }

  function startCountdown() {
    const steps = ['3', '2', '1', "Los geht's!"];
    let index = 0;
    el.countdownNumber.classList.remove('go');
    el.countdownNumber.textContent = steps[index];
    el.countdownOverlay.classList.remove('hidden');

    const advance = () => {
      index += 1;
      if (index < steps.length) {
        el.countdownNumber.textContent = steps[index];
        el.countdownNumber.classList.toggle('go', index === steps.length - 1);
        state.countdownTimer = window.setTimeout(advance, 1000);
      } else {
        el.countdownOverlay.classList.add('hidden');
        state.countingDown = false;
        beginGameplay();
      }
    };
    state.countdownTimer = window.setTimeout(advance, 1000);
  }

  function beginGameplay() {
    if (!state.running) return;
    state.startedAt = performance.now();
    state.endAt = state.startedAt + state.settings.durationMinutes * 60_000;

    state.swapTimer = window.setInterval(() => {
      if (!state.running || state.paused || state.countingDown) return;
      state.phase = !state.phase;
      renderGridDigits();
    }, SWAP_INTERVAL_MS);

    state.clockTimer = window.setInterval(updateClock, 200);
    scheduleOuterEvent();
    scheduleCentralEvent();
    updateClock();
  }

  function updateClock() {
    if (!state.running || state.paused) return;
    const remaining = Math.max(0, state.endAt - performance.now());
    const seconds = Math.ceil(remaining / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    el.gameTime.textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (remaining <= 0) finishTest();
  }

  function scheduleOuterEvent() {
    if (!state.running || state.paused) return;
    window.clearTimeout(state.outerWaitTimer);
    state.outerWaitTimer = window.setTimeout(showOuterStimulus, randomBetween(OUTER_WAIT_MIN_MS, OUTER_WAIT_MAX_MS));
  }

  function showOuterStimulus() {
    if (!state.running || state.paused) return;
    const choices = state.availableOuter.filter(id => !state.testedOuter.has(id));
    if (choices.length === 0) return;

    const id = choices[Math.floor(Math.random() * choices.length)];
    const cell = state.cells[id];
    state.testedOuter.add(id);
    state.outerActive = {
      id,
      row: Number(cell.dataset.row),
      col: Number(cell.dataset.col),
      shownAt: performance.now(),
      detected: false
    };
    cell.classList.add('outer-active');

    window.setTimeout(() => {
      if (state.outerActive && state.outerActive.id === id) cell.classList.remove('outer-active');
    }, OUTER_STIMULUS_MS);

    window.clearTimeout(state.outerResponseTimer);
    state.outerResponseTimer = window.setTimeout(() => completeOuter(false, null), RESPONSE_WINDOW_MS);
  }

  function completeOuter(detected, reactionTime) {
    if (!state.outerActive) return;
    const active = state.outerActive;
    const cell = state.cells[active.id];
    if (cell) cell.classList.remove('outer-active');
    state.results.push({
      type: 'outer',
      id: active.id,
      row: active.row,
      col: active.col,
      detected,
      reactionTimeMs: reactionTime
    });
    state.outerActive = null;
    window.clearTimeout(state.outerResponseTimer);
    scheduleOuterEvent();
  }

  function scheduleCentralEvent() {
    if (!state.running || state.paused) return;
    window.clearTimeout(state.centralWaitTimer);
    state.centralWaitTimer = window.setTimeout(showCentralChange, randomBetween(CENTRAL_WAIT_MIN_MS, CENTRAL_WAIT_MAX_MS));
  }

  function showCentralChange() {
    if (!state.running || state.paused) return;
    const symbols = ['circle', 'triangle', 'square'].filter(s => s !== state.currentSymbol);
    const next = symbols[Math.floor(Math.random() * symbols.length)];
    setCenterSymbol(next);
    state.centralActive = {
      symbol: next,
      shownAt: performance.now()
    };
    window.clearTimeout(state.centralResponseTimer);
    state.centralResponseTimer = window.setTimeout(() => completeCentral(false, null), RESPONSE_WINDOW_MS);
  }

  function completeCentral(detected, reactionTime) {
    if (!state.centralActive) return;
    state.results.push({
      type: 'central',
      symbol: state.centralActive.symbol,
      detected,
      reactionTimeMs: reactionTime
    });
    state.centralActive = null;
    window.clearTimeout(state.centralResponseTimer);
    scheduleCentralEvent();
  }

  function onKeyDown(event) {
    if (captureKey(event)) return;
    if (!state.running) return;
    if (event.repeat) return;
    if (state.countingDown) return;

    if (event.code === 'Escape') {
      event.preventDefault();
      if (state.paused) resumeTest(); else pauseTest();
      return;
    }
    if (state.paused) return;

    const code = event.code === 'NumpadEnter' ? 'Enter' : event.code;
    if (code === state.settings.outerKey) {
      event.preventDefault();
      if (state.outerActive) {
        const rt = Math.max(0, Math.round(performance.now() - state.outerActive.shownAt));
        completeOuter(true, rt);
      } else {
        state.falsePositives += 1;
      }
      return;
    }

    if (code === state.settings.centerKey) {
      event.preventDefault();
      if (state.centralActive) {
        const rt = Math.max(0, Math.round(performance.now() - state.centralActive.shownAt));
        completeCentral(true, rt);
      } else {
        state.falsePositives += 1;
      }
    }
  }

  function pauseTest() {
    if (!state.running || state.paused) return;
    state.paused = true;
    state.pauseStartedAt = performance.now();
    clearEventTimers();
    if (state.outerActive) {
      const cell = state.cells[state.outerActive.id];
      if (cell) cell.classList.remove('outer-active');
      state.outerActive = null;
    }
    state.centralActive = null;
    refreshInstructionKeys();
    el.pauseOverlay.classList.remove('hidden');
  }

  function resumeTest() {
    if (!state.running || !state.paused) return;
    const now = performance.now();
    const pausedFor = now - state.pauseStartedAt;
    state.endAt += pausedFor;
    state.pausedTotalMs += pausedFor;
    state.paused = false;
    el.pauseOverlay.classList.add('hidden');
    scheduleOuterEvent();
    scheduleCentralEvent();
  }

  function clearEventTimers() {
    window.clearTimeout(state.outerWaitTimer);
    window.clearTimeout(state.centralWaitTimer);
    window.clearTimeout(state.outerResponseTimer);
    window.clearTimeout(state.centralResponseTimer);
  }

  function clearAllTimers() {
    clearEventTimers();
    window.clearTimeout(state.countdownTimer);
    window.clearInterval(state.swapTimer);
    window.clearInterval(state.clockTimer);
  }

  async function exitFullScreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    } catch {
      // Ignore browser-specific fullscreen errors.
    }
  }

  function finishTest() {
    if (!state.running) return;
    state.running = false;
    state.paused = false;
    state.countingDown = false;
    clearAllTimers();
    el.countdownOverlay.classList.add('hidden');
    if (state.outerActive) {
      const cell = state.cells[state.outerActive.id];
      if (cell) cell.classList.remove('outer-active');
      state.outerActive = null;
    }
    state.centralActive = null;
    exitFullScreen();

    const session = {
      id: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      settings: { ...state.settings },
      grid: { ...gridPreset() },
      results: [...state.results],
      falsePositives: state.falsePositives
    };
    state.lastSession = session;
    saveSession(session);
    showResult(session);
  }

  function showLatestResult() {
    const sessions = loadSessions();
    if (sessions.length === 0) {
      el.resultsBtn.textContent = 'Noch keine Ergebnisse';
      window.setTimeout(() => { el.resultsBtn.textContent = 'Ergebnisse'; }, 1300);
      return;
    }
    showResult(sessions[0]);
  }

  function percentage(items) {
    if (!items.length) return 0;
    return Math.round((items.filter(x => x.detected).length / items.length) * 1000) / 10;
  }

  function sessionSummary(session) {
    const results = session.results || [];
    const outer = results.filter(r => r.type === 'outer');
    const central = results.filter(r => r.type === 'central');
    const hits = results.filter(r => r.detected);
    const times = hits.map(r => r.reactionTimeMs).filter(Number.isFinite);
    const avg = times.length ? Math.round(times.reduce((a,b) => a+b, 0) / times.length) : null;
    return {
      results, outer, central, hits, avg,
      cards: [
        ['Erkannt', hits.length],
        ['Nicht erkannt', results.length - hits.length],
        ['Erkennungsquote', `${percentage(results)}%`],
        ['Ø Reaktionszeit', avg == null ? '–' : `${avg} ms`],
        ['Äusseres Feld', `${percentage(outer)}%`],
        ['Zentrum', `${percentage(central)}%`],
        ['Fehlreaktionen', session.falsePositives || 0],
        ['Getestet', results.length]
      ]
    };
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function downloadResultJpg() {
    const session = state.lastSession || loadSessions()[0];
    if (!session) return;

    const dark = Boolean(state.settings.darkMode);
    const bg = dark ? '#111111' : '#f2f2f2';
    const card = dark ? '#1b1b1b' : '#ffffff';
    const soft = dark ? '#242424' : '#fafafa';
    const text = dark ? '#f2f2f2' : '#111111';
    const muted = dark ? '#b8b8b8' : '#555555';
    const border = dark ? '#3e3e3e' : '#d1d1d1';
    const hitColor = '#46aa5a';
    const missColor = '#c84141';
    const untestedColor = '#595959';
    const centerColor = '#0c0c0c';

    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = card;
    drawRoundedRect(ctx, 55, 45, 1490, 1310, 28);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = text;
    ctx.font = '800 54px Arial, sans-serif';
    ctx.fillText('08', 100, 120);
    ctx.font = '700 34px Arial, sans-serif';
    ctx.fillText('Ergebnis', 100, 170);

    const date = new Date(session.finishedAt || session.id || Date.now());
    ctx.fillStyle = muted;
    ctx.textAlign = 'right';
    ctx.font = '500 22px Arial, sans-serif';
    ctx.fillText(date.toLocaleString('de-CH'), 1500, 120);
    ctx.textAlign = 'left';

    const { cards } = sessionSummary(session);
    const statStartX = 100;
    const statStartY = 215;
    const statW = 335;
    const statH = 112;
    const statGapX = 20;
    const statGapY = 18;
    cards.forEach(([label, value], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = statStartX + col * (statW + statGapX);
      const y = statStartY + row * (statH + statGapY);
      ctx.fillStyle = soft;
      drawRoundedRect(ctx, x, y, statW, statH, 16);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = text;
      ctx.textAlign = 'center';
      ctx.font = '800 32px Arial, sans-serif';
      ctx.fillText(String(value), x + statW / 2, y + 47);
      ctx.fillStyle = muted;
      ctx.font = '500 18px Arial, sans-serif';
      ctx.fillText(label, x + statW / 2, y + 82);
    });
    ctx.textAlign = 'left';

    const preset = session.grid || GRID_PRESETS[session.settings?.gridSize] || GRID_PRESETS.medium;
    const { cols, rows } = preset;
    const mapX = 100;
    const mapY = 485;
    const mapW = 1400;
    const mapH = 788;
    const cellW = mapW / cols;
    const cellH = mapH / rows;
    const resultById = new Map((session.results || []).filter(r => r.type === 'outer').map(r => [r.id, r]));
    const centerCols = Math.max(1, Math.ceil(116 / (960 / cols)));
    const centerRows = Math.max(1, Math.ceil(112 / (540 / rows)));
    const c0 = Math.floor((cols - centerCols) / 2);
    const r0 = Math.floor((rows - centerRows) / 2);

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(mapX, mapY, mapW, mapH);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = row * cols + col;
        const inCenter = col >= c0 && col < c0 + centerCols && row >= r0 && row < r0 + centerRows;
        let fill = centerColor;
        if (!inCenter) {
          const r = resultById.get(id);
          fill = !r ? untestedColor : r.detected ? hitColor : missColor;
        }
        ctx.fillStyle = fill;
        ctx.fillRect(mapX + col * cellW, mapY + row * cellH, Math.ceil(cellW), Math.ceil(cellH));
        ctx.strokeStyle = 'rgba(0,0,0,.22)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mapX + col * cellW, mapY + row * cellH, cellW, cellH);
      }
    }

    const legendY = 1325;
    const legendItems = [
      ['erkannt', hitColor],
      ['nicht erkannt', missColor],
      ['nicht getestet', untestedColor]
    ];
    let lx = 100;
    ctx.font = '500 19px Arial, sans-serif';
    legendItems.forEach(([label, color]) => {
      ctx.fillStyle = color;
      ctx.fillRect(lx, legendY - 17, 22, 22);
      ctx.fillStyle = text;
      ctx.fillText(label, lx + 32, legendY);
      lx += ctx.measureText(label).width + 95;
    });

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `08-ergebnis-${stamp}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/jpeg', 0.94);
  }

  function showResult(session) {
    state.lastSession = session;
    const { cards } = sessionSummary(session);

    el.stats.innerHTML = cards.map(([label, value]) =>
      `<div class="stat-card"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`
    ).join('');

    renderResultMap(session);
    showScreen(el.result);
  }

  function renderResultMap(session) {
    const preset = session.grid || GRID_PRESETS[session.settings?.gridSize] || GRID_PRESETS.medium;
    const { cols, rows } = preset;
    el.resultMap.innerHTML = '';
    el.resultMap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    el.resultMap.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    const resultById = new Map((session.results || []).filter(r => r.type === 'outer').map(r => [r.id, r]));
    const centerCols = Math.max(1, Math.ceil(116 / (960 / cols)));
    const centerRows = Math.max(1, Math.ceil(112 / (540 / rows)));
    const c0 = Math.floor((cols - centerCols) / 2);
    const r0 = Math.floor((rows - centerRows) / 2);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = row * cols + col;
        const div = document.createElement('div');
        div.className = 'result-cell';
        const inCenter = col >= c0 && col < c0 + centerCols && row >= r0 && row < r0 + centerRows;
        if (inCenter) {
          div.classList.add('center-hole');
        } else {
          const r = resultById.get(id);
          div.classList.add(!r ? 'untested' : r.detected ? 'hit' : 'miss');
        }
        el.resultMap.appendChild(div);
      }
    }
  }

  el.startBtn.addEventListener('click', startFromHome);
  el.introStartBtn.addEventListener('click', startFromIntro);
  el.introBackBtn.addEventListener('click', () => showScreen(el.home));
  el.introShowBtn.addEventListener('click', toggleIntroFromIntro);
  el.settingsBtn.addEventListener('click', openSettings);
  el.resultsBtn.addEventListener('click', showLatestResult);
  el.gridButtons.forEach(btn => btn.addEventListener('click', () => selectGrid(btn.dataset.grid)));
  el.outerKeyBtn.addEventListener('click', () => startKeyCapture('outer'));
  el.centerKeyBtn.addEventListener('click', () => startKeyCapture('center'));
  el.darkModeBtn.addEventListener('click', toggleDarkMode);
  el.settingsIntroBtn.addEventListener('click', toggleIntroFromSettings);
  el.saveSettingsBtn.addEventListener('click', applySettings);
  el.cancelSettingsBtn.addEventListener('click', () => {
    state.settings = loadSettings();
    state.keyCaptureTarget = null;
    el.keyHint.textContent = '';
    selectGrid(state.settings.gridSize);
    refreshKeyButtons();
    refreshInstructionKeys();
    applyTheme();
    syncIntroPreferenceToggles();
    showScreen(el.home);
  });
  el.continueBtn.addEventListener('click', resumeTest);
  el.endBtn.addEventListener('click', finishTest);
  el.replayBtn.addEventListener('click', startFromHome);
  el.downloadResultBtn.addEventListener('click', downloadResultJpg);
  el.resultBackBtn.addEventListener('click', () => showScreen(el.home));
  document.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('resize', () => {
    if (state.running && state.cells.length) updateHiddenCenterCells();
  });

  selectGrid(state.settings.gridSize);
  refreshKeyButtons();
  refreshInstructionKeys();
  applyTheme();
  syncIntroPreferenceToggles();
  showScreen(el.home);
})();
