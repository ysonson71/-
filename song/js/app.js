/**
 * SingToScore - App Controller
 * 전체 모듈 연동 및 UI 이벤트 제어
 */
class App {
  constructor() {
    this.audioCtx = null;
    this.micStream = null;
    this.sourceNode = null;
    this.filterNode = null;
    this.analyserNode = null;
    this.rafId = null;

    this.pitchDetector = null;
    this.metronome = null;
    this.quantizer = new Quantizer();
    this.sheetRenderer = new SheetRenderer('score-output');
    this.synthPlayer = null;

    this.isRecording = false;
    this.isCountingDown = false;
    this.recordedSamples = [];
    this.recordingStartTime = 0;
    this.currentMeasures = [];

    this._initDomElements();
    this._bindEvents();
  }

  _initDomElements() {
    this.btnRecord = document.getElementById('btn-record');
    this.btnRecordText = document.getElementById('btn-record-text');
    this.btnDemo = document.getElementById('btn-demo');
    this.btnPlayScore = document.getElementById('btn-play-score');
    this.btnStopScore = document.getElementById('btn-stop-score');
    this.btnDownloadMidi = document.getElementById('btn-download-midi');
    this.btnDownloadPng = document.getElementById('btn-download-png');
    this.btnPrint = document.getElementById('btn-print');
    this.btnClear = document.getElementById('btn-clear');

    this.bpmInput = document.getElementById('bpm-input');
    this.bpmVal = document.getElementById('bpm-val');
    this.bpmBadge = document.getElementById('bpm-badge');
    this.micStatusBadge = document.getElementById('mic-status-badge');
    this.metronomeToggle = document.getElementById('metronome-toggle');
    this.countdownToggle = document.getElementById('countdown-toggle');
    this.noiseGateInput = document.getElementById('noise-gate-input');

    this.beatDots = document.querySelectorAll('.beat-dot');
    this.countdownDisplay = document.getElementById('countdown-display');

    this.currentNote = document.getElementById('current-note');
    this.currentOctave = document.getElementById('current-octave');
    this.currentFreq = document.getElementById('current-freq');
    this.centsPointer = document.getElementById('cents-pointer');
    this.centsText = document.getElementById('cents-text');
    this.volumeMeter = document.getElementById('volume-meter');
    this.statusMsg = document.getElementById('recording-status-msg');
    this.scoreSummary = document.getElementById('score-summary');
  }

  _bindEvents() {
    this.bpmInput.addEventListener('input', (e) => {
      const bpm = parseInt(e.target.value, 10);
      this.bpmVal.textContent = bpm;
      this.bpmBadge.textContent = `BPM: ${bpm}`;
      if (this.metronome) this.metronome.setBpm(bpm);
    });

    this.metronomeToggle.addEventListener('change', (e) => {
      if (this.metronome) this.metronome.setSoundEnabled(e.target.checked);
    });

    this.btnRecord.addEventListener('click', () => {
      if (this.isRecording || this.isCountingDown) {
        this.stopRecording();
      } else {
        this.startRecordingProcess();
      }
    });

    this.btnDemo.addEventListener('click', () => this.loadDemoSong());

    this.btnPlayScore.addEventListener('click', () => this.playScore());
    this.btnStopScore.addEventListener('click', () => this.stopScore());
    this.btnDownloadMidi.addEventListener('click', () => this.downloadMidi());
    this.btnDownloadPng.addEventListener('click', () => this.downloadPng());
    this.btnPrint.addEventListener('click', () => this.sheetRenderer.print());
    this.btnClear.addEventListener('click', () => this.clearScore());
  }

  /**
   * 브라우저 AudioContext 초기화 (사용자 인터랙션 시)
   */
  async _ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.pitchDetector = new PitchDetector(this.audioCtx.sampleRate);
      this.metronome = new Metronome(this.audioCtx);
      this.metronome.setBpm(parseInt(this.bpmInput.value, 10));
      this.metronome.setSoundEnabled(this.metronomeToggle.checked);
      this.synthPlayer = new SynthPlayer(this.audioCtx);
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  /**
   * 마이크 권한 획득 및 노드 연결
   */
  async _setupMicrophone() {
    if (this.micStream) return true;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);

      // 인간 보컬 주파수 대역 통과 필터 (80Hz ~ 1200Hz)
      const bandpass = this.audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 500;
      bandpass.Q.value = 0.5;

      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 2048;

      this.sourceNode.connect(bandpass);
      bandpass.connect(this.analyserNode);

