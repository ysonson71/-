import http.server
import socketserver
import io
import re
import json
import base64
import os
import google.generativeai as genai
from pptx import Presentation
from pptx.util import Inches, Pt, Cm
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.dml import MSO_LINE
from pptx.oxml import parse_xml
from pptx.oxml.ns import nsdecls

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_FILE = os.path.join(BASE_DIR, "template.pptx")

# 색상 상수 정의
COLOR_PRUSSIAN_BLUE = RGBColor(0, 49, 83)   # 프러시안 블루 (헤더/소제목)
COLOR_TEXT_DARK = RGBColor(30, 41, 59)       # 본문 텍스트 (#1e293b)
COLOR_MUTED = RGBColor(148, 163, 184)        # 회색 안내 문구 (#94a3b8)
COLOR_BORDER_LIGHT = RGBColor(203, 213, 225) # 연한 테두리 (#cbd5e1)

def ensure_default_template():
    if not os.path.exists(TEMPLATE_FILE):
        prs = Presentation()
        prs.save(TEMPLATE_FILE)

ensure_default_template()

def set_cell_border(cell, color="000000", width="12700"):
    """셀 상하좌우 테두리 설정"""
    tcPr = cell._tc.get_or_add_tcPr()
    for border in ['lnL', 'lnR', 'lnT', 'lnB']:
        edge = parse_xml(
            f'<a:{border} {nsdecls("a")} w="{width}" cmpd="s">'
            f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
            f'</a:{border}>'
        )
        tcPr.append(edge)

def clean_text(text):
    """마크다운 태그 및 볼드 기호 정리"""
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    return text.replace('`', '').strip()

