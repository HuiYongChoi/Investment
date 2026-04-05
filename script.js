const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const LOCAL_PROXY = 'http://localhost:8081';
const PROD_PROXY = '/proxy.php';
const KAKAO_JS_KEY = '88cd449d612399a0219090bbcfc20b24';
const KAKAO_STORAGE_TOKEN = 'invest_nav_kakao_token';
const KAKAO_STORAGE_ERROR = 'invest_nav_kakao_error';
const KAKAO_STORAGE_RETURN_URL = 'invest_nav_kakao_return_url';
const KAKAO_STORAGE_PROFILE = 'invest_nav_kakao_profile';
const KAKAO_REDIRECT_URI = InvestmentLogic.resolveKakaoRedirectUri(location.href);
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

const state = {
    company: null,
    annuals: [],
    annualsAll: [],
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
    chartPinch: null,
    techPinch: null,
    chartPointers: new Map(),
    techPointers: new Map(),
    chartHoverAbsoluteIndex: null,
    chartSource: 'idle',
    technicalsFull: null,
    technicalsFullSignature: '',
    searchQuery: '',
    searchMatches: [],
    searchMatchIndex: -1,
    technicals: null,
    ratings: null,
    metrics: null,
    historicalMetrics: [],
    financialHistoryRange: 3,
    financialPriceHistory: [],
    summaries: [],
    briefingMode: 'idle',
    mobileTab: 'home',
    mobileContentTab: 'chart',
    lastAnalysis: { fin: {}, scores: {}, totalPct: 0, metrics: {}, anomalies: [] },
    selectedIndicators: new Set(['RSI', 'MACD', 'STOCH', 'BOLL', 'MA']),
    analysisToken: 0
};
let priceHoverIndex = null;

lucide.createIcons();
bindEvents();
startClock();
initKakao();
syncKakaoAuthUI(null, { loggedIn: false });
restoreKakaoSession().finally(consumeKakaoMessage);
loadMarketSummary();
loadCompanyDirectory();
syncMobileTabUI();

