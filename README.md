# 🧭 FinLit (Investment Navigator)

FinLit은 투자자의 건강한 가치투자 판단을 돕기 위해 **DART(전자공시시스템)**와 **KRX Open API(한국거래소)** 데이터를 결합하여 **3차원 종합 평가**와 **실시간 기술적 분석**을 제공하는 웹 서비스입니다. 
추가적으로 **Kakao 로그인**을 지원하며 **Gemini AI**를 통한 투자 브리핑 기능을 제공합니다.

---

## 🌟 주요 기능 및 특징 (v4.0)

### 1. 🔒 편리한 인증 및 개인화
*   **카카오 로그인**: Kakao JS SDK를 이용해 원클릭으로 간편하게 로그인할 수 있습니다.
*   **투자 경험치(XP) 시스템**: 분석을 진행하거나 지표를 살필 때마다 XP가 상승하며, 투자에 대한 흥미를 유발합니다. (로컬 스토리지 기반 저장)

### 2. 📊 데이터 파이프라인 최적화 (DART vs KRX)
기존 버전에서 혼재되어 있던 데이터 소스를 확실히 분리하여 정확도와 성능을 대폭 향상했습니다.

*   **DART API (기업의 내재 가치 파악)**
    *   **역할**: 재무제표(당기순이익, 자산, 부채, 자본 등) 등 펀더멘털 데이터 추출
    *   **활용**: `수익성(영업이익률, EPS 성장률)`, `효율성(ROE, ROA)`, `건전성(부채비율, 이자보상비율)`의 3차원 종합 평가 자동 계산
*   **KRX Open API (시장의 실시간 흐름 파악)** 
    *   **역할**: 당일 주가, 거래량 실시간 시세 조회 및 OHLCV(고가, 저가, 시가, 종가) 차트 일봉 데이터 제공. **기존 키움 API의 데스크톱(Windows) 종속성을 완벽히 탈피했습니다.**
    *   **활용**: 반응형 캔들 차트(MA5, MA20 오버레이) 드로잉, RSI, MACD, 스토캐스틱, 볼린저 밴드 등 기술적 지표 완전 자동 계산

### 3. 🤖 AI 투자 브리핑 및 리포트 자동 생성
*   **Gemini 2.0 Flash 통합**: 수집된 재무 데이터 및 평가 점수를 바탕으로 "가치 투자 원칙 점수"를 계산하고, 핵심만을 짚은 요약 리포트를 한국어로 생성합니다.
*   **PDF 전문가 리포트**: 복잡한 인쇄 과정 없이 화면 내의 대시보드와 AI 브리핑을 고해상도 PDF 리포트로 바로 내보낼 수 있습니다. (`html2pdf` 라이브러리 사용)

---

## 🛠 아키텍처 및 구현 기술

### Frontend (SPA - Single Page Application)
*   **순수 HTML5 / Vanilla JS**: 리액트 등 프레임워크 종속성 없이 빠르고 가볍게 구동.
*   **CSS Style**: 모던 카드 형태의 UI와 고급스러운 다크 모드를 지원합니다.
*   **Canvas API**: KRX 차트 데이터를 캔버스에 직접 그려 성능이 우수하고 부드럽습니다.

### Backend Proxy Server
*   **Ruby WEBrick (`api_proxy.rb`)**: 브라우저 기반의 무분별한 API 호출로 생기는 CORS(Cross-Origin) 에러를 방지합니다. 
*   하나의 프록시 서버(Port 8081)로 **DART**와 **KRX Open API** 트래픽을 모두 분기 및 중계합니다.

---

## 🚀 설치 및 실행 방법

1.  **Repository Clone 또는 파일 준비**
    `index.html`, `style.css`, `script.js`, `api_proxy.rb` 4개의 핵심 파일이 한 폴더에 있어야 합니다.
2.  **환경 변수 설정 (선택사항 - 미설정 시 Fallback 모드 동작)**
    본인의 API Key가 있다면 환경변수로 주입하세요.
    ```bash
    export KRX_AUTH_KEY="발급받은_KRX_키"
    ```
3.  **Proxy Server 실행**
    ```bash
    ruby api_proxy.rb
    ```
    (성공 시 `FinLit Unified Proxy Server (DART + KRX) Port: 8081` 메시지 출력)
4.  **Frontend 앱 제공 (새 터미널 탭에서)**
    ```bash
    python3 -m http.server 8080
    ```
5.  브라우저를 열고 `http://localhost:8080/index.html`에 접속합니다.

---

## 📝 추후 개선 사항 (Roadmap)
-   카카오 로그인 Auth Token을 Proxy 서버와 연동하여 개별 유저 포트폴리오 관리 기능 추가
-   KRX Open API의 종목별 틱 데이터(Tick Data)를 활용한 실시간 초단타 매매 신호 포착
-   AWS 배포 자동화 스크립트 작성
