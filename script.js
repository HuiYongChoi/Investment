const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const LOCAL_PROXY = 'http://localhost:8081';
const PROD_PROXY = '/proxy.php';
const KAKAO_JS_KEY = '88cd449d612399a0219090bbcfc20b24';
const KAKAO_STORAGE_TOKEN = 'invest_nav_kakao_token';
const KAKAO_STORAGE_ERROR = 'invest_nav_kakao_error';
const KAKAO_STORAGE_RETURN_URL = 'invest_nav_kakao_return_url';
const KAKAO_REDIRECT_URI = InvestmentLogic.resolveKakaoRedirectUri(location.href);
const XP_MAX = 100;
const CHART_HISTORY_YEARS = 5;
const CHART_DEFAULT_WINDOWS = {
    DAY: 120,
    WEEK: 104,
    MONTH: 60,
    YEAR: 10,
    YTD: 120
};
const CHART_MIN_WINDOWS = {
    DAY: 20,
    WEEK: 12,
    MONTH: 12,
    YEAR: 3,
    YTD: 20
};
const CHART_MA_PERIODS = [5, 20, 60, 120, 200];
const CHART_MA_COLORS = {
    5: '#8fd3ff',
    20: '#f59e0b',
    60: '#22c55e',
    120: '#a855f7',
    200: '#f97316'
};

const COMPANY_MAP = {
    '삼성전자': { corpCode: '00126380', stockCode: '005930', market: 'KOSPI' },
    'SK하이닉스': { corpCode: '00164779', stockCode: '000660', market: 'KOSPI' },
    '카카오': { corpCode: '00634770', stockCode: '035720', market: 'KOSDAQ' },
    '네이버': { corpCode: '00266961', stockCode: '035420', market: 'KOSPI' },
    'NAVER': { corpCode: '00266961', stockCode: '035420', market: 'KOSPI' },
    '현대자동차': { corpCode: '00164742', stockCode: '005380', market: 'KOSPI' },
    '현대차': { corpCode: '00164742', stockCode: '005380', market: 'KOSPI' },
    'LG전자': { corpCode: '00401731', stockCode: '066570', market: 'KOSPI' },
    'LG화학': { corpCode: '00356361', stockCode: '051910', market: 'KOSPI' },
    '셀트리온': { corpCode: '00492054', stockCode: '068270', market: 'KOSPI' },
    '포스코홀딩스': { corpCode: '00138069', stockCode: '005490', market: 'KOSPI' },
    'KB금융': { corpCode: '00626907', stockCode: '105560', market: 'KOSPI' },
    '신한지주': { corpCode: '00382199', stockCode: '055550', market: 'KOSPI' },
    'SK텔레콤': { corpCode: '00164800', stockCode: '017670', market: 'KOSPI' },
    'KT': { corpCode: '00164784', stockCode: '030200', market: 'KOSPI' },
    '기아': { corpCode: '00270726', stockCode: '000270', market: 'KOSPI' },
    '삼성바이오로직스': { corpCode: '00823736', stockCode: '207940', market: 'KOSPI' },
    '카카오뱅크': { corpCode: '01085477', stockCode: '323410', market: 'KOSPI' },
    'LG에너지솔루션': { corpCode: '01011703', stockCode: '373220', market: 'KOSPI' },
    '하나금융지주': { corpCode: '00547583', stockCode: '086790', market: 'KOSPI' },
    '우리금융지주': { corpCode: '00856955', stockCode: '316140', market: 'KOSPI' },
    '현대모비스': { corpCode: '00164788', stockCode: '012330', market: 'KOSPI' },
    'SK이노베이션': { corpCode: '00631518', stockCode: '096770', market: 'KOSPI' },
    '엔씨소프트': { corpCode: '00258801', stockCode: '036570', market: 'KOSPI' },
    '크래프톤': { corpCode: '01348012', stockCode: '259960', market: 'KOSPI' },
    '두산에너빌리티': { corpCode: '00164013', stockCode: '034020', market: 'KOSPI' },
    '한화솔루션': { corpCode: '00265667', stockCode: '009830', market: 'KOSPI' },
    '삼성SDI': { corpCode: '00126362', stockCode: '006400', market: 'KOSPI' }
};

const FALLBACK_COMPANY_DIRECTORY = InvestmentLogic.buildCompanyDirectory(COMPANY_MAP);

const ACCOUNT_ALIASES = {
    revenue: ['매출액', '영업수익', '수익(매출액)', '보험영업수익'],
    operatingIncome: ['영업이익', '영업손실'],
    netIncome: ['당기순이익', '당기순손익', '분기순이익', '반기순이익', '연결당기순이익', '당기순이익(손실)'],
    assets: ['자산총계'],
    liabilities: ['부채총계'],
    equity: ['자본총계'],
    cash: ['현금및현금성자산', '현금성자산'],
    currentAssets: ['유동자산'],
    currentLiabilities: ['유동부채'],
    inventory: ['재고자산'],
    receivables: ['매출채권', '매출채권및기타채권', '매출채권 및 기타채권'],
    financeCost: ['이자비용', '금융비용', '금융원가']
};

const state = {
    company: null,
    annuals: [],
    quarterlies: [],
    reports: [],
    quote: null,
    quoteSource: 'idle',
    companyDirectory: FALLBACK_COMPANY_DIRECTORY,
    companyDirectoryLoaded: false,
    companyDirectoryPromise: null,
    chartDaily: [],
    chartWeekly: [],
    chartFullSeries: [],
    chartVisible: [],
    chartRange: 'DAY',
    chartWindow: null,
    chartDrag: null,
    techDrag: null,
    chartSource: 'idle',
    technicalsFull: null,
    technicalsFullSignature: '',
    searchQuery: '',
    searchMatches: [],
    searchMatchIndex: -1,
    technicals: null,
    ratings: null,
    metrics: null,
    summaries: [],
    briefingMode: 'idle',
    lastAnalysis: { fin: {}, scores: {}, totalPct: 0, metrics: {} },
    selectedIndicators: new Set(['RSI', 'MACD', 'STOCH', 'BOLL', 'MA']),
    analysisToken: 0
};

let xpData = JSON.parse(localStorage.getItem('invest_nav_xp') || '{"xp":0,"lv":1}');
let priceHoverIndex = null;

lucide.createIcons();

drawXP();
bindEvents();
startClock();
initKakao();
restoreKakaoSession();
consumeKakaoMessage();
loadMarketSummary();
loadCompanyDirectory();

function bindEvents() {
    const companyInput = document.getElementById('company-input');
    const suggestionBox = document.getElementById('company-suggestions');
    document.getElementById('search-btn').addEventListener('click', startSearch);
    companyInput.addEventListener('input', (event) => {
        updateCompanySuggestions(event.target.value);
    });
    companyInput.addEventListener('focus', (event) => {
        updateCompanySuggestions(event.target.value);
    });
    companyInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideCompanySuggestions();
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveCompanySuggestion(1);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveCompanySuggestion(-1);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            startSearch();
        }
    });
    suggestionBox.addEventListener('mousedown', (event) => {
        event.preventDefault();
    });
    suggestionBox.addEventListener('click', onSuggestionClick);
    document.getElementById('report-list').addEventListener('click', onReportListClick);
    document.getElementById('calc-btn').addEventListener('click', calcMetrics);
    document.getElementById('tech-refresh-btn').addEventListener('click', () => {
        if (!state.chartVisible.length) return;
        refreshTechnicals();
    });
    document.getElementById('pdf-btn').addEventListener('click', exportPdf);
    document.getElementById('btn-kakao-login').addEventListener('click', beginKakaoLogin);
    document.getElementById('btn-kakao-logout').addEventListener('click', logoutKakao);
    document.getElementById('kakao-send-btn').addEventListener('click', sendBriefingToKakao);
    document.getElementById('chart-range-controls').addEventListener('click', onChartRangeClick);
    document.getElementById('chart-reset-btn').addEventListener('click', resetChartZoom);
    document.getElementById('indicator-toggle').addEventListener('click', onIndicatorToggle);
    window.addEventListener('resize', debounce(() => {
        if (!document.getElementById('dashboard').classList.contains('hidden')) {
            renderCharts();
        }
    }, 120));
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.search-input-wrap')) {
            hideCompanySuggestions();
        }
    });
}

function addXP(amount) {
    xpData.xp += amount;
    while (xpData.xp >= XP_MAX) {
        xpData.xp -= XP_MAX;
        xpData.lv += 1;
    }
    localStorage.setItem('invest_nav_xp', JSON.stringify(xpData));
    drawXP();
}

function drawXP() {
    document.getElementById('level-badge').textContent = `Lv.${xpData.lv}`;
    document.getElementById('xp-bar').style.width = `${(xpData.xp / XP_MAX) * 100}%`;
    document.getElementById('xp-text').textContent = `${xpData.xp}/${XP_MAX}`;
}

function renderCompanySuggestions(rawQuery = '') {
    const query = String(rawQuery || '').trim();
    if (!query) {
        state.searchQuery = '';
        state.searchMatches = [];
        hideCompanySuggestions();
        return;
    }

    updateCompanySuggestions(query);
}

function updateCompanySuggestions(rawQuery = '') {
    const query = String(rawQuery || '').trim();
    state.searchQuery = query;
    state.searchMatchIndex = -1;

    if (!query) {
        state.searchMatches = [];
        hideCompanySuggestions();
        return;
    }

    state.searchMatches = InvestmentLogic.matchCompanies(state.companyDirectory, query, 8);

    if (!state.companyDirectoryLoaded) {
        loadCompanyDirectory();
    }

    renderCompanySuggestionList();
}

function renderCompanySuggestionList() {
    const container = document.getElementById('company-suggestions');
    const companyInput = document.getElementById('company-input');
    if (!state.searchMatches.length || document.activeElement !== companyInput) {
        hideCompanySuggestions();
        return;
    }

    container.innerHTML = state.searchMatches.map((company, index) => `
        <button type="button" class="company-option ${index === state.searchMatchIndex ? 'active' : ''}" data-stock-code="${company.stockCode}" data-index="${index}">
            <span class="company-option-name">${escapeHtml(company.name)}</span>
            <span class="company-option-code">${company.stockCode}</span>
        </button>
    `).join('');
    container.classList.remove('hidden');
}

function hideCompanySuggestions() {
    state.searchMatchIndex = -1;
    document.getElementById('company-suggestions').classList.add('hidden');
}

function onSuggestionClick(event) {
    const button = event.target.closest('.company-option');
    if (!button) return;
    selectCompanySuggestion(button.dataset.stockCode);
}

function selectCompanySuggestion(stockCode) {
    const selected = state.companyDirectory.find((item) => item.stockCode === stockCode);
    if (!selected) return;
    syncCompanyInputValue(companyFromDirectoryEntry(selected));
    hideCompanySuggestions();
}

function moveCompanySuggestion(step) {
    const companyInput = document.getElementById('company-input');
    if (!state.searchMatches.length) {
        updateCompanySuggestions(state.searchQuery || companyInput.value);
        if (!state.searchMatches.length) return;
    }

    state.searchMatchIndex = InvestmentLogic.moveSuggestionSelectionIndex(
        state.searchMatchIndex,
        state.searchMatches.length,
        step
    );
    const selected = state.searchMatches[state.searchMatchIndex];
    if (!selected) return;
    renderCompanySuggestionList();
    const activeButton = document.querySelector('.company-option.active');
    if (activeButton && typeof activeButton.scrollIntoView === 'function') {
        activeButton.scrollIntoView({ block: 'nearest' });
    }
}

function setStatus(message, tone = 'neutral') {
    const target = document.getElementById('search-status');
    target.textContent = message;
    target.className = 'search-status';
    if (tone === 'success') target.classList.add('good');
    if (tone === 'error') target.classList.add('bad');
    if (tone === 'warn') target.classList.add('warn');
}

function setSourceBadge(id, text, tone = 'neutral') {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'source-badge';
    if (tone === 'success') el.classList.add('good');
    if (tone === 'error') el.classList.add('bad');
    if (tone === 'warn') el.classList.add('warn');
}

function startClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const dateLabel = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(now);
    document.getElementById('market-datetime').textContent = dateLabel;
}

function setMarketChg(id, changePct) {
    const el = document.getElementById(id);
    if (!el) return;
    if (changePct === null || changePct === undefined) {
        el.textContent = '';
        el.className = 'market-chg';
        return;
    }
    const sign = changePct > 0 ? '+' : '';
    el.textContent = `${sign}${changePct.toFixed(2)}%`;
    el.className = `market-chg ${changePct > 0 ? 'up' : changePct < 0 ? 'down' : ''}`;
}

async function loadMarketSummary() {
    try {
        const data = await fetchJson(buildProxyUrl('market', '/summary'));
        if (data.usdKrw) {
            document.getElementById('fx-usdkrw').textContent = `${data.usdKrw.toFixed(2)}원`;
            document.getElementById('fx-usdkrw-note').textContent = '1달러 기준';
            setMarketChg('fx-usdkrw-chg', data.usdKrwChangePct ?? null);
        }
        if (data.jpyKrw) {
            document.getElementById('fx-jpykrw').textContent = `${(data.jpyKrw * 100).toFixed(2)}원`;
            document.getElementById('fx-jpykrw-note').textContent = '100엔 기준';
            setMarketChg('fx-jpykrw-chg', data.jpyKrwChangePct ?? null);
        }
        if (data.goldKrwPerGram) {
            document.getElementById('gold-krw').textContent = `${Math.round(data.goldKrwPerGram).toLocaleString()}원`;
            document.getElementById('gold-note').textContent = '금 1g 추정';
            setMarketChg('gold-chg', data.goldChangePct ?? null);
        } else {
            document.getElementById('gold-note').textContent = '외부 시세 연결 대기';
        }
        if (data.vix) {
            document.getElementById('vix-value').textContent = data.vix.toFixed(2);
            setMarketChg('vix-chg', data.vixChangePct ?? null);
            const vixLevel = data.vix < 15 ? '극도 낙관' : data.vix < 20 ? '안정' : data.vix < 30 ? '경계' : data.vix < 40 ? '공포' : '극도 공포';
            document.getElementById('vix-note').textContent = vixLevel;
        }
    } catch (error) {
        document.getElementById('fx-usdkrw-note').textContent = '연동 실패';
        document.getElementById('fx-jpykrw-note').textContent = '연동 실패';
        document.getElementById('gold-note').textContent = '연동 실패';
    }
}

function initKakao() {
    if (!window.Kakao) return;
    if (!Kakao.isInitialized()) {
        Kakao.init(KAKAO_JS_KEY);
    }
}

function beginKakaoLogin() {
    if (!window.Kakao) {
        alert('카카오 SDK를 불러오지 못했습니다.');
        return;
    }
    sessionStorage.setItem(KAKAO_STORAGE_RETURN_URL, location.href);
    Kakao.Auth.authorize({
        redirectUri: KAKAO_REDIRECT_URI
    });
}

