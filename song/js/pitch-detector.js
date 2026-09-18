/**
 * PitchDetector - McLeod Pitch Method (MPM) & Pitch Utilities
 * 간결하고 정밀한 단음(Monophonic) 보컬 피치 감지 모듈
 */
class PitchDetector {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
    this.bufferSize = 2048;
    this.cutoff = 0.90; // MPM 피크 임계값
    this.minFreq = 70;  // 인간 최저 음역 (~C#2)
    this.maxFreq = 1100; // 보컬 상한선 (~C#6)
  }

  setSampleRate(rate) {
    this.sampleRate = rate;
  }

  /**
   * 버퍼의 실효치(RMS) 음량 계산
   */
  getRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * McLeod Pitch Method (MPM) 기반 주파수 검출
   */
  detectPitch(buffer, noiseThreshold = 0.03) {
    const rms = this.getRMS(buffer);
    if (rms < noiseThreshold) {
      return { freq: null, clarity: 0, rms };
    }

    const nsdf = this._computeNSDF(buffer);
    const maxPositions = this._findPeaks(nsdf);

    if (maxPositions.length === 0) {
      return { freq: null, clarity: 0, rms };
    }

    // 가장 높은 피크를 찾아 parabolic interpolation 수행
    let highestPeak = maxPositions[0];
    for (let i = 1; i < maxPositions.length; i++) {
      if (nsdf[maxPositions[i]] > nsdf[highestPeak]) {
        highestPeak = maxPositions[i];
      }
    }

    // 최고 피크의 90% 이상인 첫 번째 피크 선택 (옥타브 에러 방지)
    const cutoffVal = nsdf[highestPeak] * this.cutoff;
    let chosenPeak = highestPeak;
    for (let i = 0; i < maxPositions.length; i++) {
      if (nsdf[maxPositions[i]] >= cutoffVal) {
        chosenPeak = maxPositions[i];
        break;
      }
    }

    // Parabolic interpolation
    const delta = this._parabolicInterpolation(nsdf, chosenPeak);
    const period = chosenPeak + delta;
    const freq = this.sampleRate / period;
    const clarity = nsdf[chosenPeak];

    if (freq < this.minFreq || freq > this.maxFreq || clarity < 0.70) {
      return { freq: null, clarity, rms };
    }

    const noteInfo = PitchDetector.frequencyToNote(freq);
    return { freq, clarity, rms, ...noteInfo };
  }

  _computeNSDF(buffer) {
    const size = buffer.length;
    const nsdf = new Float32Array(size);

    for (let tau = 0; tau < size; tau++) {
      let acf = 0;
      let divisor = 0;
      for (let i = 0; i < size - tau; i++) {
        acf += buffer[i] * buffer[i + tau];
        divisor += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau];
      }
      nsdf[tau] = divisor > 0.00001 ? (2 * acf) / divisor : 0;
    }
    return nsdf;
  }

  _findPeaks(nsdf) {
    const minPeriod = Math.floor(this.sampleRate / this.maxFreq);
    const maxPeriod = Math.ceil(this.sampleRate / this.minFreq);
    const peaks = [];
    let isPositive = false;

    for (let i = minPeriod; i < Math.min(maxPeriod, nsdf.length - 1); i++) {
      if (nsdf[i] > 0) {
        isPositive = true;
        if (nsdf[i] > nsdf[i - 1] && nsdf[i] >= nsdf[i + 1]) {
          peaks.push(i);
        }
      } else {
        isPositive = false;
      }
    }
    return peaks;
  }

  _parabolicInterpolation(array, x) {
    if (x <= 0 || x >= array.length - 1) return 0;
    const alpha = array[x - 1];
    const beta = array[x];
    const gamma = array[x + 1];
    const denom = 2 * (2 * beta - alpha - gamma);
    if (Math.abs(denom) < 1e-6) return 0;
    return (gamma - alpha) / denom;
  }

  /**
   * 주파수를 음계(Note) 정보로 변환
   */
  static frequencyToNote(freq) {
    if (!freq || freq <= 0) return null;
    // A4 = 440Hz, MIDI 69
    const midiFloat = 69 + 12 * Math.log2(freq / 440);
    const midi = Math.round(midiFloat);
    const cents = Math.round((midiFloat - midi) * 100);

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteIndex = ((midi % 12) + 12) % 12;
    const noteName = noteNames[noteIndex];
    const octave = Math.floor(midi / 12) - 1;

    // VexFlow 키 포맷: 'c/4', 'c#/4', etc.
    const vexKey = `${noteName.toLowerCase()}/${octave}`;

    return {
      midi,
      midiFloat,
      cents,
      name: noteName,
      octave,
      full: `${noteName}${octave}`,
      vexKey
    };
  }

  /**
   * MIDI 번호를 주파수로 변환
   */
  static midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}

// 브라우저 전역 노출
window.PitchDetector = PitchDetector;
