/**
 * Quantizer - 피치 샘플을 4/4 박자 마디 및 음표/쉼표로 양자화(Quantization)하는 엔진
 */
class Quantizer {
  constructor() {
    this.slotDurations = [
      { slots: 16, type: 'w' },  // 온음표
      { slots: 12, type: 'h', dot: true }, // 점2분음표
      { slots: 8,  type: 'h' },  // 2분음표
      { slots: 6,  type: 'q', dot: true }, // 점4분음표
      { slots: 4,  type: 'q' },  // 4분음표
      { slots: 3,  type: '8', dot: true }, // 점8분음표
      { slots: 2,  type: '8' },  // 8분음표
      { slots: 1,  type: '16' }  // 16분음표
    ];
  }

  /**
   * 녹음된 원시 샘플 배열을 VexFlow 렌더링용 마디(Measure) 배열로 변환
   */
  quantize(rawSamples, startTime, bpm) {
    if (!rawSamples || rawSamples.length === 0) {
      return this._createEmptyMeasure();
    }

    const secPerBeat = 60.0 / bpm;
    const secPerSlot = secPerBeat / 4; // 16분음표 단위 시간
    const minNoteDuration = secPerSlot * 0.75; // 최소 음표 길이 필터 (글리치 제거)

    // 1단계: 연속된 음정 세그먼트(Note Event) 추출
    const segments = this._segmentSamples(rawSamples, startTime, minNoteDuration);

    if (segments.length === 0) {
      return this._createEmptyMeasure();
    }

    // 2단계: 전체 시간 범위를 16분음표 슬롯 그리드로 매핑
    const lastNoteEnd = segments[segments.length - 1].endTime;
    const totalSlots = Math.max(16, Math.ceil(lastNoteEnd / secPerSlot));
    const totalMeasures = Math.ceil(totalSlots / 16);
    const fullGridLength = totalMeasures * 16;

    // 슬롯별 상태 배열 (null = 쉼표, 객체 = 해당 음 정보)
    const slotGrid = new Array(fullGridLength).fill(null);

    for (const seg of segments) {
      const startSlot = Math.max(0, Math.round(seg.startTime / secPerSlot));
      const endSlot = Math.min(fullGridLength, Math.max(startSlot + 1, Math.round(seg.endTime / secPerSlot)));
      
      for (let s = startSlot; s < endSlot; s++) {
        // 이미 앞선 음표가 차지하지 않은 슬롯에만 할당
        if (slotGrid[s] === null) {
          slotGrid[s] = {
            midi: seg.midi,
            noteName: seg.noteName,
            octave: seg.octave,
            vexKey: seg.vexKey,
            segId: seg.id
          };
        }
      }
    }

    // 3단계: 마디(16슬롯 단위)별로 순회하며 표준 음표/쉼표로 분할
    const measures = [];
    for (let m = 0; m < totalMeasures; m++) {
      const measureSlots = slotGrid.slice(m * 16, (m + 1) * 16);
      const measureItems = this._convertSlotsToMeasureItems(measureSlots);
      measures.push({
        measureNumber: m + 1,
        items: measureItems
      });
    }

    return measures;
  }

