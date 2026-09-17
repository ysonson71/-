# 🎮 Python Web Tetris (파이썬 테트리스)

PyScript(WebAssembly 기반 파이썬)와 HTML5 Canvas를 활용하여 별도 설치 없이 **인터넷 웹브라우저**에서 직접 실행할 수 있는 파이썬 테트리스 게임입니다.

---

## 🌐 1. 웹 브라우저에서 바로 플레이하기 (GitHub Pages)

GitHub Pages 설정을 통해 인터넷 웹 주소로 즉시 플레이할 수 있습니다.

- **온라인 접속 주소:**  
  👉 **`https://ysonson71.github.io/program/tetris/`**

> **💡 GitHub Pages 활성화 방법:**  
> 1. GitHub 저장소 (`https://github.com/ysonson71/program`) 로 이동합니다.  
> 2. 상단 메뉴에서 **Settings** ➔ 좌측 사이드바의 **Pages** 클릭  
> 3. **Build and deployment > Branch** 항목에서 `main` 브랜치, 폴더는 `/ (root)` 선택 후 **Save** 클릭  
> 4. 1~2분 뒤 위의 주소로 접속하면 브라우저에서 바로 파이썬 테트리스가 실행됩니다!

---

## 💻 2. 로컬 환경에서 실행하기

### 방법 A: 웹 브라우저로 실행 (추천)
- `play_in_browser.bat` 파일을 더블 클릭하거나 터미널에서 다음 명령어 입력:
  ```bash
  python -m http.server 8000
  ```
  이후 브라우저에서 `http://localhost:8000/tetris/` 접속

### 방법 B: 데스크톱 GUI(Tkinter) 창으로 실행
- 터미널에서 다음 명령어 입력:
  ```bash
  python tetris.py
  ```

---

## 🕹️ 조작법

| 키 / 버튼 | 동작 |
| :--- | :--- |
| **◀ / A** | 왼쪽으로 이동 |
| **▶ / D** | 오른쪽으로 이동 |
| **▲ / W** | 블록 시계방향 회전 |
| **▼ / S** | 한 칸 소프트 드롭 (아래로) |
| **SPACE** | 즉시 하강 (하드 드롭) |
| **R** | 게임 재시작 |
| **P** | 일시정지 / 계속하기 |
| **화면 터치 버튼** | 스마트폰 및 태블릿 터치 조작 지원 |

---

## 🛠️ 주요 특징 및 기술 스택
- **Python 3 / PyScript (Pyodide Wasm)**: 브라우저 내부에서 파이썬 런타임이 직접 구동
- **HTML5 Canvas & Responsive UI**: PC 키보드 및 모바일 터치 패드 완벽 지원
- **Python `asyncio` 기반 게임 루프**: 부드러운 렌더링 및 프레임 제어
