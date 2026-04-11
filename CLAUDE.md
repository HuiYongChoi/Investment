# 🧭 Investment Navigator AI Agent Guidelines

본 문서는 Investment Navigator 프로젝트를 유지보수하고 개발하는 코딩 에이전트(Claude Code, Cursor 등)를 위한 핵심 행동 지침입니다. 에이전트는 코드를 수정하거나 생성할 때 반드시 아래 원칙을 준수해야 합니다.

## 1. 제품 개요 및 기술 스택
Investment Navigator는 한국 상장기업의 가치투자 판단을 돕는 경량화된 웹 대시보드입니다.
- **Frontend:** 순수 바닐라 자바스크립트(Vanilla JS), HTML5, CSS3 (`React`, `Vue`, `jQuery` 등 외부 라이브러리 절대 금지)
- **차트 렌더링:** `Chart.js` 등 외부 라이브러리 없이 오직 `HTML5 Canvas 2D Context`를 사용하여 직접 구현합니다.
- **Backend (Proxy):** PHP (`proxy.php`) 기반의 통합 라우터 및 로컬 개발용 Python/Ruby 프록시.
- **Data Bridge:** Python (`yfinance_bridge.py`)을 활용하여 Yahoo Finance 데이터를 수집하고 정규화.
- **서버 환경:** AWS Lightsail (Bitnami Apache).

## 2. 프로젝트 파일 및 구조 원칙
코드를 수정할 때 각 파일의 고유한 역할을 반드시 존중하여 분리합니다.

### Frontend
- `index.html` & `style.css`: UI 마크업과 스타일링 담당.
- `dashboard_logic.js`: 순수 비즈니스 로직, 수학 계산, 데이터 정규화 함수만 포함. (DOM 조작 금지)
- `script.js`: DOM 조작, 이벤트 리스너 바인딩, Canvas 렌더링, Proxy API 호출 등 상태 및 화면 제어 담당.

### Backend & Data
- `proxy.php`: 상용 환경의 메인 API 게이트웨이. 새로운 엔드포인트 추가 시 여기에 `action` 라우팅을 추가합니다.
- `yfinance_bridge.py`: `yfinance` 패키지를 이용해 데이터를 수집하고 JSON으로 표준화하여 출력하는 브릿지 스크립트.
- **레거시 무시:** `kiwoom_proxy.rb`, `dart_proxy.rb`, `api_proxy.rb` 등의 Ruby 스크립트는 과거 레거시 또는 로컬 테스트용이므로 명시적인 지시가 없는 한 메인 개발 로직에서 제외합니다.

## 3. 데이터 소스 및 API 통신 원칙
- **직접 호출 금지:** 프론트엔드 브라우저에서 외부 API(DART, yfinance, Gemini, Kakao)를 직접 호출하지 않습니다. 반드시 `proxy.php` (또는 로컬 8081 포트)를 경유합니다.
- **yfinance 브릿지:** 주식 가격 및 차트 데이터는 `proxy.php`에서 `shell_exec` (또는 `proc_open`) 방식으로 `yfinance_bridge.py`를 호출하여 얻은 표준화된 OHLCV JSON 데이터를 프론트엔드로 전달합니다.
- **데이터 출처 명시:** UI에 표시되는 데이터는 `Yahoo Finance (yfinance Python)`, `DART` 등 출처를 오해 없이 명확히 표기해야 합니다.
- **에러 핸들링 (환각 방지):** 외부 API 장애 또는 시세 데이터가 없을 경우, 절대로 가짜 데이터(Fake Data)나 합성 차트를 임의로 그려 넣지 않습니다. 빈 화면(Empty State)과 함께 솔직한 오류 메시지(`실시간 시세 미연결` 등)를 표시합니다.

## 4. 보안 및 환경 변수 (Security)
- **비밀값 하드코딩 금지:** API Key, RSA Key, DB 비밀번호 등은 코드에 절대 하드코딩하지 않습니다.
- **키 로드 방식:** 백엔드(PHP, Python 등)는 반드시 `AWS.txt` 파일을 파싱하거나 서버의 환경변수(`getenv()`), 또는 외부 비밀파일(`proxy.secrets.php`)에서 키를 읽어와야 합니다. 

