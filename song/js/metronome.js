/**
 * Metronome - Web Audio API 기반 정밀 타이밍 메트로놈
 */
class Metronome {
  constructor(audioContext) {
    this.audioCtx = audioContext;
    this.bpm = 100;
    this.beatsPerMeasure = 4;
    this.isPlaying = false;
    this.soundEnabled = true;

    this.currentBeat = 0; // 0 to beatsPerMeasure - 1
    this.nextNoteTime = 0.0; // 다음 비트가 연주될 AudioContext 시간
    this.timerId = null;
    this.lookahead = 25.0; // ms
    this.scheduleAheadTime = 0.1; // seconds

    this.onBeat = null; // 비트 발생 콜백: fn(beatNumber, isDownbeat, time)
    this.startTime = 0; // 1번째 비트 시작 오디오 시간
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(240, bpm));
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = !!enabled;
  }

  start(onBeatCallback) {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentBeat = 0;
    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this.startTime = this.nextNoteTime;
    this.onBeat = onBeatCallback;

    this._scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  _scheduler() {
    if (!this.isPlaying) return;

    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this._scheduleBeat(this.currentBeat, this.nextNoteTime);
      this._nextBeat();
    }
    this.timerId = setTimeout(() => this._scheduler(), this.lookahead);
  }

  _nextBeat() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerMeasure;
  }

  _scheduleBeat(beatNumber, time) {
    const isDownbeat = beatNumber === 0;

    // 비트 소리 재생
    if (this.soundEnabled) {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isDownbeat ? 1000 : 600, time);

      gain.gain.setValueAtTime(isDownbeat ? 0.8 : 0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(time);
      osc.stop(time + 0.07);
    }

    // UI 동기화 (오디오 시간 기준 setTimeout)
    const delay = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
    setTimeout(() => {
      if (this.isPlaying && this.onBeat) {
        this.onBeat(beatNumber + 1, isDownbeat, time);
      }
    }, delay);
  }
}

window.Metronome = Metronome;