HTML_PAGE = """<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 원페이지 파워포인트 생성기</title>
  <style>
    :root { --primary: #2563eb; --primary-hover: #1d4ed8; --accent: #059669; --accent-hover: #047857; --bg: #f8fafc; --card: #ffffff; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: #1e293b; display: flex; justify-content: center; padding: 30px 16px; }
    .container { background: var(--card); max-width: 880px; width: 100%; border-radius: 12px; padding: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    p.sub { color: #64748b; font-size: 13px; margin-bottom: 20px; }

    .top-bar { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
    .box { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 13px; display: flex; align-items: center; justify-content: space-between; }
    .box input { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 12px; width: 68%; outline: none; }
    .btn-sm { background: #fff; border: 1px solid #94a3b8; color: #334155; padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; }
    .btn-sm:hover { background: #e2e8f0; }

    /* 슬라이드 형식 선택 카드 */
    .format-section { margin-bottom: 18px; }
    .format-label { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .format-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .format-card {
      border: 2px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; cursor: pointer;
      display: flex; align-items: center; gap: 12px; transition: all 0.2s ease; background: #fff;
    }
    .format-card:hover { border-color: #93c5fd; }
    .format-card.active { border-color: var(--primary); background: #eff6ff; box-shadow: 0 0 0 1px var(--primary); }
    .format-card .icon { font-size: 26px; line-height: 1; }
    .format-card .title { font-size: 14px; font-weight: 700; color: #1e293b; }
    .format-card .desc { font-size: 11px; color: #64748b; margin-top: 3px; }

    .info-bar {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #334155;
    }

    .step-header { font-weight: 700; font-size: 14px; color: #334155; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
    textarea { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; line-height: 1.5; font-family: monospace; resize: vertical; outline: none; margin-bottom: 12px; }
    textarea:focus { border-color: var(--primary); }

    .btn-action {
      width: 100%; border: none; border-radius: 8px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.15s; margin-bottom: 20px;
    }
    .btn-translate { background: var(--primary); color: #fff; }
    .btn-translate:hover { background: var(--primary-hover); }
    .btn-generate { background: var(--accent); color: #fff; }
    .btn-generate:hover { background: var(--accent-hover); }
    button:disabled { background: #94a3b8 !important; cursor: not-allowed; }

    .result-section { border-top: 2px dashed #e2e8f0; padding-top: 18px; display: none; }
    .status { margin-top: 8px; font-size: 13px; text-align: center; display: none; }
    .status.error { color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>AI 원페이지 파워포인트 슬라이드 생성기</h1>
    <p class="sub">슬라이드 레이아웃을 선택한 후 내용을 입력하면 맞춤형 PPTX 파일이 자동 생성됩니다.</p>

    <div class="top-bar">
      <div class="box">
        <span>🔑 Gemini API Key:</span>
        <input type="password" id="api-key" placeholder="AI Studio 키 입력" onchange="saveKey(this.value)">
      </div>
      <div class="box">
        <span>📄 양식: <strong id="template-name">template.pptx</strong></span>
        <button class="btn-sm" onclick="document.getElementById('tpl-input').click()">양식 교체</button>
        <input type="file" id="tpl-input" accept=".pptx" style="display:none" onchange="uploadTemplate(this.files)">
      </div>
    </div>

    <!-- 형식 선택 (1단계 전) -->
    <div class="format-section">
      <div class="format-label">1단계: 슬라이드 형식 선택</div>
      <div class="format-grid">
        <div class="format-card active" id="card-table" onclick="selectFormat('table')">
          <div class="icon">📊</div>
          <div>
            <div class="title">1) 표(Table) 형식</div>
            <div class="desc">이전 양식: 전체 너비 프러시안 블루 깔끔한 표</div>
          </div>
        </div>
        <div class="format-card" id="card-content-image" onclick="selectFormat('content_image')">
          <div class="icon">🖼️</div>
          <div>
            <div class="title">2) 내용 + 그림 형식</div>
            <div class="desc">왼쪽: 핵심 내용 정리 / 오른쪽: 그림 삽입용 빈 공간</div>
          </div>
        </div>
      </div>
    </div>

    <div class="info-bar" id="info-bar">
      📌 <b>디자인 규격 (16:9 와이드):</b> 슬라이드 제목(24pt) ➡️ ■ 핵심 1줄 요약문(16pt) ➡️ <b>프러시안 블루 표 (헤더·본문 14pt 고정)</b>
    </div>

    <!-- 내용 입력 -->
    <div class="step-header">
      <span>2단계: 내용 입력 (한국어 보고서, 전략, 기획안 등)</span>
    </div>
    <textarea id="ko-input" rows="7" placeholder="여기에 내용을 입력하거나 붙여넣으세요. AI가 핵심 요약 및 선택한 레이아웃에 맞춰 자동 구조화합니다."></textarea>

    <button class="btn-action btn-translate" id="btn-translate" onclick="runTranslate()">
      ✨ AI 요약 & 구조화 실행
    </button>

    <!-- 결과 확인 및 PPT 다운로드 -->
    <div class="result-section" id="result-section">
      <div class="step-header">
        <span>3단계: 구조화된 내용 검토 및 수정</span>
        <span style="font-size:11px; color:#059669;" id="result-hint">💡 제목 아래 '■ 1줄 요약'과 내용 확인</span>
      </div>
      <textarea id="ja-output" rows="9"></textarea>
      <button class="btn-action btn-generate" id="btn-generate" onclick="generatePPT()">
        📥 파워포인트(.pptx) 파일 다운로드
      </button>
    </div>

    <div id="status" class="status"></div>
  </div>

  <script>
    let currentFormat = 'table';

    window.addEventListener('DOMContentLoaded', () => {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) document.getElementById('api-key').value = savedKey;
    });

    function saveKey(val) {
      localStorage.setItem('gemini_api_key', val.trim());
    }

    function selectFormat(fmt) {
      currentFormat = fmt;
      document.getElementById('card-table').classList.toggle('active', fmt === 'table');
      document.getElementById('card-content-image').classList.toggle('active', fmt === 'content_image');

      const infoBar = document.getElementById('info-bar');
      const hint = document.getElementById('result-hint');
      if (fmt === 'table') {
        infoBar.innerHTML = '📌 <b>디자인 규격 (16:9 와이드):</b> 슬라이드 제목(24pt) ➡️ ■ 핵심 1줄 요약문(16pt) ➡️ <b>프러시안 블루 표 (헤더·본문 14pt 고정)</b>';
        hint.innerText = "💡 제목 아래 '■ 1줄 요약'과 표 내용 확인";
      } else {
        infoBar.innerHTML = '📌 <b>디자인 규격 (16:9 와이드):</b> 슬라이드 제목(24pt) ➡️ ■ 핵심 1줄 요약문(16pt) ➡️ <b>좌측: 핵심 내용 정리 / 우측: 그림 삽입용 빈 공간</b>';
        hint.innerText = "💡 제목 아래 '■ 1줄 요약'과 좌측 텍스트 항목 확인 (우측은 그림 영역)";
      }
    }

    async function uploadTemplate(files) {
      if (!files.length) return;
      const file = files[0];
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const res = await fetch('/upload_template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: base64Data })
        });
        if (res.ok) {
          alert('기본 양식이 교체되었습니다: ' + file.name);
          document.getElementById('template-name').innerText = file.name;
        }
      };
    }

    async function runTranslate() {
      const key = document.getElementById('api-key').value.trim();
      const koText = document.getElementById('ko-input').value.trim();
      const btn = document.getElementById('btn-translate');
      const status = document.getElementById('status');

      if (!key) {
        alert('Gemini API 키를 상단에 입력해 주세요.');
        document.getElementById('api-key').focus();
        return;
      }
      if (!koText) {
        alert('내용을 입력해 주세요.');
        return;
      }

      btn.disabled = true;
      btn.innerText = 'AI가 구조화 및 번역 중...';
      status.style.display = 'none';

      try {
        const res = await fetch('/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: key, text: koText, format_type: currentFormat })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '번역 실패');

        document.getElementById('ja-output').value = data.result;
        document.getElementById('result-section').style.display = 'block';
        document.getElementById('result-section').scrollIntoView({ behavior: 'smooth' });

        btn.disabled = false;
        btn.innerText = '✨ AI 요약 & 구조화 실행';
      } catch (err) {
        btn.disabled = false;
        btn.innerText = '✨ AI 요약 & 구조화 실행';
        status.innerText = '오류: ' + err.message;
        status.className = 'status error';
        status.style.display = 'block';
      }
    }

    async function generatePPT() {
      const btn = document.getElementById('btn-generate');
      const status = document.getElementById('status');
      const jaText = document.getElementById('ja-output').value.trim();

      if (!jaText) return;

      btn.disabled = true;
      btn.innerText = '파워포인트 제작 중...';
      status.style.display = 'none';

      try {
        const resp = await fetch('/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: jaText, format_type: currentFormat })
        });
        if (!resp.ok) throw new Error(await resp.text());

        const filename = currentFormat === 'content_image' ? 'presentation_content_image.pptx' : 'presentation_table.pptx';
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        btn.disabled = false;
        btn.innerText = '📥 파워포인트(.pptx) 파일 다운로드';
      } catch (err) {
        btn.disabled = false;
        btn.innerText = '📥 파워포인트(.pptx) 파일 다운로드';
        status.innerText = '오류: ' + err.message;
        status.className = 'status error';
        status.style.display = 'block';
      }
    }
  </script>
</body>
</html>
"""