## 5. 제품 스펙 및 구현 원칙
1. **기업 검색:** `COMPANY_DIRECTORY`에 하드코딩된 매핑 데이터를 최우선으로 참조합니다. 시장 종목코드는 `KOSPI -> .KS`, `KOSDAQ -> .KQ` 규칙을 사용하여 yfinance 티커로 변환합니다.
2. **기술적 분석:** 이동평균선(MA), RSI, MACD, 스토캐스틱, 볼린저 밴드는 자체 구현된 수학 함수(`dashboard_logic.js`)를 유지보수합니다.
3. **재무/공시:** 최근 3개년 연간 실적과 최신 분기 실적을 함께 보여주며, DART 실제 공시를 기준으로 판단합니다.
4. **브리핑 대체:** Gemini API 호출 실패 시 에러를 발생시키지 않고, 즉시 `buildLocalBriefing()` 함수를 활용한 로컬 폴백(Fallback) 브리핑으로 자연스럽게 전환해야 합니다.
5. **불확실성 대처:** 기존의 Canvas 렌더링 공식(`xAt`, `yAt`)이나 지표 계산식을 수정할 때 기획 의도가 모호하다면 임의로 코드를 덮어쓰지 말고 사용자에게 질문하여 확인받습니다.
6. **실산출물 검증:** PDF, 카카오 메시지, 다운로드 파일처럼 사용자가 직접 보는 결과물은 반드시 실제 산출물까지 확인해야 하며, 코드만 보고 “완료”로 말하지 않습니다.

## 6. 멀티 에이전트 협업 및 서버 배포 프로토콜 (Workflow & Deployment)
작업을 시작하거나 서버 배포를 진행할 때, 버전 충돌 방지와 속도 최적화를 위해 아래 프로토콜을 엄수합니다.

1. **에이전트 바통 터치 (Version Sync)**
   - **Status Check:** 작업 시작 전 터미널에서 `git status`와 `git log -n 2`를 실행하여 이전 에이전트의 최신 커밋 상태와 미커밋(Untracked/Modified) 파일을 반드시 확인합니다.
   - **Selective Sync:** 미커밋 코드가 보여도 무조건 `git add .` 하지 말고, **현재 요청과 직접 관련된 파일만 선별해서 커밋**합니다. 다른 에이전트나 사용자의 변경은 함부로 묶지 않습니다.
   - **Branching:** 브랜치 전략은 상황에 따르되, 배포 직전에는 **현재 서버에 반영할 정확한 커밋 해시를 명확히 확인**합니다.

2. **서버 배포 원칙 (Deployment)**
   - **검증된 기본 방식:** 가장 잘 동작한 배포 경로는 `scp`로 파일을 **서버 홈 디렉터리(`/home/bitnami/`)**에 먼저 올리고, 이어서 `ssh`로 접속해 **기존 웹루트 파일을 `/home/bitnami/deploy_backups/<timestamp>-...`에 백업한 뒤 `sudo cp`로 `/opt/bitnami/apache/htdocs/`에 반영하는 방식**입니다.
   - **웹루트 직접 `scp` 금지:** `/opt/bitnami/apache/htdocs/`로 바로 업로드하면 `Permission denied`가 발생할 수 있으므로, **웹루트 직접 쓰기를 반복 시도하지 않습니다.**
   - **환경 제약 시 대안:** 현재 실행 환경에서 `.pem` 접근이나 `ssh/scp` 자체가 막힐 때만 GitHub Push 후 서버 `git pull`, 또는 사용자의 `./deploy.sh` 실행 방식으로 전환합니다.
   - **배포 후 검증:** 배포가 끝났다고 바로 끝내지 말고, `curl`, `rg`, `php -l`, `python3 -m py_compile` 등으로 **라이브 파일/런타임 반영 여부를 반드시 확인**합니다.

3. **Git 속도 최적화 (Git Performance)**
   - 불필요한 대용량 파일, 로그, 캐시(예: `__pycache__`, `.DS_Store` 등)가 `.gitignore`에 제대로 등록되어 있는지 확인합니다. 
   - 커밋 시 의미 없는 대용량 파일이 스테이징되지 않도록 주의합니다.

4. **반복 실패 차단 (Do Not Loop Blindly)**
   - 같은 증상에 대해 2회 이상 수정하려 할 때는, 먼저 “직전 수정이 왜 실패했는지”를 증거로 남깁니다.
   - PDF는 실제 파일 생성 → 파일 크기/페이지 수 확인 → `fitz` 렌더 확인까지 거친 뒤에만 해결이라고 말합니다.
   - 카카오는 프론트 alert만 보지 말고, Network/Proxy/upstream `code/msg/status`를 같이 봅니다.
   - JS/CSS 변경 시 라이브 캐시 이슈를 피하려면 `?v=`를 꼭 올리고, `curl`로 라이브 파일에 반영됐는지 확인합니다.