async function restoreKakaoSession() {
    const accessToken = sessionStorage.getItem(KAKAO_STORAGE_TOKEN) || (window.Kakao ? Kakao.Auth.getAccessToken() : '');
    if (!window.Kakao || !accessToken) return;
    try {
        Kakao.Auth.setAccessToken(accessToken);
        sessionStorage.setItem(KAKAO_STORAGE_TOKEN, accessToken);
        const profile = await Kakao.API.request({ url: '/v2/user/me' });
        applyKakaoProfile(profile);
    } catch (error) {
        clearKakaoSession();
    }
}

async function logoutKakao() {
    if (window.Kakao && Kakao.Auth.getAccessToken()) {
        try {
            await Kakao.Auth.logout();
        } catch (error) {
            console.warn('Kakao logout failed', error);
        }
    }
    clearKakaoSession();
}

function clearKakaoSession() {
    InvestmentLogic.clearKakaoSessionState(sessionStorage, window.Kakao ? Kakao.Auth : null);
    document.getElementById('btn-kakao-login').classList.remove('hidden');
    document.getElementById('kakao-user-profile').classList.add('hidden');
    document.getElementById('kakao-nickname').textContent = '로그인됨';
    document.getElementById('kakao-login-state').textContent = '카카오 연동 활성화';
    document.getElementById('kakao-profile-img').removeAttribute('src');
}

function applyKakaoProfile(profile) {
    const nickname = profile?.properties?.nickname || '카카오 사용자';
    const image = profile?.properties?.thumbnail_image || '';
    document.getElementById('btn-kakao-login').classList.add('hidden');
    document.getElementById('kakao-user-profile').classList.remove('hidden');
    document.getElementById('kakao-nickname').textContent = nickname;
    document.getElementById('kakao-profile-img').src = image;
    addXP(8);
}

function consumeKakaoMessage() {
    const error = sessionStorage.getItem(KAKAO_STORAGE_ERROR);
    if (!error) return;
    setStatus(`카카오 로그인 안내: ${error}`, 'warn');
    sessionStorage.removeItem(KAKAO_STORAGE_ERROR);
}

async function sendBriefingToKakao() {
    if (!window.Kakao || !Kakao.Auth.getAccessToken()) {
        alert('카카오 로그인이 필요합니다.');
        return;
    }

    if (!state.company) {
        alert('먼저 기업 분석을 실행해주세요.');
        return;
    }

    const text = document.getElementById('briefing-content').innerText.replace(/\s+/g, ' ').trim().slice(0, 350);
    try {
        await Kakao.API.request({
            url: '/v2/api/talk/memo/default/send',
            data: {
                template_object: {
                    object_type: 'text',
                    text: `[Investment Navigator] ${state.company.name} 브리핑\n\n${text}`,
                    link: {
                        web_url: location.href,
                        mobile_web_url: location.href
                    }
                }
            }
        });
        addXP(5);
        alert('카카오톡 나에게 보내기가 완료되었습니다.');
    } catch (error) {
        alert('카카오톡 전송에 실패했습니다. 메시지 API 권한과 로그인 상태를 확인해주세요.');
    }
}

async function startSearch() {
    const companyInput = document.getElementById('company-input');
    const rawInput = companyInput.value.trim();
    let company = resolveCompany(rawInput, { exactOnly: true });
    if (!company) {
        company = resolvePreferredSuggestion(rawInput);
    }
    if (!company) {
        company = await resolveCompanyAsync(rawInput);
    }
    if (!company) {
        setStatus('기업명 또는 종목코드를 입력해주세요.', 'error');
        return;
    }

    syncCompanyInputValue(company);
    hideCompanySuggestions();
    const analysisToken = state.analysisToken + 1;
    state.analysisToken = analysisToken;
    state.company = company;
    state.annuals = [];
    state.quarterlies = [];
    state.reports = [];
    state.quote = null;
    state.quoteSource = 'idle';
    state.chartDaily = [];
    state.chartWeekly = [];
    state.chartRange = 'DAY';
    state.chartWindow = null;
    state.chartDrag = null;
    state.techDrag = null;
    state.chartFullSeries = [];
    state.chartVisible = [];
    state.chartSource = 'idle';
    state.technicals = null;
    state.technicalsFull = null;
    state.technicalsFullSignature = '';
    state.ratings = null;
    state.metrics = null;
    state.summaries = [];
    priceHoverIndex = null;
    setStatus(`${company.name} 분석을 시작합니다. DART, Yahoo Finance 시세와 다중 기간 차트를 동기화하는 중입니다.`);
    setSourceBadge('source-dart', 'DART 동기화 중');
    setSourceBadge('source-market', 'Yahoo Finance 동기화 중');
    setSourceBadge('source-gemini', 'Gemini 대기 중');

    document.getElementById('company-name').textContent = company.name;
    document.getElementById('company-meta').textContent = `${getCurrentYearKst()}년 기준 최근 3개년 실적과 Yahoo Finance (yfinance Python) 일·주·월·연/YTD 가격 흐름을 분석합니다.`;
    document.getElementById('dart-link').href = buildDartCompanySearchUrl(company);
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('stock-realtime').classList.add('hidden');
    document.getElementById('stock-realtime').innerHTML = '';
    renderReports([]);
    renderFinancialTable('fin-annual-table', []);
    renderFinancialTable('fin-quarterly-table', []);
    renderTechnicalCards();
    renderTechSummary();
    renderCharts();
    document.getElementById('chart-status').textContent = 'Yahoo Finance 차트 동기화 중';

    try {
        const startDate = `${getCurrentYearKst() - CHART_HISTORY_YEARS}0101`;
        const endDate = getCurrentDateTokenKst();
        const companyNameHint = buildCompanyNameHint(company);
        const dailyChartPromise = fetchYfinanceChart(company.stockCode, company.market, 'daily', startDate, endDate, companyNameHint)
            .catch((error) => ({ live: false, rows: [], error: error.message || 'Yahoo Finance 일봉 차트 요청 실패' }));
        const quotePromise = fetchYfinanceQuote(company.stockCode, company.market, companyNameHint)
            .catch((error) => ({ live: false, error: error.message || 'Yahoo Finance 현재가 요청 실패' }));
        const financialDataPromise = Promise.allSettled([
            fetchMultiYearDart(company.corpCode),
            fetchQuarterlyHistory(company.corpCode),
            fetchDartReportList(company.corpCode)
        ]);
        const dailyChartPayload = await dailyChartPromise;
        if (analysisToken !== state.analysisToken) return;

        const dailyPoints = dailyChartPayload.live
            ? InvestmentLogic.normalizeYfinanceChartRows(dailyChartPayload.rows, {
                startDate
            })
            : [];
        const cachedChart = readChartCache(company.stockCode);

        if (dailyPoints.length) {
            state.chartDaily = dailyPoints;
            state.chartWeekly = aggregateCandles(dailyPoints, 'week');
            state.chartSource = 'yfinance_python';
            writeChartCache(company.stockCode, state.chartDaily, state.chartWeekly);
            setSourceBadge('source-market', 'Yahoo Finance 차트 연동됨', 'success');
        } else if (cachedChart) {
            state.chartDaily = cachedChart.daily;
            state.chartWeekly = cachedChart.weekly.length ? cachedChart.weekly : aggregateCandles(cachedChart.daily, 'week');
            state.chartSource = 'cache';
            setSourceBadge('source-market', 'Yahoo Finance 실패 · 저장된 마지막 차트 사용', 'warn');
        } else {
            state.chartDaily = [];
            state.chartWeekly = [];
            state.chartSource = 'unavailable';
            setSourceBadge('source-market', dailyChartPayload.error || 'Yahoo Finance 차트를 불러오지 못했습니다.', 'error');
        }

        const latestChartPoint = state.chartDaily[state.chartDaily.length - 1] || null;
        if (latestChartPoint) {
            state.quoteSource = state.chartSource === 'cache' ? 'cache' : 'yfinance_chart';
        }
        renderStockStrip(null, latestChartPoint);
        refreshTechnicals(false);
        renderCharts();
        document.getElementById('chart-status').textContent = formatChartSourceStatus();
        setStatus(`${company.name} 차트를 먼저 표시했습니다. DART 재무와 브리핑을 이어서 정리하는 중입니다.`);

        const [annualsResult, quarterliesResult, reportsResult] = await financialDataPromise;
        if (analysisToken !== state.analysisToken) return;

        state.reports = reportsResult.status === 'fulfilled' ? reportsResult.value : [];
        renderReports(state.reports);

        if (annualsResult.status === 'fulfilled' && annualsResult.value.length) {
            state.annuals = annualsResult.value;
            state.quarterlies = quarterliesResult.status === 'fulfilled' ? quarterliesResult.value : [];
            state.summaries = state.annuals.map((item) => ({
                ...item,
                summary: summarizeStatement(item.list)
            }));
            renderFinancialTable('fin-annual-table', state.annuals);
            renderFinancialTable('fin-quarterly-table', state.quarterlies);
            const valuationSnapshot = state.quote || latestChartPoint || null;
            autoFillMetrics(state.summaries[0]?.summary || {}, valuationSnapshot);
            calcMetrics();
            buildRatings();
            setSourceBadge('source-dart', 'DART 공시 연동됨', 'success');
        } else {
            state.annuals = [];
            state.quarterlies = quarterliesResult.status === 'fulfilled' ? quarterliesResult.value : [];
            state.summaries = [];
            renderFinancialTable('fin-annual-table', []);
            renderFinancialTable('fin-quarterly-table', state.quarterlies);
            setSourceBadge('source-dart', 'DART 재무제표를 불러오지 못했습니다.', 'error');
        }

        const quotePayload = await quotePromise;
        if (analysisToken !== state.analysisToken) return;
        const resolvedMarket = quotePayload?.market || dailyChartPayload?.market || '';
        if (resolvedMarket && resolvedMarket !== 'AUTO') {
            state.company.market = resolvedMarket;
        }
        state.quote = quotePayload?.live
            ? InvestmentLogic.normalizeYfinanceQuote(quotePayload, quotePayload.fetched_at || '')
            : null;
        if (state.quote) {
            state.quoteSource = 'yfinance_python';
            setSourceBadge('source-market', 'Yahoo Finance 시세 연동됨', 'success');
        }
        renderStockStrip(state.quote, latestChartPoint);
        if (state.summaries.length) {
            autoFillMetrics(state.summaries[0]?.summary || {}, state.quote || latestChartPoint || null);
            calcMetrics();
            buildRatings();
        }

        addXP(18);
        if (state.summaries.length) {
            await generateBriefing();
            if (analysisToken !== state.analysisToken) return;
        } else {
            setSourceBadge('source-gemini', 'Gemini 대기', 'warn');
        }

        setStatus(`${company.name} 분석이 완료되었습니다.`, 'success');
        document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        console.error(error);
        setStatus(error.message || '분석 중 알 수 없는 오류가 발생했습니다.', 'error');
        setSourceBadge('source-dart', 'DART 실패', 'error');
        setSourceBadge('source-gemini', 'Gemini 대기', 'warn');
    }
}

async function loadCompanyDirectory(force = false) {
    if (state.companyDirectoryLoaded && !force) {
        return state.companyDirectory;
    }
    if (state.companyDirectoryPromise && !force) {
        return state.companyDirectoryPromise;
    }

    const request = fetchJson(buildProxyUrl('company-directory', '', {}, 'company_directory'))
        .then((payload) => {
            const remoteDirectory = Array.isArray(payload?.directory) ? payload.directory : [];
            if (remoteDirectory.length) {
                state.companyDirectory = InvestmentLogic.mergeCompanyDirectories(remoteDirectory, FALLBACK_COMPANY_DIRECTORY);
                state.companyDirectoryLoaded = true;
            }
            return state.companyDirectory;
        })
        .catch((error) => {
            console.warn('company directory load failed', error);
            return state.companyDirectory;
        })
        .finally(() => {
            state.companyDirectoryPromise = null;
            const companyInput = document.getElementById('company-input');
            if (document.activeElement === companyInput && companyInput.value.trim()) {
                updateCompanySuggestions(state.searchQuery || companyInput.value);
            }
        });

    state.companyDirectoryPromise = request;
    return request;
}

async function resolveCompanyAsync(input) {
    let company = resolveCompany(input);
    if (company || state.companyDirectoryLoaded) return company;
    await loadCompanyDirectory();
    company = resolveCompany(input);
    return company;
}

function buildCompanyNameHint(company) {
    const aliases = Array.isArray(company?.aliases) ? company.aliases : [];
    return Array.from(new Set(
        [company?.name, ...aliases]
            .map((item) => String(item || '').trim())
            .filter(Boolean)
    )).join('|');
}

function companyFromDirectoryEntry(entry) {
    if (!entry) return null;
    return {
        name: entry.name,
        corpCode: entry.corpCode,
        stockCode: entry.stockCode,
        market: entry.market,
        aliases: entry.aliases || []
    };
}

function syncCompanyInputValue(company) {
    if (!company) return;
    const companyInput = document.getElementById('company-input');
    const directory = state.companyDirectory.length ? state.companyDirectory : FALLBACK_COMPANY_DIRECTORY;
    const matched = directory.find((item) => (
        item.stockCode === company.stockCode
        || (item.corpCode && item.corpCode === company.corpCode)
    ));
    if (matched) {
        companyInput.value = matched.displayLabel;
        return;
    }
    if (company.name && company.stockCode) {
        companyInput.value = `${company.name} · ${company.stockCode}`;
        return;
    }
    if (company.name) {
        companyInput.value = company.name;
    }
}

function resolvePreferredSuggestion(rawInput) {
    const selected = state.searchMatchIndex >= 0 ? state.searchMatches[state.searchMatchIndex] : null;
    if (selected) return companyFromDirectoryEntry(selected);

    const trailing = state.searchMatches.length
        ? state.searchMatches[state.searchMatches.length - 1]
        : InvestmentLogic.pickTrailingCompanyMatch(state.companyDirectory, rawInput, 8);
    return companyFromDirectoryEntry(trailing);
}

function resolveCompany(input, options = {}) {
    const exactOnly = Boolean(options?.exactOnly);
    if (!input) return null;
    const directory = state.companyDirectory.length ? state.companyDirectory : FALLBACK_COMPANY_DIRECTORY;

    const stockCode = (input.match(/\b(\d{6})\b/) || [])[1];
    if (stockCode) {
        const matchByStock = directory.find((item) => item.stockCode === stockCode);
        if (matchByStock) {
            return companyFromDirectoryEntry(matchByStock);
        }
    }

    const exactNameMatch = directory.find((item) => (
        item.name === input
        || item.displayLabel === input
        || (item.aliases || []).includes(input)
    ));
    if (exactNameMatch) {
        return companyFromDirectoryEntry(exactNameMatch);
    }

    if (exactOnly) {
        return null;
    }

    const fuzzyMatch = InvestmentLogic.matchCompanies(directory, input, 1)[0];
    if (fuzzyMatch) {
        return companyFromDirectoryEntry(fuzzyMatch);
    }

    if (/^\d{8}$/.test(input)) {
        return { name: input, corpCode: input, stockCode: input.slice(-6), market: 'KOSPI' };
    }

    return null;
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
        const message = typeof data === 'object'
            ? (typeof data.error === 'string' ? data.error : data.error?.message || data.message || response.statusText)
            : response.statusText;
        throw new Error(message);
    }
    return data;
}

