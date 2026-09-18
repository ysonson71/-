/**
 * SheetRenderer - VexFlow 4 기반 5선지 악보 렌더링 및 내보내기 모듈
 */
class SheetRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.measuresPerLine = 2; // 한 줄당 2마디 렌더링
    this.staveWidth = 380;
    this.staveHeight = 140;
  }

  /**
   * 마디 데이터 목록을 VexFlow 5선지 악보로 렌더링
   */
  render(measures) {
    if (!this.container) return;
    this.container.innerHTML = '';

    if (!window.Vex || !measures || measures.length === 0) {
      this.container.innerHTML = '<div class="empty-state">렌더링할 악보 데이터가 없습니다.</div>';
      return;
    }

    const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Accidental, Dot } = Vex.Flow;

    // 반응형 너비 계산
    const containerWidth = Math.max(760, Math.min(1000, this.container.clientWidth || 800));
    const measuresPerLine = containerWidth > 850 ? 3 : 2;
    const measureWidth = Math.floor((containerWidth - 40) / measuresPerLine);

    const totalLines = Math.ceil(measures.length / measuresPerLine);
    const totalHeight = totalLines * (this.staveHeight + 20) + 40;

    // 메인 SVG Renderer 생성
    const renderer = new Renderer(this.container, Renderer.Backends.SVG);
    renderer.resize(containerWidth, totalHeight);
    const context = renderer.getContext();
    context.setFont('Arial', 10, '').setBackgroundFillStyle('#ffffff');

    // 마디 렌더링 루프
    for (let m = 0; m < measures.length; m++) {
      const lineIndex = Math.floor(m / measuresPerLine);
      const colIndex = m % measuresPerLine;

      const x = 20 + colIndex * measureWidth;
      const y = 20 + lineIndex * (this.staveHeight + 15);

      const stave = new Stave(x, y, measureWidth);

      // 첫 마디 또는 각 줄의 첫 마디에 높은음자리표 표시
      if (colIndex === 0) {
        stave.addClef('treble');
      }
      // 곡의 첫 마디에만 4/4 박자표 표시
      if (m === 0) {
        stave.addTimeSignature('4/4');
      }

      stave.setContext(context).draw();

      const measureData = measures[m];
      const vexNotes = [];

      for (const item of measureData.items) {
        try {
          const noteProps = {
            keys: item.keys,
            duration: item.duration,
            clef: 'treble'
          };
          const staveNote = new StaveNote(noteProps);

          // 점음표 처리
          if (item.dots > 0) {
            Dot.buildAndAttach([staveNote], { all: true });
          }

          // 임시표(# 또는 b) 처리
          if (!item.isRest && item.keys[0]) {
            const keyPart = item.keys[0].split('/')[0];
            if (keyPart.includes('#')) {
              staveNote.addModifier(new Accidental('#'));
            } else if (keyPart.includes('b')) {
              staveNote.addModifier(new Accidental('b'));
            }
          }

          vexNotes.push(staveNote);
        } catch (err) {
          console.warn('음표 생성 에러 (무시됨):', err, item);
        }
      }

      if (vexNotes.length > 0) {
        try {
          const voice = new Voice({ num_beats: 4, beat_value: 4 });
          voice.setMode(Voice.Mode.SOFT); // 박자 오차 허용 모드
          voice.addTickables(vexNotes);

          // 8분/16분음표 빔(Beams) 자동 연결
          const beams = Beam.generateBeams(vexNotes);

          const formatter = new Formatter();
          const startXOffset = (colIndex === 0 && m === 0) ? 75 : (colIndex === 0 ? 55 : 20);
          const usableWidth = measureWidth - startXOffset - 15;
          formatter.joinVoices([voice]).format([voice], Math.max(100, usableWidth));

          voice.draw(context, stave);
          beams.forEach(beam => beam.setContext(context).draw());
        } catch (voiceErr) {
          console.error('보이스 렌더링 에러:', voiceErr);
        }
      }
    }
  }

  /**
   * SVG 악보를 PNG 이미지 파일로 다운로드
   */
  exportToPNG(filename = 'sing-to-score.png') {
    const svg = this.container.querySelector('svg');
    if (!svg) {
      alert('저장할 악보가 없습니다.');
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const padding = 40;
      canvas.width = svg.clientWidth || 800;
      canvas.height = (svg.clientHeight || 400) + padding;
      const ctx = canvas.getContext('2d');

      // 흰색 배경
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 20);

      const a = document.createElement('a');
      a.download = filename;
      a.href = canvas.toDataURL('image/png');
      a.click();
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  }

  /**
   * 인쇄 다이얼로그 (브라우저 PDF 저장 가능)
   */
  print() {
    window.print();
  }
}

window.SheetRenderer = SheetRenderer;