  /**
   * 연속된 피치 샘플을 개별 음표 세그먼트로 그룹화
   */
  _segmentSamples(samples, startTime, minDuration) {
    const segments = [];
    let currentSegment = null;
    let segIdCounter = 0;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const relTime = Math.max(0, s.time - startTime);

      if (s.midi !== null && s.clarity >= 0.70) {
        if (!currentSegment) {
          // 새 세그먼트 시작
          currentSegment = {
            id: ++segIdCounter,
            startTime: relTime,
            endTime: relTime,
            midis: [s.midiFloat || s.midi]
          };
        } else {
          // 이전 음정과 차이가 1.0 반음 이내인지 확인
          const currentAvgMidi = currentSegment.midis.reduce((a, b) => a + b, 0) / currentSegment.midis.length;
          const midiDiff = Math.abs((s.midiFloat || s.midi) - currentAvgMidi);

          // 시간 간격이 0.12초 이상 끊어지지 않았고 피치가 비슷하면 병합
          if (midiDiff <= 1.0 && (relTime - currentSegment.endTime) <= 0.12) {
            currentSegment.endTime = relTime;
            currentSegment.midis.push(s.midiFloat || s.midi);
          } else {
            // 다른 음이 시작됨 -> 기존 세그먼트 종료
            this._finalizeSegment(currentSegment, segments, minDuration);
            currentSegment = {
              id: ++segIdCounter,
              startTime: relTime,
              endTime: relTime,
              midis: [s.midiFloat || s.midi]
            };
          }
        }
      } else {
        // 무음 또는 노이즈
        if (currentSegment) {
          if (relTime - currentSegment.endTime > 0.08) {
            this._finalizeSegment(currentSegment, segments, minDuration);
            currentSegment = null;
          }
        }
      }
    }

    if (currentSegment) {
      this._finalizeSegment(currentSegment, segments, minDuration);
    }

    return segments;
  }

  _finalizeSegment(segment, list, minDuration) {
    const duration = segment.endTime - segment.startTime;
    if (duration >= minDuration && segment.midis.length >= 2) {
      // 중앙값(Median) 피치 계산으로 튄 값 제거
      segment.midis.sort((a, b) => a - b);
      const medianMidi = Math.round(segment.midis[Math.floor(segment.midis.length / 2)]);
      
      const noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
      const noteIndex = ((medianMidi % 12) + 12) % 12;
      const octave = Math.floor(medianMidi / 12) - 1;
      const vexKey = `${noteNames[noteIndex]}/${octave}`;

      list.push({
        id: segment.id,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration,
        midi: medianMidi,
        noteName: noteNames[noteIndex].toUpperCase(),
        octave,
        vexKey
      });
    }
  }

  /**
   * 16개 슬롯(한 마디)을 표준 박자 음표/쉼표 목록으로 변환 (총합 정확히 16슬롯)
   */
  _convertSlotsToMeasureItems(slots) {
    const items = [];
    let idx = 0;

    while (idx < 16) {
      const current = slots[idx];
      const isRest = current === null;
      let runLength = 1;

      // 같은 음(또는 연속된 쉼표)이 몇 슬롯 지속되는지 계산
      while (idx + runLength < 16) {
        const next = slots[idx + runLength];
        if (isRest) {
          if (next !== null) break;
        } else {
          if (next === null || next.segId !== current.segId) break;
        }
        runLength++;
      }

      // runLength 슬롯을 표준 박자(16, 12, 8, 6, 4, 3, 2, 1) 단위로 분할
      let remaining = runLength;
      while (remaining > 0) {
        let matched = false;
        for (const dur of this.slotDurations) {
          if (dur.slots <= remaining) {
            items.push({
              isRest,
              slots: dur.slots,
              duration: dur.type + (isRest ? 'r' : ''),
              dots: dur.dot ? 1 : 0,
              keys: isRest ? ['b/4'] : [current.vexKey], // VexFlow 쉼표 기본 위치 b/4
              midi: isRest ? null : current.midi,
              noteName: isRest ? 'Rest' : current.noteName,
              octave: isRest ? '' : current.octave
            });
            remaining -= dur.slots;
            matched = true;
            break;
          }
        }
        if (!matched) {
          remaining--; // 안전장치
        }
      }

      idx += runLength;
    }

    return items;
  }

  _createEmptyMeasure() {
    return [{
      measureNumber: 1,
      items: [{
        isRest: true,
        slots: 16,
        duration: 'wr',
        dots: 0,
        keys: ['b/4'],
        midi: null,
        noteName: 'Rest',
        octave: ''
      }]
    }];
  }
}

window.Quantizer = Quantizer;