function buildProxyUrl(service, endpoint = '', params = {}, productionAction = service) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, value);
        }
    });

    if (isLocal) {
        const base = `${LOCAL_PROXY}/${service}${endpoint}`;
        return query.toString() ? `${base}?${query.toString()}` : base;
    }

    query.set('action', productionAction);
    if (endpoint) query.set('endpoint', endpoint);
    return `${PROD_PROXY}?${query.toString()}`;
}

function buildProxyPostUrl(service, endpoint = '', productionAction = service) {
    if (isLocal) return `${LOCAL_PROXY}/${service}${endpoint}`;
    const query = new URLSearchParams({ action: productionAction });
    if (endpoint) query.set('endpoint', endpoint);
    return `${PROD_PROXY}?${query.toString()}`;
}

function chartCacheKey(stockCode) {
    return `invest_nav_chart_cache_v42_${getCurrentYearKst()}_${stockCode}`;
}

function readChartCache(stockCode) {
    try {
        const raw = localStorage.getItem(chartCacheKey(stockCode));
        if (!raw) return null;
        const payload = JSON.parse(raw);
        if (!Array.isArray(payload?.daily) || !payload.daily.length) return null;
        return {
            daily: payload.daily,
            weekly: Array.isArray(payload.weekly) ? payload.weekly : [],
            savedAt: payload.savedAt || ''
        };
    } catch (error) {
        return null;
    }
}

function writeChartCache(stockCode, daily, weekly) {
    try {
        localStorage.setItem(chartCacheKey(stockCode), JSON.stringify({
            savedAt: new Date().toISOString(),
            daily,
            weekly
        }));
    } catch (error) {
        console.warn('chart cache write failed', error);
    }
}

async function fetchMultiYearDart(corpCode) {
    const currentYear = getCurrentYearKst();
    const years = [currentYear, currentYear - 1, currentYear - 2];
    const results = [];

    for (const year of years) {
        const candidates = [
            { code: '11011', label: `${year} 사업보고서`, period: 'ANNUAL' },
            { code: '11014', label: `${year} 3분기`, period: 'Q3' },
            { code: '11012', label: `${year} 반기`, period: 'Q2' },
            { code: '11013', label: `${year} 1분기`, period: 'Q1' }
        ];

        let found = null;
        for (const candidate of candidates) {
            try {
                const data = await fetchJson(buildProxyUrl('dart', '/fnlttSinglAcnt.json', {
                    corp_code: corpCode,
                    bsns_year: year,
                    reprt_code: candidate.code
                }));
                if (data.status === '000' && Array.isArray(data.list) && data.list.length) {
                    found = { year, label: candidate.label, period: candidate.period, list: data.list };
                    break;
                }
            } catch (error) {
                continue;
            }
        }
        if (found) results.push(found);
    }
    return results;
}

async function fetchQuarterlyHistory(corpCode) {
    const currentYear = getCurrentYearKst();
    const results = [];
    const reportCodes = InvestmentLogic.getQuarterlyReportConfigs();

    for (let year = currentYear; year >= currentYear - 2; year -= 1) {
        for (const report of reportCodes) {
            try {
                const data = await fetchJson(buildProxyUrl('dart', '/fnlttSinglAcnt.json', {
                    corp_code: corpCode,
                    bsns_year: year,
                    reprt_code: report.code
                }));
                if (data.status === '000' && Array.isArray(data.list) && data.list.length) {
                    results.push({
                        year,
                        label: `${year} ${report.annual ? '4분기(사업보고서)' : report.label}`,
                        period: `Q${report.rank}`,
                        sortKey: year * 10 + report.rank,
                        isAnnual: Boolean(report.annual),
                        list: data.list
                    });
                }
            } catch (error) {
                continue;
            }
        }
    }

    return InvestmentLogic.sortPeriods(results);
}