def ai_structure_and_translate(api_key, korean_text, format_type='table'):
    """형식(표 or 내용+그림)에 맞추어 1줄 요약문과 본문을 일본어로 구조화"""
    genai.configure(api_key=api_key)

    if format_type == 'content_image':
        prompt = f"""
당신은 일본 비즈니스 기획서 및 파워포인트 원페이지 보고서 작성 전문가입니다.
입력된 한국어 내용을 분석하여, '단 1장의 슬라이드 좌측에 들어갈 핵심 내용' 형태로 구조화하여 일본어로 번역하세요.
(슬라이드 우측 반쪽은 사용자가 그림이나 다이어그램을 넣을 수 있도록 비워둘 예정입니다.)

[필수 작성 규칙]
1. 1행에는 슬라이드의 메인 타이틀을 '# 슬라이드 제목' 형식으로 작성하세요.
2. 2행에는 장표 전체를 관통하는 '핵심 내용 1줄 요약문(결론/리드문)'을 반드시 '■ 요약문' 형식으로 작성하세요.
3. 3행부터는 표(Table)를 만들지 말고, 좌측 영역에 들어갈 2~3개의 핵심 항목(섹션)을 아래 형식으로 작성하세요:
   ### 1. 현황 및 과제 (또는 일본어 명칭)
   - 세부 내용 항목 1 (체언지, 간결하게)
   - 세부 내용 항목 2 (체언지, 간결하게)

   ### 2. 주요 실행 과제
   - 세부 내용 항목 1
   - 세부 내용 항목 2

   ### 3. 기대 효과 및 목표
   - 세부 내용 항목 1
   - 세부 내용 항목 2
4. 모든 문장은 비즈니스 일본어 '체언지(体言止め, 명사형 종결)'로 군더더기 없이 간결하게 작성하세요.
5. 표(| ... |)는 절대로 출력하지 마세요.
6. '**' (볼드 기호) 또는 '<br>' (HTML 태그) 같은 기호는 사용하지 마세요.
7. 마크다운 내용 외의 다른 인사말이나 잡담은 일절 출력하지 마세요.

[입력된 한국어 내용]
{korean_text}
"""
    else:
        prompt = f"""
당신은 일본 비즈니스 기획서 및 파워포인트 원페이지 보고서 작성 전문가입니다.
입력된 한국어 내용을 분석하여, '단 1장의 슬라이드에 들어갈 핵심 1줄 요약문과 간결한 표(Table)' 형태로 구조화하여 일본어로 번역하세요.

[필수 작성 규칙]
1. 1행에는 슬라이드의 메인 타이틀을 '# 슬라이드 제목' 형식으로 작성하세요.
2. 2행에는 장표 전체를 관통하는 '핵심 내용 1줄 요약문(결론/리드문)'을 반드시 '■ 요약문' 형식으로 작성하세요.
3. 그 아래에 반드시 마크다운 표(Table) 형식으로 핵심 내용을 3~4개 열, 3~5개 행으로 작성하세요.
   - 표 헤더 예시: | 項目 | 現状・課題 | 推進施策 | 期待効果・KPI |
4. 표 내부의 내용 항목에는 글머리 기호(▲, ▼, ●, •, -, * 등)를 절대로 붙이지 마세요!
5. 표 내부의 모든 텍스트는 반드시 비즈니스 '체언지(体言止め, 명사형 종결)'로 작성하세요.
6. '**' (볼드 기호) 또는 '<br>' (HTML 태그) 같은 기호는 사용하지 마세요.
7. 마크다운 내용 외의 다른 인사말이나 잡담은 일절 출력하지 마세요.

[입력된 한국어 내용]
{korean_text}
"""

    for model_name in ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
        except Exception:
            continue
    raise RuntimeError("Gemini API 호출에 실패했습니다. API 키를 확인해 주세요.")