      this.micStatusBadge.textContent = '🎤 마이크 연결됨';
      this.micStatusBadge.classList.add('active');
      return true;
    } catch (err) {
      alert('마이크 접근 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요.');
      console.error(err);
      return false;
    }
  }

  /**
   * 녹음 시작 프로세스 (카운트다운 처리)
   */
  async startRecordingProcess() {
    await this._ensureAudioContext();
    const micOk = await this._setupMicrophone();
    if (!micOk) return;

    const bpm = parseInt(this.bpmInput.value, 10);
    this.metronome.setBpm(bpm);
    this.recordedSamples = [];

    const useCountdown = this.countdownToggle.checked;
    if (useCountdown) {
      this.isCountingDown = true;
      this.statusMsg.textContent = '카운트다운 중... 준비하세요!';
      this.btnRecord.classList.add('recording');
      this.btnRecordText.textContent = '준비 중... (중지)';

      let countdownCount = 4;
      this.countdownDisplay.textContent = `READY... ${countdownCount}`;

      this.metronome.start((beat, isDownbeat, time) => {
        this._updateBeatVisual(beat, isDownbeat);

        if (this.isCountingDown) {
          countdownCount--;
          if (countdownCount > 0) {
            this.countdownDisplay.textContent = `READY... ${countdownCount}`;
          } else {
            // 카운트다운 완료 -> 실제 녹음 시작
            this.isCountingDown = false;
            this.countdownDisplay.textContent = 'SING! 🎤';
            setTimeout(() => {
              this.countdownDisplay.textContent = '';
            }, 1200);
            this._startActualRecording(time);
          }
        }
      });
    } else {
      this.metronome.start((beat, isDownbeat, time) => {
        this._updateBeatVisual(beat, isDownbeat);
      });
      this._startActualRecording(this.audioCtx.currentTime);
    }
  }

  _startActualRecording(startTime) {
    this.isRecording = true;
    this.recordingStartTime = startTime;
    this.btnRecordText.textContent = '녹음 종료 및 악보 생성';
    this.btnRecord.classList.add('recording');
    this.statusMsg.textContent = '노래를 부르는 중입니다... 실시간 음정을 확인하세요!';

    this._startPitchLoop();
  }

  _startPitchLoop() {
    const buffer = new Float32Array(this.analyserNode.fftSize);

    const checkPitch = () => {
      if (!this.isRecording && !this.isCountingDown) return;

      this.analyserNode.getFloatTimeDomainData(buffer);
      const noiseThreshold = parseFloat(this.noiseGateInput.value);
      const result = this.pitchDetector.detectPitch(buffer, noiseThreshold);

      // UI 업데이트
      this._updateTunerUI(result);

      // 녹음 중이면 피치 샘플 저장
      if (this.isRecording) {
        this.recordedSamples.push({
          time: this.audioCtx.currentTime,
          freq: result.freq,
          clarity: result.clarity,
          rms: result.rms,
          midi: result.midi || null,
          midiFloat: result.midiFloat || null,
          noteName: result.name || null,
          octave: result.octave || null,
          vexKey: result.vexKey || null
        });
      }

      this.rafId = requestAnimationFrame(checkPitch);
    };

    this.rafId = requestAnimationFrame(checkPitch);
  }

  _updateBeatVisual(beat, isDownbeat) {
    this.beatDots.forEach(dot => {
      const dotBeat = parseInt(dot.dataset.beat, 10);
      dot.classList.remove('active', 'downbeat');
      if (dotBeat === beat) {
        dot.classList.add('active');
        if (isDownbeat) dot.classList.add('downbeat');
      }
    });
  }

  _updateTunerUI(result) {
    // 볼륨 게이지 (0 ~ 100%)
    const volPercent = Math.min(100, Math.round(result.rms * 500));
    this.volumeMeter.style.width = `${volPercent}%`;

    if (result.freq && result.name) {
      this.currentNote.textContent = result.name;
      this.currentOctave.textContent = result.octave;
      this.currentFreq.textContent = `${result.freq.toFixed(1)} Hz`;

      // Cents 미터 포인터 (-50 ~ +50 cents를 0% ~ 100%로 매핑)
      const cents = Math.max(-50, Math.min(50, result.cents || 0));
      const pointerPercent = 50 + cents;
      this.centsPointer.style.left = `${pointerPercent}%`;
      this.centsText.textContent = `${cents > 0 ? '+' : ''}${cents} cents`;
    } else {
      this.centsPointer.style.left = '50%';
      this.centsText.textContent = '0 cents';
    }
  }

  /**
   * 녹음 종료 및 악보 생성
   */
  stopRecording() {
    this.isRecording = false;
    this.isCountingDown = false;
    if (this.metronome) this.metronome.stop();
    if (this.rafId) cancelAnimationFrame(this.rafId);

    this.btnRecord.classList.remove('recording');
    this.btnRecordText.textContent = '녹음 시작';
    this.countdownDisplay.textContent = '';
    this.beatDots.forEach(d => d.classList.remove('active', 'downbeat'));

    this.statusMsg.textContent = '오디오 분석 및 악보 생성 중...';

    // 양자화 및 악보 변환 실행
    const bpm = parseInt(this.bpmInput.value, 10);
    setTimeout(() => {
      this.currentMeasures = this.quantizer.quantize(this.recordedSamples, this.recordingStartTime, bpm);
      this._displayScore(this.currentMeasures, bpm);
    }, 50);
  }

  _displayScore(measures, bpm) {
    this.sheetRenderer.render(measures);

    // 통계 계산
    let totalNotes = 0;
    for (const m of measures) {
      for (const item of m.items) {
        if (!item.isRest) totalNotes++;
      }
    }

    this.scoreSummary.textContent = `악보 생성 완료: 총 ${measures.length}마디, 감지된 음표 ${totalNotes}개 (템포 ${bpm} BPM)`;
    this.statusMsg.textContent = '악보가 성공적으로 생성되었습니다. 재생하거나 다운로드할 수 있습니다.';

    // 툴바 버튼 활성화
    const hasNotes = totalNotes > 0;
    this.btnPlayScore.disabled = !hasNotes;
    this.btnDownloadMidi.disabled = !hasNotes;
    this.btnDownloadPng.disabled = false;
    this.btnPrint.disabled = false;
  }

  playScore() {
    if (!this.synthPlayer || !this.currentMeasures.length) return;
    const bpm = parseInt(this.bpmInput.value, 10);

    this.btnPlayScore.disabled = true;
    this.btnStopScore.disabled = false;
    this.statusMsg.textContent = '악보를 신디사이저로 재생하는 중...';

    this.synthPlayer.play(this.currentMeasures, bpm, () => {
      this.btnPlayScore.disabled = false;
      this.btnStopScore.disabled = true;
      this.statusMsg.textContent = '재생이 완료되었습니다.';
    });
  }

  stopScore() {
    if (this.synthPlayer) {
      this.synthPlayer.stop();
      this.btnPlayScore.disabled = false;
      this.btnStopScore.disabled = true;
      this.statusMsg.textContent = '재생이 정지되었습니다.';
    }
  }

  downloadMidi() {
    if (!this.currentMeasures.length) return;
    const bpm = parseInt(this.bpmInput.value, 10);
    MidiExporter.exportMidi(this.currentMeasures, bpm, 'sing-to-score.mid');
  }

  downloadPng() {
    this.sheetRenderer.exportToPNG('sing-to-score.png');
  }

  clearScore() {
    this.stopScore();
    this.currentMeasures = [];
    this.recordedSamples = [];
    const output = document.getElementById('score-output');
    output.innerHTML = '<div class="empty-state">녹음 종료 후 자동으로 4/4 박자 5선지 악보가 그려집니다.</div>';
    this.scoreSummary.textContent = '변환된 음표가 여기에 표시됩니다.';
    this.btnPlayScore.disabled = true;
    this.btnStopScore.disabled = true;
    this.btnDownloadMidi.disabled = true;
    this.btnDownloadPng.disabled = true;
    this.btnPrint.disabled = true;
  }

  /**
   * 마이크 없이 즉시 테스트할 수 있는 샘플 곡 (작은 별)
   */
  async loadDemoSong() {
    await this._ensureAudioContext();
    const bpm = 100;
    this.bpmInput.value = bpm;
    this.bpmVal.textContent = bpm;
    this.bpmBadge.textContent = `BPM: ${bpm}`;

    // 반짝반짝 작은별 멜로디 (4마디)
    // 1마디: 도 도 솔 솔 (4분음표 4개)
    // 2마디: 라 라 솔 (4분음표 2개, 2분음표 1개)
    // 3마디: 파 파 미 미 (4분음표 4개)
    // 4마디: 레 레 도 (4분음표 2개, 2분음표 1개)
    const demoMeasures = [
      {
        measureNumber: 1,
        items: [
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['c/4'], midi: 60, noteName: 'C', octave: 4 },
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['c/4'], midi: 60, noteName: 'C', octave: 4 },
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['g/4'], midi: 67, noteName: 'G', octave: 4 },
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['g/4'], midi: 67, noteName: 'G', octave: 4 }
        ]
      },
      {
        measureNumber: 2,
        items: [
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['a/4'], midi: 69, noteName: 'A', octave: 4 },
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['a/4'], midi: 69, noteName: 'A', octave: 4 },
          { isRest: false, slots: 8, duration: 'h', dots: 0, keys: ['g/4'], midi: 67, noteName: 'G', octave: 4 }
        ]
      },
      {
        measureNumber: 3,
        items: [
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['f/4'], midi: 65, noteName: 'F', octave: 4 },
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['f/4'], midi: 65, noteName: 'F', octave: 4 },
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['e/4'], midi: 64, noteName: 'E', octave: 4 },
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['e/4'], midi: 64, noteName: 'E', octave: 4 }
        ]
      },
      {
        measureNumber: 4,
        items: [
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['d/4'], midi: 62, noteName: 'D', octave: 4 },
          { isRest: false, slots: 4, duration: 'q', dots: 0, keys: ['d/4'], midi: 62, noteName: 'D', octave: 4 },
          { isRest: false, slots: 8, duration: 'h', dots: 0, keys: ['c/4'], midi: 60, noteName: 'C', octave: 4 }
        ]
      }
    ];

    this.currentMeasures = demoMeasures;
    this._displayScore(demoMeasures, bpm);
  }
}

// 브라우저 로드 시 앱 인스턴스 초기화
window.addEventListener('DOMContentLoaded', () => {
  window.singToScoreApp = new App();
});
