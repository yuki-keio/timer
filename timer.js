class SimpleTimer {
  constructor() {
    this.timer = null;
    this.totalSeconds = 180;
    this.remainingSeconds = 180;
    this.isRunning = false;
    this.isPaused = false;
    this.isFullscreen = false; // フルスクリーン状態を管理

    this.initializeElements();
    this.loadSettings();
    this.setupEventListeners();
    this.initializeSpeech();
    this.updateDisplay();
  }

  initializeElements() {
    this.elements = {
      minutesInput: document.getElementById('minutes-input'),
      secondsInput: document.getElementById('seconds-input'),
      timeControls: document.querySelector('.time-controls'),
      timeBtns: document.querySelectorAll('.time-btn'),
      startBtn: document.getElementById('start-btn'),
      resetBtn: document.getElementById('reset-btn'),
      soundCheck: document.getElementById('sound-check'),
      alarmCheck: document.getElementById('alarm-check'),
      helpBtn: document.getElementById('help-btn'),
      presetBtns: document.querySelectorAll('.preset-btn'),
      fullscreenBtn: document.getElementById('fullscreen-btn'),
      fullscreenOverlay: document.getElementById('fullscreen-overlay'),
      fullscreenTimer: document.getElementById('fullscreen-timer'),
      exitFullscreenBtn: document.getElementById('exit-fullscreen-btn')
    };
  }

  initializeSpeech() {
    this.speech = new SpeechSynthesisUtterance();
    this.speech.lang = 'ja-JP';
    this.speech.rate = 1.0;
    this.speech.pitch = 1.0;

    // アラーム音を初期化
    this.alarmAudio = new Audio('./alarm.mp3');
    this.alarmAudio.preload = 'auto';
    this.alarmAudio.volume = 0.7;
  }

  setupEventListeners() {
    // スタートボタン（スタート/一時停止/再開を切り替え）
    this.elements.startBtn.addEventListener('click', () => this.handleStartPause());

    // リセットボタン
    this.elements.resetBtn.addEventListener('click', () => this.reset());

    // 音声設定
    this.elements.soundCheck.addEventListener('change', (e) => {
      this.soundEnabled = e.target.checked;
      this.saveSettings(); // 設定を保存
      if (this.soundEnabled) {
        this.speak('音声がONになりました');
      }
    });

    // アラーム設定
    this.elements.alarmCheck.addEventListener('change', (e) => {
      this.alarmEnabled = e.target.checked;
      this.saveSettings(); // 設定を保存
      if (this.alarmEnabled) {
        this.speak('アラーム音がONになりました');
      }
    });

    // ヘルプボタン
    this.elements.helpBtn.addEventListener('click', () => this.showHelp());

    this.elements.presetBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const minutes = parseInt(e.target.dataset.minutes);
        this.setPresetTime(minutes);
      });
    });

    // 時間入力フィールドの変更
    this.elements.minutesInput.addEventListener('input', () => this.updateTimeFromInput());
    this.elements.secondsInput.addEventListener('input', () => this.updateTimeFromInput());
    this.elements.minutesInput.addEventListener('blur', () => this.validateMinutesInput());
    this.elements.secondsInput.addEventListener('blur', () => this.validateSecondsInput());

    // プラス・マイナスボタン
    this.elements.timeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const unit = e.currentTarget.dataset.unit;
        const isPlus = e.currentTarget.classList.contains('time-btn-up');
        // data-step属性があればその値、なければ1
        const step = parseInt(e.currentTarget.dataset.step) || 1;
        this.adjustTime(unit, isPlus ? step : -step);
      });
    });

    // キーボードショートカット
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // フルスクリーンボタン
    this.elements.fullscreenBtn.addEventListener('click', () => this.enterFullscreen());

    // フルスクリーン終了ボタン
    this.elements.exitFullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // イベントの伝播を止める
      this.exitFullscreen();
    });

    // フルスクリーンオーバーレイのクリックでタイマーを開始/一時停止
    this.elements.fullscreenOverlay.addEventListener('click', (e) => {
      // exitボタン自体のクリックは除外（stopPropagationで処理済み）
      this.handleStartPause();
      // クリックフィードバックを表示
      this.showClickFeedback();
    });
  }

  showClickFeedback() {
    const fullscreenContent = this.elements.fullscreenOverlay.querySelector('.fullscreen-content');
    fullscreenContent.classList.add('click-feedback');
    setTimeout(() => {
      fullscreenContent.classList.remove('click-feedback');
    }, 300);
  }

  loadSettings() {
    // localStorageから音声設定を読み込み、デフォルトはfalse（オフ）
    const savedSoundEnabled = localStorage.getItem('timerSoundEnabled');
    this.soundEnabled = savedSoundEnabled === 'true';

    // localStorageからアラーム設定を読み込み、デフォルトはtrue（オン）
    const savedAlarmEnabled = localStorage.getItem('timerAlarmEnabled');
    this.alarmEnabled = savedAlarmEnabled !== 'false'; // デフォルトはON

    // チェックボックスの状態を設定に合わせる
    if (this.elements.soundCheck) {
      this.elements.soundCheck.checked = this.soundEnabled;
    }
    if (this.elements.alarmCheck) {
      this.elements.alarmCheck.checked = this.alarmEnabled;
    }
  }

  saveSettings() {
    // 音声設定をlocalStorageに保存
    localStorage.setItem('timerSoundEnabled', this.soundEnabled.toString());
    // アラーム設定をlocalStorageに保存
    localStorage.setItem('timerAlarmEnabled', this.alarmEnabled.toString());
  }

  parseTimeInput(timeString) {
    // この関数は互換性のために残しますが、新しいUIでは使用しません
    const cleanTime = timeString.replace(/[^\d:]/g, '');
    const parts = cleanTime.split(':');

    let minutes = 0;
    let seconds = 0;

    if (parts.length === 1) {
      // 数字のみの場合は分として扱う
      minutes = parseInt(parts[0]) || 0;
    } else if (parts.length >= 2) {
      minutes = parseInt(parts[0]) || 0;
      seconds = parseInt(parts[1]) || 0;
    }

    // 秒が60以上の場合は分に変換
    if (seconds >= 60) {
      minutes += Math.floor(seconds / 60);
      seconds = seconds % 60;
    }

    // 制限値の適用
    minutes = Math.min(Math.max(minutes, 0), 999);
    seconds = Math.min(Math.max(seconds, 0), 59);

    return { minutes, seconds };
  }

  adjustTime(unit, delta) {
    if (this.isRunning) return;

    if (unit === 'minutes') {
      let minutes = parseInt(this.elements.minutesInput.value) || 0;
      minutes = Math.max(0, Math.min(999, minutes + delta));
      this.elements.minutesInput.value = minutes;
    } else if (unit === 'seconds') {
      let seconds = parseInt(this.elements.secondsInput.value) || 0;
      seconds += delta;

      // stepが10や20でも正しく分・秒を調整
      let minutes = parseInt(this.elements.minutesInput.value) || 0;
      if (seconds >= 60) {
        minutes += Math.floor(seconds / 60);
        seconds = seconds % 60;
        minutes = Math.min(999, minutes);
        this.elements.minutesInput.value = minutes;
      } else if (seconds < 0) {
        let absSec = Math.abs(seconds);
        let dec = Math.ceil(absSec / 60);
        if (minutes >= dec) {
          minutes -= dec;
          seconds = (seconds % 60 + 60) % 60;
        } else {
          minutes = 0;
          seconds = 0;
        }
        this.elements.minutesInput.value = minutes;
      }

      this.elements.secondsInput.value = seconds.toString().padStart(2, '0');
    }

    this.updateTimeFromInput();
  }

  formatTime(minutes, seconds) {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  updateTimeFromInput() {
    if (this.isRunning) return; // タイマー実行中は更新しない

    const minutes = parseInt(this.elements.minutesInput.value) || 0;
    const seconds = parseInt(this.elements.secondsInput.value) || 0;

    this.totalSeconds = minutes * 60 + seconds;
    this.remainingSeconds = this.totalSeconds;

    const matchingPreset = Array.from(this.elements.presetBtns).find(btn =>
      parseInt(btn.dataset.minutes) === minutes && seconds === 0
    );
    this.updatePresetButtons(matchingPreset ? minutes : null);
  }

  validateMinutesInput() {
    if (this.isRunning) return;

    let minutes = parseInt(this.elements.minutesInput.value) || 0;
    minutes = Math.min(Math.max(minutes, 0), 999);
    this.elements.minutesInput.value = minutes;
    this.updateTimeFromInput();
  }

  validateSecondsInput() {
    if (this.isRunning) return;

    let seconds = parseInt(this.elements.secondsInput.value) || 0;
    seconds = Math.min(Math.max(seconds, 0), 59);
    this.elements.secondsInput.value = seconds.toString().padStart(2, '0');
    this.updateTimeFromInput();
  }

  onInputFocus() {
    if (!this.isRunning && !this.isPaused) {
      // フォーカス時の処理（必要に応じて）
    }
  }

  setPresetTime(minutes) {
    this.elements.minutesInput.value = minutes;
    this.elements.secondsInput.value = "00"
    this.updateTimeFromInput();
    this.updatePresetButtons(minutes);
  }

  updatePresetButtons(activeMinutes = null) {
    this.elements.presetBtns.forEach(btn => {
      const btnMinutes = parseInt(btn.dataset.minutes);
      if (btnMinutes === activeMinutes) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  handleStartPause() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  start() {
    if (this.totalSeconds <= 0) {
      alert('時間を設定してください');
      return;
    }

    if (!this.isPaused) {
      this.remainingSeconds = this.totalSeconds;
      this.updateDisplay();
    }

    this.isRunning = true;
    this.isPaused = false;

    this.updateButtons();
    this.updateDisplayState();

    this.timer = setInterval(() => {
      this.tick();
    }, 1000);

    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    this.speak(`${minutes}分${seconds}秒のタイマーをスタートしました`);
  }

  pause() {
    this.isRunning = false;
    this.isPaused = true;

    clearInterval(this.timer);
    this.updateButtons();
    this.updateDisplayState();

    this.speak('タイマーを一時停止しました');
  }

  reset() {
    this.isRunning = false;
    this.isPaused = false;

    clearInterval(this.timer);
    this.remainingSeconds = this.totalSeconds;

    this.updateButtons();
    this.updateDisplay();
    this.updateDisplayState();

    this.speak('タイマーをリセットしました');
  }

  tick() {
    this.remainingSeconds--;
    this.updateDisplay();

    // 1分ごとの音声通知
    if (this.remainingSeconds > 0 && this.remainingSeconds % 60 === 0) {
      const minutes = Math.floor(this.remainingSeconds / 60);
      this.speak(`あと${minutes}分です`);
    }

    // 最後の10秒のカウントダウン
    if (this.remainingSeconds <= 10 && this.remainingSeconds > 0) {
      this.speak(`${this.remainingSeconds}`);
    }

    if (this.remainingSeconds <= 0) {
      this.finish();
    }
  }

  finish() {
    this.isRunning = false;
    this.isPaused = false;
    clearInterval(this.timer);

    this.remainingSeconds = 0;
    this.updateDisplay();
    this.updateButtons();
    this.updateDisplayState();

    // アラーム音を再生
    if (this.alarmEnabled) {
      this.playAlarm();
    }

    this.speak('タイマー終了です！');

    // 視覚的な通知
    setTimeout(() => {
      alert('タイマー終了！');
    }, 500);
  }

  updateDisplay() {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    this.elements.minutesInput.value = minutes;
    this.elements.secondsInput.value = seconds.toString().padStart(2, '0');

    // フルスクリーン表示も更新
    this.updateFullscreenTimer();
  }

  updateDisplayState() {
    const { timeControls, fullscreenTimer, fullscreenOverlay } = this.elements;

    timeControls.classList.remove('running', 'paused', 'finished');
    if (fullscreenTimer) {
      fullscreenTimer.classList.remove('running', 'paused', 'finished');
    }
    if (fullscreenOverlay) {
      fullscreenOverlay.classList.remove('paused', 'finished');
    }

    if (this.remainingSeconds <= 0) {
      timeControls.classList.add('finished');
      if (fullscreenTimer) {
        fullscreenTimer.classList.add('finished');
      }
      if (fullscreenOverlay) {
        fullscreenOverlay.classList.add('finished');
      }
    } else if (this.isRunning) {
      timeControls.classList.add('running');
      if (fullscreenTimer) {
        fullscreenTimer.classList.add('running');
      }
    } else if (this.isPaused) {
      timeControls.classList.add('paused');
      if (fullscreenTimer) {
        fullscreenTimer.classList.add('paused');
      }
      if (fullscreenOverlay) {
        fullscreenOverlay.classList.add('paused');
      }
    }
  }

  updateButtons() {
    if (this.isRunning) {
      this.elements.startBtn.textContent = '一時停止';
      this.elements.startBtn.className = 'btn btn-secondary';
    } else {
      this.elements.startBtn.textContent = this.isPaused ? '再開' : 'スタート';
      this.elements.startBtn.className = 'btn btn-primary';
    }
  }

  speak(text) {
    if (this.soundEnabled && 'speechSynthesis' in window) {
      speechSynthesis.cancel(); // 前の音声を停止
      this.speech.text = text;
      speechSynthesis.speak(this.speech);
    }
  }

  playAlarm() {
    if (this.alarmAudio) {
      this.alarmAudio.currentTime = 0; // 最初から再生
      this.alarmAudio.play().catch(error => {
        console.warn('アラーム音の再生に失敗しました:', error);
      });
    }
  }

  handleKeyboard(e) {
    if (e.key === 'Escape' && this.isFullscreen) {
      this.exitFullscreen();
    }

    // 入力フィールドにフォーカスがある場合はキーボードショートカットを無効化
    if (document.activeElement === this.elements.minutesInput ||
      document.activeElement === this.elements.secondsInput) {
      return;
    }

    // 1-9キー: 分数設定（1なら1分、2なら2分...）
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      if (this.isRunning) return;
      const minutes = parseInt(e.key);
      this.setPresetTime(minutes);
      this.remainingSeconds = minutes * 60;
      this.updateFullscreenTimer();
      if (this.soundEnabled) {
        this.speak(`${minutes}分に設定しました`);
      }
    }
    // スペースキー: スタート/一時停止
    else if (e.code === 'Space') {
      e.preventDefault();
      this.handleStartPause();
    }
    // Rキー: リセット
    else if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      this.reset();
    }
    // Enterキー: スタート/一時停止
    else if (e.key === 'Enter' && !e.target.matches('input')) {
      e.preventDefault();
      this.handleStartPause();
    }
  }

  showHelp() {
    const helpText = `
■ キーボードショートカット
・0-9キー: 時間設定（0なら0分、1なら1分、...9なら9分）
・スペースキー: スタート/一時停止/再開
・Enterキー: スタート/一時停止/再開
・Rキー: リセット
  `.trim();

    alert(helpText);
  }

  enterFullscreen() {
    if (this.isFullscreen) return;

    this.isFullscreen = true;
    this.elements.fullscreenOverlay.style.display = 'flex';

    // フルスクリーンAPIを呼び出す
    if (this.elements.fullscreenOverlay.requestFullscreen) {
      this.elements.fullscreenOverlay.requestFullscreen();
    }

    // フルスクリーン時のタイマー表示を更新
    this.updateFullscreenTimer();
  }

  exitFullscreen() {
    if (!this.isFullscreen) return;

    this.isFullscreen = false;
    this.elements.fullscreenOverlay.style.display = 'none';

    // フルスクリーン解除
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }

  updateFullscreenTimer() {
    if (!this.isFullscreen) return;

    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    const display = this.formatTime(minutes, seconds);
    this.elements.fullscreenTimer.textContent = display;
  }
}

// DOMが読み込まれたらタイマーを初期化
document.addEventListener('DOMContentLoaded', () => {
  new SimpleTimer();
});