def create_base_slide(title, summary_line):
    """공통 베이스 슬라이드 생성 (16:9 와이드, 24pt 제목, 4pt 검은색 분리선, 16pt ■ 1줄 요약문)"""
    ensure_default_template()
    prs = Presentation(TEMPLATE_FILE)
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    layouts = prs.slide_layouts
    layout = layouts[1] if len(layouts) > 1 else layouts[0]

    for i in range(len(prs.slides) - 1, -1, -1):
        rId = prs.slides._sldIdLst[i].rId
        prs.part.drop_rel(rId)
        del prs.slides._sldIdLst[i]

    slide = prs.slides.add_slide(layout)

    # 1. 슬라이드 제목 (24pt 볼드, 왼쪽 맞춤)
    if slide.shapes.title and slide.shapes.title.has_text_frame:
        slide.shapes.title.text = title
        slide.shapes.title.left = Inches(0.8)
        slide.shapes.title.top = Inches(0.35)
        slide.shapes.title.width = Inches(11.733)
        slide.shapes.title.height = Inches(0.65)
        if slide.shapes.title.text_frame.paragraphs:
            p_title = slide.shapes.title.text_frame.paragraphs[0]
            p_title.alignment = PP_ALIGN.LEFT
            p_title.font.bold = True
            p_title.font.size = Pt(24)
    else:
        tb_title = slide.shapes.add_textbox(Inches(0.8), Inches(0.35), Inches(11.733), Inches(0.65))
        p_title = tb_title.text_frame.paragraphs[0]
        p_title.text = title
        p_title.alignment = PP_ALIGN.LEFT
        p_title.font.bold = True
        p_title.font.size = Pt(24)

    # 기본 플레이스홀더 정리
    for shape in list(slide.placeholders):
        if shape.has_text_frame and shape != slide.shapes.title:
            sp = shape._element
            sp.getparent().remove(sp)

    # 2. 핵심 1줄 요약문 (16pt 볼드, ■ 네모)
    if summary_line:
        tb_summary = slide.shapes.add_textbox(Inches(0.8), Inches(1.24), Inches(11.733), Inches(0.5))
        tf_summary = tb_summary.text_frame
        tf_summary.word_wrap = True
        p_sum = tf_summary.paragraphs[0]
        p_sum.alignment = PP_ALIGN.LEFT

        r_sq = p_sum.add_run()
        r_sq.text = "■ "
        r_sq.font.bold = True
        r_sq.font.size = Pt(16)
        r_sq.font.color.rgb = COLOR_TEXT_DARK

        r_txt = p_sum.add_run()
        r_txt.text = summary_line
        r_txt.font.bold = True
        r_txt.font.size = Pt(16)
        r_txt.font.color.rgb = COLOR_TEXT_DARK

    return prs, slide

