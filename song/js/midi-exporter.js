/**
 * MidiExporter - 표준 MIDI 파일(SMF Type 0) 바이너리 생성 및 다운로드 모듈
 */
class MidiExporter {
  /**
   * 마디 목록을 MIDI 파일로 변환하여 다운로드
   */
  static exportMidi(measures, bpm = 100, filename = 'sing-to-score.mid') {
    const ticksPerQuarter = 480;
    const ticksPerSlot = ticksPerQuarter / 4; // 120 ticks (16분음표)

    // 마이크로초 단위 템포 (60,000,000 / BPM)
    const mpqn = Math.round(60000000 / bpm);

    const trackEvents = [];

    // 1. 템포 메타 이벤트 (Delta 0)
    trackEvents.push(...this._writeVLQ(0));
    trackEvents.push(0xFF, 0x51, 0x03, (mpqn >> 16) & 0xFF, (mpqn >> 8) & 0xFF, mpqn & 0xFF);

    // 2. 박자표 4/4 메타 이벤트 (Delta 0)
    trackEvents.push(...this._writeVLQ(0));
    trackEvents.push(0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

    // 3. 악기 선택 (Grand Piano: 0x00)
    trackEvents.push(...this._writeVLQ(0));
    trackEvents.push(0xC0, 0x00);

    let pendingDelta = 0;

    for (const measure of measures) {
      for (const item of measure.items) {
        const itemTicks = item.slots * ticksPerSlot;

        if (item.isRest || !item.midi) {
          pendingDelta += itemTicks;
        } else {
          // Note On (채널 0, 음정, 벨로시티 85)
          trackEvents.push(...this._writeVLQ(pendingDelta));
          trackEvents.push(0x90, item.midi & 0x7F, 85);

          // Note Off (채널 0, 음정, 벨로시티 64)
          trackEvents.push(...this._writeVLQ(itemTicks));
          trackEvents.push(0x80, item.midi & 0x7F, 64);

          pendingDelta = 0;
        }
      }
    }

    // 4. 트랙 종료 메타 이벤트
    trackEvents.push(...this._writeVLQ(pendingDelta));
    trackEvents.push(0xFF, 0x2F, 0x00);

    // MIDI 바이너리 조립
    const header = [
      0x4D, 0x54, 0x68, 0x64, // 'MThd'
      0x00, 0x00, 0x00, 0x06, // 청크 크기 6
      0x00, 0x00,             // 포맷 0 (단일 트랙)
      0x00, 0x01,             // 트랙 개수 1
      (ticksPerQuarter >> 8) & 0xFF, ticksPerQuarter & 0xFF // 480 ticks
    ];

    const trackHeader = [
      0x4D, 0x54, 0x72, 0x6B, // 'MTrk'
      (trackEvents.length >> 24) & 0xFF,
      (trackEvents.length >> 16) & 0xFF,
      (trackEvents.length >> 8) & 0xFF,
      trackEvents.length & 0xFF
    ];

    const fullMidi = new Uint8Array([...header, ...trackHeader, ...trackEvents]);
    const blob = new Blob([fullMidi], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Variable-Length Quantity(VLQ) 인코딩
   */
  static _writeVLQ(value) {
    let buffer = value & 0x7F;
    const bytes = [];
    while ((value >>= 7)) {
      buffer <<= 8;
      buffer |= ((value & 0x7F) | 0x80);
    }
    while (true) {
      bytes.push(buffer & 0xFF);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return bytes;
  }
}

window.MidiExporter = MidiExporter;
