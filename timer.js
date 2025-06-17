class SimpleTimer {
  constructor() {
    this.timer = null;
    this.totalSeconds = 180;
    this.remainingSeconds = 180;
    this.isRunning = false;
    this.isPaused = false;

    this.initializeElements();
    this.loadSettings();
    this.setupEventListeners();
    this.initializeSpeech();
    this.updateDisplay();
  }

  initializeElements() {
    this.elements = {
      timeInput: document.getElementById('time-input'),
      startBtn: document.getElementById('start-btn'),
      resetBtn: document.getElementById('reset-btn'),
      soundCheck: document.getElementById('sound-check'),
      alarmCheck: document.getElementById('alarm-check'),
      helpBtn: document.getElementById('help-btn'),
      presetBtns: document.querySelectorAll('.preset-btn')
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
    this.elements.timeInput.addEventListener('input', () => this.updateTimeFromInput());
    this.elements.timeInput.addEventListener('blur', () => this.validateTimeInput());
    this.elements.timeInput.addEventListener('focus', () => this.onInputFocus());

    // キーボードショートカット
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
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
    // MM:SS形式の文字列を解析
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

  formatTime(minutes, seconds) {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  updateTimeFromInput() {
    if (this.isRunning) return; // タイマー実行中は更新しない

    const { minutes, seconds } = this.parseTimeInput(this.elements.timeInput.value);
    this.totalSeconds = minutes * 60 + seconds;
    this.remainingSeconds = this.totalSeconds;

    const matchingPreset = Array.from(this.elements.presetBtns).find(btn =>
      parseInt(btn.dataset.minutes) === minutes && seconds === 0
    );
    this.updatePresetButtons(matchingPreset ? minutes : null);
  }

  validateTimeInput() {
    if (this.isRunning) return;

    const { minutes, seconds } = this.parseTimeInput(this.elements.timeInput.value);
    const formattedTime = this.formatTime(minutes, seconds);
    this.elements.timeInput.value = formattedTime;
    this.updateTimeFromInput();
  }

  onInputFocus() {
    if (!this.isRunning && !this.isPaused) {
      this.elements.timeInput.select();
    }
  }

  setPresetTime(minutes) {
    const formattedTime = this.formatTime(minutes, 0);
    this.elements.timeInput.value = formattedTime;
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
    const display = this.formatTime(minutes, seconds);
    this.elements.timeInput.value = display;
  }

  updateDisplayState() {
    this.elements.timeInput.classList.remove('running', 'paused', 'finished');

    if (this.remainingSeconds <= 0) {
      this.elements.timeInput.classList.add('finished');
    } else if (this.isRunning) {
      this.elements.timeInput.classList.add('running');
    } else if (this.isPaused) {
      this.elements.timeInput.classList.add('paused');
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
    // 入力フィールドにフォーカスがある場合はキーボードショートカットを無効化
    if (document.activeElement === this.elements.timeInput) {
      return;
    }

    // 1-9キー: 分数設定（1なら1分、2なら2分...）
    if (e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const minutes = parseInt(e.key);
      this.setPresetTime(minutes);
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
【Simple Timer 使い方】

■ 基本操作
・時間入力欄に時間を入力（例：05:30）またはボタンを使用
・スタートボタンを押してタイマー開始

■ 時間入力方法
・MM:SS形式で入力（例：05:30 = 5分30秒）
・数字のみでも入力可能（例：5 = 5分）
・最大999分59秒まで設定可能

■ キーボードショートカット
・1-9キー: 時間設定（1なら1分、2なら2分...9なら9分）
・スペースキー: スタート/一時停止/再開
・Enterキー: スタート/一時停止/再開
・Rキー: リセット

■ 機能
・音声読み上げON/OFF切り替え
・アラーム音ON/OFF切り替え（デフォルト：ON）
・1分ごとの残り時間通知
・最後の10秒カウントダウン
・設定はブラウザに自動保存されます
    `.trim();

    alert(helpText);
  }
}

// DOMが読み込まれたらタイマーを初期化
document.addEventListener('DOMContentLoaded', () => {
  new SimpleTimer();
});