async function fetchDartReportList(corpCode) {
    const currentYear = getCurrentYearKst();
    const bgn = `${currentYear - 2}0101`;
    const end = `${currentYear}1231`;
    let page = 1;
    let totalPages = 1;
    const relevantReports = [];
    const seenReceiptNumbers = new Set();

    while (page <= totalPages && relevantReports.length < 12) {
        const data = await fetchJson(buildProxyUrl('dart', '/list.json', {
            corp_code: corpCode,
            bgn_de: bgn,
            end_de: end,
            page_count: 100,
            page_no: page
        }));
        if (data.status !== '000' || !Array.isArray(data.list)) {
            break;
        }

        totalPages = Math.max(page, Number(data.total_page) || 1);
        data.list
            .filter((item) => /사업보고서|반기보고서|분기보고서/.test(item.report_nm))
            .forEach((item) => {
                const receiptNumber = String(item.rcept_no || '').trim();
                if (!receiptNumber || seenReceiptNumbers.has(receiptNumber)) return;
                seenReceiptNumbers.add(receiptNumber);
                relevantReports.push({
                    title: item.report_nm,
                    date: item.rcept_dt,
                    type: item.report_nm.includes('사업') ? '사업보고서' : item.report_nm.includes('반기') ? '반기보고서' : '분기보고서',
                    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receiptNumber}`
                });
            });

        page += 1;
    }

    return relevantReports
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 12);
}

function formatChartSourceStatus() {
    const coverage = state.chartVisible.length && state.chartFullSeries.length
        ? ` · ${state.chartVisible.length}/${state.chartFullSeries.length}봉`
        : '';
    if (state.chartSource === 'yfinance_python') {
        return `Yahoo Finance (yfinance Python) 차트${coverage}`;
    }
    if (state.chartSource === 'cache') {
        return `저장된 마지막 Yahoo Finance 차트${coverage}`;
    }
    return 'Yahoo Finance 차트가 연결되지 않아 가격 차트를 표시하지 못하고 있습니다.';
}

function formatChartSourceName() {
    if (state.chartSource === 'yfinance_python') {
        return 'Yahoo Finance (yfinance Python)';
    }
    if (state.chartSource === 'cache') {
        return '저장된 마지막 Yahoo Finance 차트';
    }
    return '차트 미연결';
}

function formatQuoteSourceText() {
    if (state.quoteSource === 'yfinance_python') {
        return 'Yahoo Finance (yfinance Python) 현재가 기준';
    }
    if (state.quoteSource === 'yfinance_chart') {
        return '최근 Yahoo Finance 차트 기준';
    }
    if (state.quoteSource === 'cache') {
        return '저장된 마지막 Yahoo Finance 차트 기준';
    }
    return '최근 차트 기준';
}

async function fetchYfinanceQuote(stockCode, market, nameHint = '') {
    return fetchJson(buildProxyUrl('yfinance', '/quote', {
        stock_code: stockCode,
        market,
        name_hint: nameHint
    }, 'yfinance_quote'));
}

async function fetchYfinanceChart(stockCode, market, interval, startDate, endDate, nameHint = '') {
    return fetchJson(buildProxyUrl('yfinance', '/chart', {
        stock_code: stockCode,
        market,
        interval,
        start_date: startDate,
        end_date: endDate,
        name_hint: nameHint
    }, 'yfinance_chart'));
}

function buildDartCompanySearchUrl(company) {
    const name = String(company?.name || '').trim();
    const corpCode = String(company?.corpCode || '').trim();
    if (!name && !corpCode) {
        return 'https://dart.fss.or.kr/dsab007/main.do';
    }

    const currentYear = getCurrentYearKst();
    const startDate = `${currentYear - 2}0101`;
    const endDate = `${currentYear}1231`;
    const encodedName = encodeURIComponent(name);
    const encodedCorpCode = encodeURIComponent(corpCode);

    return `https://dart.fss.or.kr/dsab007/main.do?autoSearch=Y&currentPage=1&maxResults=100&maxLinks=10&sort=&series=&option=corp&selectKey=&textCrpCik=${encodedCorpCode}&textCrpNm=${encodedName}&startDate=${startDate}&endDate=${endDate}`;
}

function buildFinancialRows(periods) {
    return periods.map((period) => ({
        ...period,
        summary: summarizeStatement(period.list)
    }));
}

function summarizeStatement(list) {
    const revenue = findAmount(list, ACCOUNT_ALIASES.revenue);
    const operatingIncome = findAmount(list, ACCOUNT_ALIASES.operatingIncome);
    const netIncome = findAmount(list, ACCOUNT_ALIASES.netIncome);
    const assets = findAmount(list, ACCOUNT_ALIASES.assets);
    const liabilities = findAmount(list, ACCOUNT_ALIASES.liabilities);
    const equity = findAmount(list, ACCOUNT_ALIASES.equity);
    const cash = findAmount(list, ACCOUNT_ALIASES.cash);
    const currentAssets = findAmount(list, ACCOUNT_ALIASES.currentAssets);
    const currentLiabilities = findAmount(list, ACCOUNT_ALIASES.currentLiabilities);
    const inventory = findAmount(list, ACCOUNT_ALIASES.inventory);
    const receivables = findAmount(list, ACCOUNT_ALIASES.receivables);
    const financeCost = findAmount(list, ACCOUNT_ALIASES.financeCost);

    const operatingMargin = percentage(operatingIncome, revenue);
    const netMargin = percentage(netIncome, revenue);
    const debtRatio = percentage(liabilities, equity);
    const roe = percentage(netIncome, equity);
    const roa = percentage(netIncome, assets);
    const assetTurnover = safeDivide(revenue, assets);
    const currentRatio = percentage(currentAssets, currentLiabilities);
    const inventoryTurnover = safeDivide(revenue, inventory);
    const receivableTurnover = safeDivide(revenue, receivables);
    const interestCoverage = financeCost ? safeDivide(operatingIncome, Math.abs(financeCost)) : null;

    return {
        revenue,
        operatingIncome,
        netIncome,
        assets,
        liabilities,
        equity,
        cash,
        currentAssets,
        currentLiabilities,
        inventory,
        receivables,
        financeCost,
        operatingMargin,
        netMargin,
        debtRatio,
        roe,
        roa,
        assetTurnover,
        currentRatio,
        inventoryTurnover,
        receivableTurnover,
        interestCoverage
    };
}

function findAmount(list, aliases) {
    const normalizedAliases = aliases.map(normalizeAccountName);
    const match = list.find((item) => {
        const name = normalizeAccountName(item.account_nm || '');
        return normalizedAliases.some((alias) => name.includes(alias));
    });
    if (!match) return 0;
    return parseAmount(match.thstrm_amount);
}

function parseAmount(rawValue) {
    if (rawValue === null || rawValue === undefined) return 0;
    const value = String(rawValue).replace(/,/g, '').trim();
    if (!value || value === '-') return 0;
    const negative = value.includes('(') && value.includes(')');
    const numeric = Number(value.replace(/[()]/g, ''));
    if (Number.isNaN(numeric)) return 0;
    return negative ? -numeric : numeric;
}

function normalizeAccountName(value) {
    return String(value).replace(/\s+/g, '').replace(/[()]/g, '');
}

function renderReports(reports) {
    const container = document.getElementById('report-list');
    if (!reports.length) {
        container.innerHTML = '<div class="report-item">최근 3년 공시 리포트를 찾지 못했습니다.</div>';
        return;
    }

    const groupedReports = InvestmentLogic.groupReportsBySection(reports);
    const annualSection = renderReportSection(
        '사업보고서',
        '최근 3년 사업보고서를 최신 공시 순으로 정리했습니다.',
        groupedReports.annualReports.length
            ? renderReportItems(groupedReports.annualReports)
            : '<div class="report-item">최근 3년 사업보고서를 찾지 못했습니다.</div>'
    );
    const quarterlySection = renderReportSection(
        '분기보고서',
        '반기보고서를 포함해 연도별로 열고 닫을 수 있습니다.',
        groupedReports.quarterlyYears.length
            ? groupedReports.quarterlyYears.map((group, index) => renderQuarterlyReportYearGroup(group, index === 0)).join('')
            : '<div class="report-item">최근 3년 분기·반기보고서를 찾지 못했습니다.</div>'
    );

    container.innerHTML = `${annualSection}${quarterlySection}`;
}

function renderReportSection(title, description, bodyHtml) {
    return `
        <section class="report-section">
            <button
                type="button"
                class="report-section-toggle"
                aria-expanded="false"
            >
                <span>
                    <div class="report-section-title">${escapeHtml(title)}</div>
                    <div class="report-section-copy">${escapeHtml(description)}</div>
                </span>
                <span class="report-year-chevron" aria-hidden="true">▾</span>
            </button>
            <div class="report-section-body hidden">${bodyHtml}</div>
        </section>
    `;
}

function renderQuarterlyReportYearGroup(group, expanded) {
    return `
        <section class="report-year-group">
            <button
                type="button"
                class="report-year-toggle"
                data-report-year="${escapeHtml(group.year)}"
                aria-expanded="${expanded ? 'true' : 'false'}"
            >
                <span class="report-year-copy">
                    <span class="report-year-title">${escapeHtml(group.year)}년</span>
                    <span class="report-year-count">${group.reports.length}건</span>
                </span>
                <span class="report-year-chevron" aria-hidden="true">▾</span>
            </button>
            <div class="report-year-panel hidden">
                ${renderReportItems(group.reports)}
            </div>
        </section>
    `;
}

function renderReportItems(reports) {
    return reports.map((report) => `
        <a class="report-item" href="${report.url}" target="_blank" rel="noreferrer">
            <div class="report-head">
                <div>
                    <div class="report-title">${escapeHtml(report.title)}</div>
                    <div class="report-date">${formatDateToken(report.date)}</div>
                </div>
                <span class="report-type">${report.type}</span>
            </div>
        </a>
    `).join('');
}

function onReportListClick(event) {
    const sectionToggle = event.target.closest('.report-section-toggle');
    if (sectionToggle) {
        const sectionPanel = sectionToggle.nextElementSibling;
        if (!sectionPanel) return;
        const sectionExpanded = sectionToggle.getAttribute('aria-expanded') === 'true';
        sectionToggle.setAttribute('aria-expanded', sectionExpanded ? 'false' : 'true');
        sectionPanel.classList.toggle('hidden', sectionExpanded);
        return;
    }

    const toggle = event.target.closest('.report-year-toggle');
    if (!toggle) return;

    const panel = toggle.nextElementSibling;
    if (!panel) return;

    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    panel.classList.toggle('hidden', expanded);
}

function renderFinancialTable(containerId, periods) {
    const container = document.getElementById(containerId);
    if (!periods.length) {
        container.innerHTML = '<div class="report-item">해당 기간 데이터를 찾지 못했습니다.</div>';
        return;
    }

    const summaries = buildFinancialRows(periods);
    const rows = [
        { label: '매출액', key: 'revenue', type: 'money' },
        { label: '영업이익', key: 'operatingIncome', type: 'money' },
        { label: '당기순이익', key: 'netIncome', type: 'money' },
        { label: '자산총계', key: 'assets', type: 'money' },
        { label: '부채총계', key: 'liabilities', type: 'money' },
        { label: '자본총계', key: 'equity', type: 'money' },
        { label: '영업이익률', key: 'operatingMargin', type: 'pct' },
        { label: '부채비율', key: 'debtRatio', type: 'pct' },
        { label: 'ROE', key: 'roe', type: 'pct' }
    ];

    const headerCells = summaries.map((period) => `<th>${period.label}</th>`).join('');
    const body = rows.map((row) => {
        const cells = summaries.map((period, i) => {
            const current = period.summary[row.key];
            const prev = summaries[i + 1]?.summary[row.key];
            const growth = computeGrowth(current, prev);
            const chgClass = growth > 0 ? 'good' : growth < 0 ? 'bad' : '';
            const chgText = growth === null
                ? ''
                : `<span class="fin-chg ${chgClass}">${growth > 0 ? '+' : ''}${growth.toFixed(1)}%</span>`;
            return `<td><span class="fin-val">${formatMetricValue(current, row.type)}</span>${chgText}</td>`;
        }).join('');
        return `<tr><td>${row.label}</td>${cells}</tr>`;
    }).join('');

    container.innerHTML = `
        <table class="fin-table">
            <thead>
                <tr>
                    <th>항목</th>
                    ${headerCells}
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
    `;
}

function renderStockStrip(quote, chartPoint) {
    const snapshot = quote || chartPoint;
    if (!snapshot) return;
    const price = snapshot.close;
    const open = snapshot.open ?? chartPoint?.open ?? 0;
    const high = snapshot.high ?? chartPoint?.high ?? 0;
    const low = snapshot.low ?? chartPoint?.low ?? 0;
    const volume = snapshot.volume ?? chartPoint?.volume ?? 0;
    const change = snapshot.change ?? (snapshot.close - (snapshot.open || chartPoint?.open || snapshot.close));
    const basePrice = snapshot.open || chartPoint?.open || snapshot.close;
    const changePct = snapshot.changePct ?? percentage(change, basePrice);
    const className = change > 0 ? 'up' : change < 0 ? 'down' : '';
    const sign = change > 0 ? '+' : '';
    const sourceText = formatQuoteSourceText();
    const previousClose = snapshot.previousClose ?? (Number.isFinite(price) && Number.isFinite(change) ? price - change : null);
    const openDelta = InvestmentLogic.describePriceDelta(open, previousClose);
    const highDelta = InvestmentLogic.describePriceDelta(high, previousClose);
    const lowDelta = InvestmentLogic.describePriceDelta(low, previousClose);
    const priceSub = `${sign}${change.toLocaleString()}원 (${changePct.toFixed(2)}%)${snapshot.asOf ? ` · ${formatQuoteTime(snapshot.asOf)}` : ''}`;
    document.getElementById('stock-realtime').classList.remove('hidden');
    document.getElementById('stock-realtime').innerHTML = `
        <div class="ss-item">
            <div class="ss-label">현재가</div>
            <div class="ss-val ${className}">${price.toLocaleString()}원</div>
            <div class="ss-sub ${className}">${priceSub}</div>
        </div>
        <div class="ss-item">
            <div class="ss-label">시가</div>
            <div class="ss-val">${open ? `${open.toLocaleString()}원` : '-'}</div>
            <div class="ss-sub ${openDelta.direction === 'up' ? 'up' : openDelta.direction === 'down' ? 'down' : ''}">${open ? formatStripDeltaText(openDelta) : '시가 데이터 없음'}</div>
        </div>
        <div class="ss-item">
            <div class="ss-label">고가</div>
            <div class="ss-val good">${high ? `${high.toLocaleString()}원` : '-'}</div>
            <div class="ss-sub ${highDelta.direction === 'up' ? 'up' : highDelta.direction === 'down' ? 'down' : ''}">${high ? formatStripDeltaText(highDelta) : '고가 데이터 없음'}</div>
        </div>
        <div class="ss-item">
            <div class="ss-label">저가</div>
            <div class="ss-val bad">${low ? `${low.toLocaleString()}원` : '-'}</div>
            <div class="ss-sub ${lowDelta.direction === 'up' ? 'up' : lowDelta.direction === 'down' ? 'down' : ''}">${low ? formatStripDeltaText(lowDelta) : '저가 데이터 없음'}</div>
        </div>
        <div class="ss-item">
            <div class="ss-label">거래량</div>
            <div class="ss-val">${volume ? formatCompact(volume) : '-'}</div>
            <div class="ss-sub">${volume ? sourceText : '거래량 데이터 없음'}</div>
        </div>
    `;
}

function formatStripDeltaText(delta) {
    if (delta.change === null || delta.changePct === null) {
        return '전일 대비 정보 없음';
    }
    const sign = delta.change > 0 ? '+' : '';
    return `전일 대비 ${sign}${delta.change.toLocaleString()}원 (${sign}${delta.changePct.toFixed(2)}%)`;
}

function autoFillMetrics(summary, lastTrade) {
    document.getElementById('m-price').value = lastTrade?.close || 0;
    document.getElementById('m-shares').value = lastTrade?.listedShares || 0;
    document.getElementById('m-expected-op').value = Math.max(summary.operatingIncome || 0, 0);
    document.getElementById('m-target-per').value = 15;
    state.lastAnalysis.fin = {
        rev: summary.revenue || 0,
        op: summary.operatingIncome || 0,
        net: summary.netIncome || 0,
        eq: summary.equity || 0,
        debt: summary.liabilities || 0,
        assets: summary.assets || 0
    };
}

function calcMetrics() {
    const price = Number(document.getElementById('m-price').value) || 0;
    const shares = Number(document.getElementById('m-shares').value) || 0;
    const expectedOp = Number(document.getElementById('m-expected-op').value) || 0;
    const targetPer = Number(document.getElementById('m-target-per').value) || 15;
    const fin = state.lastAnalysis.fin;

    const eps = safeDivide(fin.net, shares);
    const per = safeDivide(price, eps);
    const roe = percentage(fin.net, fin.eq);
    const debtRatio = percentage(fin.debt, fin.eq);
    const operatingMargin = percentage(fin.op, fin.rev);
    const targetPrice = shares ? Math.round(((expectedOp > 0 ? expectedOp : fin.net) * targetPer) / shares) : 0;
    const upside = percentage(targetPrice - price, price);

    state.lastAnalysis.metrics = { per, roe, debtR: debtRatio, opM: operatingMargin, targetPrice, upside };
    state.metrics = state.lastAnalysis.metrics;

    const items = [
        { label: 'EPS', value: `${Math.round(eps || 0).toLocaleString()}원`, hint: '순이익 / 상장주식수' },
        { label: '현재 PER', value: per ? `${per.toFixed(1)}배` : '-', tone: per && per <= targetPer ? 'good' : per && per <= targetPer * 1.4 ? 'warn' : 'bad', hint: `목표 PER ${targetPer}배 기준` },
        { label: 'ROE', value: `${roe.toFixed(1)}%`, tone: roe > 12 ? 'good' : roe > 8 ? 'warn' : 'bad', hint: '당기순이익 / 자본' },
        { label: '영업이익률', value: `${operatingMargin.toFixed(1)}%`, tone: operatingMargin > 10 ? 'good' : operatingMargin > 5 ? 'warn' : 'bad', hint: '영업이익 / 매출액' },
        { label: '부채비율', value: `${debtRatio.toFixed(1)}%`, tone: debtRatio < 100 ? 'good' : debtRatio < 180 ? 'warn' : 'bad', hint: '부채총계 / 자본총계' },
        { label: '적정주가', value: targetPrice ? `${targetPrice.toLocaleString()}원` : '-', hint: '예상 영업이익 x 목표 PER' },
        { label: '상승여력', value: `${upside > 0 ? '+' : ''}${upside.toFixed(1)}%`, tone: upside > 0 ? 'good' : 'bad', hint: '적정주가 대비' }
    ];

    document.getElementById('metrics-grid').innerHTML = items.map((item) => `
        <div class="metric-tile">
            <div class="mt-label">${item.label}</div>
            <div class="mt-value ${item.tone || ''}">${item.value}</div>
            <div class="mt-hint">${item.hint}</div>
        </div>
    `).join('');
}

function buildRatings() {
    const current = state.summaries[0]?.summary;
    const previous = state.summaries[1]?.summary;
    if (!current) return;

    const comparableQuarterlies = state.quarterlies.filter((item) => !item.isAnnual);
    const latestQuarter = comparableQuarterlies[0] ? summarizeStatement(comparableQuarterlies[0].list) : null;
    const previousQuarter = comparableQuarterlies[1] ? summarizeStatement(comparableQuarterlies[1].list) : null;

    const revenueGrowth = computeGrowth(current.revenue, previous?.revenue);
    const opGrowth = computeGrowth(current.operatingIncome, previous?.operatingIncome);
    const equityGrowth = computeGrowth(current.equity, previous?.equity);
    const quarterNetGrowth = latestQuarter ? computeGrowth(latestQuarter.netIncome, previousQuarter?.netIncome) : null;

    const profitabilityScore = scoreByRules([
        current.operatingMargin >= 12,
        current.netMargin >= 8,
        current.roe >= 10,
        opGrowth !== null && opGrowth > 0,
        quarterNetGrowth !== null && quarterNetGrowth > 0
    ]);

    const stabilityScore = scoreByRules([
        current.debtRatio <= 100,
        current.currentRatio >= 100,
        current.cash > 0,
        current.interestCoverage !== null && current.interestCoverage >= 4,
        equityGrowth !== null && equityGrowth >= 0
    ]);

    const efficiencyScore = scoreByRules([
        current.roa >= 5,
        current.assetTurnover >= 0.6,
        current.inventoryTurnover === null || current.inventoryTurnover >= 1,
        current.receivableTurnover === null || current.receivableTurnover >= 1,
        revenueGrowth !== null && revenueGrowth > 0
    ]);

    state.ratings = {
        profitability: {
            icon: '💰',
            title: '수익성',
            score: profitabilityScore,
            sub: `영업이익률 ${current.operatingMargin.toFixed(1)}%, ROE ${current.roe.toFixed(1)}%`,
            reasons: [
                `영업이익률 ${current.operatingMargin.toFixed(1)}%`,
                `순이익률 ${current.netMargin.toFixed(1)}%`,
                `연간 영업이익 성장률 ${formatNullablePct(opGrowth)}`,
                `최근 분기 순이익 증감률 ${formatNullablePct(quarterNetGrowth)}`
            ]
        },
        stability: {
            icon: '🛡️',
            title: '건전성',
            score: stabilityScore,
            sub: `부채비율 ${current.debtRatio.toFixed(1)}%, 유동비율 ${current.currentRatio.toFixed(1)}%`,
            reasons: [
                `부채비율 ${current.debtRatio.toFixed(1)}%`,
                `유동비율 ${current.currentRatio.toFixed(1)}%`,
                `현금 및 현금성자산 ${formatMetricValue(current.cash, 'money')}`,
                `이자보상배율 ${current.interestCoverage === null ? '-' : `${current.interestCoverage.toFixed(1)}배`}`
            ]
        },
        efficiency: {
            icon: '⚙️',
            title: '효율성',
            score: efficiencyScore,
            sub: `ROA ${current.roa.toFixed(1)}%, 자산회전율 ${current.assetTurnover.toFixed(2)}회`,
            reasons: [
                `ROA ${current.roa.toFixed(1)}%`,
                `자산회전율 ${current.assetTurnover.toFixed(2)}회`,
                `재고회전율 ${current.inventoryTurnover ? `${current.inventoryTurnover.toFixed(2)}회` : '-'}`,
                `매출채권회전율 ${current.receivableTurnover ? `${current.receivableTurnover.toFixed(2)}회` : '-'}`
            ]
        }
    };

    const ratingEntries = Object.values(state.ratings);
    const average = ratingEntries.reduce((sum, entry) => sum + entry.score, 0) / ratingEntries.length;
    const totalPct = Math.round((average / 5) * 100);
    state.lastAnalysis.scores = {
        profit: state.ratings.profitability.score,
        safety: state.ratings.stability.score,
        efficiency: state.ratings.efficiency.score
    };
    state.lastAnalysis.totalPct = totalPct;

    document.getElementById('rating-overview').innerHTML = ratingEntries.map((entry) => {
        const stars = Array.from({ length: 5 }, (_, index) => `<span class="${index < entry.score ? 'on' : ''}">★</span>`).join('');
        return `
            <div class="rating-card">
                <div class="rc-icon">${entry.icon}</div>
                <div>
                    <div class="rc-title">${entry.title}</div>
                    <div class="rc-sub">${entry.sub}</div>
                    <div class="rc-stars">${stars}</div>
                </div>
                <div class="rc-score">${entry.score}/5</div>
            </div>
        `;
    }).join('');

    const verdict = average >= 4 ? '우량 구간' : average >= 3 ? '관찰 우위' : '보수적 접근';
    document.getElementById('rating-details').innerHTML = `
        <div class="verdict-box">종합 점수 ${totalPct}% · ${verdict}</div>
        ${ratingEntries.map((entry) => `
            <details class="rating-detail">
                <summary>${entry.title} 평가 근거</summary>
                <div class="detail-body">
                    <ul class="detail-list">
                        ${entry.reasons.map((reason) => `<li>${reason}</li>`).join('')}
                    </ul>
                </div>
            </details>
        `).join('')}
    `;
}

function refreshTechnicals(shouldRenderCharts = true) {
    state.technicals = computeTechnicals(state.chartDaily);
    state.technicalsFull = null;
    state.technicalsFullSignature = '';
    renderTechnicalCards();
    renderTechSummary();
    if (shouldRenderCharts) {
        renderCharts();
        return;
    }
    renderTechLegend();
}

function computeTechnicals(data) {
    if (!Array.isArray(data) || data.length < 20) {
        return null;
    }

    const closes = data.map((point) => point.close);
    const highs = data.map((point) => point.high);
    const lows = data.map((point) => point.low);

    const ma5 = computeSMA(closes, 5);
    const ma20 = computeSMA(closes, 20);
    const rsi = computeRSISeries(closes, 14);
    const macd = computeMACDSeries(closes, 12, 26, 9);
    const stoch = computeStochasticSeries(highs, lows, closes, 14, 3);
    const boll = computeBollingerSeries(closes, 20, 2);

    const latestClose = closes[closes.length - 1] || 0;
    const lastRsi = lastDefined(rsi);
    const lastMacd = lastDefined(macd.macd);
    const lastMacdSignal = lastDefined(macd.signal);
    const lastStochK = lastDefined(stoch.k);
    const lastStochD = lastDefined(stoch.d);
    const lastMa5 = lastDefined(ma5);
    const lastMa20 = lastDefined(ma20);
    const lastBoll = lastDefinedObject(boll);

    const cards = [
        {
            key: 'RSI',
            label: 'RSI',
            value: lastRsi !== null ? `${lastRsi.toFixed(1)}` : '-',
            note: '14일 기준',
            signal: lastRsi !== null ? (lastRsi < 35 ? '매수' : lastRsi > 65 ? '매도' : '중립') : '중립'
        },
        {
            key: 'MACD',
            label: 'MACD',
            value: lastMacd !== null ? `${lastMacd.toFixed(2)} / ${lastMacdSignal?.toFixed(2) ?? '-'}` : '-',
            note: 'MACD / Signal',
            signal: lastMacd !== null && lastMacdSignal !== null ? (lastMacd > lastMacdSignal ? '매수' : lastMacd < lastMacdSignal ? '매도' : '중립') : '중립'
        },
        {
            key: 'STOCH',
            label: '스토캐스틱',
            value: lastStochK !== null ? `${lastStochK.toFixed(1)} / ${lastStochD?.toFixed(1) ?? '-'}` : '-',
            note: '%K / %D',
            signal: lastStochK !== null && lastStochD !== null ? (lastStochK > lastStochD && lastStochK < 25 ? '매수' : lastStochK < lastStochD && lastStochK > 75 ? '매도' : '중립') : '중립'
        },
        {
            key: 'MA',
            label: '골든/데드크로스',
            value: lastMa5 !== null ? `${Math.round(lastMa5).toLocaleString()} / ${Math.round(lastMa20 || 0).toLocaleString()}` : '-',
            note: 'MA5 / MA20',
            signal: lastMa5 !== null && lastMa20 !== null ? (lastMa5 > lastMa20 ? '매수' : lastMa5 < lastMa20 ? '매도' : '중립') : '중립'
        },
        {
            key: 'BOLL',
            label: '볼린저 밴드',
            value: lastBoll ? `${Math.round(lastBoll.lower).toLocaleString()} ~ ${Math.round(lastBoll.upper).toLocaleString()}` : '-',
            note: `현재가 ${latestClose.toLocaleString()}원`,
            signal: lastBoll ? (latestClose < lastBoll.lower ? '매수' : latestClose > lastBoll.upper ? '매도' : '중립') : '중립'
        }
    ];

    return { ma5, ma20, rsi, macd, stoch, boll, cards };
}

function ensureFullSeriesTechnicals(series) {
    const signature = InvestmentLogic.buildChartSeriesSignature(series);
    if (signature === state.technicalsFullSignature) {
        return state.technicalsFull;
    }

    state.technicalsFull = computeTechnicals(series);
    state.technicalsFullSignature = signature;
    return state.technicalsFull;
}

const INDICATOR_TOOLTIPS = {
    RSI: 'RSI (상대강도지수) 14일 기준\n🟢 매수: RSI ≤ 30 (과매도)\n🔴 매도: RSI ≥ 70 (과매수)\n⚪ 중립: 30 ~ 70 구간',
    MACD: 'MACD (이동평균수렴확산)\n단기(12일) - 장기(26일) EMA 차이\n🟢 매수: MACD가 Signal 상향돌파\n🔴 매도: MACD가 Signal 하향돌파',
    STOCH: '스토캐스틱 (14, 3)\n%K / %D 모멘텀 오실레이터\n🟢 매수: %K 상향돌파 & K < 25\n🔴 매도: %K 하향돌파 & K > 75\n⚪ 중립: 25 ~ 75 구간',
    MA: '골든 / 데드크로스 (MA5/MA20)\n🟢 골든크로스(매수): MA5 > MA20\n🔴 데드크로스(매도): MA5 < MA20',
    BOLL: '볼린저 밴드 (20일, 2σ)\n가격 변동성 기반 채널\n🟢 매수: 현재가 ≤ 하단 밴드\n🔴 매도: 현재가 ≥ 상단 밴드\n중간선 = 20일 이동평균'
};

function renderTechnicalCards() {
    const container = document.getElementById('technical-grid');
    if (!state.technicals) {
        container.innerHTML = '<div class="report-item">Yahoo Finance 차트 데이터가 충분할 때 기술적 분석 카드가 표시됩니다.</div>';
        return;
    }

    container.innerHTML = state.technicals.cards.map((card) => {
        const tone = card.signal === '매수' ? 'good' : card.signal === '매도' ? 'bad' : 'warn';
        const tipText = (INDICATOR_TOOLTIPS[card.key] || '').replace(/\n/g, '<br>');
        return `
            <div class="signal-card">
                <div class="signal-card-label">
                    <span class="signal-label">${card.label}</span>
                    ${tipText ? `<span class="signal-card-hint">?<span class="signal-card-tooltip">${tipText}</span></span>` : ''}
                </div>
                <div class="signal-value">${card.value}</div>
                <div class="signal-note">${card.note}</div>
                <div class="signal-note ${tone}">${card.signal}</div>
            </div>
        `;
    }).join('');
}

function renderTechSummary() {
    if (!state.technicals) {
        document.getElementById('tech-summary').innerHTML = '<div class="signal-note">차트 데이터가 충분할 때 매수/매도 집계를 계산합니다.</div>';
        return;
    }
    const signals = state.technicals.cards.map((card) => card.signal);
    const buys = signals.filter((signal) => signal === '매수').length;
    const sells = signals.filter((signal) => signal === '매도').length;
    const neutrals = signals.length - buys - sells;
    const verdict = buys > sells ? '매수 우세' : sells > buys ? '매도 우세' : '중립';

    document.getElementById('tech-summary').innerHTML = `
        <div class="summary-grid">
            <div class="summary-tile">
                <strong class="good">${buys}</strong>
                <span>매수 의견</span>
            </div>
            <div class="summary-tile">
                <strong class="bad">${sells}</strong>
                <span>매도 의견</span>
            </div>
            <div class="summary-tile">
                <strong>${neutrals}</strong>
                <span>중립 의견</span>
            </div>
        </div>
        <div class="signal-note" style="margin-top:14px;">기술적 종합 판단: <strong>${verdict}</strong></div>
    `;
}

function syncChartRangeButtons() {
    document.querySelectorAll('#chart-range-controls .seg-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.range === state.chartRange);
    });
}

function getChartWindowMinimum(range, totalPoints) {
    const requested = CHART_MIN_WINDOWS[String(range || 'DAY').toUpperCase()] || 20;
    return Math.max(1, Math.min(Math.max(1, totalPoints || 0), requested));
}

function getDefaultChartWindowSize(range, totalPoints) {
    const minimum = getChartWindowMinimum(range, totalPoints);
    const requested = CHART_DEFAULT_WINDOWS[String(range || 'DAY').toUpperCase()] || minimum;
    return Math.max(minimum, Math.min(Math.max(1, totalPoints || 0), requested));
}

function updateChartViewport(mode = 'preserve') {
    const fullSeries = InvestmentLogic.resolveChartSeries(state.chartDaily, state.chartRange, {
        currentYear: getCurrentYearKst(),
        currentDateToken: getCurrentDateTokenKst()
    });
    state.chartFullSeries = fullSeries;

    if (!fullSeries.length) {
        state.chartWindow = { start: 0, end: 0 };
        state.chartVisible = [];
        updateChartResetButton();
        return;
    }

    const total = fullSeries.length;
    const minimum = getChartWindowMinimum(state.chartRange, total);

    if (mode === 'recent' || !state.chartWindow) {
        const windowSize = getDefaultChartWindowSize(state.chartRange, total);
        state.chartWindow = InvestmentLogic.normalizeChartWindow(total, total - windowSize, windowSize, minimum);
    } else if (mode === 'full') {
        state.chartWindow = InvestmentLogic.normalizeChartWindow(total, 0, total, minimum);
    } else {
        state.chartWindow = InvestmentLogic.normalizeChartWindow(
            total,
            state.chartWindow.start,
            state.chartWindow.end - state.chartWindow.start,
            minimum
        );
    }

    state.chartVisible = fullSeries.slice(state.chartWindow.start, state.chartWindow.end);
    updateChartResetButton();
}

function isChartAtFullRange() {
    if (!state.chartFullSeries.length || !state.chartWindow) return true;
    return state.chartWindow.start === 0 && state.chartWindow.end === state.chartFullSeries.length;
}

function updateChartResetButton() {
    const button = document.getElementById('chart-reset-btn');
    if (!button) return;
    button.disabled = !state.chartFullSeries.length || isChartAtFullRange();
}

function resetChartZoom() {
    if (!state.chartDaily.length) return;
    state.chartDrag = null;
    priceHoverIndex = null;
    renderCharts({ viewport: 'full' });
}

function onChartRangeClick(event) {
    const button = event.target.closest('.seg-btn');
    if (!button) return;
    state.chartRange = button.dataset.range;
    state.chartWindow = null;
    state.chartDrag = null;
    priceHoverIndex = null;
    renderCharts({ viewport: 'recent' });
}

function onIndicatorToggle(event) {
    if (event.target.closest('.chip-hint')) return; // ? 클릭은 무시
    const button = event.target.closest('.indicator-chip');
    if (!button) return;
    const indicator = button.dataset.indicator;
    if (state.selectedIndicators.has(indicator)) {
        state.selectedIndicators.delete(indicator);
    } else {
        state.selectedIndicators.add(indicator);
    }
    button.classList.toggle('active', state.selectedIndicators.has(indicator));
    renderCharts();
}

function renderCharts(options = {}) {
    syncChartRangeButtons();
    updateChartViewport(options.viewport || 'preserve');
    const fullRangeTechnicals = ensureFullSeriesTechnicals(state.chartFullSeries);
    const visibleTechnicals = InvestmentLogic.sliceTechnicalSeriesWindow(fullRangeTechnicals, state.chartWindow);
    renderPriceChart(state.chartVisible);
    renderTechPriceChart(state.chartVisible, visibleTechnicals);
    renderIndicatorChart(state.chartVisible, visibleTechnicals);
    renderChartLegend();
    renderTechLegend();
    document.getElementById('chart-status').textContent = formatChartSourceStatus();
}

function aggregateCandles(data, mode) {
    const groups = new Map();
    data.forEach((point) => {
        const key = mode === 'week' ? weekKey(point.date) : point.date.slice(0, 6);
        if (!groups.has(key)) {
            groups.set(key, { key, date: point.date, open: point.open, high: point.high, low: point.low, close: point.close, volume: point.volume });
            return;
        }
        const bucket = groups.get(key);
        bucket.high = Math.max(bucket.high, point.high);
        bucket.low = Math.min(bucket.low, point.low);
        bucket.close = point.close;
        bucket.volume += point.volume;
        bucket.date = point.date;
    });

    const aggregated = Array.from(groups.values());
    aggregated.forEach((point) => {
        point.change = point.close - point.open;
        point.changePct = percentage(point.change, point.open);
    });
    return aggregated;
}

function clearCanvasInteractions(canvas, cursor = 'default') {
    if (!canvas) return;
    canvas.style.cursor = cursor;
    canvas.onwheel = null;
    canvas.onpointerdown = null;
    canvas.onpointermove = null;
    canvas.onpointerup = null;
    canvas.onpointerleave = null;
    canvas.onpointercancel = null;
}

function renderPriceChart(data) {
    const canvas = document.getElementById('candle-chart');
    const context = canvas.getContext('2d');
    const wrapperWidth = canvas.parentElement.clientWidth - 36;
    canvas.width = Math.max(wrapperWidth, 320);
    canvas.height = 380;

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!data.length) {
        context.fillStyle = '#94a3b8';
        context.font = '14px Inter';
        context.fillText('차트 데이터가 없습니다.', 24, 32);
        clearCanvasInteractions(canvas);
        return;
    }

    const fullSeries = state.chartFullSeries.length ? state.chartFullSeries : data;
    const windowStart = state.chartWindow?.start ?? 0;
    const windowEnd = state.chartWindow?.end ?? fullSeries.length;
    const padding = { top: 18, right: 86, bottom: 38, left: 18 };
    const width = canvas.width - padding.left - padding.right;
    const height = canvas.height - padding.top - padding.bottom;
    const closeSeries = fullSeries.map((point) => point.close);
    const movingAverages = Object.fromEntries(
        CHART_MA_PERIODS.map((period) => [period, computeSMA(closeSeries, period).slice(windowStart, windowEnd)])
    );
    const overlayValues = Object.values(movingAverages)
        .flat()
        .filter((value) => Number.isFinite(value));
    const prices = data.flatMap((point) => [point.high, point.low]).concat(overlayValues);
    const maxPrice = Math.max(...prices) * 1.02;
    const minPrice = Math.min(...prices) * 0.98;
    const xGap = width / Math.max(1, data.length);
    const candleWidth = Math.max(4, Math.min(18, xGap * 0.58));
    const hovered = priceHoverIndex;

    const xAt = (index) => padding.left + xGap * index + xGap / 2;
    const yAt = (value) => padding.top + height - ((value - minPrice) / (maxPrice - minPrice || 1)) * height;

    context.strokeStyle = 'rgba(255,255,255,0.08)';
    context.lineWidth = 1;
    for (let index = 0; index <= 5; index += 1) {
        const y = padding.top + (height / 5) * index;
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(canvas.width - padding.right, y);
        context.stroke();

        const price = maxPrice - ((maxPrice - minPrice) / 5) * index;
        context.fillStyle = '#94a3b8';
        context.font = '12px Inter';
        context.textAlign = 'left';
        context.fillText(Math.round(price).toLocaleString(), canvas.width - padding.right + 12, y + 4);
    }

    data.forEach((point, index) => {
        const x = xAt(index);
        const openY = yAt(point.open);
        const closeY = yAt(point.close);
        const highY = yAt(point.high);
        const lowY = yAt(point.low);
        const rising = point.close >= point.open;
        const color = rising ? '#22c55e' : '#ef4444';

        context.strokeStyle = color;
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(x, highY);
        context.lineTo(x, lowY);
        context.stroke();

        context.fillStyle = color;
        context.fillRect(x - candleWidth / 2, Math.min(openY, closeY), candleWidth, Math.max(2, Math.abs(closeY - openY)));
    });

    CHART_MA_PERIODS.forEach((period) => {
        drawOverlayLine(context, movingAverages[period], xAt, yAt, CHART_MA_COLORS[period]);
    });

    const labelStep = Math.max(1, Math.floor(data.length / 6));
    context.fillStyle = '#64748b';
    context.textAlign = 'center';
    context.font = '11px Inter';
    data.forEach((point, index) => {
        if (index % labelStep !== 0 && index !== data.length - 1) return;
        context.fillText(formatAxisDate(point.date, state.chartRange), xAt(index), canvas.height - 12);
    });

    if (hovered !== null && data[hovered]) {
        const point = data[hovered];
        const x = xAt(hovered);
        context.strokeStyle = 'rgba(255,255,255,0.22)';
        context.beginPath();
        context.moveTo(x, padding.top);
        context.lineTo(x, canvas.height - padding.bottom);
        context.stroke();

        const lines = [
            formatDateToken(point.date),
            `시가 ${point.open.toLocaleString()}원`,
            `고가 ${point.high.toLocaleString()}원`,
            `저가 ${point.low.toLocaleString()}원`,
            `종가 ${point.close.toLocaleString()}원`,
            `등락 ${(point.changePct > 0 ? '+' : '') + point.changePct.toFixed(2)}%`
        ];
        drawTooltip(context, x, padding.top + 10, lines, {
            left: padding.left + 8,
            top: padding.top + 8,
            right: canvas.width - padding.right - 8,
            bottom: canvas.height - padding.bottom - 8
        });
    }

    canvas.style.cursor = state.chartDrag ? 'grabbing' : 'crosshair';

    const clearHover = () => {
        if (priceHoverIndex === null) return;
        priceHoverIndex = null;
        renderPriceChart(state.chartVisible);
    };

    const releaseDrag = (pointerId) => {
        if (!state.chartDrag) return;
        if (pointerId !== undefined && state.chartDrag.pointerId !== pointerId) return;
        try {
            if (state.chartDrag.pointerId !== undefined) {
                canvas.releasePointerCapture?.(state.chartDrag.pointerId);
            }
        } catch (error) {
            // Pointer capture release can fail when the pointer was already lost.
        }
        state.chartDrag = null;
        canvas.style.cursor = 'crosshair';
    };

    canvas.onwheel = (event) => {
        if (!state.chartFullSeries.length || !state.chartWindow) return;
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const localX = event.clientX - rect.left - padding.left;
        const anchorRatio = Math.max(0, Math.min(1, localX / Math.max(1, width)));
        const factor = event.deltaY < 0 ? 0.82 : 1.22;
        state.chartWindow = InvestmentLogic.zoomChartWindow(
            state.chartWindow,
            state.chartFullSeries.length,
            factor,
            anchorRatio,
            getChartWindowMinimum(state.chartRange, state.chartFullSeries.length)
        );
        state.chartDrag = null;
        priceHoverIndex = null;
        renderCharts({ viewport: 'preserve' });
    };

    canvas.onpointerdown = (event) => {
        if (!state.chartVisible.length || !state.chartWindow) return;
        state.chartDrag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            window: { ...state.chartWindow }
        };
        canvas.setPointerCapture?.(event.pointerId);
        canvas.style.cursor = 'grabbing';
    };

    canvas.onpointermove = (event) => {
        if (state.chartDrag && state.chartDrag.pointerId === event.pointerId) {
            const dragWidth = Math.max(1, width);
            const visiblePoints = Math.max(1, state.chartDrag.window.end - state.chartDrag.window.start);
            const deltaRatio = (event.clientX - state.chartDrag.startX) / dragWidth;
            const deltaPoints = Math.round(-deltaRatio * visiblePoints);
            state.chartWindow = InvestmentLogic.panChartWindow(
                state.chartDrag.window,
                deltaPoints,
                state.chartFullSeries.length
            );
            priceHoverIndex = null;
            renderCharts({ viewport: 'preserve' });
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left - padding.left;
        if (x < 0 || x > width) {
            clearHover();
            return;
        }
        const nextIndex = Math.min(data.length - 1, Math.max(0, Math.floor(x / xGap)));
        if (nextIndex === priceHoverIndex) return;
        priceHoverIndex = nextIndex;
        renderPriceChart(state.chartVisible);
    };

    canvas.onpointerup = (event) => {
        releaseDrag(event.pointerId);
    };

    canvas.onpointercancel = (event) => {
        releaseDrag(event.pointerId);
        clearHover();
    };

    canvas.onpointerleave = (event) => {
        if (state.chartDrag && state.chartDrag.pointerId === event.pointerId) return;
        clearHover();
    };
}

/**
 * Attach synchronized zoom (wheel) + pan (pointer drag) to a canvas.
 * All canvases share state.chartWindow / state.chartFullSeries with the main chart.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} padLeft   - drawing area left padding
 * @param {number} padRight  - drawing area right padding
 * @param {Function} [onHoverMove] - (e, rect) callback when hovering (no drag)
 * @param {Function} [onHoverEnd]  - () callback when pointer leaves or drag starts
 */
function setupZoomPan(canvas, padLeft, padRight, onHoverMove, onHoverEnd) {
    canvas.style.cursor = onHoverMove ? 'crosshair' : 'grab';

    canvas.onwheel = (e) => {
        if (!state.chartFullSeries.length || !state.chartWindow) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const drawWidth = canvas.width - padLeft - padRight;
        const localX = (e.clientX - rect.left) * (canvas.width / rect.width) - padLeft;
        const anchorRatio = Math.max(0, Math.min(1, localX / Math.max(1, drawWidth)));
        const factor = e.deltaY < 0 ? 0.82 : 1.22;
        state.chartWindow = InvestmentLogic.zoomChartWindow(
            state.chartWindow,
            state.chartFullSeries.length,
            factor,
            anchorRatio,
            getChartWindowMinimum(state.chartRange, state.chartFullSeries.length)
        );
        state.techDrag = null;
        if (onHoverEnd) onHoverEnd();
        renderCharts({ viewport: 'preserve' });
    };

    canvas.onpointerdown = (e) => {
        if (!state.chartWindow) return;
        state.techDrag = {
            canvas,
            pointerId: e.pointerId,
            startX: e.clientX,
            window: { ...state.chartWindow }
        };
        canvas.setPointerCapture?.(e.pointerId);
        canvas.style.cursor = 'grabbing';
        if (onHoverEnd) onHoverEnd();
    };

    canvas.onpointermove = (e) => {
        const drag = state.techDrag;
        if (drag && drag.canvas === canvas && drag.pointerId === e.pointerId) {
            const drawWidth = canvas.width - padLeft - padRight;
            const visiblePoints = Math.max(1, drag.window.end - drag.window.start);
            const deltaRatio = (e.clientX - drag.startX) / Math.max(1, drawWidth);
            const deltaPoints = Math.round(-deltaRatio * visiblePoints);
            state.chartWindow = InvestmentLogic.panChartWindow(
                drag.window,
                deltaPoints,
                state.chartFullSeries.length
            );
            if (onHoverEnd) onHoverEnd();
            renderCharts({ viewport: 'preserve' });
            return;
        }
        if (onHoverMove) {
            const rect = canvas.getBoundingClientRect();
            onHoverMove(e, rect);
        }
    };

    const releasePointer = (e) => {
        const drag = state.techDrag;
        if (!drag || drag.canvas !== canvas || drag.pointerId !== e.pointerId) return;
        try { canvas.releasePointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
        state.techDrag = null;
        canvas.style.cursor = onHoverMove ? 'crosshair' : 'grab';
    };

    canvas.onpointerup = releasePointer;
    canvas.onpointercancel = (e) => {
        releasePointer(e);
        if (onHoverEnd) onHoverEnd();
    };
    canvas.onpointerleave = (e) => {
        const drag = state.techDrag;
        if (drag && drag.canvas === canvas && drag.pointerId === e.pointerId) return;
        if (onHoverEnd) onHoverEnd();
        canvas.style.cursor = onHoverMove ? 'crosshair' : 'grab';
    };
    // Suppress default touch scroll inside the chart
    canvas.style.touchAction = 'none';
}

function renderTechPriceChart(data, visibleTechnicals) {
    const canvas = document.getElementById('tech-price-chart');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const wrapperWidth = canvas.parentElement.clientWidth - 36;
    canvas.width = Math.max(wrapperWidth, 320);
    const SIGNAL_STRIP = 34;
    canvas.height = 300;

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!data || !data.length) {
        context.fillStyle = '#94a3b8';
        context.font = '13px Inter';
        context.fillText('차트 데이터가 없습니다.', 18, 30);
        clearCanvasInteractions(canvas);
        hideTechTooltip();
        return;
    }

    const localTech = visibleTechnicals;
    const bollActive = state.selectedIndicators.has('BOLL') && localTech;
    const maActive = state.selectedIndicators.has('MA') && localTech;

    const padding = { top: 18, right: 72, bottom: 28 + SIGNAL_STRIP, left: 18 };
    const width = canvas.width - padding.left - padding.right;
    const priceHeight = canvas.height - padding.top - padding.bottom;

    // Price range — extend to include BB bands and MA lines
    let allPrices = data.flatMap((d) => [d.high, d.low]);
    if (bollActive) {
        localTech.boll.forEach((b) => { if (b) { allPrices.push(b.upper, b.lower); } });
    }
    if (maActive) {
        localTech.ma5.forEach((v) => { if (v !== null) allPrices.push(v); });
        localTech.ma20.forEach((v) => { if (v !== null) allPrices.push(v); });
    }
    const maxPrice = Math.max(...allPrices) * 1.01;
    const minPrice = Math.min(...allPrices) * 0.99;

    const xGap = width / Math.max(1, data.length);
    const candleW = Math.max(3, Math.min(14, xGap * 0.55));
    const xAt = (i) => padding.left + xGap * i + xGap / 2;
    const yAt = (v) => padding.top + priceHeight - ((v - minPrice) / (maxPrice - minPrice || 1)) * priceHeight;

    // Grid lines + price labels
    context.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (priceHeight / 4) * i;
        context.strokeStyle = 'rgba(255,255,255,0.06)';
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(canvas.width - padding.right, y);
        context.stroke();
        const price = maxPrice - ((maxPrice - minPrice) / 4) * i;
        context.fillStyle = '#64748b';
        context.font = '11px Inter';
        context.textAlign = 'left';
        context.fillText(Math.round(price).toLocaleString(), canvas.width - padding.right + 8, y + 4);
    }

    // Bollinger Band shaded area
    if (bollActive) {
        const validBoll = localTech.boll.map((b, i) => ({ b, i })).filter(({ b }) => b !== null);
        if (validBoll.length > 1) {
            context.beginPath();
            validBoll.forEach(({ b, i }, vi) => {
                if (vi === 0) context.moveTo(xAt(i), yAt(b.upper));
                else context.lineTo(xAt(i), yAt(b.upper));
            });
            for (let vi = validBoll.length - 1; vi >= 0; vi--) {
                const { b, i } = validBoll[vi];
                context.lineTo(xAt(i), yAt(b.lower));
            }
            context.closePath();
            context.fillStyle = 'rgba(143,211,255,0.07)';
            context.fill();
        }
        drawLineSeries(context, localTech.boll.map((b) => (b ? b.upper : null)), xAt, yAt, 'rgba(143,211,255,0.55)', 1.2);
        drawLineSeries(context, localTech.boll.map((b) => (b ? b.middle : null)), xAt, yAt, 'rgba(143,211,255,0.3)', 1);
        drawLineSeries(context, localTech.boll.map((b) => (b ? b.lower : null)), xAt, yAt, 'rgba(143,211,255,0.55)', 1.2);
    }

    // MA5 / MA20 overlay
    if (maActive) {
        drawLineSeries(context, localTech.ma5, xAt, yAt, '#8fd3ff', 1.6);
        drawLineSeries(context, localTech.ma20, xAt, yAt, '#f59e0b', 1.6);
    }

    // Candles
    data.forEach((point, i) => {
        const x = xAt(i);
        const rising = point.close >= point.open;
        const color = rising ? '#22c55e' : '#ef4444';
        context.strokeStyle = color;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, yAt(point.high));
        context.lineTo(x, yAt(point.low));
        context.stroke();
        context.fillStyle = color;
        const topY = Math.min(yAt(point.open), yAt(point.close));
        const bodyH = Math.max(1, Math.abs(yAt(point.open) - yAt(point.close)));
        context.fillRect(x - candleW / 2, topY, candleW, bodyH);
    });

    // Date axis
    const labelStep = Math.max(1, Math.floor(data.length / 6));
    context.fillStyle = '#64748b';
    context.textAlign = 'center';
    context.font = '11px Inter';
    data.forEach((point, i) => {
        if (i % labelStep !== 0 && i !== data.length - 1) return;
        context.fillText(formatAxisDate(point.date, state.chartRange), xAt(i), padding.top + priceHeight + 16);
    });

    // Signal strip separator
    const stripTop = canvas.height - SIGNAL_STRIP;
    context.strokeStyle = 'rgba(255,255,255,0.07)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding.left, stripTop);
    context.lineTo(canvas.width - padding.right, stripTop);
    context.stroke();
    context.fillStyle = '#475569';
    context.font = '10px Inter';
    context.textAlign = 'left';
    context.fillText('매수/매도 시그널', padding.left, stripTop + 12);

    // Collect & draw buy/sell markers in strip
    if (localTech) {
        const allMarkers = [];
        if (state.selectedIndicators.has('RSI') || state.selectedIndicators.has('STOCH')) {
            buildOscillatorMarkers(localTech, state.selectedIndicators).forEach((m) => allMarkers.push(m));
        }
        if (state.selectedIndicators.has('MACD')) {
            buildMacdMarkers(localTech.macd).forEach((m) => allMarkers.push(m));
        }
        if (state.selectedIndicators.has('MA')) {
            buildMAMarkers(localTech).forEach((m) => allMarkers.push(m));
        }
        const stripMidY = stripTop + SIGNAL_STRIP / 2 + 2;
        allMarkers.forEach((marker) => {
            drawSignalMarker(context, xAt(marker.index), stripMidY, marker.type);
        });
    }

    // ── 줌/패닝 + 호버 툴팁 (연동) ──
    setupZoomPan(
        canvas,
        padding.left,
        padding.right,
        (e, rect) => {
            const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
            const idx = Math.round((mouseX - padding.left - xGap / 2) / xGap);
            if (idx < 0 || idx >= data.length) { hideTechTooltip(); return; }
            const chartWidth = canvas.width - padding.left - padding.right;
            const cursorFraction = Math.max(0, Math.min(1, (mouseX - padding.left) / chartWidth));
            showTechTooltip(idx, data, localTech, cursorFraction);
        },
        hideTechTooltip
    );
}