def parse_table_content(text):
    """표 형식 텍스트 파싱"""
    lines = [line.strip() for line in text.strip().split('\n') if line.strip()]
    title = "タイトル"
    summary_line = ""
    table_rows = []

    for line in lines:
        clean_l = clean_text(line)
        if clean_l.startswith('#') and not table_rows:
            title = clean_l.lstrip('#').strip()
        elif (clean_l.startswith(('■', '□', '▶', '●', '>')) or (summary_line == "" and not clean_l.startswith('|') and not clean_l.startswith('#'))) and not table_rows:
            summary_text = re.sub(r'^[■□▶●>\s\-]+', '', clean_l).strip()
            if summary_text:
                summary_line = summary_text
        elif clean_l.startswith('|') and clean_l.endswith('|'):
            if re.match(r'^\|[\s\-:|]+\|$', clean_l):
                continue
            cells = []
            for c in clean_l.split('|')[1:-1]:
                val = clean_text(c.strip())
                val = re.sub(r'^[▲▼●○•\-\*\s]+', '', val).strip()
                cells.append(val)
            if cells:
                table_rows.append(cells)

    return title, summary_line, table_rows

def build_table_presentation(title, summary_line, table_rows):
    """1) 표 형식 슬라이드 생성"""
    prs, slide = create_base_slide(title, summary_line)

    if not table_rows:
        out = io.BytesIO()
        prs.save(out)
        out.seek(0)
        return out.read()

    rows = len(table_rows)
    cols = len(table_rows[0])
    left = Inches(0.8)
    top = Inches(1.85)
    width = Inches(11.733)
    height = Inches(4.8)

    table_shape = slide.shapes.add_table(rows, cols, left, top, width, height)
    table = table_shape.table

    col_width = width / cols
    for col in table.columns:
        col.width = int(col_width)

    for r_idx, row in enumerate(table_rows):
        for c_idx, val in enumerate(row):
            if c_idx >= cols:
                continue
            cell = table.cell(r_idx, c_idx)
            set_cell_border(cell, color="000000", width="12700")
            tf = cell.text_frame
            tf.word_wrap = True

            if r_idx == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = COLOR_PRUSSIAN_BLUE
                p = tf.paragraphs[0]
                p.text = val
                p.font.bold = True
                p.font.color.rgb = RGBColor(255, 255, 255)
                p.font.size = Pt(14)
                p.alignment = PP_ALIGN.CENTER
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = RGBColor(255, 255, 255)
                sub_lines = [l.strip() for l in val.split('\n') if l.strip()] or [""]
                for line_idx, line_text in enumerate(sub_lines):
                    p = tf.paragraphs[0] if line_idx == 0 else tf.add_paragraph()
                    p.alignment = PP_ALIGN.LEFT
                    p.text = re.sub(r'^[▲▼●○•\-\*\s]+', '', line_text).strip()
                    p.font.size = Pt(14)
                    p.font.color.rgb = COLOR_TEXT_DARK

    out = io.BytesIO()
    prs.save(out)
    out.seek(0)
    return out.read()

