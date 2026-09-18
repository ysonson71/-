/**
 * SynthPlayer - Web Audio API 기반 악보 재생기
 */
class SynthPlayer {
  constructor(audioContext) {
    this.audioCtx = audioContext;
    this.isPlaying = false;
    this.scheduledNodes = [];
    this.stopTimerId = null;
    this.onEnded = null;
  }

  /**
   * 마디 목록을 순서대로 재생
   */
  play(measures, bpm = 100, onEndedCallback = null) {
    if (this.isPlaying) {
      this.stop();
    }

    this.isPlaying = true;
    this.onEnded = onEndedCallback;
    this.scheduledNodes = [];

    const secPerBeat = 60.0 / bpm;
    const secPerSlot = secPerBeat / 4; // 16분음표 1개 길이
    let currentTime = this.audioCtx.currentTime + 0.1;

    for (const measure of measures) {
      for (const item of measure.items) {
        const itemDuration = item.slots * secPerSlot;

        if (!item.isRest && item.midi) {
          this._scheduleNote(item.midi, currentTime, itemDuration);
        }

        currentTime += itemDuration;
      }
    }

    const totalDuration = (currentTime - this.audioCtx.currentTime) * 1000;
    this.stopTimerId = setTimeout(() => {
      this.stop();
      if (this.onEnded) this.onEnded();
    }, Math.max(100, totalDuration));
  }

  _scheduleNote(midi, startTime, duration) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    // 부드러운 플루트/오르간 스타일 삼각파(Triangle)
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    // ADSR 엔벨로프 (클릭음 방지)
    const attack = 0.02;
    const release = Math.min(0.05, duration * 0.2);
    const sustainDuration = Math.max(0.01, duration - attack - release);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + attack);
    gain.gain.setValueAtTime(0.3, startTime + attack + sustainDuration);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.scheduledNodes.push(osc, gain);
  }

  stop() {
    this.isPlaying = false;
    if (this.stopTimerId) {
      clearTimeout(this.stopTimerId);
      this.stopTimerId = null;
    }

    for (const node of this.scheduledNodes) {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch (e) {
        // 이미 종료된 노드 무시
      }
    }
    this.scheduledNodes = [];
  }
}

window.SynthPlayer = SynthPlayer;