function hideTechTooltip() {
    const el = document.getElementById('tech-tooltip');
    if (el) el.style.display = 'none';
}

function showTechTooltip(idx, data, tech, cursorFraction = 0.5) {
    const el = document.getElementById('tech-tooltip');
    if (!el) return;
    const pt = data[idx];
    if (!pt) return;

    const fmt = (v) => (v != null ? Math.round(v).toLocaleString() : '-');
    const fmtF = (v, d = 1) => (v != null ? v.toFixed(d) : '-');

    // 지표별 시그널 뱃지 생성 헬퍼
    const buyBadge  = (label) => `<span class="sig-buy">▲ ${label}</span>`;
    const sellBadge = (label) => `<span class="sig-sell">▼ ${label}</span>`;

    // 각 지표 값
    const rsi    = tech?.rsi?.[idx];
    const stochK = tech?.stoch?.k?.[idx];
    const stochD = tech?.stoch?.d?.[idx];
    const macdV  = tech?.macd?.macd?.[idx];
    const macdS  = tech?.macd?.signal?.[idx];
    const boll   = tech?.boll?.[idx];
    const ma5    = tech?.ma5?.[idx];
    const ma20   = tech?.ma20?.[idx];

    // 지표별 고유 시그널
    const rsiSig   = rsi != null
        ? (rsi <= 30 ? buyBadge('RSI 과매도') : rsi >= 70 ? sellBadge('RSI 과매수') : '') : '';
    const stochSig = (stochK != null && stochD != null)
        ? (stochK > stochD && stochK < 25 ? buyBadge('%K 상향교차')
            : stochK < stochD && stochK > 75 ? sellBadge('%K 하향교차') : '') : '';
    const macdSig  = (macdV != null && macdS != null)
        ? (macdV > macdS ? buyBadge('MACD 골든') : sellBadge('MACD 데드')) : '';
    const bollSig  = boll
        ? (pt.close <= boll.lower ? buyBadge('BB 하단이탈')
            : pt.close >= boll.upper ? sellBadge('BB 상단돌파') : '') : '';
    const maSig    = (ma5 != null && ma20 != null)
        ? (ma5 > ma20 ? buyBadge('골든크로스') : sellBadge('데드크로스')) : '';

    const sep = '<div style="border-top:1px solid rgba(255,255,255,0.10);margin:5px 0"></div>';

    let html = `<div style="font-weight:800;color:#e2e8f0;margin-bottom:4px">${formatDateToken(pt.date)}</div>`;
    html += `<div>시가 <strong>${fmt(pt.open)}원</strong></div>`;
    html += `<div>고가 <strong style="color:#f87171">${fmt(pt.high)}원</strong></div>`;
    html += `<div>저가 <strong style="color:#4ade80">${fmt(pt.low)}원</strong></div>`;
    html += `<div>종가 <strong>${fmt(pt.close)}원</strong></div>`;

    let hasPrev = false;
    if (state.selectedIndicators.has('RSI') && rsi != null) {
        html += sep; hasPrev = true;
        html += `<div>RSI&nbsp;<strong>${fmtF(rsi)}</strong>${rsiSig}</div>`;
    }
    if (state.selectedIndicators.has('STOCH') && stochK != null) {
        if (!hasPrev) { html += sep; hasPrev = true; }
        html += `<div>%K&nbsp;<strong>${fmtF(stochK)}</strong>&nbsp;%D&nbsp;<strong>${fmtF(stochD)}</strong>${stochSig}</div>`;
    }
    if (state.selectedIndicators.has('MACD') && macdV != null) {
        html += sep;
        html += `<div>MACD&nbsp;<strong>${fmtF(macdV, 0)}</strong>&nbsp;/&nbsp;Sig&nbsp;<strong>${fmtF(macdS, 0)}</strong>${macdSig}</div>`;
    }
    if (state.selectedIndicators.has('BOLL') && boll) {
        html += sep;
        html += `<div>BB상단&nbsp;<strong>${fmt(boll.upper)}</strong></div>`;
        html += `<div>BB하단&nbsp;<strong>${fmt(boll.lower)}</strong>${bollSig}</div>`;
    }
    if (state.selectedIndicators.has('MA') && ma5 != null) {
        html += sep;
        html += `<div>MA5&nbsp;<strong>${fmt(ma5)}</strong>&nbsp;/&nbsp;MA20&nbsp;<strong>${fmt(ma20)}</strong>${maSig}</div>`;
    }

    el.innerHTML = html;
    el.style.display = 'block';

    // 커서 위치에 따라 툴팁을 반대쪽에 배치
    if (cursorFraction > 0.5) {
        // 커서가 오른쪽 → 툴팁은 왼쪽
        el.style.left = '14px';
        el.style.right = 'auto';
    } else {
        // 커서가 왼쪽 → 툴팁은 오른쪽
        el.style.left = 'auto';
        el.style.right = '14px';
    }
}

