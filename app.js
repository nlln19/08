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
    showIntro: true,
    language: 'de'
  };

  const MAX_DURATION_MINUTES = 120;
  const OUTER_SHORT_SLOT_MS = 3500;
  const OUTER_NORMAL_SLOT_MS = 5000;
  const SWAP_INTERVAL_MS = 120;
  const OUTER_STIMULUS_MS = 260;
  const RESPONSE_WINDOW_MS = 1500;
  const CENTRAL_WAIT_MIN_MS = 15000;
  const CENTRAL_WAIT_MAX_MS = 25000;
  const HOME_DIGIT_SWAP_MS = 1200;

  const state = {
    settings: loadSettings(),
    phase: false,
    cells: [],
    availableOuter: [],
    outerPlan: [],
    outerPlanIndex: 0,
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
    fullscreenTransitioning: false,
    settingsSnapshot: null,
    settingsConfirmOpen: false,
    resetConfirmOpen: false,
    historyOpen: false,
    wakeLock: null,
    countdownSuspended: false,
    preGamePaused: false,
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
    languageButtons: [...document.querySelectorAll('[data-language]')],
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    cancelSettingsBtn: document.getElementById('cancel-settings-btn'),
    unsavedSettingsOverlay: document.getElementById('unsaved-settings-overlay'),
    unsavedSettingsTitle: document.getElementById('unsaved-settings-title'),
    unsavedSettingsText: document.getElementById('unsaved-settings-text'),
    saveAndBackBtn: document.getElementById('save-and-back-btn'),
    discardAndBackBtn: document.getElementById('discard-and-back-btn'),
    resetSettingsBtn: document.getElementById('reset-settings-btn'),
    resetSettingsOverlay: document.getElementById('reset-settings-overlay'),
    resetSettingsTitle: document.getElementById('reset-settings-title'),
    resetSettingsText: document.getElementById('reset-settings-text'),
    confirmResetSettingsBtn: document.getElementById('confirm-reset-settings-btn'),
    cancelResetSettingsBtn: document.getElementById('cancel-reset-settings-btn'),
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
    resultMapSlot: document.getElementById('result-map-slot'),
    resultBackBtn: document.getElementById('result-back-btn'),
    downloadResultBtn: document.getElementById('download-result-btn'),
    replayBtn: document.getElementById('replay-btn'),
    historyBtn: document.getElementById('history-btn'),
    comparison: document.getElementById('comparison'),
    historyOverlay: document.getElementById('history-overlay'),
    historyTitle: document.getElementById('history-title'),
    historyList: document.getElementById('history-list'),
    historyCloseBtn: document.getElementById('history-close-btn'),
    gameHelp: document.getElementById('game-help'),
    introOuterText: document.getElementById('intro-outer-text'),
    introCenterText: document.getElementById('intro-center-text'),
    introPauseText: document.getElementById('intro-pause-text')
  };

  const I18N = {
    de: {
      settings: 'Einstellungen', results: 'Ergebnisse', introTitle: "So geht's",
      introOuter: 'Drücke {key}, wenn du draussen etwas siehst.',
      introCenter: 'Drücke {key}, wenn sich die Form in der Mitte ändert.',
      introPause: 'Mit {key} kannst du pausieren.', introPref: 'Vor jedem Spiel anzeigen',
      back: 'Zurück', duration: 'Spieldauer', minutes: 'Minuten', gridSize: 'Grösse der 0/8-Felder',
      large: 'Gross', medium: 'Mittel', small: 'Klein', keys: 'Tasten', outer: 'Aussen', center: 'Zentrum',
      language: 'Sprache', darkMode: 'Dark Mode', introSetting: 'Erklärung vor Spiel', save: 'Speichern',
      unsavedTitle: 'Änderungen speichern?', unsavedText: 'Du hast Einstellungen geändert. Möchtest du sie vor dem Zurückgehen speichern?',
      saveAndBack: 'Speichern & zurück', discardAndBack: 'Ohne Speichern',
      resetSettings: 'Reset', resetTitle: 'Möchtest du die Einstellungen zurücksetzen?',
      resetText: '', resetConfirm: 'Reset', cancel: 'Abbrechen',
      history: 'Verlauf', historyTitle: 'Letzte 10 Runden', historyEmpty: 'Noch keine gespeicherten Runden',
      latest: 'Neueste', previousRound: 'Vergleich zur vorherigen Runde', noPreviousRound: 'Noch keine vorherige Runde zum Vergleichen.',
      percentagePoints: '%-Pkt.', roundLabel: 'Runde',
      pressKey: 'Taste drücken …', pressDesired: 'Jetzt gewünschte Taste drücken', escReserved: 'ESC ist für Pause reserviert',
      gameHelp: 'ESC · Pause / Beenden', pause: 'Pause', currentKeys: 'Aktuelle Tasten', continue: 'Weiter', end: 'Beenden',
      result: 'Ergebnis', replay: 'Nochmal spielen', downloadJpg: 'Als JPG herunterladen',
      hit: 'erkannt', miss: 'nicht erkannt', untested: 'nicht getestet', noResults: 'Noch keine Ergebnisse',
      detected: 'Erkannt', notDetected: 'Nicht erkannt', detectionRate: 'Erkennungsquote', reactionTime: 'Ø Reaktionszeit',
      outerField: 'Äusseres Feld', falsePositives: 'Fehlreaktionen', tested: 'Getestet', go: "Los geht's!",
      circle: 'Kreis', triangle: 'Dreieck', square: 'Quadrat', deleteKey: 'ENTF', resultFile: '08-ergebnis'
    },
    en: {
      settings: 'Settings', results: 'Results', introTitle: 'How to play',
      introOuter: 'Press {key} when you see something in the outer field.',
      introCenter: 'Press {key} when the shape in the center changes.',
      introPause: 'Press {key} to pause.', introPref: 'Show before every game',
      back: 'Back', duration: 'Game duration', minutes: 'Minutes', gridSize: 'Size of the 0/8 fields',
      large: 'Large', medium: 'Medium', small: 'Small', keys: 'Keys', outer: 'Outer', center: 'Center',
      language: 'Language', darkMode: 'Dark Mode', introSetting: 'Instructions before game', save: 'Save',
      unsavedTitle: 'Save changes?', unsavedText: 'You changed some settings. Would you like to save them before going back?',
      saveAndBack: 'Save & back', discardAndBack: 'Leave without saving',
      resetSettings: 'Reset', resetTitle: 'Do you want to reset the settings?',
      resetText: '', resetConfirm: 'Reset', cancel: 'Cancel',
      history: 'History', historyTitle: 'Last 10 rounds', historyEmpty: 'No saved rounds yet',
      latest: 'Latest', previousRound: 'Compared with previous round', noPreviousRound: 'No previous round to compare yet.',
      percentagePoints: 'pp', roundLabel: 'Round',
      pressKey: 'Press a key …', pressDesired: 'Press the key you want to use', escReserved: 'ESC is reserved for pause',
      gameHelp: 'ESC · Pause / End', pause: 'Pause', currentKeys: 'Current keys', continue: 'Continue', end: 'End',
      result: 'Result', replay: 'Play again', downloadJpg: 'Download as JPG',
      hit: 'detected', miss: 'not detected', untested: 'not tested', noResults: 'No results yet',
      detected: 'Detected', notDetected: 'Not detected', detectionRate: 'Detection rate', reactionTime: 'Ø reaction time',
      outerField: 'Outer field', falsePositives: 'False positives', tested: 'Tested', go: "Let's go!",
      circle: 'Circle', triangle: 'Triangle', square: 'Square', deleteKey: 'DELETE', resultFile: '08-result'
    }
  };

  function language() {
    return state.settings.language === 'en' ? 'en' : 'de';
  }

  function t(key) {
    return I18N[language()][key] ?? I18N.de[key] ?? key;
  }

  function keyedSentence(template, keyLabel, small = false) {
    const cls = small ? 'keycap keycap-small' : 'keycap';
    return template.replace('{key}', `<kbd class="${cls}">${keyLabel}</kbd>`);
  }

  function applyLanguage() {
    const lang = language();
    document.documentElement.lang = lang;
    document.getElementById('settings-btn').textContent = t('settings');
    document.getElementById('results-btn').textContent = t('results');
    document.getElementById('intro-title').textContent = t('introTitle');
    document.getElementById('intro-pref-label').textContent = t('introPref');
    document.getElementById('intro-back-btn').textContent = t('back');
    document.getElementById('settings-title').textContent = t('settings');
    document.getElementById('duration-label').textContent = t('duration');
    document.getElementById('minutes-label').textContent = t('minutes');
    document.getElementById('grid-size-label').textContent = t('gridSize');
    document.getElementById('grid-size-buttons').setAttribute('aria-label', t('gridSize'));
    el.gridButtons.forEach(btn => { btn.textContent = t(btn.dataset.grid); });
    document.getElementById('keys-label').textContent = t('keys');
    document.getElementById('outer-label').textContent = t('outer');
    document.getElementById('center-label').textContent = t('center');
    document.getElementById('language-label').textContent = t('language');
    document.getElementById('dark-mode-label').textContent = t('darkMode');
    document.getElementById('settings-intro-label').textContent = t('introSetting');
    document.getElementById('save-settings-btn').textContent = t('save');
    document.getElementById('cancel-settings-btn').textContent = t('back');
    if (el.unsavedSettingsTitle) el.unsavedSettingsTitle.textContent = t('unsavedTitle');
    if (el.unsavedSettingsText) el.unsavedSettingsText.textContent = t('unsavedText');
    if (el.saveAndBackBtn) el.saveAndBackBtn.textContent = t('saveAndBack');
    if (el.discardAndBackBtn) el.discardAndBackBtn.textContent = t('discardAndBack');
    if (el.resetSettingsBtn) el.resetSettingsBtn.textContent = t('resetSettings');
    if (el.resetSettingsTitle) el.resetSettingsTitle.textContent = t('resetTitle');
    if (el.confirmResetSettingsBtn) el.confirmResetSettingsBtn.textContent = t('resetConfirm');
    if (el.cancelResetSettingsBtn) el.cancelResetSettingsBtn.textContent = t('cancel');
    if (el.historyBtn) el.historyBtn.textContent = t('history');
    if (el.historyTitle) el.historyTitle.textContent = t('historyTitle');
    if (el.historyCloseBtn) el.historyCloseBtn.textContent = t('back');
    if (el.gameHelp) el.gameHelp.textContent = t('gameHelp');
    document.getElementById('pause-title').textContent = t('pause');
    document.getElementById('pause-keys').setAttribute('aria-label', t('currentKeys'));
    document.getElementById('pause-outer-label').textContent = t('outer');
    document.getElementById('pause-center-label').textContent = t('center');
    document.getElementById('pause-pause-label').textContent = t('pause');
    document.getElementById('continue-btn').textContent = t('continue');
    document.getElementById('end-btn').textContent = t('end');
    document.getElementById('result-title').textContent = t('result');
    document.getElementById('replay-btn').textContent = t('replay');
    document.getElementById('download-result-btn').textContent = t('downloadJpg');
    document.getElementById('result-back-btn').textContent = t('back');
    document.getElementById('legend-hit').textContent = t('hit');
    document.getElementById('legend-miss').textContent = t('miss');
    document.getElementById('legend-untested').textContent = t('untested');
    const introAria = lang === 'en' ? 'Show instructions before every game' : 'Erklärung vor jedem Spiel anzeigen';
    el.introShowBtn.setAttribute('aria-label', introAria);
    el.settingsIntroBtn.setAttribute('aria-label', introAria);
    document.getElementById('language-buttons').setAttribute('aria-label', t('language'));
    el.languageButtons.forEach(btn => {
      const selected = btn.dataset.language === lang;
      btn.classList.toggle('selected', selected);
      btn.setAttribute('aria-checked', String(selected));
    });
    refreshKeyButtons();
    refreshInstructionKeys();
    setCenterSymbol(state.currentSymbol || 'circle');
    if (state.lastSession && el.result.classList.contains('active')) showResult(state.lastSession);
    if (state.historyOpen) renderHistoryList();
  }

  function selectLanguage(lang) {
    state.settings.language = lang === 'en' ? 'en' : 'de';
    applyLanguage();
  }

  function normalizeSettings(settings) {
    const normalized = { ...DEFAULTS, ...settings };
    normalized.durationMinutes = Math.max(
      1,
      Math.min(MAX_DURATION_MINUTES, Number.parseInt(normalized.durationMinutes, 10) || DEFAULTS.durationMinutes)
    );
    return normalized;
  }

  function loadSettings() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return normalizeSettings(JSON.parse(current));

      const previousRaw = localStorage.getItem(PREVIOUS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      const previous = previousRaw ? JSON.parse(previousRaw) : {};
      const settings = normalizeSettings({ ...previous, darkMode: true });
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
      if (!Array.isArray(value)) return [];
      const trimmed = value.slice(0, 10);
      if (!localStorage.getItem(SESSION_KEY) || value.length !== trimmed.length) {
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(trimmed));
        } catch {
          // Reading existing results should still work if storage is full.
        }
      }
      return trimmed;
    } catch {
      return [];
    }
  }

  function saveSession(session) {
    const sessions = loadSessions();
    sessions.unshift(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions.slice(0, 10)));
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
      Backspace: 'BACKSPACE', Delete: t('deleteKey'), Tab: 'TAB'
    };
    if (names[code]) return names[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
    return code.replace(/^(Left|Right)/, '');
  }

  function refreshKeyButtons() {
    el.outerKeyBtn.textContent = state.keyCaptureTarget === 'outer' ? t('pressKey') : displayKey(state.settings.outerKey);
    el.centerKeyBtn.textContent = state.keyCaptureTarget === 'center' ? t('pressKey') : displayKey(state.settings.centerKey);
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
    if (el.introOuterText) el.introOuterText.innerHTML = keyedSentence(t('introOuter'), outer);
    if (el.introCenterText) el.introCenterText.innerHTML = keyedSentence(t('introCenter'), center);
    if (el.introPauseText) el.introPauseText.innerHTML = keyedSentence(t('introPause'), 'ESC', true);
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
    el.keyHint.textContent = t('pressDesired');
    refreshKeyButtons();
  }

  function captureKey(event) {
    if (!state.keyCaptureTarget) return false;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return true;
    if (event.code === 'Escape') {
      el.keyHint.textContent = t('escReserved');
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

  function settingsComparable(settings) {
    const normalized = normalizeSettings(settings);
    return {
      durationMinutes: normalized.durationMinutes,
      gridSize: normalized.gridSize,
      outerKey: normalized.outerKey,
      centerKey: normalized.centerKey,
      darkMode: Boolean(normalized.darkMode),
      showIntro: normalized.showIntro !== false,
      language: normalized.language === 'en' ? 'en' : 'de'
    };
  }

  function readSettingsDraft() {
    const minutes = Math.max(
      1,
      Math.min(MAX_DURATION_MINUTES, Number.parseInt(el.duration.value, 10) || DEFAULTS.durationMinutes)
    );
    return normalizeSettings({ ...state.settings, durationMinutes: minutes });
  }

  function hasUnsavedSettingsChanges() {
    if (!state.settingsSnapshot) return false;
    return JSON.stringify(settingsComparable(readSettingsDraft())) !== JSON.stringify(settingsComparable(state.settingsSnapshot));
  }

  function closeUnsavedSettingsDialog() {
    state.settingsConfirmOpen = false;
    if (el.unsavedSettingsOverlay) el.unsavedSettingsOverlay.classList.add('hidden');
  }

  function openUnsavedSettingsDialog() {
    state.keyCaptureTarget = null;
    el.keyHint.textContent = '';
    refreshKeyButtons();
    state.settingsConfirmOpen = true;
    applyLanguage();
    el.unsavedSettingsOverlay.classList.remove('hidden');
    window.requestAnimationFrame(() => el.saveAndBackBtn?.focus());
  }

  function restoreSavedSettingsAndReturn() {
    closeUnsavedSettingsDialog();
    state.settings = loadSettings();
    state.settingsSnapshot = null;
    state.keyCaptureTarget = null;
    el.keyHint.textContent = '';
    selectGrid(state.settings.gridSize);
    refreshKeyButtons();
    refreshInstructionKeys();
    applyTheme();
    syncIntroPreferenceToggles();
    applyLanguage();
    showScreen(el.home);
  }

  function closeResetSettingsDialog() {
    state.resetConfirmOpen = false;
    if (el.resetSettingsOverlay) el.resetSettingsOverlay.classList.add('hidden');
  }

  function openResetSettingsDialog() {
    state.keyCaptureTarget = null;
    el.keyHint.textContent = '';
    refreshKeyButtons();
    state.resetConfirmOpen = true;
    applyLanguage();
    el.resetSettingsOverlay?.classList.remove('hidden');
    window.requestAnimationFrame(() => el.confirmResetSettingsBtn?.focus());
  }

  function resetSettingsToDefaults() {
    state.settings = normalizeSettings({ ...DEFAULTS });
    el.duration.value = String(state.settings.durationMinutes);
    selectGrid(state.settings.gridSize);
    state.keyCaptureTarget = null;
    el.keyHint.textContent = '';
    refreshKeyButtons();
    refreshInstructionKeys();
    applyTheme();
    syncIntroPreferenceToggles();
    applyLanguage();
    saveSettings();
    state.settingsSnapshot = normalizeSettings({ ...state.settings });
    closeResetSettingsDialog();
  }

  function handleSettingsBack() {
    if (hasUnsavedSettingsChanges()) {
      openUnsavedSettingsDialog();
      return;
    }
    restoreSavedSettingsAndReturn();
  }

  function openSettings() {
    closeUnsavedSettingsDialog();
    closeResetSettingsDialog();
    state.settingsSnapshot = normalizeSettings({ ...state.settings });
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
    applyLanguage();
    showScreen(el.settings);
  }

  function clampDurationInput() {
    const raw = String(el.duration.value ?? '').trim();
    if (!raw) return;
    const value = Number.parseInt(raw, 10);
    if (Number.isFinite(value) && value > MAX_DURATION_MINUTES) {
      el.duration.value = String(MAX_DURATION_MINUTES);
    }
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
    state.settings = readSettingsDraft();
    el.duration.value = String(state.settings.durationMinutes);
    saveSettings();
    state.settingsSnapshot = null;
    closeUnsavedSettingsDialog();
    refreshInstructionKeys();
    applyTheme();
    syncIntroPreferenceToggles();
    applyLanguage();
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
    el.centerSymbol.setAttribute('aria-label', symbol === 'circle' ? t('circle') : symbol === 'triangle' ? t('triangle') : t('square'));
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

  function centerGridCells(cols, rows) {
    // Always use a centre cut-out that matches the parity of the grid.
    // This guarantees exactly the same number of visible fields on both
    // sides of the centre for every preset.
    return {
      cols: cols % 2 === 0 ? [cols / 2 - 1, cols / 2] : [Math.floor(cols / 2)],
      rows: rows % 2 === 0 ? [rows / 2 - 1, rows / 2] : [Math.floor(rows / 2)]
    };
  }

  function updateHiddenCenterCells() {
    // Keep the central cut-out tied to logical grid cells, not to the current
    // browser viewport. Native fullscreen changes the viewport size while ESC
    // is being handled; recomputing by pixel intersection made extra rows or
    // columns disappear around the centre after rapid pause/resume cycles.
    const { cols, rows } = gridPreset();
    const center = centerGridCells(cols, rows);
    const hiddenIds = new Set();

    center.rows.forEach(row => {
      center.cols.forEach(col => hiddenIds.add(row * cols + col));
    });

    state.availableOuter = [];
    state.cells.forEach(cell => {
      const id = Number(cell.dataset.id);
      const hidden = hiddenIds.has(id);
      cell.classList.toggle('hidden-cell', hidden);
      if (!hidden) state.availableOuter.push(id);
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

  async function lockEscapeForGame() {
    // Chromium/Edge expose the Keyboard Lock API separately. Using it in
    // addition to the fullscreen option gives ESC to the game reliably on
    // browsers that support immersive keyboard capture.
    if (!navigator.keyboard || typeof navigator.keyboard.lock !== 'function') return;
    try {
      await navigator.keyboard.lock(['Escape']);
    } catch {
      // Progressive enhancement only. Normal fullscreen remains usable.
    }
  }

  async function requestFullScreen() {
    if (document.fullscreenElement) {
      await lockEscapeForGame();
      return true;
    }
    if (!document.documentElement.requestFullscreen) return false;
    try {
      // Fullscreen keyboard lock allows ESC to be used as the in-game
      // pause/resume key instead of immediately leaving fullscreen.
      await document.documentElement.requestFullscreen({
        navigationUI: 'hide',
        keyboardLock: 'browser'
      });
      await lockEscapeForGame();
      return Boolean(document.fullscreenElement);
    } catch {
      // Fallback for browsers that do not understand the newer fullscreen
      // options. The Continue button still restores fullscreen there.
      try {
        await document.documentElement.requestFullscreen();
        await lockEscapeForGame();
        return Boolean(document.fullscreenElement);
      } catch {
        return false;
      }
    }
  }

  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || !state.running || state.paused || document.hidden) return false;
    try {
      if (state.wakeLock && !state.wakeLock.released) return true;
      const lock = await navigator.wakeLock.request('screen');
      state.wakeLock = lock;
      lock.addEventListener('release', () => {
        if (state.wakeLock === lock) state.wakeLock = null;
      }, { once: true });
      return true;
    } catch {
      state.wakeLock = null;
      return false;
    }
  }

  async function releaseWakeLock() {
    const lock = state.wakeLock;
    state.wakeLock = null;
    if (!lock) return;
    try {
      await lock.release();
    } catch {
      // Wake Lock is progressive enhancement; gameplay must not depend on it.
    }
  }

  function pauseBeforeGameplay() {
    if (!state.running || !state.countingDown || state.preGamePaused) return;
    window.clearTimeout(state.countdownTimer);
    state.countdownSuspended = true;
    state.countingDown = false;
    state.preGamePaused = true;
    state.paused = true;
    state.pauseStartedAt = performance.now();
    void releaseWakeLock();
    el.countdownOverlay.classList.add('hidden');
    refreshInstructionKeys();
    el.pauseOverlay.classList.remove('hidden');
  }

  function handleVisibilityChange() {
    if (!state.running) return;

    if (document.hidden) {
      if (state.countingDown) {
        pauseBeforeGameplay();
      } else if (!state.paused) {
        pauseTest();
      } else {
        void releaseWakeLock();
      }
    }
  }

  function handleWindowBlur() {
    if (!state.running || state.paused || state.fullscreenTransitioning) return;
    window.setTimeout(() => {
      if (!state.running || state.paused || state.fullscreenTransitioning || document.hasFocus()) return;
      if (state.countingDown) pauseBeforeGameplay();
      else pauseTest();
    }, 80);
  }

  function startTest() {
    requestFullScreen();
    clearAllTimers();
    state.phase = false;
    state.running = true;
    state.paused = false;
    state.countingDown = true;
    state.fullscreenTransitioning = false;
    state.countdownSuspended = false;
    state.preGamePaused = false;
    state.testedOuter = new Set();
    state.outerPlan = [];
    state.outerPlanIndex = 0;
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
    void requestWakeLock();
    startCountdown();
  }

  function startCountdown() {
    if (!state.running || state.countdownSuspended) return;
    window.clearTimeout(state.countdownTimer);
    const steps = ['3', '2', '1', t('go')];
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
    void requestWakeLock();
    state.startedAt = performance.now();
    state.endAt = state.startedAt + state.settings.durationMinutes * 60_000;
    prepareOuterPlan();

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

  function shuffled(values) {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function outerTargetSlotMs(durationMinutes) {
    // Short rounds are intentionally denser. From 5 to 15 minutes the target
    // gradually relaxes to the normal pace. Longer rounds keep the normal
    // target and naturally spread out further once every available field is
    // already part of the plan.
    if (durationMinutes <= 5) return OUTER_SHORT_SLOT_MS;
    if (durationMinutes >= 15) return OUTER_NORMAL_SLOT_MS;
    const progress = (durationMinutes - 5) / 10;
    return OUTER_SHORT_SLOT_MS + (OUTER_NORMAL_SLOT_MS - OUTER_SHORT_SLOT_MS) * progress;
  }

  function prepareOuterPlan() {
    const durationMs = state.settings.durationMinutes * 60_000;
    const targetSlotMs = outerTargetSlotMs(state.settings.durationMinutes);
    // Every location can still appear at most once. Short sessions use more
    // locations per minute, while long sessions can eventually use all fields.
    const plannedCount = Math.min(
      state.availableOuter.length,
      Math.max(1, Math.floor(durationMs / targetSlotMs))
    );
    state.outerPlan = shuffled(state.availableOuter).slice(0, plannedCount);
    state.outerPlanIndex = 0;
  }

  function scheduleOuterEvent() {
    if (!state.running || state.paused) return;
    window.clearTimeout(state.outerWaitTimer);

    const remainingCount = state.outerPlan.length - state.outerPlanIndex;
    if (remainingCount <= 0) return;

    const remainingGameMs = Math.max(0, state.endAt - performance.now());
    if (remainingGameMs <= RESPONSE_WINDOW_MS + 100) return;

    // Use a deliberately wide random range instead of a narrow jitter around
    // a fixed beat. Recomputing from the remaining time after every event
    // keeps the complete plan spread across the session without creating a
    // recognisable rhythm. The minimum is longer than the response window, so
    // two outer stimuli cannot overlap.
    const idealSlotMs = remainingGameMs / remainingCount;
    const randomFactor = 0.45 + Math.random() * 1.25;
    const minDelay = RESPONSE_WINDOW_MS + 250;
    const latestSafeDelay = Math.max(minDelay, remainingGameMs - RESPONSE_WINDOW_MS - 100);
    const delay = Math.min(latestSafeDelay, Math.max(minDelay, idealSlotMs * randomFactor));

    state.outerWaitTimer = window.setTimeout(showOuterStimulus, delay);
  }

  function showOuterStimulus() {
    if (!state.running || state.paused) return;
    if (state.outerPlanIndex >= state.outerPlan.length) return;

    const id = state.outerPlan[state.outerPlanIndex];
    state.outerPlanIndex += 1;
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
    // Schedule independently of the player's response so outer timing is not
    // coupled to reaction speed or to the central stimulus sequence.
    scheduleOuterEvent();
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
    // The next center change is planned from the moment this change appears,
    // not from the response. This keeps center and outer events independent.
    scheduleCentralEvent();
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
  }

  function onKeyDown(event) {
    if (state.resetConfirmOpen) {
      if (event.code === 'Escape') {
        event.preventDefault();
        closeResetSettingsDialog();
        el.resetSettingsBtn?.focus();
      }
      return;
    }
    if (state.historyOpen) {
      if (event.code === 'Escape') {
        event.preventDefault();
        closeHistory();
        el.historyBtn?.focus();
      }
      return;
    }
    if (state.settingsConfirmOpen) {
      if (event.code === 'Escape') {
        event.preventDefault();
        closeUnsavedSettingsDialog();
        el.cancelSettingsBtn?.focus();
      }
      return;
    }
    if (captureKey(event)) return;
    if (!state.running) return;
    if (event.repeat) return;

    // Before gameplay begins, ESC never resumes the game. If the opening
    // countdown was auto-paused because the page lost focus, the player must
    // use Continue so fullscreen can be restored through a click gesture.
    if (state.preGamePaused) {
      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    // ESC is deliberately unavailable during the opening countdown. With
    // fullscreen keyboard lock enabled, preventDefault() also keeps supported
    // browsers from leaving fullscreen during these first seconds.
    if (state.countingDown) {
      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (event.code === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (state.fullscreenTransitioning) return;
      if (state.paused) void resumeTest();
      else pauseTest();
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
    void releaseWakeLock();
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

  async function resumeTest() {
    if (!state.running || !state.paused || state.fullscreenTransitioning) return;

    // With keyboard lock, ESC normally leaves fullscreen untouched and this
    // resolves immediately. The fullscreen check remains as a fallback for
    // browsers that still exit fullscreen on ESC.
    state.fullscreenTransitioning = true;
    const enteredFullscreen = await requestFullScreen();
    state.fullscreenTransitioning = false;

    if (!state.running || !state.paused) return;
    if (!enteredFullscreen && !document.fullscreenElement) {
      // Stay paused if fullscreen could not be restored. The Continue button
      // can always provide the required click gesture in fallback browsers.
      return;
    }

    if (state.preGamePaused) {
      state.preGamePaused = false;
      state.countdownSuspended = false;
      state.paused = false;
      state.countingDown = true;
      el.pauseOverlay.classList.add('hidden');
      void requestWakeLock();
      startCountdown();
      return;
    }

    const now = performance.now();
    const pausedFor = now - state.pauseStartedAt;
    state.endAt += pausedFor;
    state.pausedTotalMs += pausedFor;
    state.paused = false;
    el.pauseOverlay.classList.add('hidden');
    void requestWakeLock();
    scheduleOuterEvent();
    scheduleCentralEvent();
  }

  function onFullscreenChange() {
    if (document.fullscreenElement) {
      if (state.running) void lockEscapeForGame();
      return;
    }

    // Fallback for browsers without keyboard lock: if the browser still
    // consumes ESC and leaves fullscreen during gameplay, pause immediately.
    if (state.running && !state.paused && !state.countingDown) {
      pauseTest();
    }
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
    state.countdownSuspended = false;
    state.preGamePaused = false;
    void releaseWakeLock();
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
      el.resultsBtn.textContent = t('noResults');
      window.setTimeout(() => { el.resultsBtn.textContent = t('results'); }, 1300);
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
        [t('detected'), hits.length],
        [t('notDetected'), results.length - hits.length],
        [t('detectionRate'), `${percentage(results)}%`],
        [t('reactionTime'), avg == null ? '–' : `${avg} ms`],
        [t('outerField'), `${percentage(outer)}%`],
        [t('center'), `${percentage(central)}%`],
        [t('falsePositives'), session.falsePositives || 0],
        [t('tested'), results.length]
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
    ctx.fillText(t('result'), 100, 170);

    const date = new Date(session.finishedAt || session.id || Date.now());
    ctx.fillStyle = muted;
    ctx.textAlign = 'right';
    ctx.font = '500 22px Arial, sans-serif';
    ctx.fillText(date.toLocaleString(language() === 'en' ? 'en-GB' : 'de-CH'), 1500, 120);
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
    const center = centerGridCells(cols, rows);
    const centerColSet = new Set(center.cols);
    const centerRowSet = new Set(center.rows);

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(mapX, mapY, mapW, mapH);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = row * cols + col;
        const inCenter = centerColSet.has(col) && centerRowSet.has(row);
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
      [t('hit'), hitColor],
      [t('miss'), missColor],
      [t('untested'), untestedColor]
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
      a.download = `${t('resultFile')}-${stamp}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/jpeg', 0.94);
  }

  function sessionMetrics(session) {
    const results = session?.results || [];
    const hits = results.filter(r => r.detected);
    const times = hits.map(r => r.reactionTimeMs).filter(Number.isFinite);
    return {
      rate: percentage(results),
      falsePositives: Number(session?.falsePositives || 0),
      avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null
    };
  }

  function signed(value, digits = 0) {
    if (!Number.isFinite(value)) return '–';
    const rounded = Number(value.toFixed(digits));
    return `${rounded > 0 ? '+' : ''}${rounded}`;
  }

  function findSessionIndex(session, sessions) {
    const id = session?.id || session?.finishedAt;
    return sessions.findIndex(item => (item.id || item.finishedAt) === id);
  }

  function renderComparison(session) {
    if (!el.comparison) return;
    const sessions = loadSessions();
    const index = findSessionIndex(session, sessions);
    const previous = index >= 0 ? sessions[index + 1] : null;

    if (!previous) {
      el.comparison.innerHTML = `<span class="comparison-title">${t('previousRound')}</span><span class="comparison-empty">${t('noPreviousRound')}</span>`;
      return;
    }

    const current = sessionMetrics(session);
    const prior = sessionMetrics(previous);
    const rateDelta = current.rate - prior.rate;
    const falseDelta = current.falsePositives - prior.falsePositives;
    const reactionDelta = current.avg != null && prior.avg != null ? current.avg - prior.avg : null;

    el.comparison.innerHTML = `
      <span class="comparison-title">${t('previousRound')}</span>
      <span><b>${t('detectionRate')}</b> ${signed(rateDelta, 1)} ${t('percentagePoints')}</span>
      <span><b>${t('falsePositives')}</b> ${signed(falseDelta)}</span>
      <span><b>${t('reactionTime')}</b> ${reactionDelta == null ? '–' : `${signed(reactionDelta)} ms`}</span>
    `;
  }

  function closeHistory() {
    state.historyOpen = false;
    el.historyOverlay?.classList.add('hidden');
  }

  function renderHistoryList() {
    if (!el.historyList) return;
    const sessions = loadSessions();
    el.historyList.innerHTML = '';

    if (!sessions.length) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = t('historyEmpty');
      el.historyList.appendChild(empty);
      return;
    }

    const locale = language() === 'en' ? 'en-GB' : 'de-CH';
    sessions.forEach((session, index) => {
      const metrics = sessionMetrics(session);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-item';
      const selectedId = state.lastSession?.id || state.lastSession?.finishedAt;
      const itemId = session.id || session.finishedAt;
      button.classList.toggle('selected', selectedId === itemId);

      const date = new Date(session.finishedAt || session.id || Date.now());
      const title = document.createElement('span');
      title.className = 'history-item-title';
      title.textContent = `${index === 0 ? `${t('latest')} · ` : ''}${date.toLocaleString(locale)}`;

      const meta = document.createElement('span');
      meta.className = 'history-item-meta';
      meta.textContent = `${t('detectionRate')}: ${metrics.rate}% · ${t('falsePositives')}: ${metrics.falsePositives}`;

      button.append(title, meta);
      button.addEventListener('click', () => {
        closeHistory();
        showResult(session);
      });
      el.historyList.appendChild(button);
    });
  }

  function openHistory() {
    state.historyOpen = true;
    renderHistoryList();
    el.historyOverlay?.classList.remove('hidden');
    window.requestAnimationFrame(() => el.historyCloseBtn?.focus());
  }

  function showResult(session) {
    state.lastSession = session;
    const { cards } = sessionSummary(session);

    el.stats.innerHTML = cards.map(([label, value]) =>
      `<div class="stat-card"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`
    ).join('');

    renderComparison(session);
    renderResultMap(session);
    showScreen(el.result);
  }

  function fitResultMap() {
    if (!el.resultMap || !el.resultMapSlot || !el.result.classList.contains('active')) return;
    const rect = el.resultMapSlot.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const ratio = 16 / 9;
    let width = rect.width;
    let height = width / ratio;
    if (height > rect.height) {
      height = rect.height;
      width = height * ratio;
    }

    el.resultMap.style.width = `${Math.max(1, Math.floor(width))}px`;
    el.resultMap.style.height = `${Math.max(1, Math.floor(height))}px`;
  }

  function renderResultMap(session) {
    const preset = session.grid || GRID_PRESETS[session.settings?.gridSize] || GRID_PRESETS.medium;
    const { cols, rows } = preset;
    el.resultMap.innerHTML = '';
    el.resultMap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    el.resultMap.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    const resultById = new Map((session.results || []).filter(r => r.type === 'outer').map(r => [r.id, r]));
    const center = centerGridCells(cols, rows);
    const centerColSet = new Set(center.cols);
    const centerRowSet = new Set(center.rows);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = row * cols + col;
        const div = document.createElement('div');
        div.className = 'result-cell';
        const inCenter = centerColSet.has(col) && centerRowSet.has(row);
        if (inCenter) {
          div.classList.add('center-hole');
        } else {
          const r = resultById.get(id);
          div.classList.add(!r ? 'untested' : r.detected ? 'hit' : 'miss');
        }
        el.resultMap.appendChild(div);
      }
    }
    window.requestAnimationFrame(fitResultMap);
  }

  el.startBtn.addEventListener('click', startFromHome);
  el.introStartBtn.addEventListener('click', startFromIntro);
  el.introBackBtn.addEventListener('click', () => showScreen(el.home));
  el.introShowBtn.addEventListener('click', toggleIntroFromIntro);
  el.settingsBtn.addEventListener('click', openSettings);
  el.languageButtons.forEach(btn => btn.addEventListener('click', () => selectLanguage(btn.dataset.language)));
  el.resultsBtn.addEventListener('click', showLatestResult);
  el.gridButtons.forEach(btn => btn.addEventListener('click', () => selectGrid(btn.dataset.grid)));
  el.duration.addEventListener('input', clampDurationInput);
  el.outerKeyBtn.addEventListener('click', () => startKeyCapture('outer'));
  el.centerKeyBtn.addEventListener('click', () => startKeyCapture('center'));
  el.darkModeBtn.addEventListener('click', toggleDarkMode);
  el.settingsIntroBtn.addEventListener('click', toggleIntroFromSettings);
  el.saveSettingsBtn.addEventListener('click', applySettings);
  el.cancelSettingsBtn.addEventListener('click', handleSettingsBack);
  el.saveAndBackBtn.addEventListener('click', applySettings);
  el.discardAndBackBtn.addEventListener('click', restoreSavedSettingsAndReturn);
  el.resetSettingsBtn.addEventListener('click', openResetSettingsDialog);
  el.confirmResetSettingsBtn.addEventListener('click', resetSettingsToDefaults);
  el.cancelResetSettingsBtn.addEventListener('click', closeResetSettingsDialog);
  el.continueBtn.addEventListener('click', resumeTest);
  el.endBtn.addEventListener('click', finishTest);
  el.replayBtn.addEventListener('click', startFromHome);
  el.downloadResultBtn.addEventListener('click', downloadResultJpg);
  el.historyBtn.addEventListener('click', openHistory);
  el.historyCloseBtn.addEventListener('click', closeHistory);
  el.resultBackBtn.addEventListener('click', () => {
    closeHistory();
    showScreen(el.home);
  });
  document.addEventListener('keydown', onKeyDown, { passive: false });
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('resize', () => window.requestAnimationFrame(fitResultMap));
  window.addEventListener('focus', () => {
    if (state.running && !state.paused && !document.hidden) void requestWakeLock();
  });
  if ('ResizeObserver' in window && el.resultMapSlot) {
    const resultMapObserver = new ResizeObserver(() => window.requestAnimationFrame(fitResultMap));
    resultMapObserver.observe(el.resultMapSlot);
  }

  // The game grid itself is responsive through CSS. The central cut-out is
  // intentionally NOT recalculated on resize/fullscreen changes so its logical
  // shape cannot change when ESC is pressed repeatedly.

  selectGrid(state.settings.gridSize);
  applyTheme();
  syncIntroPreferenceToggles();
  applyLanguage();
  showScreen(el.home);
})();