def parse_content_image(text):
    """2) 내용+그림 형식 텍스트 파싱 (제목, 요약, 섹션별 내용)"""
    lines = [line.strip() for line in text.strip().split('\n') if line.strip()]
    title = "タイトル"
    summary_line = ""
    sections = []  # [{'title': '...', 'items': [...]}]
    current_sec = None

    for line in lines:
        clean_l = clean_text(line)
        if clean_l.startswith('#') and not clean_l.startswith('###') and not sections:
            title = clean_l.lstrip('#').strip()
        elif (clean_l.startswith(('■', '□', '▶', '●', '>')) or (summary_line == "" and not clean_l.startswith(('#', '-')))) and not sections:
            summary_text = re.sub(r'^[■□▶●>\s\-]+', '', clean_l).strip()
            if summary_text:
                summary_line = summary_text
        elif clean_l.startswith('###') or re.match(r'^\d+[\.\)]\s*', clean_l):
            sec_title = clean_l.lstrip('#').strip()
            current_sec = {'title': sec_title, 'items': []}
            sections.append(current_sec)
        else:
            item_text = re.sub(r'^[▲▼●○•\-\*\d\.\)\s]+', '', clean_l).strip()
            if item_text:
                if current_sec is None:
                    current_sec = {'title': '', 'items': []}
                    sections.append(current_sec)
                current_sec['items'].append(item_text)

    return title, summary_line, sections