function buildMAMarkers(technicals) {
    const markers = [];
    for (let i = 1; i < technicals.ma5.length; i++) {
        const prevMa5 = technicals.ma5[i - 1];
        const prevMa20 = technicals.ma20[i - 1];
        const currMa5 = technicals.ma5[i];
        const currMa20 = technicals.ma20[i];
        if (prevMa5 === null || prevMa20 === null || currMa5 === null || currMa20 === null) continue;
        if (prevMa5 <= prevMa20 && currMa5 > currMa20) {
            markers.push({ index: i, type: 'buy', value: currMa5 });
        } else if (prevMa5 >= prevMa20 && currMa5 < currMa20) {
            markers.push({ index: i, type: 'sell', value: currMa5 });
        }
    }
    return markers.slice(-10);
}

function renderIndicatorChart(data, visibleTechnicals) {
    const canvas = document.getElementById('indicator-chart');
    const context = canvas.getContext('2d');
    const wrapperWidth = canvas.parentElement.clientWidth - 36;
    canvas.width = Math.max(wrapperWidth, 320);

    // Build panel list: each oscillator gets its own panel
    const panels = [
        state.selectedIndicators.has('RSI') ? 'RSI' : null,
        state.selectedIndicators.has('STOCH') ? 'STOCH' : null,
        state.selectedIndicators.has('MACD') ? 'MACD' : null
    ].filter(Boolean);

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!data.length || !panels.length) {
        canvas.height = 48;
        context.fillStyle = '#94a3b8';
        context.font = '13px Inter';
        context.fillText('RSI, 스토캐스틱, MACD 중 하나를 선택하면 보조 차트가 표시됩니다.', 18, 30);
        clearCanvasInteractions(canvas);
        return;
    }

    const localTechnicals = visibleTechnicals;
    if (!localTechnicals) {
        canvas.height = 48;
        context.fillStyle = '#94a3b8';
        context.font = '13px Inter';
        context.fillText('선택한 기간의 봉 수가 충분할 때 보조 차트가 표시됩니다.', 18, 30);
        clearCanvasInteractions(canvas);
        return;
    }

    const PANEL_H = 110;
    const GAP = 10;
    const padding = { top: 10, right: 36, bottom: 10, left: 24 };
    canvas.height = padding.top + panels.length * PANEL_H + (panels.length - 1) * GAP + padding.bottom;

    const width = canvas.width - padding.left - padding.right;
    const xGap = width / data.length;
    const xAt = (index) => padding.left + xGap * index + xGap / 2;

    panels.forEach((panel, panelIndex) => {
        const top = padding.top + panelIndex * (PANEL_H + GAP);
        const bottom = top + PANEL_H;

        // ── 패널 클리핑: 다른 패널로 선이 넘치지 않도록 ──
        context.save();
        context.beginPath();
        context.rect(padding.left - 2, top, width + 4, PANEL_H);
        context.clip();

        // Panel border
        context.strokeStyle = 'rgba(255,255,255,0.07)';
        context.lineWidth = 1;
        context.setLineDash([]);
        context.strokeRect(padding.left, top, width, PANEL_H);

        if (panel === 'RSI') {
            const yAt = (value) => bottom - (value / 100) * PANEL_H;
            context.fillStyle = 'rgba(239,68,68,0.05)';
            context.fillRect(padding.left, top, width, yAt(70) - top);
            context.fillStyle = 'rgba(34,197,94,0.05)';
            context.fillRect(padding.left, yAt(30), width, bottom - yAt(30));
            [70, 50, 30].forEach((lvl) => {
                context.strokeStyle = lvl === 50 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)';
                context.setLineDash(lvl === 50 ? [] : [3, 3]);
                context.beginPath();
                context.moveTo(padding.left, yAt(lvl));
                context.lineTo(canvas.width - padding.right, yAt(lvl));
                context.stroke();
                context.setLineDash([]);
            });
            drawLineSeries(context, localTechnicals.rsi, xAt, yAt, '#8fd3ff', 2);
            context.fillStyle = '#94a3b8';
            context.font = '11px Inter';
            context.textAlign = 'left';
            context.fillText('RSI (14)', padding.left + 8, top + 14);
        }

        if (panel === 'STOCH') {
            const yAt = (value) => bottom - (value / 100) * PANEL_H;
            context.fillStyle = 'rgba(239,68,68,0.05)';
            context.fillRect(padding.left, top, width, yAt(75) - top);
            context.fillStyle = 'rgba(34,197,94,0.05)';
            context.fillRect(padding.left, yAt(25), width, bottom - yAt(25));
            [75, 50, 25].forEach((lvl) => {
                context.strokeStyle = lvl === 50 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)';
                context.setLineDash(lvl === 50 ? [] : [3, 3]);
                context.beginPath();
                context.moveTo(padding.left, yAt(lvl));
                context.lineTo(canvas.width - padding.right, yAt(lvl));
                context.stroke();
                context.setLineDash([]);
            });
            drawLineSeries(context, localTechnicals.stoch.k, xAt, yAt, '#f59e0b', 1.8);
            drawLineSeries(context, localTechnicals.stoch.d, xAt, yAt, '#a855f7', 1.4);
            context.fillStyle = '#94a3b8';
            context.font = '11px Inter';
            context.textAlign = 'left';
            context.fillText('Stochastic %K / %D', padding.left + 8, top + 14);
        }

        if (panel === 'MACD') {
            const hist   = localTechnicals.macd.histogram;
            const series = localTechnicals.macd.macd;
            const signal = localTechnicals.macd.signal;
            // ── scale을 hist + macd line + signal line 전체 범위 기준으로 계산 ──
            const allVals = [...hist, ...series, ...signal].filter((v) => v !== null);
            const maxAbs  = Math.max(...allVals.map((v) => Math.abs(v)), 1);
            const midY    = top + PANEL_H / 2;
            const yAt     = (value) => midY - (value / maxAbs) * (PANEL_H / 2 - 10);
            // Zero line
            context.strokeStyle = 'rgba(255,255,255,0.12)';
            context.setLineDash([]);
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(padding.left, midY);
            context.lineTo(canvas.width - padding.right, midY);
            context.stroke();
            // Histogram bars
            hist.forEach((value, index) => {
                if (value === null) return;
                const x = xAt(index);
                context.strokeStyle = value >= 0 ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.8)';
                context.lineWidth = Math.max(2, xGap * 0.45);
                context.beginPath();
                context.moveTo(x, yAt(0));
                context.lineTo(x, yAt(value));
                context.stroke();
            });
            drawLineSeries(context, series, xAt, yAt, '#8fd3ff', 2);
            drawLineSeries(context, signal, xAt, yAt, '#f59e0b', 1.6);
            context.fillStyle = '#94a3b8';
            context.font = '11px Inter';
            context.textAlign = 'left';
            context.fillText('MACD', padding.left + 8, top + 14);
        }

        context.restore(); // 클리핑 해제

        // 라벨은 클리핑 밖 (오른쪽 숫자)
        context.fillStyle = '#64748b';
        context.font = '10px Inter';
        context.textAlign = 'left';
        if (panel === 'RSI') {
            const yAt = (v) => bottom - (v / 100) * PANEL_H;
            [70, 50, 30].forEach((lvl) => context.fillText(String(lvl), canvas.width - padding.right + 4, yAt(lvl) + 4));
        }
        if (panel === 'STOCH') {
            const yAt = (v) => bottom - (v / 100) * PANEL_H;
            [75, 50, 25].forEach((lvl) => context.fillText(String(lvl), canvas.width - padding.right + 4, yAt(lvl) + 4));
        }
    });

    setupZoomPan(canvas, padding.left, padding.right);
}