function bindEvents() {
    const companyInput = document.getElementById('company-input');
    const suggestionBox = document.getElementById('company-suggestions');
    const sectorPresetSelect = document.getElementById('m-sector-preset');
    const financialPeriodSelect = document.getElementById('fin-period-select');
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
    document.getElementById('mobile-kakao-login')?.addEventListener('click', beginKakaoLogin);
    document.getElementById('mobile-kakao-logout')?.addEventListener('click', logoutKakao);
    document.getElementById('kakao-send-btn').addEventListener('click', sendBriefingToKakao);
    document.getElementById('chart-range-controls').addEventListener('click', onChartRangeClick);
    document.getElementById('chart-reset-btn').addEventListener('click', resetChartZoom);
    document.querySelectorAll('[data-chart-zoom]').forEach((button) => {
        button.addEventListener('click', onChartZoomClick);
    });
    document.getElementById('indicator-toggle').addEventListener('click', onIndicatorToggle);
    if (sectorPresetSelect) {
        sectorPresetSelect.addEventListener('change', onValuationSectorPresetChange);
    }
    if (financialPeriodSelect) {
        financialPeriodSelect.addEventListener('change', onFinancialPeriodChange);
    }
    document.querySelectorAll('[data-number-format="won"]').forEach((input) => {
        if (input.readOnly) return;
        input.addEventListener('input', onWonInputFormat);
        input.addEventListener('blur', onWonInputFormat);
    });
    document.querySelectorAll('[data-mobile-tab-target]').forEach((button) => {
        button.addEventListener('click', onMobileTabClick);
    });
    document.querySelectorAll('[data-mobile-content-target]').forEach((button) => {
        button.addEventListener('click', onMobileContentTabClick);
    });
    ['m-adjusted-eps', 'm-target-per', 'm-eps-growth', 'm-required-return'].forEach((id) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', onValuationManualInput);
        input.addEventListener('blur', onValuationManualInput);
    });
    window.addEventListener('resize', debounce(() => {
        syncMobileTabUI();
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

function renderCompanyHeading(name, anomalies = []) {
    const heading = document.getElementById('company-name');
    if (!heading) return;

    heading.replaceChildren(document.createTextNode(name || '-'));

    if (!Array.isArray(anomalies) || !anomalies.length) {
        return;
    }

    const icon = document.createElement('span');
    icon.className = 'anomaly-warning-icon';
    icon.tabIndex = 0;
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', '재무 법의학 경고');

    const symbol = document.createElement('span');
    symbol.className = 'anomaly-warning-symbol';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = '⚠️';
    icon.appendChild(symbol);

    const tooltip = document.createElement('div');
    tooltip.className = 'anomaly-tooltip';

    const title = document.createElement('div');
    title.className = 'anomaly-tooltip-title';
    title.textContent = '재무 법의학 Red Flags';
    tooltip.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'anomaly-tooltip-list';
    anomalies.forEach((message) => {
        const text = String(message || '').trim();
        if (!text) return;
        const item = document.createElement('li');
        item.textContent = text;
        list.appendChild(item);
    });
    tooltip.appendChild(list);
    icon.appendChild(tooltip);
    heading.appendChild(icon);
}

function applySummaryAnomalies() {
    const currentSummary = state.summaries[0]?.summary || null;
    const pastSummaries = state.summaries.slice(1)
        .map((item) => item.summary)
        .filter(Boolean);
    const anomalies = currentSummary
        ? InvestmentLogic.detectAnomalies(currentSummary, pastSummaries)
        : [];

    state.lastAnalysis.anomalies = anomalies;
    if (currentSummary) {
        currentSummary.anomalies = anomalies;
    }
    renderCompanyHeading(state.company?.name || '-', anomalies);
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
    const mobileClock = document.getElementById('mobile-market-datetime');
    if (mobileClock) {
        mobileClock.textContent = dateLabel.replace(/\s+/g, ' ');
    }
}

function setTextIfPresent(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = value;
}

function writeKakaoStorage(key, value) {
    try {
        if (value === null || value === undefined || value === '') {
            sessionStorage.removeItem(key);
        } else {
            sessionStorage.setItem(key, value);
        }
    } catch (error) {
        console.warn('sessionStorage write failed', error);
    }

    try {
        if (value === null || value === undefined || value === '') {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, value);
        }
    } catch (error) {
        console.warn('localStorage write failed', error);
    }
}

function readKakaoStorage(key) {
    try {
        const sessionValue = sessionStorage.getItem(key);
        if (sessionValue) return sessionValue;
    } catch (error) {
        console.warn('sessionStorage read failed', error);
    }

    try {
        return localStorage.getItem(key) || '';
    } catch (error) {
        console.warn('localStorage read failed', error);
        return '';
    }
}

function readStoredKakaoProfile() {
    const raw = readKakaoStorage(KAKAO_STORAGE_PROFILE);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.warn('Kakao profile storage parse failed', error);
        writeKakaoStorage(KAKAO_STORAGE_PROFILE, '');
        return null;
    }
}

function syncKakaoAuthUI(profile, options = {}) {
    const isLoggedIn = options.loggedIn === true;
    const isFallback = options.fallback === true;
    const nickname = profile?.nickname || '카카오 사용자';
    const image = profile?.image || '';
    const stateText = isFallback ? '카카오 로그인 유지 중' : '카카오 프로필 동기화 완료';

    if (isLoggedIn) {
        document.getElementById('btn-kakao-login').classList.add('hidden');
        document.getElementById('kakao-user-profile').classList.remove('hidden');
        document.getElementById('mobile-kakao-login')?.classList.add('hidden');
        document.getElementById('mobile-kakao-profile')?.classList.remove('hidden');
        document.getElementById('mobile-kakao-logout')?.classList.remove('hidden');
    } else {
        document.getElementById('btn-kakao-login').classList.remove('hidden');
        document.getElementById('kakao-user-profile').classList.add('hidden');
        document.getElementById('mobile-kakao-login')?.classList.remove('hidden');
        document.getElementById('mobile-kakao-profile')?.classList.add('hidden');
        document.getElementById('mobile-kakao-logout')?.classList.add('hidden');
    }

    if (!isLoggedIn) {
        setTextIfPresent('kakao-nickname', '카카오 로그인');
        setTextIfPresent('kakao-login-state', '로그인이 필요합니다');
        setTextIfPresent('mobile-kakao-nickname', '카카오 로그인');
        setTextIfPresent('mobile-kakao-login-state', '간편 로그인');
        document.getElementById('kakao-profile-img').removeAttribute('src');
        document.getElementById('mobile-kakao-profile-img')?.removeAttribute('src');
        return;
    }

    setTextIfPresent('kakao-nickname', nickname);
    setTextIfPresent('kakao-login-state', stateText);
    setTextIfPresent('mobile-kakao-nickname', nickname);
    setTextIfPresent('mobile-kakao-login-state', stateText);
    if (image) {
        document.getElementById('kakao-profile-img').src = image;
        document.getElementById('mobile-kakao-profile-img')?.setAttribute('src', image);
    } else {
        document.getElementById('kakao-profile-img').removeAttribute('src');
        document.getElementById('mobile-kakao-profile-img')?.removeAttribute('src');
    }
}

function isMobileHybridViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function syncMobileHeaderChrome() {
    const dashboard = document.getElementById('dashboard');
    const body = document.body;
    const dashboardVisible = !!dashboard && !dashboard.classList.contains('hidden');
    body.classList.toggle('mobile-dashboard-active', isMobileHybridViewport() && dashboardVisible && state.mobileTab !== 'home');
}

function setMobileTab(tab, options = {}) {
    const dashboard = document.getElementById('dashboard');
    const tabbar = document.getElementById('mobile-tabbar');
    if (!dashboard || !tabbar) return;
    const allowedTabs = new Set(['home', 'chart-finance', 'valuation', 'briefing']);
    tab = allowedTabs.has(tab) ? tab : 'chart-finance';
    if (tab !== 'home' && dashboard.classList.contains('hidden')) {
        tab = 'home';
    }
    state.mobileTab = tab;
    dashboard.dataset.mobileTab = tab;
    tabbar.querySelectorAll('[data-mobile-tab-target]').forEach((button) => {
        const active = button.dataset.mobileTabTarget === tab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (tab === 'chart-finance' && !dashboard.classList.contains('hidden')) {
        requestAnimationFrame(() => {
            renderCharts();
        });
    }
    if (options.scroll && isMobileHybridViewport()) {
        const target = tab === 'home'
            ? document.getElementById('search-hero')
            : dashboard;
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function setMobileContentTab(tab, options = {}) {
    const dashboard = document.getElementById('dashboard');
    const contentTabbar = document.getElementById('mobile-content-tabbar');
    if (!dashboard || !contentTabbar) return;

    const allowedTabs = new Set(['chart', 'finance', 'technical']);
    tab = allowedTabs.has(tab) ? tab : 'chart';
    state.mobileContentTab = tab;
    dashboard.dataset.mobileContentTab = tab;

    contentTabbar.querySelectorAll('[data-mobile-content-target]').forEach((button) => {
        const active = button.dataset.mobileContentTarget === tab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (options.scroll && isMobileHybridViewport()) {
        contentTabbar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (!dashboard.classList.contains('hidden') && state.mobileTab === 'chart-finance' && (tab === 'chart' || tab === 'technical')) {
        requestAnimationFrame(() => {
            renderCharts();
        });
    }
}

function syncMobileTabUI() {
    const dashboard = document.getElementById('dashboard');
    const tabbar = document.getElementById('mobile-tabbar');
    const contentTabbar = document.getElementById('mobile-content-tabbar');
    const utilityStrip = document.getElementById('mobile-utility-strip');
    const searchHero = document.getElementById('search-hero');
    if (!dashboard || !tabbar) return;
    const isMobile = isMobileHybridViewport();
    const dashboardVisible = !dashboard.classList.contains('hidden');
    const shouldShowTabbar = isMobile;
    const shouldShowHome = !isMobile || !dashboardVisible || state.mobileTab === 'home';
    tabbar.classList.toggle('hidden', !shouldShowTabbar);
    utilityStrip?.classList.toggle('hidden', !(isMobile && shouldShowHome));
    searchHero?.classList.toggle('hidden', isMobile && !shouldShowHome);
    dashboard.classList.toggle('mobile-home-hidden', isMobile && dashboardVisible && state.mobileTab === 'home');
    setMobileTab(state.mobileTab || dashboard.dataset.mobileTab || 'chart-finance');
    const shouldShowContentTabbar = isMobile && dashboardVisible && state.mobileTab === 'chart-finance';
    contentTabbar?.classList.toggle('hidden', !shouldShowContentTabbar);
    setMobileContentTab(state.mobileContentTab || dashboard.dataset.mobileContentTab || 'chart');
    syncMobileHeaderChrome();
}

function onMobileTabClick(event) {
    const button = event.target.closest('[data-mobile-tab-target]');
    if (!button) return;
    setMobileTab(button.dataset.mobileTabTarget, { scroll: true });
    syncMobileTabUI();
}

function onMobileContentTabClick(event) {
    const button = event.target.closest('[data-mobile-content-target]');
    if (!button) return;
    setMobileContentTab(button.dataset.mobileContentTarget, { scroll: false });
}

function setMarketChg(id, changePct, options = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    if (changePct === null || changePct === undefined) {
        el.textContent = '';
        el.className = 'market-chg';
        return;
    }
    const inverse = options.inverse === true;
    const sign = changePct > 0 ? '+' : '';
    el.textContent = `${sign}${changePct.toFixed(2)}%`;
    if (inverse) {
        el.className = `market-chg ${changePct > 0 ? 'cost-up' : changePct < 0 ? 'cost-down' : ''}`;
        return;
    }
    el.className = `market-chg ${changePct > 0 ? 'up' : changePct < 0 ? 'down' : ''}`;
}

function formatMarketIndexValue(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '-';
    return numeric.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatCommodityUsd(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '-';
    return `$${numeric.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

async function loadMarketSummary() {
    try {
        const data = await fetchJson(buildProxyUrl('market', '/summary'));
        if (data.usdKrw) {
            document.getElementById('fx-usdkrw').textContent = `${data.usdKrw.toFixed(2)}원`;
            document.getElementById('mobile-fx-usdkrw').textContent = `${data.usdKrw.toFixed(2)}원`;
            document.getElementById('fx-usdkrw-note').textContent = '1달러 기준';
            setMarketChg('fx-usdkrw-chg', data.usdKrwChangePct ?? null);
            setMarketChg('mobile-fx-usdkrw-chg', data.usdKrwChangePct ?? null);
        }
        if (data.jpyKrw) {
            document.getElementById('fx-jpykrw').textContent = `${(data.jpyKrw * 100).toFixed(2)}원`;
            document.getElementById('mobile-fx-jpykrw').textContent = `${(data.jpyKrw * 100).toFixed(2)}원`;
            document.getElementById('fx-jpykrw-note').textContent = '100엔 기준';
            setMarketChg('fx-jpykrw-chg', data.jpyKrwChangePct ?? null);
            setMarketChg('mobile-fx-jpykrw-chg', data.jpyKrwChangePct ?? null);
        }
        if (data.goldKrwPerGram) {
            document.getElementById('gold-krw').textContent = `${Math.round(data.goldKrwPerGram).toLocaleString()}원`;
            document.getElementById('mobile-gold-krw').textContent = `${Math.round(data.goldKrwPerGram).toLocaleString()}원`;
            document.getElementById('gold-note').textContent = '금 1g 추정';
            setMarketChg('gold-chg', data.goldChangePct ?? null);
            setMarketChg('mobile-gold-chg', data.goldChangePct ?? null);
        } else {
            document.getElementById('gold-note').textContent = '외부 시세 연결 대기';
        }
        if (data.vix) {
            document.getElementById('vix-value').textContent = data.vix.toFixed(2);
            document.getElementById('mobile-vix-value').textContent = data.vix.toFixed(2);
            setMarketChg('vix-chg', data.vixChangePct ?? null);
            setMarketChg('mobile-vix-chg', data.vixChangePct ?? null);
            const vixLevel = data.vix < 15 ? '극도 낙관' : data.vix < 20 ? '안정' : data.vix < 30 ? '경계' : data.vix < 40 ? '공포' : '극도 공포';
            document.getElementById('vix-note').textContent = vixLevel;
        }
        if (data.wti) {
            document.getElementById('wti-value').textContent = formatCommodityUsd(data.wti);
            document.getElementById('mobile-wti-value').textContent = formatCommodityUsd(data.wti);
            document.getElementById('wti-note').textContent = '미국 원유 벤치마크';
            setMarketChg('wti-chg', data.wtiChangePct ?? null, { inverse: true });
            setMarketChg('mobile-wti-chg', data.wtiChangePct ?? null, { inverse: true });
        }
        if (data.brent) {
            document.getElementById('brent-value').textContent = formatCommodityUsd(data.brent);
            document.getElementById('mobile-brent-value').textContent = formatCommodityUsd(data.brent);
            document.getElementById('brent-note').textContent = '글로벌 실물 원유 기준';
            setMarketChg('brent-chg', data.brentChangePct ?? null, { inverse: true });
            setMarketChg('mobile-brent-chg', data.brentChangePct ?? null, { inverse: true });
        }
        if (data.kospi) {
            document.getElementById('kospi-value').textContent = formatMarketIndexValue(data.kospi);
            document.getElementById('mobile-kospi-value').textContent = formatMarketIndexValue(data.kospi);
            document.getElementById('kospi-note').textContent = '코스피 종합지수';
            setMarketChg('kospi-chg', data.kospiChangePct ?? null);
            setMarketChg('mobile-kospi-chg', data.kospiChangePct ?? null);
        }
        if (data.kosdaq) {
            document.getElementById('kosdaq-value').textContent = formatMarketIndexValue(data.kosdaq);
            document.getElementById('mobile-kosdaq-value').textContent = formatMarketIndexValue(data.kosdaq);
            document.getElementById('kosdaq-note').textContent = '코스닥 종합지수';
            setMarketChg('kosdaq-chg', data.kosdaqChangePct ?? null);
            setMarketChg('mobile-kosdaq-chg', data.kosdaqChangePct ?? null);
        }
    } catch (error) {
        document.getElementById('fx-usdkrw-note').textContent = '연동 실패';
        document.getElementById('fx-jpykrw-note').textContent = '연동 실패';
        document.getElementById('gold-note').textContent = '연동 실패';
        document.getElementById('vix-note').textContent = '연동 실패';
        document.getElementById('wti-note').textContent = '연동 실패';
        document.getElementById('brent-note').textContent = '연동 실패';
        document.getElementById('kospi-note').textContent = '연동 실패';
        document.getElementById('kosdaq-note').textContent = '연동 실패';
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
    try {
        sessionStorage.setItem(KAKAO_STORAGE_RETURN_URL, location.href);
        localStorage.setItem(KAKAO_STORAGE_RETURN_URL, location.href);
    } catch (error) {
        console.warn('Kakao return URL storage fallback', error);
    }
    writeKakaoStorage(KAKAO_STORAGE_RETURN_URL, location.href);
    writeKakaoStorage(KAKAO_STORAGE_ERROR, '');
    Kakao.Auth.authorize({
        redirectUri: KAKAO_REDIRECT_URI
    });
}

async function restoreKakaoSession() {
    const accessToken = sessionStorage.getItem(KAKAO_STORAGE_TOKEN) || localStorage.getItem(KAKAO_STORAGE_TOKEN) || (window.Kakao ? Kakao.Auth.getAccessToken() : '');
    const storedProfile = readStoredKakaoProfile();
    if (!accessToken) return;
    try {
        if (window.Kakao) {
            Kakao.Auth.setAccessToken(accessToken);
        }
        writeKakaoStorage(KAKAO_STORAGE_TOKEN, accessToken);
        if (storedProfile) {
            applyKakaoProfile(storedProfile, { fallback: true });
        } else {
            syncKakaoAuthUI({ nickname: '카카오 사용자', image: '' }, { loggedIn: true, fallback: true });
        }
        if (!window.Kakao) return;
        const profile = await Kakao.API.request({ url: '/v2/user/me' });
        applyKakaoProfile(profile);
        writeKakaoStorage(KAKAO_STORAGE_ERROR, '');
    } catch (error) {
        console.warn('Kakao profile restore fallback', error);
        writeKakaoStorage(KAKAO_STORAGE_TOKEN, accessToken);
        if (storedProfile) {
            applyKakaoProfile(storedProfile, { fallback: true });
            writeKakaoStorage(KAKAO_STORAGE_ERROR, '');
            return;
        }
        syncKakaoAuthUI({ nickname: '카카오 사용자', image: '' }, { loggedIn: true, fallback: true });
        writeKakaoStorage(KAKAO_STORAGE_ERROR, '카카오 프로필을 기본 상태로 연결했습니다.');
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
    InvestmentLogic.clearKakaoSessionState(localStorage, null);
    syncKakaoAuthUI(null, { loggedIn: false });
}

function applyKakaoProfile(profile, options = {}) {
    const { nickname, image } = InvestmentLogic.extractKakaoProfile(profile);
    writeKakaoStorage(KAKAO_STORAGE_PROFILE, JSON.stringify(profile || {}));
    syncKakaoAuthUI({ nickname, image }, { loggedIn: true, fallback: options.fallback === true });
}

function consumeKakaoMessage() {
    const error = readKakaoStorage(KAKAO_STORAGE_ERROR);
    if (!error) return;
    setStatus(`카카오 로그인 안내: ${error}`, 'warn');
    writeKakaoStorage(KAKAO_STORAGE_ERROR, '');
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
    state.annualsAll = [];
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
    state.chartPinch = null;
    state.techPinch = null;
    state.chartPointers.clear();
    state.techPointers.clear();
    state.chartHoverAbsoluteIndex = null;
    state.chartFullSeries = [];
    state.chartVisible = [];
    state.chartSource = 'idle';
    state.technicals = null;
    state.technicalsFull = null;
    state.technicalsFullSignature = '';
    state.ratings = null;
    state.metrics = null;
    state.historicalMetrics = [];
    state.financialHistoryRange = 3;
    state.financialPriceHistory = [];
    state.summaries = [];
    state.lastAnalysis = { fin: {}, scores: {}, totalPct: 0, metrics: {}, anomalies: [] };
    priceHoverIndex = null;
    setStatus(`${company.name} 분석을 시작합니다. DART, Yahoo Finance 시세와 다중 기간 차트를 동기화하는 중입니다.`);
    setSourceBadge('source-dart', 'DART 동기화 중');
    setSourceBadge('source-market', 'Yahoo Finance 동기화 중');
    setSourceBadge('source-gemini', 'Gemini 대기 중');

    renderCompanyHeading(company.name, []);
    document.getElementById('company-meta').textContent = `${getCurrentYearKst()}년 기준 최근 3개년 실적과 Yahoo Finance (yfinance Python) 일·주·월·연/YTD 가격 흐름을 분석합니다.`;
    document.getElementById('dart-link').href = buildDartCompanySearchUrl(company);
    document.getElementById('dashboard').classList.remove('hidden');
    setMobileTab('chart-finance');
    setMobileContentTab('chart');
    syncMobileTabUI();
    document.getElementById('stock-realtime').classList.add('hidden');
    document.getElementById('stock-realtime').innerHTML = '';
    document.getElementById('fin-period-select').value = '3';
    setFinancialHistoryLoading(false);
    resetMetricManualInputs();
    renderReports([]);
    renderFinancialTable('fin-annual-table', []);
    renderHistoricalMetricsTable('fin-metrics-table', []);
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
            state.financialPriceHistory = dailyPoints.slice();
            state.chartSource = 'yfinance_python';
            writeChartCache(company.stockCode, state.chartDaily, state.chartWeekly);
            setSourceBadge('source-market', 'Yahoo Finance 차트 연동됨', 'success');
        } else if (cachedChart) {
            state.chartDaily = cachedChart.daily;
            state.chartWeekly = cachedChart.weekly.length ? cachedChart.weekly : aggregateCandles(cachedChart.daily, 'week');
            state.financialPriceHistory = cachedChart.daily.slice();
            state.chartSource = 'cache';
            setSourceBadge('source-market', 'Yahoo Finance 실패 · 저장된 마지막 차트 사용', 'warn');
        } else {
            state.chartDaily = [];
            state.chartWeekly = [];
            state.financialPriceHistory = [];
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
            state.annualsAll = annualsResult.value;
            state.annuals = annualsResult.value.slice(0, state.financialHistoryRange);
            state.quarterlies = quarterliesResult.status === 'fulfilled' ? quarterliesResult.value : [];
            syncFinancialHistoryViews();
            renderFinancialTable('fin-quarterly-table', state.quarterlies);
            const valuationSnapshot = state.quote || latestChartPoint || null;
            autoFillMetrics(state.summaries[0]?.summary || {}, valuationSnapshot, state.summaries[1]?.summary || null);
            calcMetrics();
            buildRatings();
            setSourceBadge('source-dart', 'DART 공시 연동됨', 'success');
        } else {
            state.annuals = [];
            state.annualsAll = [];
            state.quarterlies = quarterliesResult.status === 'fulfilled' ? quarterliesResult.value : [];
            state.summaries = [];
            applySummaryAnomalies();
            renderFinancialTable('fin-annual-table', []);
            renderHistoricalMetricsTable('fin-metrics-table', []);
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
            if (state.annualsAll.length) {
                syncFinancialHistoryViews();
            }
            autoFillMetrics(state.summaries[0]?.summary || {}, state.quote || latestChartPoint || null, state.summaries[1]?.summary || null);
            calcMetrics();
            buildRatings();
        }

        if (state.summaries.length) {
            await generateBriefing();
            if (analysisToken !== state.analysisToken) return;
        } else {
            setSourceBadge('source-gemini', 'Gemini 대기', 'warn');
        }

        setStatus(`${company.name} 분석이 완료되었습니다.`, 'success');
        if (isMobileHybridViewport()) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
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

async function fetchAnnualDartYear(corpCode, year) {
    const [statementResult, shareResult] = await Promise.allSettled([
        fetchJson(buildProxyUrl('dart', '/fnlttSinglAcnt.json', {
            corp_code: corpCode,
            bsns_year: year,
            reprt_code: '11011'
        })),
        fetchJson(buildProxyUrl('dart', '/stockTotqySttus.json', {
            corp_code: corpCode,
            bsns_year: year,
            reprt_code: '11011'
        }))
    ]);

    if (statementResult.status !== 'fulfilled') {
        return null;
    }

    const annualPayload = statementResult.value;
    if (annualPayload.status !== '000' || !Array.isArray(annualPayload.list) || !annualPayload.list.length) {
        return null;
    }

    const shareList = shareResult.status === 'fulfilled' && shareResult.value?.status === '000' && Array.isArray(shareResult.value.list)
        ? shareResult.value.list
        : [];
    const summary = summarizeStatement(annualPayload.list);

    return {
        year,
        label: `${year} 사업보고서`,
        period: 'ANNUAL',
        reportCode: '11011',
        rank: 4,
        annual: true,
        sortKey: year * 10 + 4,
        shareCount: InvestmentLogic.extractAnnualShareCount(shareList),
        list: annualPayload.list,
        summary
    };
}

async function fetchAnnualDartBatch(corpCode, years) {
    const settled = await Promise.allSettled((years || []).map((year) => fetchAnnualDartYear(corpCode, year)));
    return settled
        .filter((result) => result.status === 'fulfilled' && result.value)
        .map((result) => result.value);
}

async function fetchMultiYearDart(corpCode, limit = 3, excludedYears = []) {
    const currentYear = getCurrentYearKst();
    const skipYears = new Set((excludedYears || []).map((year) => Number(year)).filter(Boolean));
    const results = [];
    const candidateYears = [];

    for (let year = currentYear - 1; year >= currentYear - 15; year -= 1) {
        if (skipYears.has(year)) continue;
        candidateYears.push(year);
    }

    for (let index = 0; index < candidateYears.length && results.length < limit; index += 3) {
        const batchYears = candidateYears.slice(index, index + 3);
        const batchResults = await fetchAnnualDartBatch(corpCode, batchYears);
        results.push(...batchResults);
    }

    return InvestmentLogic.buildDartAnnualPeriods(results, limit);
}

async function fetchQuarterlyHistory(corpCode) {
    const currentYear = getCurrentYearKst();
    const rawPeriods = [];
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
                    rawPeriods.push({
                        year,
                        label: `${year} ${report.annual ? '4분기(사업보고서)' : report.label}`,
                        period: `Q${report.rank}`,
                        sortKey: year * 10 + report.rank,
                        rank: report.rank,
                        reportCode: report.code,
                        isAnnual: Boolean(report.annual),
                        annual: Boolean(report.annual),
                        list: data.list
                    });
                }
            } catch (error) {
                continue;
            }
        }
    }

    return InvestmentLogic.buildDartQuarterlyPeriods(rawPeriods);
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
        summary: period.summary || summarizeStatement(period.list)
    }));
}

function summarizeStatement(list) {
    return InvestmentLogic.summarizeStatement(list);
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

function renderHistoricalMetricsTable(containerId, rows) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!rows.length) {
        container.innerHTML = '<div class="report-item">연도별 투자 지표를 계산할 데이터가 아직 없습니다.</div>';
        return;
    }

    const metricRows = [
        { label: '연말 종가', key: 'yearEndClose', type: 'money' },
        { label: '발행주식수', key: 'shareCount', type: 'shares' },
        { label: 'EPS', key: 'eps', type: 'money' },
        { label: 'BPS', key: 'bps', type: 'money' },
        { label: 'PER', key: 'per', type: 'multiple' },
        { label: 'PBR', key: 'pbr', type: 'multiple' },
        { label: 'ROE', key: 'roe', type: 'pct' },
        { label: 'ROIC', key: 'roic', type: 'pct' }
    ];

    const headerCells = rows.map((row) => `<th>${row.year}</th>`).join('');
    const body = metricRows.map((metric) => `
        <tr>
            <td>${metric.label}</td>
            ${rows.map((row) => {
                const metaText = metric.key === 'yearEndClose' && row.yearEndClose !== null && row.yearEndClose !== undefined
                    ? '<span class="fin-meta">해당 연도 마지막 종가</span>'
                    : '';
                return `<td><span class="fin-val">${formatMetricValue(row[metric.key], metric.type)}</span>${metaText}</td>`;
            }).join('')}
        </tr>
    `).join('');

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

function setFinancialHistoryLoading(isLoading, message = '') {
    const loadingChip = document.getElementById('fin-period-loading');
    const overlay = document.getElementById('fin-history-overlay');
    const periodSelect = document.getElementById('fin-period-select');
    if (loadingChip) {
        loadingChip.classList.toggle('hidden', !isLoading);
        const textNode = loadingChip.querySelector('span:last-child');
        if (textNode && message) {
            textNode.textContent = message;
        }
    }
    if (overlay) {
        overlay.classList.toggle('hidden', !isLoading);
    }
    if (periodSelect) {
        periodSelect.disabled = isLoading;
    }
}

function getSelectedFinancialHistoryYears() {
    const select = document.getElementById('fin-period-select');
    const value = Number(select?.value || state.financialHistoryRange || 3);
    return [3, 5, 10].includes(value) ? value : 3;
}

function mergePriceHistoryRows(existingRows, incomingRows) {
    const merged = new Map();
    [...(existingRows || []), ...(incomingRows || [])]
        .filter((row) => row && row.date)
        .forEach((row) => {
            merged.set(row.date, row);
        });

    return Array.from(merged.values()).sort((left, right) => left.date.localeCompare(right.date));
}

async function ensureHistoricalPriceCoverage(company, periods, analysisToken) {
    if (!company?.stockCode || !periods.length) return;

    const years = periods
        .map((period) => Number(period?.year) || 0)
        .filter(Boolean);
    if (!years.length) return;

    const earliestNeededYear = Math.min(...years);
    const oldestAvailableYear = state.financialPriceHistory.length
        ? Number(String(state.financialPriceHistory[0].date || '').slice(0, 4)) || Infinity
        : Infinity;

    if (oldestAvailableYear <= earliestNeededYear) {
        return;
    }

    const endDate = Number.isFinite(oldestAvailableYear) && oldestAvailableYear !== Infinity
        ? `${oldestAvailableYear - 1}1231`
        : getCurrentDateTokenKst();
    const pricePayload = await fetchYfinanceChart(
        company.stockCode,
        company.market,
        'daily',
        `${earliestNeededYear}0101`,
        endDate,
        buildCompanyNameHint(company)
    ).catch(() => ({ live: false, rows: [] }));
    if (analysisToken !== state.analysisToken || !pricePayload?.live) {
        return;
    }

    const normalizedRows = InvestmentLogic.normalizeYfinanceChartRows(pricePayload.rows, {
        startDate: `${earliestNeededYear}0101`
    });
    if (normalizedRows.length) {
        state.financialPriceHistory = mergePriceHistoryRows(normalizedRows, state.financialPriceHistory);
    }
}

function syncFinancialHistoryViews() {
    state.annuals = state.annualsAll.slice(0, state.financialHistoryRange);
    state.summaries = state.annuals.map((item) => ({
        ...item,
        summary: item.summary || summarizeStatement(item.list)
    }));
    applySummaryAnomalies();
    renderFinancialTable('fin-annual-table', state.annuals);
    const priceMap = InvestmentLogic.buildYearEndCloseMap(
        state.financialPriceHistory.length ? state.financialPriceHistory : state.chartDaily
    );
    state.historicalMetrics = InvestmentLogic.buildHistoricalInvestmentRows(
        state.annuals,
        priceMap,
        state.quote?.sharesOutstanding || 0
    );
    renderHistoricalMetricsTable('fin-metrics-table', state.historicalMetrics);
}

async function ensureFinancialHistoryCoverage(desiredYears, analysisToken = state.analysisToken) {
    if (!state.company?.corpCode) return;

    const nextYears = [3, 5, 10].includes(Number(desiredYears)) ? Number(desiredYears) : 3;
    const loadedYears = new Set((state.annualsAll || []).map((period) => Number(period?.year)).filter(Boolean));
    const missingCount = Math.max(0, nextYears - loadedYears.size);

    if (missingCount > 0) {
        const fetchedPeriods = await fetchMultiYearDart(state.company.corpCode, missingCount, Array.from(loadedYears));
        if (analysisToken !== state.analysisToken) return;
        state.annualsAll = InvestmentLogic.mergeAnnualHistoryPeriods(state.annualsAll, fetchedPeriods);
    }

    state.financialHistoryRange = nextYears;
    await ensureHistoricalPriceCoverage(state.company, state.annualsAll.slice(0, nextYears), analysisToken);
    if (analysisToken !== state.analysisToken) return;

    syncFinancialHistoryViews();
}

async function onFinancialPeriodChange(event) {
    const targetYears = Number(event.target?.value || 3);
    if (!state.company || !state.annualsAll.length) {
        state.financialHistoryRange = targetYears;
        return;
    }

    const activeToken = state.analysisToken;
    setFinancialHistoryLoading(true, `${targetYears}년 조회를 위해 과거 연도를 추가 조회하는 중입니다.`);
    setStatus(`${state.company.name}의 최근 ${targetYears}년 재무와 투자 지표를 불러오는 중입니다.`);
    try {
        await ensureFinancialHistoryCoverage(targetYears, activeToken);
        if (activeToken !== state.analysisToken) return;
        if (state.quote || state.chartDaily.length) {
            autoFillMetrics(
                state.summaries[0]?.summary || {},
                state.quote || state.chartDaily[state.chartDaily.length - 1] || null,
                state.summaries[1]?.summary || null
            );
            calcMetrics();
            buildRatings();
        }
        setStatus(`${state.company.name}의 최근 ${targetYears}년 재무와 투자 지표를 갱신했습니다.`, 'success');
    } catch (error) {
        console.error(error);
        if (activeToken !== state.analysisToken) return;
        setStatus(error.message || '과거 재무 조회 중 오류가 발생했습니다.', 'error');
    } finally {
        if (activeToken === state.analysisToken) {
            setFinancialHistoryLoading(false);
        }
    }
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

function onWonInputFormat(event) {
    const input = event.target;
    if (!input || input.readOnly) return;
    input.value = InvestmentLogic.formatWonInputValue(input.value);
}

function onValuationManualInput(event) {
    const input = event.target;
    if (!input || input.readOnly) return;
    if (input.dataset.numberFormat === 'won') {
        input.value = InvestmentLogic.formatWonInputValue(input.value);
    }
    if (!state.lastAnalysis.fin) return;
    calcMetrics();
}

function renderForwardEpsWarning(show) {
    const warning = document.getElementById('forward-eps-warning');
    if (!warning) return;
    warning.classList.toggle('hidden', !show);
}

function getSelectedValuationSectorPreset() {
    return InvestmentLogic.resolveValuationSectorPreset(document.getElementById('m-sector-preset')?.value || '');
}

function renderValuationPresetGuide(preset) {
    const nameBadge = document.getElementById('sector-name-badge');
    const premiumBadge = document.getElementById('sector-premium-badge');
    const guideCopy = document.getElementById('metrics-guide-copy');
    if (!nameBadge || !premiumBadge || !guideCopy) return;

    const badgeToneClasses = ['sector-badge-ai', 'sector-badge-bio', 'sector-badge-growth', 'sector-badge-value', 'sector-badge-industrial'];
    nameBadge.classList.remove(...badgeToneClasses);
    premiumBadge.classList.remove(...badgeToneClasses);

    if (!preset) {
        nameBadge.textContent = '프리셋 없음';
        premiumBadge.textContent = '무형자산 가산 0%';
        guideCopy.textContent = '섹터 프리셋을 선택하면 목표 PER, 요구수익률, 무형자산 프리미엄이 자동 적용됩니다.';
        return;
    }

    nameBadge.textContent = preset.label;
    premiumBadge.textContent = preset.badgeText || `무형자산 가산 ${preset.premiumRate}%`;
    guideCopy.textContent = preset.guideText;
    if (preset.badgeTone) {
        nameBadge.classList.add(preset.badgeTone);
        premiumBadge.classList.add(preset.badgeTone);
    }
}

function applyValuationSectorPreset(preset) {
    if (!preset) return;
    document.getElementById('m-target-per').value = String(preset.targetPer);
    document.getElementById('m-required-return').value = String(preset.requiredReturn);
}

function onValuationSectorPresetChange(event) {
    const preset = InvestmentLogic.resolveValuationSectorPreset(event.target.value);
    if (preset) {
        applyValuationSectorPreset(preset);
    } else {
        document.getElementById('m-target-per').value = '';
        document.getElementById('m-required-return').value = '8';
    }
    renderValuationPresetGuide(preset);
    if (!state.lastAnalysis.fin) return;
    calcMetrics();
}

function setFormattedInputValue(id, value) {
    const input = document.getElementById(id);
    if (!input) return;
    const numeric = Number(value);
    input.value = Number.isFinite(numeric) && numeric !== 0
        ? InvestmentLogic.formatWonInputValue(String(Math.round(numeric)))
        : '';
}

function setPlainInputValue(id, value, digits = 1) {
    const input = document.getElementById(id);
    if (!input) return;
    const numeric = Number(value);
    input.value = Number.isFinite(numeric) && numeric !== 0
        ? numeric.toFixed(digits)
        : '';
}

function getNumericInputValue(id) {
    const input = document.getElementById(id);
    if (!input) return 0;
    return InvestmentLogic.parseFormattedNumber(input.value);
}

function resetMetricManualInputs() {
    document.getElementById('m-sector-preset').value = '';
    document.getElementById('m-adjusted-eps').value = '';
    document.getElementById('m-target-per').value = '';
    document.getElementById('m-eps-growth').value = '';
    document.getElementById('m-required-return').value = '8';
    document.getElementById('m-trailing-eps').value = '';
    renderForwardEpsWarning(false);
    renderValuationPresetGuide(null);
}

function resolveValuationInputs(summary, lastTrade, previousSummary) {
    const price = Number(lastTrade?.close) || 0;
    const fallbackRoe = Number(summary?.roe) || percentage(summary?.netIncome || 0, summary?.equity || 0);
    const fallbackGrowth = computeGrowth(summary?.netIncome, previousSummary?.netIncome) ?? 0;
    const fallbackBps = Number(lastTrade?.sharesOutstanding)
        ? safeDivide(summary?.equity || 0, lastTrade.sharesOutstanding)
        : 0;
    const fallbackEps = Number(lastTrade?.sharesOutstanding)
        ? safeDivide(summary?.netIncome || 0, lastTrade.sharesOutstanding)
        : (fallbackBps && fallbackRoe ? fallbackBps * (fallbackRoe / 100) : 0);
    const forwardEps = Number(lastTrade?.forwardEps) || 0;
    const trailingEps = Number(lastTrade?.trailingEps) || fallbackEps || 0;
    const bps = Number(lastTrade?.bps) || fallbackBps || 0;
    const roe = Number(lastTrade?.roe) || fallbackRoe || 0;
    const forwardPer = Number(lastTrade?.forwardPer) || (forwardEps ? safeDivide(price, forwardEps) : 0) || 0;
    const forwardOverheat = forwardEps > 0 && trailingEps > 0 && forwardEps >= (trailingEps * 1.5);

    return {
        price,
        forwardEps,
        trailingEps,
        forwardPer,
        bps,
        roe,
        growthRate: fallbackGrowth,
        forwardOverheat
    };
}

function autoFillMetrics(summary, lastTrade, previousSummary) {
    const valuation = resolveValuationInputs(summary, lastTrade, previousSummary);
    setFormattedInputValue('m-price', valuation.price);
    setFormattedInputValue('m-forward-eps', valuation.forwardEps);
    setFormattedInputValue('m-trailing-eps', valuation.trailingEps);
    setPlainInputValue('m-forward-per', valuation.forwardPer, 1);
    setFormattedInputValue('m-bps', valuation.bps);
    setPlainInputValue('m-roe', valuation.roe, 1);
    renderForwardEpsWarning(valuation.forwardOverheat);
    if (!document.getElementById('m-eps-growth').value.trim()) {
        document.getElementById('m-eps-growth').value = valuation.growthRate ? valuation.growthRate.toFixed(1) : '0.0';
    }
    if (!document.getElementById('m-required-return').value.trim()) {
        document.getElementById('m-required-return').value = '8';
    }
    state.lastAnalysis.fin = {
        rev: summary.revenue || 0,
        op: summary.operatingIncome || 0,
        net: summary.netIncome || 0,
        eq: summary.equity || 0,
        debt: summary.liabilities || 0,
        assets: summary.assets || 0,
        valuation
    };
}

function calcMetrics() {
    const price = getNumericInputValue('m-price');
    const forwardEps = getNumericInputValue('m-forward-eps');
    const trailingEps = getNumericInputValue('m-trailing-eps');
    const forwardPer = Number(document.getElementById('m-forward-per').value) || safeDivide(price, forwardEps) || 0;
    const bps = getNumericInputValue('m-bps');
    const roe = Number(document.getElementById('m-roe').value) || 0;
    const selectedSectorPreset = getSelectedValuationSectorPreset();
    const { baseEPS, basePER, usingManualEps, epsSource, forwardOverheat } = InvestmentLogic.resolveBaseValuationVariables({
        adjustedEps: document.getElementById('m-adjusted-eps').value,
        forwardEps: document.getElementById('m-forward-eps').value,
        trailingEps: document.getElementById('m-trailing-eps').value,
        targetPer: document.getElementById('m-target-per').value,
        forwardPer: document.getElementById('m-forward-per').value
    });
    const epsGrowth = Number(document.getElementById('m-eps-growth').value) || 0;
    const requiredReturn = Number(document.getElementById('m-required-return').value) || 8;
    const fin = state.lastAnalysis.fin;

    const debtRatio = percentage(fin.debt, fin.eq);
    const operatingMargin = percentage(fin.op, fin.rev);
    const valuationOutputs = InvestmentLogic.computeValuationOutputs({
        currentPrice: document.getElementById('m-price').value,
        baseEPS,
        basePER,
        bps: document.getElementById('m-bps').value,
        roe: document.getElementById('m-roe').value,
        epsGrowth: document.getElementById('m-eps-growth').value,
        requiredReturn: document.getElementById('m-required-return').value,
        premiumRate: selectedSectorPreset?.premiumRate ?? 0
    });
    const { perFairValue, finalTargetPrice, premiumRatePct, lossMaking, pegRatio, pegTone, srimFairValue, upsidePct, upsideTone } = valuationOutputs;
    renderValuationPresetGuide(selectedSectorPreset);
    renderForwardEpsWarning(forwardOverheat);

    const epsSourceLabel = epsSource === 'manual'
        ? '조정 EPS'
        : epsSource === 'forward'
            ? '선행 EPS'
            : epsSource === 'ttm'
                ? 'TTM EPS'
                : 'EPS';
    const hasUpsideInputs = price > 0 && finalTargetPrice > 0;

    state.lastAnalysis.metrics = {
        forwardPer,
        roe,
        debtR: debtRatio,
        opM: operatingMargin,
        targetPrice: finalTargetPrice,
        upside: upsidePct,
        requiredReturn,
        baseEPS,
        basePER,
        premiumRate: premiumRatePct,
        pegRatio,
        perModelPrice: perFairValue,
        srimPrice: srimFairValue
    };
    state.metrics = state.lastAnalysis.metrics;

    const items = [
        {
            label: '최종 목표가',
            primary: true,
            value: lossMaking
                ? '이익 미발생 구간 - PBR 밴드 활용 권장'
                : finalTargetPrice
                    ? `${Math.round(finalTargetPrice).toLocaleString()}원`
                    : '-',
            tone: lossMaking ? 'warn' : '',
            hint: lossMaking
                ? `EPS 기준: ${epsSourceLabel} · 적자 구간은 PER보다 PBR 밴드와 자산가치를 우선 확인하세요.`
                : finalTargetPrice
                ? `PER 모델 ${Math.round(perFairValue).toLocaleString()}원 × 무형자산 가산 ${premiumRatePct.toFixed(0)}% · EPS 기준: ${epsSourceLabel}`
                : 'EPS와 목표 PER가 잡히면 섹터 프리미엄을 반영합니다.'
        },
        {
            label: 'PEG 지표',
            value: pegRatio === null ? '-' : pegRatio.toFixed(2),
            tone: pegTone,
            hint: `목표 PER ${basePER.toFixed(1)}배 / EPS 예상 성장률 ${epsGrowth.toFixed(1)}%`
        },
        {
            label: 'S-RIM 적정주가',
            value: srimFairValue ? `${Math.round(srimFairValue).toLocaleString()}원` : '-',
            hint: `BPS ${Math.round(bps).toLocaleString()}원, ROE ${roe.toFixed(1)}%, 요구수익률 ${requiredReturn.toFixed(1)}%`
        },
        {
            label: '상승여력',
            value: hasUpsideInputs
                ? `${upsidePct > 0 ? '+' : ''}${upsidePct.toFixed(1)}%`
                : '-',
            tone: hasUpsideInputs ? upsideTone : '',
            hint: hasUpsideInputs
                ? `${usingManualEps ? '조정 EPS' : epsSourceLabel} 기준 최종 목표가 대비`
                : '현재 주가와 최종 목표가가 모두 잡히면 상승여력을 계산합니다.'
        }
    ];

    document.getElementById('metrics-grid').innerHTML = items.map((item) => `
        <div class="metric-tile metric-result-tile ${item.primary ? 'metric-result-primary' : ''}">
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
    const latestQuarter = comparableQuarterlies[0]
        ? (comparableQuarterlies[0].summary || summarizeStatement(comparableQuarterlies[0].list))
        : null;
    const previousQuarter = comparableQuarterlies[1]
        ? (comparableQuarterlies[1].summary || summarizeStatement(comparableQuarterlies[1].list))
        : null;

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

function syncHoveredCandleToViewport() {
    if (!state.chartWindow || !Number.isFinite(Number(state.chartHoverAbsoluteIndex))) {
        priceHoverIndex = null;
        return;
    }
    const absoluteIndex = Math.round(Number(state.chartHoverAbsoluteIndex));
    if (absoluteIndex < state.chartWindow.start || absoluteIndex >= state.chartWindow.end) {
        priceHoverIndex = null;
        return;
    }
    priceHoverIndex = absoluteIndex - state.chartWindow.start;
}

function setHoveredCandleIndex(relativeIndex) {
    if (!Number.isFinite(Number(relativeIndex)) || !state.chartWindow) {
        priceHoverIndex = null;
        state.chartHoverAbsoluteIndex = null;
        return;
    }
    const nextIndex = Math.max(0, Math.round(Number(relativeIndex)));
    priceHoverIndex = nextIndex;
    state.chartHoverAbsoluteIndex = state.chartWindow.start + nextIndex;
}

function clearHoveredCandle() {
    priceHoverIndex = null;
    state.chartHoverAbsoluteIndex = null;
}

function getChartZoomAnchorRatio(fallbackRatio = 0.5) {
    return InvestmentLogic.resolveChartAnchorRatio(
        state.chartWindow,
        state.chartHoverAbsoluteIndex,
        fallbackRatio
    );
}

function zoomSharedChartViewport(factor, fallbackRatio = 0.5) {
    if (!state.chartFullSeries.length || !state.chartWindow) return;
    state.chartDrag = null;
    state.techDrag = null;
    state.chartPinch = null;
    state.techPinch = null;
    state.chartWindow = InvestmentLogic.zoomChartWindow(
        state.chartWindow,
        state.chartFullSeries.length,
        factor,
        getChartZoomAnchorRatio(fallbackRatio),
        getChartWindowMinimum(state.chartRange, state.chartFullSeries.length)
    );
    syncHoveredCandleToViewport();
    renderCharts({ viewport: 'preserve' });
}

function getCanvasLocalX(canvas, clientX) {
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
}

function getCanvasAnchorRatio(canvas, clientX, padLeft, padRight) {
    const drawWidth = canvas.width - padLeft - padRight;
    const localX = getCanvasLocalX(canvas, clientX) - padLeft;
    return Math.max(0, Math.min(1, localX / Math.max(1, drawWidth)));
}

function getCanvasClientDrawWidth(canvas, padLeft, padRight) {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / Math.max(1, canvas.width);
    return Math.max(1, rect.width - ((padLeft + padRight) * scale));
}

function getPointerDistance(pointerMap) {
    const pointers = Array.from(pointerMap.values());
    if (pointers.length < 2) return 0;
    const [first, second] = pointers;
    const dx = Number(second.clientX || 0) - Number(first.clientX || 0);
    const dy = Number(second.clientY || 0) - Number(first.clientY || 0);
    return Math.hypot(dx, dy);
}

function getPointerMidpoint(pointerMap) {
    const pointers = Array.from(pointerMap.values());
    if (pointers.length < 2) return null;
    const [first, second] = pointers;
    return {
        clientX: (Number(first.clientX || 0) + Number(second.clientX || 0)) / 2,
        clientY: (Number(first.clientY || 0) + Number(second.clientY || 0)) / 2
    };
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
    syncHoveredCandleToViewport();
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
    state.techDrag = null;
    state.chartPinch = null;
    state.techPinch = null;
    state.chartPointers.clear();
    state.techPointers.clear();
    clearHoveredCandle();
    renderCharts({ viewport: 'full' });
}

function onChartZoomClick(event) {
    const button = event.target.closest('[data-chart-zoom]');
    if (!button || !state.chartFullSeries.length || !state.chartWindow) return;
    const action = button.dataset.chartZoom;
    if (action === 'reset') {
        resetChartZoom();
        return;
    }

    const factor = action === 'in' ? 0.82 : 1.22;
    zoomSharedChartViewport(factor, 1);
}

function onChartRangeClick(event) {
    const button = event.target.closest('.seg-btn');
    if (!button) return;
    state.chartRange = button.dataset.range;
    state.chartWindow = null;
    state.chartDrag = null;
    state.techDrag = null;
    state.chartPinch = null;
    state.techPinch = null;
    state.chartPointers.clear();
    state.techPointers.clear();
    clearHoveredCandle();
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
        if (priceHoverIndex === null && state.chartHoverAbsoluteIndex === null) return;
        clearHoveredCandle();
        renderPriceChart(state.chartVisible);
    };

    const updatePointerRecord = (event) => {
        state.chartPointers.set(event.pointerId, {
            clientX: event.clientX,
            clientY: event.clientY
        });
    };

    const startPinchGesture = () => {
        if (state.chartPointers.size < 2 || !state.chartWindow) return false;
        const midpoint = getPointerMidpoint(state.chartPointers);
        if (!midpoint) return false;
        state.chartDrag = null;
        state.chartPinch = {
            distance: getPointerDistance(state.chartPointers),
            window: { ...state.chartWindow },
            anchorRatio: getCanvasAnchorRatio(canvas, midpoint.clientX, padding.left, padding.right)
        };
        canvas.style.cursor = 'grabbing';
        return true;
    };

    const releaseDrag = (pointerId) => {
        try {
            if (pointerId !== undefined) canvas.releasePointerCapture?.(pointerId);
        } catch (error) {
            // Pointer capture release can fail when the pointer was already lost.
        }
        state.chartPointers.delete(pointerId);
        if (state.chartDrag && (pointerId === undefined || state.chartDrag.pointerId === pointerId)) {
            state.chartDrag = null;
        }
        if (state.chartPointers.size < 2) {
            state.chartPinch = null;
        }
        if (!state.chartPointers.size) {
            canvas.style.cursor = 'crosshair';
        }
    };

    canvas.onwheel = (event) => {
        if (!state.chartFullSeries.length || !state.chartWindow) return;
        event.preventDefault();
        const factor = event.deltaY < 0 ? 0.82 : 1.22;
        state.chartDrag = null;
        state.chartPinch = null;
        zoomSharedChartViewport(factor, getCanvasAnchorRatio(canvas, event.clientX, padding.left, padding.right));
    };

    canvas.onpointerdown = (event) => {
        if (!state.chartVisible.length || !state.chartWindow) return;
        updatePointerRecord(event);
        if (state.chartPointers.size >= 2 && startPinchGesture()) {
            canvas.setPointerCapture?.(event.pointerId);
            return;
        }
        state.chartDrag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            window: { ...state.chartWindow }
        };
        state.chartPinch = null;
        canvas.setPointerCapture?.(event.pointerId);
        canvas.style.cursor = 'grabbing';
        // 터치: 누른 봉의 가격 정보를 즉시 표시 (hover 없는 모바일 대응)
        if (event.pointerType === 'touch') {
            const x = getCanvasLocalX(canvas, event.clientX) - padding.left;
            const idx = Math.min(data.length - 1, Math.max(0, Math.floor(x / xGap)));
            setHoveredCandleIndex(idx);
            renderPriceChart(state.chartVisible);
        }
    };

    canvas.onpointermove = (event) => {
        if (state.chartPointers.has(event.pointerId)) {
            updatePointerRecord(event);
        }
        if (state.chartPinch && state.chartPointers.size >= 2) {
            const factor = InvestmentLogic.resolvePinchZoomFactor(
                state.chartPinch.distance,
                getPointerDistance(state.chartPointers)
            );
            state.chartWindow = InvestmentLogic.zoomChartWindow(
                state.chartPinch.window,
                state.chartFullSeries.length,
                factor,
                state.chartPinch.anchorRatio,
                getChartWindowMinimum(state.chartRange, state.chartFullSeries.length)
            );
            syncHoveredCandleToViewport();
            renderCharts({ viewport: 'preserve' });
            return;
        }
        if (state.chartDrag && state.chartDrag.pointerId === event.pointerId) {
            const dragDistance = Math.abs(event.clientX - state.chartDrag.startX);
            // 터치 손떨림(8px 미만)은 탭으로 취급 – 패닝 무시
            if (event.pointerType === 'touch' && dragDistance < 8) return;
            const dragWidth = getCanvasClientDrawWidth(canvas, padding.left, padding.right);
            const visiblePoints = Math.max(1, state.chartDrag.window.end - state.chartDrag.window.start);
            const deltaRatio = (event.clientX - state.chartDrag.startX) / dragWidth;
            const deltaPoints = Math.round(-deltaRatio * visiblePoints);
            state.chartWindow = InvestmentLogic.panChartWindow(
                state.chartDrag.window,
                deltaPoints,
                state.chartFullSeries.length
            );
            clearHoveredCandle();
            renderCharts({ viewport: 'preserve' });
            return;
        }

        const x = getCanvasLocalX(canvas, event.clientX) - padding.left;
        if (x < 0 || x > width) {
            clearHover();
            return;
        }
        const nextIndex = Math.min(data.length - 1, Math.max(0, Math.floor(x / xGap)));
        if (nextIndex === priceHoverIndex) return;
        setHoveredCandleIndex(nextIndex);
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
        // 터치는 손가락을 떼도 가격 정보 유지 (다음 탭/드래그 시 갱신)
        if (event.pointerType === 'touch') return;
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

    const endHover = () => {
        clearHoveredCandle();
        if (onHoverEnd) onHoverEnd();
    };

    const updatePointerRecord = (event) => {
        state.techPointers.set(event.pointerId, {
            clientX: event.clientX,
            clientY: event.clientY
        });
    };

    const startPinchGesture = () => {
        if (state.techPointers.size < 2 || !state.chartWindow) return false;
        const midpoint = getPointerMidpoint(state.techPointers);
        if (!midpoint) return false;
        state.techDrag = null;
        state.techPinch = {
            canvas,
            distance: getPointerDistance(state.techPointers),
            window: { ...state.chartWindow },
            anchorRatio: getCanvasAnchorRatio(canvas, midpoint.clientX, padLeft, padRight)
        };
        canvas.style.cursor = 'grabbing';
        return true;
    };

    canvas.onwheel = (e) => {
        if (!state.chartFullSeries.length || !state.chartWindow) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 0.82 : 1.22;
        state.techDrag = null;
        state.techPinch = null;
        zoomSharedChartViewport(factor, getCanvasAnchorRatio(canvas, e.clientX, padLeft, padRight));
        if (onHoverEnd) onHoverEnd();
    };

    canvas.onpointerdown = (e) => {
        if (!state.chartWindow) return;
        updatePointerRecord(e);
        if (state.techPointers.size >= 2 && startPinchGesture()) {
            canvas.setPointerCapture?.(e.pointerId);
            endHover();
            return;
        }
        state.techDrag = {
            canvas,
            pointerId: e.pointerId,
            startX: e.clientX,
            window: { ...state.chartWindow }
        };
        state.techPinch = null;
        canvas.setPointerCapture?.(e.pointerId);
        canvas.style.cursor = 'grabbing';
        // 터치: 누른 위치의 지표값/날짜를 즉시 툴팁으로 표시
        if (e.pointerType === 'touch' && onHoverMove) {
            const rect = canvas.getBoundingClientRect();
            onHoverMove(e, rect);
        } else {
            endHover();
        }
    };

    canvas.onpointermove = (e) => {
        if (state.techPointers.has(e.pointerId)) {
            updatePointerRecord(e);
        }
        if (state.techPinch && state.techPinch.canvas === canvas && state.techPointers.size >= 2) {
            const factor = InvestmentLogic.resolvePinchZoomFactor(
                state.techPinch.distance,
                getPointerDistance(state.techPointers)
            );
            state.chartWindow = InvestmentLogic.zoomChartWindow(
                state.techPinch.window,
                state.chartFullSeries.length,
                factor,
                state.techPinch.anchorRatio,
                getChartWindowMinimum(state.chartRange, state.chartFullSeries.length)
            );
            syncHoveredCandleToViewport();
            renderCharts({ viewport: 'preserve' });
            return;
        }
        const drag = state.techDrag;
        if (drag && drag.canvas === canvas && drag.pointerId === e.pointerId) {
            // 터치 손떨림(8px 미만)은 탭으로 취급 – 패닝 무시
            if (e.pointerType === 'touch' && Math.abs(e.clientX - drag.startX) < 8) return;
            const drawWidth = getCanvasClientDrawWidth(canvas, padLeft, padRight);
            const visiblePoints = Math.max(1, drag.window.end - drag.window.start);
            const deltaRatio = (e.clientX - drag.startX) / Math.max(1, drawWidth);
            const deltaPoints = Math.round(-deltaRatio * visiblePoints);
            state.chartWindow = InvestmentLogic.panChartWindow(
                drag.window,
                deltaPoints,
                state.chartFullSeries.length
            );
            endHover();
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
        try { canvas.releasePointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
        state.techPointers.delete(e.pointerId);
        if (drag && drag.canvas === canvas && drag.pointerId === e.pointerId) {
            state.techDrag = null;
        }
        if (state.techPointers.size < 2) {
            state.techPinch = null;
        }
        if (!state.techPointers.size) {
            canvas.style.cursor = onHoverMove ? 'crosshair' : 'grab';
        }
    };

    canvas.onpointerup = releasePointer;
    canvas.onpointercancel = (e) => {
        releasePointer(e);
        endHover();
    };
    canvas.onpointerleave = (e) => {
        const drag = state.techDrag;
        if (drag && drag.canvas === canvas && drag.pointerId === e.pointerId) return;
        // 터치는 손가락을 떼도 툴팁 유지 (다음 탭/스와이프 시 갱신)
        if (e.pointerType === 'touch') {
            canvas.style.cursor = onHoverMove ? 'crosshair' : 'grab';
            return;
        }
        endHover();
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
            if (idx < 0 || idx >= data.length) {
                clearHoveredCandle();
                hideTechTooltip();
                return;
            }
            state.chartHoverAbsoluteIndex = (state.chartWindow?.start || 0) + idx;
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
    const anomalies = [
        ...(Array.isArray(state.lastAnalysis?.anomalies) ? state.lastAnalysis.anomalies : []),
        ...(Array.isArray(state.lastAnalysis?.redFlags) ? state.lastAnalysis.redFlags : []),
        ...(Array.isArray(summary?.anomalies) ? summary.anomalies : []),
        ...(Array.isArray(summary?.redFlags) ? summary.redFlags : [])
    ]
        .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') {
                return String(item.label || item.title || item.reason || item.message || '').trim();
            }
            return '';
        })
        .filter(Boolean);
    const anomalyText = anomalies.length ? anomalies.join(', ') : '-';

    const prompt = `
당신은 월스트리트 탑티어 헤지펀드의 수석 퀀트 애널리스트입니다. 
제공된 거시 경제(Macro) 지표와 개별 기업의 퀀트 데이터를 종합하여, 기관 투자자 클라이언트를 위한 냉철하고 날카로운 투자 브리핑을 작성하세요.

[거시 경제(Macro) 환경]
- 환율(USD/KRW): ${document.getElementById('fx-usdkrw')?.innerText || '-'}
- VIX 공포지수: ${document.getElementById('vix-value')?.innerText || '-'}
- WTI 원유: ${document.getElementById('wti-value')?.innerText || '-'}

[기업(${company}) 핵심 퀀트 데이터]
- 종합 재무 건전성 랭킹: ${totalPct}% (수익성 ${state.ratings.profitability.score}/5, 건전성 ${state.ratings.stability.score}/5)
- 주요 지표: 영업이익률 ${summary?.operatingMargin?.toFixed(1) ?? '-'}%, 부채비율 ${summary?.debtRatio?.toFixed(1) ?? '-'}%, ROE ${summary?.roe?.toFixed(1) ?? '-'}%
- 밸류에이션: 적정주가 ${state.metrics.targetPrice ? state.metrics.targetPrice.toLocaleString() + '원' : '-'} (현재가 대비 상승여력 ${state.metrics.upside?.toFixed(1) ?? '-'}%)
- 기술적 시그널: ${technicalCards.map((card) => `${card.label}(${card.signal})`).join(', ') || '-'}
- 차트 소스: ${formatChartSourceName()}

[재무 이상치 / Red Flags]
- ${anomalyText}

[작성 지침 - 반드시 준수할 것]
1. 데이터의 단순 나열을 엄격히 금지합니다. 숫자가 의미하는 바(Context)를 통찰력 있게 해석하세요. (예: "이익률은 높으나 부채가 과도하여 흑자 부도 리스크 잠재됨")
2. 현재 환율과 유가 등 거시 환경이 해당 기업의 실적(수출/수입/원가 등)에 미칠 영향을 반드시 1~2문장으로 추론하여 포함하세요.
3. 경어체를 사용하되, 감정을 배제한 매우 건조하고 전문적인 '보고서 문체(존댓말)'를 사용하세요.
4. 마크다운을 사용하여 다음 4가지 섹션으로 정확히 나누어 출력하세요:
   🎯 **핵심 요약 (Investment Thesis)**
   📈 **상승 촉매 및 강점 (Catalysts & Strengths)**
   ⚠️ **핵심 리스크 및 매크로 역풍 (Risks & Headwinds)**
   ⚖️ **최종 투자의견 (Strong Buy / Buy / Hold / Reduce) 및 대응 전략**
    `.trim();

    try {
        const response = await fetchJson(buildProxyPostUrl('gemini'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 1200
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
    if (type === 'multiple') return `${value.toFixed(1)}배`;
    if (type === 'shares') return `${formatCompact(value)}주`;
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