def build_content_image_presentation(title, summary_line, sections):
    """2) 내용+그림 형식 슬라이드 생성 (좌측 내용 정리 + 우측 그림용 빈 영역)"""
    prs, slide = create_base_slide(title, summary_line)

    # 1. 좌측 내용 영역 (왼쪽 반: 너비 5.7인치)
    left_x = Inches(0.8)
    content_y = Inches(1.85)
    left_w = Inches(5.7)
    content_h = Inches(5.0)

    tb_left = slide.shapes.add_textbox(left_x, content_y, left_w, content_h)
    tf = tb_left.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.1)
    tf.margin_right = Inches(0.1)
    tf.margin_top = Inches(0.1)
    tf.margin_bottom = Inches(0.1)

    is_first_para = True
    for sec_idx, sec in enumerate(sections):
        # 섹션 소제목 (프러시안 블루, 볼드 15pt)
        if sec['title']:
            p_sec = tf.paragraphs[0] if is_first_para else tf.add_paragraph()
            is_first_para = False
            p_sec.alignment = PP_ALIGN.LEFT
            if sec_idx > 0:
                p_sec.space_before = Pt(14)

            r_sec = p_sec.add_run()
            r_sec.text = sec['title']
            r_sec.font.bold = True
            r_sec.font.size = Pt(15)
            r_sec.font.color.rgb = COLOR_PRUSSIAN_BLUE

        # 섹션 세부 항목들 (13pt 본문, 글머리 기호)
        for item in sec['items']:
            p_item = tf.paragraphs[0] if is_first_para else tf.add_paragraph()
            is_first_para = False
            p_item.alignment = PP_ALIGN.LEFT
            p_item.space_before = Pt(4)

            # 불릿 기호
            r_bullet = p_item.add_run()
            r_bullet.text = "• "
            r_bullet.font.bold = True
            r_bullet.font.size = Pt(13)
            r_bullet.font.color.rgb = COLOR_PRUSSIAN_BLUE

            # 본문 내용
            r_text = p_item.add_run()
            r_text.text = item
            r_text.font.size = Pt(13)
            r_text.font.color.rgb = COLOR_TEXT_DARK

    # 2. 우측 그림 영역 (오른쪽 반: 너비 5.7인치, 임의로 그림을 넣을 수 있도록 비워둠)
    right_x = Inches(6.8)
    guide_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_x, content_y, left_w, content_h)
    guide_box.fill.background()  # 배경 투명
    guide_box.line.color.rgb = COLOR_BORDER_LIGHT
    guide_box.line.width = Pt(1.5)
    try:
        guide_box.line.dash_style = MSO_LINE.DASH
    except Exception:
        pass

    tf_guide = guide_box.text_frame
    tf_guide.vertical_anchor = MSO_ANCHOR.MIDDLE
    p_g = tf_guide.paragraphs[0]
    p_g.alignment = PP_ALIGN.CENTER
    r_g1 = p_g.add_run()
    r_g1.text = "🖼️ [ 그림 / 도표 삽입 영역 ]\n\n"
    r_g1.font.bold = True
    r_g1.font.size = Pt(14)
    r_g1.font.color.rgb = COLOR_MUTED

    r_g2 = p_g.add_run()
    r_g2.text = "(이 영역에 이미지를 자유롭게 배치하세요)"
    r_g2.font.size = Pt(12)
    r_g2.font.color.rgb = COLOR_MUTED

    out = io.BytesIO()
    prs.save(out)
    out.seek(0)
    return out.read()

class PPTHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(HTML_PAGE.encode('utf-8'))

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len)
        data = json.loads(post_body.decode('utf-8'))

        if self.path == '/translate':
            try:
                api_key = data.get('api_key', '').strip()
                korean_text = data.get('text', '').strip()
                format_type = data.get('format_type', 'table')
                if not api_key or not korean_text:
                    self.send_error(400, "API 키와 내용을 모두 입력해 주세요.")
                    return

                res_text = ai_structure_and_translate(api_key, korean_text, format_type)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({'result': res_text}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

        elif self.path == '/upload_template':
            try:
                b64_tpl = data.get('template')
                if b64_tpl:
                    with open(TEMPLATE_FILE, 'wb') as f:
                        f.write(base64.b64decode(b64_tpl))
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b"OK")
            except Exception as e:
                self.send_error(500, str(e))

        elif self.path == '/generate':
            try:
                content_text = data.get('content', '')
                format_type = data.get('format_type', 'table')

                if format_type == 'content_image':
                    title, summary_line, sections = parse_content_image(content_text)
                    out_bytes = build_content_image_presentation(title, summary_line, sections)
                    filename = "presentation_content_image.pptx"
                else:
                    title, summary_line, table_rows = parse_table_content(content_text)
                    out_bytes = build_table_presentation(title, summary_line, table_rows)
                    filename = "presentation_table.pptx"

                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(out_bytes)))
                self.end_headers()
                self.wfile.write(out_bytes)
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(f"생성 오류: {str(e)}".encode('utf-8'))
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    print("==================================================")
    print("AI 원페이지 파워포인트 슬라이드 생성기 실행 중")
    print(f"접속 주소: http://localhost:{PORT}")
    print(f"기본 양식 파일: {os.path.abspath(TEMPLATE_FILE)}")
    print("지원 형식: 1) 표 형식, 2) 내용+그림 형식")
    print("==================================================")
    with socketserver.TCPServer(("", PORT), PPTHandler) as httpd:
        httpd.serve_forever()