function renderChartLegend() {
    const items = [
        { type: 'dot', color: '#22c55e', label: '상승 봉' },
        { type: 'dot', color: '#ef4444', label: '하락 봉' },
        ...CHART_MA_PERIODS.map((period) => ({
            type: 'line',
            color: CHART_MA_COLORS[period],
            label: `MA${period}`
        }))
    ];

    document.getElementById('chart-legend').innerHTML = items.map((item) => `
        <span class="legend-chip">
            <span class="${item.type === 'line' ? 'legend-line' : 'legend-dot'}" style="background:${item.color}"></span>
            <span>${item.label}</span>
        </span>
    `).join('');
}

function renderTechLegend() {
    const base = [
        { type: 'dot', color: '#22c55e', label: '상승 봉' },
        { type: 'dot', color: '#ef4444', label: '하락 봉' },
        { type: 'dot', color: '#22c55e', label: '매수 시그널' },
        { type: 'dot', color: '#ef4444', label: '매도 시그널' }
    ];
    const optional = [];
    if (state.selectedIndicators.has('BOLL')) {
        optional.push({ type: 'line', color: 'rgba(143,211,255,0.7)', label: '볼린저 밴드' });
    }
    if (state.selectedIndicators.has('MA')) {
        optional.push({ type: 'line', color: '#8fd3ff', label: 'MA5' });
        optional.push({ type: 'line', color: '#f59e0b', label: 'MA20' });
    }
    if (state.selectedIndicators.has('RSI')) {
        optional.push({ type: 'line', color: '#8fd3ff', label: 'RSI' });
    }
    if (state.selectedIndicators.has('STOCH')) {
        optional.push({ type: 'line', color: '#f59e0b', label: 'Stoch %K' });
        optional.push({ type: 'line', color: '#a855f7', label: 'Stoch %D' });
    }
    if (state.selectedIndicators.has('MACD')) {
        optional.push({ type: 'line', color: '#8fd3ff', label: 'MACD' });
        optional.push({ type: 'line', color: '#f59e0b', label: 'Signal' });
    }
    const items = [...base, ...optional];

    document.getElementById('tech-legend').innerHTML = items.map((item) => `
        <span class="legend-chip">
            <span class="${item.type === 'line' ? 'legend-line' : 'legend-dot'}" style="background:${item.color}"></span>
            <span>${item.label}</span>
        </span>
    `).join('');
}

async function generateBriefing() {
    if (!state.company || !state.ratings || !state.metrics) return;

    const company = state.company.name;
    const technicalCards = state.technicals?.cards || [];
    const summary = state.summaries[0]?.summary;
    const totalPct = state.lastAnalysis.totalPct || 0;

    const prompt = `
${company}에 대한 한국어 투자 브리핑을 작성하세요.

[입력 데이터]
- 가치투자 부합도: ${totalPct}%
- 매출액: ${formatMetricValue(summary?.revenue, 'money')}
- 영업이익: ${formatMetricValue(summary?.operatingIncome, 'money')}
- 순이익: ${formatMetricValue(summary?.netIncome, 'money')}
- ROE: ${summary?.roe?.toFixed(1) ?? '-'}%
- 부채비율: ${summary?.debtRatio?.toFixed(1) ?? '-'}%
- 적정주가: ${state.metrics.targetPrice ? `${state.metrics.targetPrice.toLocaleString()}원` : '-'}
- 상승여력: ${state.metrics.upside?.toFixed(1) ?? '-'}%
- 수익성 점수: ${state.ratings.profitability.score}/5
- 건전성 점수: ${state.ratings.stability.score}/5
- 효율성 점수: ${state.ratings.efficiency.score}/5
- 기술적 판단: ${technicalCards.map((card) => `${card.label} ${card.signal}`).join(', ')}
- 차트 소스: ${formatChartSourceName()}

[출력 형식]
1. 한 줄 요약
2. 강점 3가지
3. 리스크 3가지
4. 최종 의견(매수/관망/주의 중 하나)과 근거
5. 너무 길지 않게 작성
    `.trim();

    try {
        const response = await fetchJson(buildProxyPostUrl('gemini'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 850
                }
            })
        });
        const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new Error('Gemini 응답에 브리핑 본문이 없습니다.');
        }
        renderBriefing(text, 'Gemini Live', 'Gemini 응답으로 브리핑을 생성했습니다.');
        setSourceBadge('source-gemini', 'Gemini 응답 완료', 'success');
    } catch (error) {
        console.warn('Gemini briefing fallback', error);
        renderBriefing(buildLocalBriefing(), 'Fallback Briefing', 'Gemini 할당량 또는 인증 이슈로 로컬 브리핑으로 전환했습니다.', true);
        setSourceBadge('source-gemini', 'Gemini 대체 브리핑', 'warn');
    }
}

function renderBriefing(content, badge, meta, isLocal = false) {
    document.getElementById('briefing-meta').textContent = meta;
    const badgeTone = isLocal ? 'rgba(245,158,11,0.14)' : 'rgba(79,140,255,0.14)';
    const bodyHtml = isLocal ? content : formatBriefingText(content);
    document.getElementById('briefing-content').innerHTML = `
        <div class="briefing-badge" style="background:${badgeTone}">${badge}</div>
        ${bodyHtml}
    `;
}

function buildLocalBriefing() {
    const summary = state.summaries[0]?.summary;
    const strengthLines = [
        `수익성 점수 ${state.ratings.profitability.score}/5, 영업이익률 ${summary.operatingMargin.toFixed(1)}%`,
        `건전성 점수 ${state.ratings.stability.score}/5, 부채비율 ${summary.debtRatio.toFixed(1)}%`,
        `효율성 점수 ${state.ratings.efficiency.score}/5, ROA ${summary.roa.toFixed(1)}%`
    ];
    const riskLines = [
        `상승여력 ${state.metrics.upside.toFixed(1)}%는 입력한 목표 PER 가정에 민감합니다.`,
        `차트 소스는 현재 ${formatChartSourceName()}입니다.`,
        `최근 분기 데이터가 부족한 경우 분기 성장률 평가는 보수적으로 해석해야 합니다.`
    ];
    const finalOpinion = state.lastAnalysis.totalPct >= 80 ? '매수 후보' : state.lastAnalysis.totalPct >= 60 ? '관망 우위' : '주의 구간';

    return `
        <div class="briefing-section">
            <h3>한 줄 요약</h3>
            <div class="briefing-body">${state.company.name}은 현재 가치지표와 재무 점수상 ${finalOpinion}에 가까우며, 기술적 지표는 ${document.getElementById('tech-summary').innerText.trim()} 상태입니다.</div>
        </div>
        <div class="briefing-section">
            <h3>강점</h3>
            <ul class="briefing-list">${strengthLines.map((item) => `<li>${item}</li>`).join('')}</ul>
        </div>
        <div class="briefing-section">
            <h3>리스크</h3>
            <ul class="briefing-list">${riskLines.map((item) => `<li>${item}</li>`).join('')}</ul>
        </div>
        <div class="briefing-section">
            <h3>최종 의견</h3>
            <div class="briefing-body">${finalOpinion}입니다. 재무 점수, 적정주가, 기술적 집계 결과를 함께 확인하면서 DART 원문과 최신 공시까지 교차 검증하는 접근이 적합합니다.</div>
        </div>
    `;
}

function formatBriefingText(text) {
    const escaped = escapeHtml(text);
    const sections = escaped.split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean);
    return sections.map((section) => {
        const lines = section.split('\n').map((line) => line.trim()).filter(Boolean);
        const title = lines[0];
        const body = lines.slice(1);
        const heading = /^\d+\./.test(title) || title.endsWith(':');
        if (!heading) {
            return `<div class="briefing-section"><div class="briefing-body">${lines.join('<br>')}</div></div>`;
        }

        const cleanTitle = title.replace(/^\d+\.\s*/, '').replace(/:$/, '');
        const listLike = body.every((line) => /^[-•]/.test(line));
        return `
            <div class="briefing-section">
                <h3>${cleanTitle}</h3>
                ${listLike
                ? `<ul class="briefing-list">${body.map((line) => `<li>${line.replace(/^[-•]\s*/, '')}</li>`).join('')}</ul>`
                : `<div class="briefing-body">${body.join('<br>')}</div>`}
            </div>
        `;
    }).join('');
}

function exportPdf() {
    if (!state.company) return;
    html2pdf().from(document.getElementById('dashboard')).set({
        margin: 10,
        filename: `InvestmentNavigator_${state.company.name}_${getCurrentYearKst()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#080a10' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).save();
}

function computeSMA(values, period) {
    const result = [];
    let sum = 0;
    for (let index = 0; index < values.length; index += 1) {
        sum += values[index];
        if (index >= period) sum -= values[index - period];
        result.push(index >= period - 1 ? sum / period : null);
    }
    return result;
}

function computeEMA(values, period) {
    const multiplier = 2 / (period + 1);
    const result = [];
    let ema = null;
    values.forEach((value, index) => {
        if (index === period - 1) {
            const slice = values.slice(0, period);
            ema = slice.reduce((sum, item) => sum + item, 0) / period;
            result.push(ema);
            return;
        }
        if (index < period - 1) {
            result.push(null);
            return;
        }
        ema = (value - ema) * multiplier + ema;
        result.push(ema);
    });
    return result;
}

function computeRSISeries(values, period = 14) {
    const rsi = Array(values.length).fill(null);
    if (values.length <= period) return rsi;
    let gains = 0;
    let losses = 0;
    for (let index = 1; index <= period; index += 1) {
        const diff = values[index] - values[index - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    rsi[period] = 100 - (100 / (1 + avgGain / (avgLoss || 1)));
    for (let index = period + 1; index < values.length; index += 1) {
        const diff = values[index] - values[index - 1];
        avgGain = ((avgGain * (period - 1)) + Math.max(diff, 0)) / period;
        avgLoss = ((avgLoss * (period - 1)) + Math.max(-diff, 0)) / period;
        rsi[index] = 100 - (100 / (1 + avgGain / (avgLoss || 1)));
    }
    return rsi;
}

function computeMACDSeries(values, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    const shortEma = computeEMA(values, shortPeriod);
    const longEma = computeEMA(values, longPeriod);
    const macd = values.map((_, index) => (shortEma[index] !== null && longEma[index] !== null ? shortEma[index] - longEma[index] : null));
    const filtered = macd.map((value) => value ?? 0);
    const signal = computeEMA(filtered, signalPeriod).map((value, index) => (macd[index] === null ? null : value));
    const histogram = macd.map((value, index) => (value !== null && signal[index] !== null ? value - signal[index] : null));
    return { macd, signal, histogram };
}

function computeStochasticSeries(highs, lows, closes, period = 14, signalPeriod = 3) {
    const k = closes.map((close, index) => {
        if (index < period - 1) return null;
        const high = Math.max(...highs.slice(index - period + 1, index + 1));
        const low = Math.min(...lows.slice(index - period + 1, index + 1));
        return high === low ? 50 : ((close - low) / (high - low)) * 100;
    });
    const d = computeSMA(k.map((value) => value ?? 0), signalPeriod).map((value, index) => (k[index] === null ? null : value));
    return { k, d };
}

function computeBollingerSeries(values, period = 20, multiplier = 2) {
    const middle = computeSMA(values, period);
    return values.map((value, index) => {
        if (index < period - 1 || middle[index] === null) return null;
        const slice = values.slice(index - period + 1, index + 1);
        const mean = middle[index];
        const variance = slice.reduce((sum, item) => sum + ((item - mean) ** 2), 0) / period;
        const std = Math.sqrt(variance);
        return {
            middle: mean,
            upper: mean + std * multiplier,
            lower: mean - std * multiplier
        };
    });
}

function drawOverlayLine(context, series, xAt, yAt, color) {
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = 1.8;
    let started = false;
    series.forEach((value, index) => {
        if (value === null || value === undefined) return;
        const x = xAt(index);
        const y = yAt(value);
        if (!started) {
            context.moveTo(x, y);
            started = true;
        } else {
            context.lineTo(x, y);
        }
    });
    context.stroke();
}

function drawLineSeries(context, series, xAt, yAt, color, width = 1.8) {
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = width;
    let started = false;
    series.forEach((value, index) => {
        if (value === null || value === undefined) return;
        const x = xAt(index);
        const y = yAt(value);
        if (!started) {
            context.moveTo(x, y);
            started = true;
        } else {
            context.lineTo(x, y);
        }
    });
    context.stroke();
}

function drawTooltip(context, anchorX, anchorY, lines, bounds) {
    const paddingX = 16;
    const paddingY = 14;
    const lineHeight = 20;
    const safeLines = Array.isArray(lines) ? lines : [];

    context.save();
    context.font = '600 13px Inter';
    const boxWidth = Math.min(
        Math.max(
            156,
            ...safeLines.map((line) => context.measureText(line).width + paddingX * 2)
        ),
        238
    );
    const boxHeight = Math.max(48, safeLines.length * lineHeight + paddingY * 2 - 4);
    const layout = InvestmentLogic.resolveChartTooltipLayout({
        anchorX,
        anchorY,
        boxWidth,
        boxHeight,
        bounds,
        gap: 16
    });
    const radius = 16;

    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.shadowColor = 'rgba(15, 23, 42, 0.18)';
    context.shadowBlur = 16;
    context.shadowOffsetY = 6;
    context.fillStyle = 'rgba(255, 255, 255, 0.84)';
    context.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    context.lineWidth = 1;

    context.beginPath();
    roundedRectPath(context, layout.x, layout.y, boxWidth, boxHeight, radius);
    context.fill();
    context.stroke();

    context.shadowColor = 'transparent';
    safeLines.forEach((line, index) => {
        const textY = layout.y + paddingY + (index * lineHeight);
        const isHeading = index === 0;
        context.font = isHeading ? '700 13px Inter' : '600 12px Inter';
        context.fillStyle = isHeading ? 'rgba(15, 23, 42, 0.96)' : 'rgba(15, 23, 42, 0.88)';
        context.fillText(line, layout.x + paddingX, textY);
    });
    context.restore();
}

function roundedRectPath(context, x, y, width, height, radius) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.moveTo(x + safeRadius, y);
    context.arcTo(x + width, y, x + width, y + height, safeRadius);
    context.arcTo(x + width, y + height, x, y + height, safeRadius);
    context.arcTo(x, y + height, x, y, safeRadius);
    context.arcTo(x, y, x + width, y, safeRadius);
    context.closePath();
}

function buildOscillatorMarkers(technicals, selectedIndicators) {
    const markers = [];
    for (let index = 1; index < technicals.rsi.length; index += 1) {
        if (selectedIndicators.has('RSI') && technicals.rsi[index] !== null) {
            if (technicals.rsi[index] < 30) markers.push({ index, type: 'buy', value: technicals.rsi[index] });
            if (technicals.rsi[index] > 70) markers.push({ index, type: 'sell', value: technicals.rsi[index] });
        }

        if (selectedIndicators.has('STOCH')) {
            const previousK = technicals.stoch.k[index - 1];
            const previousD = technicals.stoch.d[index - 1];
            const currentK = technicals.stoch.k[index];
            const currentD = technicals.stoch.d[index];
            if (previousK !== null && previousD !== null && currentK !== null && currentD !== null) {
                if (previousK <= previousD && currentK > currentD && currentK < 25) {
                    markers.push({ index, type: 'buy', value: currentK });
                } else if (previousK >= previousD && currentK < currentD && currentK > 75) {
                    markers.push({ index, type: 'sell', value: currentK });
                }
            }
        }
    }
    return markers.slice(-10);
}

function buildMacdMarkers(macd) {
    const markers = [];
    for (let index = 1; index < macd.macd.length; index += 1) {
        const prevMacd = macd.macd[index - 1];
        const prevSignal = macd.signal[index - 1];
        const currMacd = macd.macd[index];
        const currSignal = macd.signal[index];
        if (prevMacd === null || prevSignal === null || currMacd === null || currSignal === null) continue;
        if (prevMacd <= prevSignal && currMacd > currSignal) {
            markers.push({ index, type: 'buy', value: currMacd });
        } else if (prevMacd >= prevSignal && currMacd < currSignal) {
            markers.push({ index, type: 'sell', value: currMacd });
        }
    }
    return markers.slice(-10);
}

function drawSignalMarker(context, x, y, type) {
    context.save();
    context.fillStyle = type === 'buy' ? '#22c55e' : '#ef4444';
    context.strokeStyle = 'rgba(8,10,16,0.72)';
    context.lineWidth = 1;
    context.beginPath();
    if (type === 'buy') {
        context.moveTo(x, y - 9);
        context.lineTo(x - 7, y + 5);
        context.lineTo(x + 7, y + 5);
    } else {
        context.moveTo(x, y + 9);
        context.lineTo(x - 7, y - 5);
        context.lineTo(x + 7, y - 5);
    }
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
}

function scoreByRules(rules) {
    return Math.max(1, Math.min(5, rules.filter(Boolean).length));
}

function computeGrowth(current, previous) {
    if (current === null || current === undefined || previous === null || previous === undefined) return null;
    if (!previous) return null;
    return ((current / previous) - 1) * 100;
}

function formatMetricValue(value, type) {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    if (type === 'money') return formatKoreanMoney(value);
    if (type === 'pct') return `${value.toFixed(1)}%`;
    return String(value);
}

function formatKoreanMoney(value) {
    if (!value) return '0';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}조`;
    if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(1)}억`;
    return `${sign}${Math.round(abs).toLocaleString()}`;
}

function formatCompact(value) {
    if (!value) return '0';
    if (value >= 1e8) return `${(value / 1e8).toFixed(1)}억`;
    if (value >= 1e4) return `${(value / 1e4).toFixed(1)}만`;
    return value.toLocaleString();
}

function formatNullablePct(value) {
    if (value === null || value === undefined) return '-';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatDateToken(token) {
    if (!token || token.length !== 8) return token || '-';
    return `${token.slice(0, 4)}.${token.slice(4, 6)}.${token.slice(6, 8)}`;
}

function formatQuoteTime(value) {
    if (!value) return '공개 종가 기준';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '공개 종가 기준';
    return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);
}

function formatAxisDate(token, range = 'DAY') {
    if (!token || token.length !== 8) return '';
    const mode = String(range || 'DAY').toUpperCase();
    if (mode === 'YEAR') return token.slice(0, 4);
    if (mode === 'MONTH') return `${token.slice(2, 4)}.${token.slice(4, 6)}`;
    if (mode === 'WEEK') return `${token.slice(4, 6)}/${token.slice(6, 8)}`;
    return `${token.slice(4, 6)}.${token.slice(6, 8)}`;
}

function getCurrentYearKst() {
    return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()));
}

function getCurrentDateTokenKst() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}${map.month}${map.day}`;
}

function buildBusinessDateTokens(startToken, endToken) {
    const result = [];
    const cursor = toDate(startToken);
    const end = toDate(endToken);
    while (cursor <= end) {
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) {
            result.push(fromDate(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return result;
}

function toDate(token) {
    return new Date(Number(token.slice(0, 4)), Number(token.slice(4, 6)) - 1, Number(token.slice(6, 8)));
}

function fromDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function numericSeed(value) {
    return Array.from(String(value)).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function percentage(part, total) {
    if (!total) return 0;
    return (part / total) * 100;
}

function safeDivide(a, b) {
    if (!b) return 0;
    return a / b;
}

function lastDefined(series) {
    for (let index = series.length - 1; index >= 0; index -= 1) {
        if (series[index] !== null && series[index] !== undefined) return series[index];
    }
    return null;
}

function lastDefinedObject(series) {
    for (let index = series.length - 1; index >= 0; index -= 1) {
        if (series[index]) return series[index];
    }
    return null;
}

function weekKey(token) {
    const date = toDate(token);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() + 4 - day);
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}
