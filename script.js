const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const LOCAL_PROXY = 'http://localhost:8081';
const PROD_PROXY = '/proxy.php';
const KAKAO_JS_KEY = '88cd449d612399a0219090bbcfc20b24';
const KAKAO_REDIRECT_URI = new URL('/auth/kakao/callback', window.location.origin).toString();
const XP_MAX = 100;

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

const BASE_PRICE_HINTS = {
    '005930': 186200,
    '000660': 215000,
    '035420': 205000,
    '035720': 58000,
    '005380': 255000,
    '207940': 1120000
};

const COMPANY_DIRECTORY = InvestmentLogic.buildCompanyDirectory(COMPANY_MAP);

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
    publicQuote: null,
    kiwoomQuote: null,
    chartDaily: [],
    chartWeekly: [],
    chartMonthly: [],
    chartVisible: [],
    chartRange: 'DAILY',
    chartYtdYear: getCurrentYearKst(),
    chartSource: 'idle',
    searchMatches: [],
    technicals: null,
    ratings: null,
    metrics: null,
    summaries: [],
    briefingMode: 'idle',
    lastAnalysis: { fin: {}, scores: {}, totalPct: 0, metrics: {} },
    selectedIndicators: new Set(['RSI', 'MACD', 'STOCH', 'BOLL', 'MA'])
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

function bindEvents() {
    const companyInput = document.getElementById('company-input');
    const suggestionBox = document.getElementById('company-suggestions');
    document.getElementById('search-btn').addEventListener('click', startSearch);
    companyInput.addEventListener('input', (event) => {
        renderCompanySuggestions(event.target.value);
    });
    companyInput.addEventListener('focus', (event) => {
        renderCompanySuggestions(event.target.value);
    });
    companyInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideCompanySuggestions();
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!resolveCompany(companyInput.value) && state.searchMatches[0]) {
                selectCompanySuggestion(state.searchMatches[0].stockCode);
            }
            startSearch();
        }
    });
    suggestionBox.addEventListener('mousedown', (event) => {
        event.preventDefault();
    });
    suggestionBox.addEventListener('click', onSuggestionClick);
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
    document.getElementById('indicator-toggle').addEventListener('click', onIndicatorToggle);

    const ytdSelect = document.getElementById('ytd-year-select');
    if (ytdSelect) {
        ytdSelect.addEventListener('change', (event) => {
            state.chartYtdYear = Number(event.target.value);
            renderCharts();
        });
    }

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
    const container = document.getElementById('company-suggestions');
    const matches = InvestmentLogic.matchCompanies(COMPANY_DIRECTORY, rawQuery, 8);
    state.searchMatches = matches;

    if (!matches.length || document.activeElement !== document.getElementById('company-input')) {
        hideCompanySuggestions();
        return;
    }

    container.innerHTML = matches.map((company) => `
        <button type="button" class="company-option" data-stock-code="${company.stockCode}">
            <span class="company-option-name">${escapeHtml(company.name)}</span>
            <span class="company-option-code">${company.stockCode}</span>
        </button>
    `).join('');
    container.classList.remove('hidden');
}

function hideCompanySuggestions() {
    document.getElementById('company-suggestions').classList.add('hidden');
}

function onSuggestionClick(event) {
    const button = event.target.closest('.company-option');
    if (!button) return;
    selectCompanySuggestion(button.dataset.stockCode);
}

function selectCompanySuggestion(stockCode) {
    const selected = COMPANY_DIRECTORY.find((item) => item.stockCode === stockCode);
    if (!selected) return;
    document.getElementById('company-input').value = selected.displayLabel;
    hideCompanySuggestions();
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

async function loadMarketSummary() {
    try {
        const data = await fetchJson(buildProxyUrl('market', '/summary'));
        if (data.usdKrw) {
            document.getElementById('fx-usdkrw').textContent = `${data.usdKrw.toFixed(2)}원`;
            document.getElementById('fx-usdkrw-note').textContent = '1달러 기준';
        }
        if (data.jpyKrw) {
            document.getElementById('fx-jpykrw').textContent = `${(data.jpyKrw * 100).toFixed(2)}원`;
            document.getElementById('fx-jpykrw-note').textContent = '100엔 기준';
        }
        if (data.goldKrwPerGram) {
            document.getElementById('gold-krw').textContent = `${Math.round(data.goldKrwPerGram).toLocaleString()}원`;
            document.getElementById('gold-note').textContent = '금 1g 추정';
        } else {
            document.getElementById('gold-note').textContent = '외부 시세 연결 대기';
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
    sessionStorage.setItem('invest_nav_kakao_return_url', location.href);
    Kakao.Auth.authorize({
        redirectUri: KAKAO_REDIRECT_URI
    });
}

async function restoreKakaoSession() {
    const accessToken = sessionStorage.getItem('invest_nav_kakao_token');
    if (!window.Kakao || !accessToken) return;
    try {
        Kakao.Auth.setAccessToken(accessToken);
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
    sessionStorage.removeItem('invest_nav_kakao_token');
    document.getElementById('btn-kakao-login').classList.remove('hidden');
    document.getElementById('kakao-user-profile').classList.add('hidden');
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
    const error = sessionStorage.getItem('invest_nav_kakao_error');
    if (!error) return;
    setStatus(`카카오 로그인 안내: ${error}`, 'warn');
    sessionStorage.removeItem('invest_nav_kakao_error');
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
    const rawInput = document.getElementById('company-input').value.trim();
    const company = resolveCompany(rawInput);
    if (!company) {
        setStatus('사전 매핑된 기업명 또는 종목코드를 입력해주세요.', 'error');
        return;
    }

    hideCompanySuggestions();
    state.company = company;
    state.chartRange = 'DAILY';
    state.chartYtdYear = getCurrentYearKst();
    setStatus(`${company.name} 분석을 시작합니다. DART, 키움증권, 공시 리포트를 동기화하는 중입니다.`);
    setSourceBadge('source-dart', 'DART 동기화 중');
    setSourceBadge('source-krx', '시세 동기화 중');
    setSourceBadge('source-gemini', 'Gemini 대기 중');

    document.getElementById('company-name').textContent = company.name;
    document.getElementById('company-meta').textContent = `${getCurrentYearKst()}년 기준 최근 3개년 실적과 주가 차트를 분석합니다.`;
    document.getElementById('dart-link').href = `https://dart.fss.or.kr/dsaf001/main.do?corpCode=${company.corpCode}`;
    document.getElementById('dashboard').classList.remove('hidden');

    try {
        const [annualsResult, quarterliesResult, reportsResult, kiwoomQuoteResult, naverQuoteResult] = await Promise.allSettled([
            fetchMultiYearDart(company.corpCode),
            fetchQuarterlyHistory(company.corpCode),
            fetchDartReportList(company.corpCode),
            fetchKiwoomQuote(company.stockCode),
            fetchPublicQuote(company.stockCode)
        ]);

        if (annualsResult.status !== 'fulfilled' || !annualsResult.value.length) {
            throw new Error('DART 재무제표를 불러오지 못했습니다.');
        }

        state.annuals = annualsResult.value;
        state.quarterlies = quarterliesResult.status === 'fulfilled' ? quarterliesResult.value : [];
        state.reports = reportsResult.status === 'fulfilled' ? reportsResult.value : [];
        state.kiwoomQuote = kiwoomQuoteResult.status === 'fulfilled' ? kiwoomQuoteResult.value : null;
        state.publicQuote = naverQuoteResult.status === 'fulfilled' ? naverQuoteResult.value : null;

        const kiwoomLive = state.kiwoomQuote?.live === true;
        const quoteForStrip = kiwoomLive ? state.kiwoomQuote : state.publicQuote;

        const [dailyResult, weeklyResult, monthlyResult] = await Promise.allSettled([
            fetchKiwoomChart(company.stockCode, 'daily'),
            fetchKiwoomChart(company.stockCode, 'weekly'),
            fetchKiwoomChart(company.stockCode, 'monthly')
        ]);

        const dailyPayload = dailyResult.status === 'fulfilled' ? dailyResult.value : { live: false, points: [] };
        const weeklyPayload = weeklyResult.status === 'fulfilled' ? weeklyResult.value : { live: false, points: [] };
        const monthlyPayload = monthlyResult.status === 'fulfilled' ? monthlyResult.value : { live: false, points: [] };

        if (dailyPayload.live && dailyPayload.points.length) {
            state.chartDaily = dailyPayload.points;
            state.chartSource = 'kiwoom';
            setSourceBadge('source-krx', '키움증권 REST API 연동됨', 'success');
        } else {
            state.chartDaily = generateSyntheticChart(company.stockCode, state.publicQuote);
            state.chartSource = state.publicQuote?.close ? 'public_quote' : 'synthetic';
            const errorMsg = dailyPayload.error || '';
            setSourceBadge(
                'source-krx',
                errorMsg
                    ? `키움 제한: ${errorMsg}${state.publicQuote?.close ? ' · 공개 시세 보정 차트 사용' : ''}`
                    : (state.publicQuote?.close ? '공개 시세 보정 차트 사용' : '대체 차트 사용'),
                'warn'
            );
        }

        state.chartWeekly = weeklyPayload.live ? weeklyPayload.points : aggregateCandles(state.chartDaily, 'week');
        state.chartMonthly = monthlyPayload.live ? monthlyPayload.points : aggregateCandles(state.chartDaily, 'month');

        state.summaries = state.annuals.map((item) => ({
            ...item,
            summary: summarizeStatement(item.list)
        }));

        renderReports(state.reports);
        renderFinancialTable('fin-annual-table', state.annuals);
        renderFinancialTable('fin-quarterly-table', state.quarterlies);

        const latestQuote = state.chartDaily[state.chartDaily.length - 1];
        autoFillMetrics(state.summaries[0]?.summary || {}, latestQuote, quoteForStrip);
        calcMetrics();
        renderStockStrip(latestQuote, quoteForStrip, kiwoomLive);
        buildRatings();
        refreshTechnicals();
        renderCharts();

        setSourceBadge('source-dart', 'DART 공시 연동됨', 'success');
        document.getElementById('chart-status').textContent = state.chartSource === 'kiwoom'
            ? '키움증권 REST API 시세 기반 차트'
            : state.chartSource === 'public_quote'
                ? '공개 종가에 맞춘 보정 차트를 표시 중입니다.'
                : '대체 YTD 차트를 표시 중입니다.';
        addXP(18);

        await generateBriefing();

        setStatus(`${company.name} 분석이 완료되었습니다.`, 'success');
        document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        console.error(error);
        setStatus(error.message || '분석 중 알 수 없는 오류가 발생했습니다.', 'error');
        setSourceBadge('source-dart', 'DART 실패', 'error');
        setSourceBadge('source-gemini', 'Gemini 대기', 'warn');
    }
}

function resolveCompany(input) {
    if (!input) return null;
    if (COMPANY_MAP[input]) {
        return { name: input, ...COMPANY_MAP[input] };
    }

    const stockCode = (input.match(/\b(\d{6})\b/) || [])[1];
    if (stockCode) {
        const matchByStock = COMPANY_DIRECTORY.find((item) => item.stockCode === stockCode);
        if (matchByStock) {
            return { name: matchByStock.name, corpCode: matchByStock.corpCode, stockCode: matchByStock.stockCode, market: matchByStock.market };
        }
    }

    const exactNameMatch = COMPANY_DIRECTORY.find((item) => item.name === input || item.displayLabel === input);
    if (exactNameMatch) {
        return { name: exactNameMatch.name, corpCode: exactNameMatch.corpCode, stockCode: exactNameMatch.stockCode, market: exactNameMatch.market };
    }

    const fuzzyMatch = InvestmentLogic.matchCompanies(COMPANY_DIRECTORY, input, 1)[0];
    if (fuzzyMatch) {
        return { name: fuzzyMatch.name, corpCode: fuzzyMatch.corpCode, stockCode: fuzzyMatch.stockCode, market: fuzzyMatch.market };
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
    const data = await fetchJson(buildProxyUrl('dart', '/list.json', {
        corp_code: corpCode,
        bgn_de: bgn,
        end_de: end,
        page_count: 100
    }));
    if (data.status !== '000' || !Array.isArray(data.list)) return [];

    return data.list
        .filter((item) => /사업보고서|반기보고서|분기보고서/.test(item.report_nm))
        .map((item) => ({
            title: item.report_nm,
            date: item.rcept_dt,
            type: item.report_nm.includes('사업') ? '사업보고서' : item.report_nm.includes('반기') ? '반기보고서' : '분기보고서',
            url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 12);
}

async function fetchPublicQuote(stockCode) {
    const payload = await fetchJson(buildProxyUrl('market', '/quote', {
        stock_code: stockCode
    }, 'quote'));
    return InvestmentLogic.normalizePublicQuote(payload);
}

async function fetchKiwoomQuote(stockCode) {
    try {
        const data = await fetchJson(buildProxyUrl('kiwoom_quote', '', {
            stock_code: stockCode
        }, 'kiwoom_quote'));
        return data;
    } catch (error) {
        return { live: false, error: error.message };
    }
}

async function fetchKiwoomChart(stockCode, chartType = 'daily') {
    try {
        const data = await fetchJson(buildProxyUrl('kiwoom_chart', '', {
            stock_code: stockCode,
            chart_type: chartType,
            base_dt: getCurrentDateTokenKst()
        }, 'kiwoom_chart'));
        return data;
    } catch (error) {
        return { live: false, error: error.message, points: [] };
    }
}

function generateSyntheticChart(stockCode, quote = null) {
    return InvestmentLogic.generateAnchoredSyntheticChart({
        stockCode,
        startDate: `${getCurrentYearKst()}0101`,
        endDate: getCurrentDateTokenKst(),
        anchorClose: quote?.close || 0,
        anchorChange: quote?.change ?? null,
        baseHints: BASE_PRICE_HINTS
    });
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

    container.innerHTML = reports.map((report) => `
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
        const cells = summaries.map((period, colIndex) => {
            const value = period.summary[row.key];
            const prevValue = colIndex < summaries.length - 1 ? summaries[colIndex + 1]?.summary[row.key] : null;
            const growth = computeGrowth(value, prevValue);
            const growthHtml = growth === null ? '' : `<span class="inline-change ${growth > 0 ? 'good' : growth < 0 ? 'bad' : ''}">${growth > 0 ? '+' : ''}${growth.toFixed(1)}%</span>`;
            return `<td>${formatMetricValue(value, row.type)}${growthHtml}</td>`;
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

function renderStockStrip(lastPoint, quoteData, kiwoomLive) {
    if (!lastPoint && !quoteData) return;
    const hasLiveData = kiwoomLive && quoteData?.close > 0;
    const price = hasLiveData ? quoteData.close : (lastPoint?.close || 0);
    const change = hasLiveData ? quoteData.change : (lastPoint?.change ?? (lastPoint ? lastPoint.close - lastPoint.open : 0));
    const changePct = hasLiveData ? quoteData.changePct : (lastPoint?.changePct ?? percentage(change, lastPoint?.open || 1));
    const openPrice = hasLiveData ? quoteData.open : (lastPoint?.open || 0);
    const highPrice = hasLiveData ? quoteData.high : (lastPoint?.high || 0);
    const lowPrice = hasLiveData ? quoteData.low : (lastPoint?.low || 0);
    const volume = hasLiveData ? quoteData.volume : (lastPoint?.volume || 0);

    const className = change > 0 ? 'up' : change < 0 ? 'down' : '';
    const sign = change > 0 ? '+' : '';
    const priceSub = `${sign}${change.toLocaleString()}원 (${Number(changePct).toFixed(2)}%)`;

    document.getElementById('stock-realtime').classList.remove('hidden');
    document.getElementById('stock-realtime').innerHTML = `
        <div class="ss-item">
            <div class="ss-label">현재가</div>
            <div class="ss-val ${className}">${price.toLocaleString()}원</div>
            <div class="ss-sub ${className}">${priceSub}</div>
        </div>
        <div class="ss-item">
            <div class="ss-label">시가</div>
            <div class="ss-val">${openPrice > 0 ? `${openPrice.toLocaleString()}원` : '-'}</div>
            <div class="ss-sub">${openPrice > 0 ? '당일 시작 가격' : '시세 데이터 대기'}</div>
        </div>
        <div class="ss-item">
            <div class="ss-label">고가</div>
            <div class="ss-val good">${highPrice > 0 ? `${highPrice.toLocaleString()}원` : '-'}</div>
            <div class="ss-sub">${highPrice > 0 ? '장중 최고가' : '시세 데이터 대기'}</div>
        </div>
        <div class="ss-item">
            <div class="ss-label">저가</div>
            <div class="ss-val bad">${lowPrice > 0 ? `${lowPrice.toLocaleString()}원` : '-'}</div>
            <div class="ss-sub">${lowPrice > 0 ? '장중 최저가' : '시세 데이터 대기'}</div>
        </div>
        <div class="ss-item">
            <div class="ss-label">거래량</div>
            <div class="ss-val">${volume > 0 ? formatCompact(volume) : '-'}</div>
            <div class="ss-sub">${volume > 0 ? '누적 거래량' : '시세 데이터 대기'}</div>
        </div>
    `;
}

function autoFillMetrics(summary, lastTrade, quoteData) {
    const price = quoteData?.close || lastTrade?.close || 0;
    const shares = quoteData?.listedShares || lastTrade?.listedShares || 0;
    document.getElementById('m-price').value = price;
    document.getElementById('m-shares').value = shares;
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

function refreshTechnicals() {
    state.technicals = computeTechnicals(state.chartDaily);
    renderTechnicalCards();
    renderTechSummary();
    renderCharts();
    renderTechLegend();
}

function computeTechnicals(data) {
    const closes = data.map((point) => point.close);
    const highs = data.map((point) => point.high);
    const lows = data.map((point) => point.low);

    const ma5 = computeSMA(closes, 5);
    const ma20 = computeSMA(closes, 20);
    const ma60 = computeSMA(closes, 60);
    const ma200 = computeSMA(closes, 200);
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

    return { ma5, ma20, ma60, ma200, rsi, macd, stoch, boll, cards };
}

function renderTechnicalCards() {
    const container = document.getElementById('technical-grid');
    if (!state.technicals) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = state.technicals.cards.map((card) => {
        const tone = card.signal === '매수' ? 'good' : card.signal === '매도' ? 'bad' : 'warn';
        return `
            <div class="signal-card">
                <div class="signal-label">${card.label}</div>
                <div class="signal-value">${card.value}</div>
                <div class="signal-note">${card.note}</div>
                <div class="signal-note ${tone}">${card.signal}</div>
            </div>
        `;
    }).join('');
}

function renderTechSummary() {
    if (!state.technicals) return;
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

function onChartRangeClick(event) {
    const button = event.target.closest('.seg-btn');
    if (!button) return;
    state.chartRange = button.dataset.range;
    document.querySelectorAll('#chart-range-controls .seg-btn').forEach((item) => item.classList.toggle('active', item === button));
    const ytdSelect = document.getElementById('ytd-year-select');
    if (ytdSelect) {
        ytdSelect.style.display = state.chartRange === 'YTD' ? 'inline-block' : 'none';
    }
    renderCharts();
}

function onIndicatorToggle(event) {
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

function renderCharts() {
    state.chartVisible = getVisibleChartData();
    renderPriceChart(state.chartVisible);
    renderSeparateIndicatorCharts(state.chartVisible);
    renderChartLegend();
    renderTechLegend();
}

function getVisibleChartData() {
    const range = state.chartRange;
    if (range === 'DAILY') return state.chartDaily.slice(-60);
    if (range === 'WEEKLY') return state.chartWeekly.length ? state.chartWeekly.slice(-52) : aggregateCandles(state.chartDaily, 'week');
    if (range === 'MONTHLY') return state.chartMonthly.length ? state.chartMonthly.slice(-24) : aggregateCandles(state.chartDaily, 'month');
    if (range === 'YTD') {
        const yearStr = String(state.chartYtdYear);
        return state.chartDaily.filter((p) => p.date.startsWith(yearStr));
    }
    return state.chartDaily.slice(-60);
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
        return;
    }

    const padding = { top: 18, right: 86, bottom: 38, left: 18 };
    const width = canvas.width - padding.left - padding.right;
    const height = canvas.height - padding.top - padding.bottom;
    const prices = data.flatMap((point) => [point.high, point.low]);
    const maxPrice = Math.max(...prices) * 1.02;
    const minPrice = Math.min(...prices) * 0.98;
    const xGap = width / data.length;
    const candleWidth = Math.max(4, xGap * 0.6);
    const hovered = priceHoverIndex;

    const closeSeries = data.map((point) => point.close);
    const ma5 = computeSMA(closeSeries, 5);
    const ma20 = computeSMA(closeSeries, 20);
    const ma60 = computeSMA(closeSeries, 60);
    const ma200 = computeSMA(closeSeries, 200);
    const boll = computeBollingerSeries(closeSeries, 20, 2);

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

    if (state.selectedIndicators.has('MA')) {
        drawOverlayLine(context, ma5, xAt, yAt, '#8fd3ff');
        drawOverlayLine(context, ma20, xAt, yAt, '#f59e0b');
        drawOverlayLine(context, ma60, xAt, yAt, '#a855f7');
        drawOverlayLine(context, ma200, xAt, yAt, '#ef4444', 1.2, [6, 3]);
    }

    if (state.selectedIndicators.has('BOLL')) {
        drawOverlayLine(context, boll.map((item) => item?.upper ?? null), xAt, yAt, 'rgba(34,211,238,0.9)');
        drawOverlayLine(context, boll.map((item) => item?.lower ?? null), xAt, yAt, 'rgba(124,108,255,0.9)');
    }

    const labelStep = Math.max(1, Math.floor(data.length / 6));
    context.fillStyle = '#64748b';
    context.textAlign = 'center';
    context.font = '11px Inter';
    const isWeekly = state.chartRange === 'WEEKLY';
    data.forEach((point, index) => {
        if (index % labelStep !== 0 && index !== data.length - 1) return;
        context.fillText(formatAxisDate(point.date, isWeekly), xAt(index), canvas.height - 12);
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
            `등락 ${(point.changePct || 0).toFixed(2)}%`
        ];
        drawTooltip(context, x + 16, padding.top + 12, lines, canvas.width - 200, canvas.height - 120);
    }

    canvas.onmousemove = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left - padding.left;
        if (x < 0 || x > width) {
            priceHoverIndex = null;
            renderPriceChart(data);
            return;
        }
        priceHoverIndex = Math.min(data.length - 1, Math.max(0, Math.floor(x / xGap)));
        renderPriceChart(data);
    };

    canvas.onmouseleave = () => {
        priceHoverIndex = null;
        renderPriceChart(data);
    };
}

function renderSeparateIndicatorCharts(data) {
    const container = document.getElementById('indicator-panels');
    if (!container) return;
    if (!data.length || !state.technicals) {
        container.innerHTML = '';
        return;
    }

    const localTech = computeTechnicals(data);
    const panels = [];

    if (state.selectedIndicators.has('RSI')) {
        panels.push({ key: 'RSI', label: 'RSI (14)', render: (ctx, w, h, xAt) => {
            const yAt = (v) => h - (v / 100) * (h - 32) - 16;
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            [30, 50, 70].forEach((level) => {
                ctx.beginPath();
                ctx.moveTo(0, yAt(level));
                ctx.lineTo(w, yAt(level));
                ctx.stroke();
                ctx.fillStyle = '#64748b';
                ctx.font = '10px Inter';
                ctx.textAlign = 'right';
                ctx.fillText(String(level), w - 4, yAt(level) - 3);
            });
            drawLineSeries(ctx, localTech.rsi, xAt, yAt, '#8fd3ff', 2);
            buildRsiMarkers(localTech.rsi).forEach((m) => drawSignalMarker(ctx, xAt(m.index), yAt(m.value), m.type));
        }});
    }

    if (state.selectedIndicators.has('MACD')) {
        panels.push({ key: 'MACD', label: 'MACD (12, 26, 9)', render: (ctx, w, h, xAt) => {
            const hist = localTech.macd.histogram;
            const values = hist.filter((v) => v !== null);
            const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
            const yAt = (v) => h / 2 - (v / maxAbs) * (h / 2 - 16);
            hist.forEach((v, i) => {
                if (v === null) return;
                ctx.strokeStyle = v >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.8)';
                ctx.lineWidth = Math.max(2, (w / data.length) * 0.45);
                ctx.beginPath();
                ctx.moveTo(xAt(i), yAt(0));
                ctx.lineTo(xAt(i), yAt(v));
                ctx.stroke();
            });
            drawLineSeries(ctx, localTech.macd.macd, xAt, yAt, '#8fd3ff', 2);
            drawLineSeries(ctx, localTech.macd.signal, xAt, yAt, '#f59e0b', 1.6);
            buildMacdMarkers(localTech.macd).forEach((m) => drawSignalMarker(ctx, xAt(m.index), yAt(m.value), m.type));
        }});
    }

    if (state.selectedIndicators.has('STOCH')) {
        panels.push({ key: 'STOCH', label: '스토캐스틱 (14, 3)', render: (ctx, w, h, xAt) => {
            const yAt = (v) => h - (v / 100) * (h - 32) - 16;
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            [20, 50, 80].forEach((level) => {
                ctx.beginPath();
                ctx.moveTo(0, yAt(level));
                ctx.lineTo(w, yAt(level));
                ctx.stroke();
                ctx.fillStyle = '#64748b';
                ctx.font = '10px Inter';
                ctx.textAlign = 'right';
                ctx.fillText(String(level), w - 4, yAt(level) - 3);
            });
            drawLineSeries(ctx, localTech.stoch.k, xAt, yAt, '#f59e0b', 2);
            drawLineSeries(ctx, localTech.stoch.d, xAt, yAt, '#a855f7', 1.6);
        }});
    }

    if (state.selectedIndicators.has('BOLL')) {
        panels.push({ key: 'BOLL', label: '볼린저 밴드 (20, 2)', render: (ctx, w, h, xAt) => {
            const closeSeries = data.map((p) => p.close);
            const bollData = computeBollingerSeries(closeSeries, 20, 2);
            const allVals = bollData.filter((b) => b).flatMap((b) => [b.upper, b.lower]);
            if (!allVals.length) return;
            const maxV = Math.max(...allVals) * 1.01;
            const minV = Math.min(...allVals) * 0.99;
            const yAt = (v) => 8 + (h - 24) - ((v - minV) / (maxV - minV || 1)) * (h - 24);
            drawLineSeries(ctx, bollData.map((b) => b?.upper ?? null), xAt, yAt, 'rgba(34,211,238,0.9)', 1.6);
            drawLineSeries(ctx, bollData.map((b) => b?.middle ?? null), xAt, yAt, '#94a3b8', 1.2);
            drawLineSeries(ctx, bollData.map((b) => b?.lower ?? null), xAt, yAt, 'rgba(124,108,255,0.9)', 1.6);
            drawLineSeries(ctx, closeSeries, xAt, yAt, '#8fd3ff', 1.4);
        }});
    }

    if (state.selectedIndicators.has('MA')) {
        panels.push({ key: 'MA', label: '이동평균선 (5, 20, 60, 200)', render: (ctx, w, h, xAt) => {
            const closeSeries = data.map((p) => p.close);
            const allVals = closeSeries.filter((v) => v > 0);
            if (!allVals.length) return;
            const maxV = Math.max(...allVals) * 1.02;
            const minV = Math.min(...allVals) * 0.98;
            const yAt = (v) => 8 + (h - 24) - ((v - minV) / (maxV - minV || 1)) * (h - 24);
            drawLineSeries(ctx, closeSeries, xAt, yAt, 'rgba(255,255,255,0.25)', 1);
            drawLineSeries(ctx, computeSMA(closeSeries, 5), xAt, yAt, '#8fd3ff', 2);
            drawLineSeries(ctx, computeSMA(closeSeries, 20), xAt, yAt, '#f59e0b', 1.8);
            drawLineSeries(ctx, computeSMA(closeSeries, 60), xAt, yAt, '#a855f7', 1.6);
            drawOverlayLine(ctx, computeSMA(closeSeries, 200), xAt, yAt, '#ef4444', 1.4, [6, 3]);
        }});
    }

    if (!panels.length) {
        container.innerHTML = '<p style="color:#94a3b8;padding:18px;">지표를 선택하면 개별 차트가 표시됩니다.</p>';
        return;
    }

    container.innerHTML = panels.map((p) => `
        <div class="indicator-panel-item">
            <div class="indicator-panel-label">${p.label}</div>
            <div class="indicator-shell-mini">
                <canvas id="ind-canvas-${p.key}" width="1000" height="160"></canvas>
            </div>
        </div>
    `).join('');

    panels.forEach((panel) => {
        const cvs = document.getElementById(`ind-canvas-${panel.key}`);
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        const wrapperWidth = cvs.parentElement.clientWidth - 12;
        cvs.width = Math.max(wrapperWidth, 320);
        cvs.height = 160;
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        const xGap = cvs.width / data.length;
        const xAt = (i) => xGap * i + xGap / 2;
        panel.render(ctx, cvs.width, cvs.height, xAt);
    });
}

function renderChartLegend() {
    const items = [
        { type: 'dot', color: '#22c55e', label: '상승 봉' },
        { type: 'dot', color: '#ef4444', label: '하락 봉' }
    ];

    if (state.selectedIndicators.has('MA')) {
        items.push({ type: 'line', color: '#8fd3ff', label: 'MA5' });
        items.push({ type: 'line', color: '#f59e0b', label: 'MA20' });
        items.push({ type: 'line', color: '#a855f7', label: 'MA60' });
        items.push({ type: 'line', color: '#ef4444', label: 'MA200' });
    }
    if (state.selectedIndicators.has('BOLL')) {
        items.push({ type: 'line', color: 'rgba(34,211,238,0.9)', label: '볼린저 상단' });
        items.push({ type: 'line', color: 'rgba(124,108,255,0.9)', label: '볼린저 하단' });
    }

    document.getElementById('chart-legend').innerHTML = items.map((item) => `
        <span class="legend-chip">
            <span class="${item.type === 'line' ? 'legend-line' : 'legend-dot'}" style="background:${item.color}"></span>
            <span>${item.label}</span>
        </span>
    `).join('');
}

function renderTechLegend() {
    const items = [
        { type: 'line', color: '#8fd3ff', label: '기술 지표선' },
        { type: 'line', color: '#f59e0b', label: '보조 신호선' },
        { type: 'dot', color: '#22c55e', label: '매수 시그널' },
        { type: 'dot', color: '#ef4444', label: '매도 시그널' }
    ];

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
${company}에 대한 투자 브리핑을 아래 형식에 맞춰 한국어로 작성하세요.

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
- 시세 소스: ${state.chartSource === 'kiwoom' ? '키움증권 REST API' : state.chartSource === 'public_quote' ? '공개 시세 보정' : '대체 차트'}

[출력 형식 — 반드시 아래 구조와 소제목을 사용하세요]
## 한 줄 요약
(1~2문장)

## 핵심 강점
- 강점1
- 강점2
- 강점3

## 주요 리스크
- 리스크1
- 리스크2
- 리스크3

## 최종 의견
(매수/관망/주의 중 택 1) + 근거 2~3줄

** 간결하게 작성하되, 수치 근거를 반드시 포함하세요.
    `.trim();

    try {
        const response = await fetchJson(buildProxyPostUrl('gemini'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 1000
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
        `시세 소스는 현재 ${state.chartSource === 'kiwoom' ? '키움증권 실데이터' : state.chartSource === 'public_quote' ? '공개 시세 보정 차트' : '대체 YTD 차트'}입니다.`,
        `최근 분기 데이터가 부족한 경우 분기 성장률 평가는 보수적으로 해석해야 합니다.`
    ];
    const finalOpinion = state.lastAnalysis.totalPct >= 80 ? '매수 후보' : state.lastAnalysis.totalPct >= 60 ? '관망 우위' : '주의 구간';

    return `
        <div class="briefing-section">
            <h3>한 줄 요약</h3>
            <div class="briefing-body">${state.company.name}은 현재 가치지표와 재무 점수상 <strong>${finalOpinion}</strong>에 가까우며, 기술적 지표는 ${document.getElementById('tech-summary').innerText.trim()} 상태입니다.</div>
        </div>
        <div class="briefing-section">
            <h3>핵심 강점</h3>
            <ul class="briefing-list">${strengthLines.map((item) => `<li>${item}</li>`).join('')}</ul>
        </div>
        <div class="briefing-section">
            <h3>주요 리스크</h3>
            <ul class="briefing-list">${riskLines.map((item) => `<li>${item}</li>`).join('')}</ul>
        </div>
        <div class="briefing-section">
            <h3>최종 의견</h3>
            <div class="briefing-body"><strong>${finalOpinion}</strong>입니다. 재무 점수, 적정주가, 기술적 집계 결과를 함께 확인하면서 DART 원문과 최신 공시까지 교차 검증하는 접근이 적합합니다.</div>
        </div>
    `;
}

function formatBriefingText(text) {
    const escaped = escapeHtml(text);
    const lines = escaped.split('\n');
    let html = '';
    let currentSection = null;
    let listBuffer = [];

    function flushList() {
        if (listBuffer.length) {
            html += `<ul class="briefing-list">${listBuffer.map((l) => `<li>${l}</li>`).join('')}</ul>`;
            listBuffer = [];
        }
    }

    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) return;

        if (line.startsWith('## ') || line.startsWith('**') && line.endsWith('**')) {
            flushList();
            const heading = line.replace(/^##\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
            html += `</div><div class="briefing-section"><h3>${heading}</h3>`;
            currentSection = heading;
            return;
        }

        if (/^\d+\.\s/.test(line)) {
            flushList();
            const heading = line.replace(/^\d+\.\s*/, '').replace(/:$/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
            html += `</div><div class="briefing-section"><h3>${heading}</h3>`;
            return;
        }

        if (/^[-•]\s/.test(line)) {
            listBuffer.push(line.replace(/^[-•]\s*/, '').replace(/\*\*/g, ''));
            return;
        }

        flushList();
        const cleaned = line.replace(/\*\*/g, '');
        html += `<div class="briefing-body">${cleaned}</div>`;
    });

    flushList();
    return `<div>${html}</div>`;
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

function drawOverlayLine(context, series, xAt, yAt, color, lineWidth = 1.8, dash = null) {
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    if (dash) context.setLineDash(dash);
    else context.setLineDash([]);
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
    context.setLineDash([]);
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

function drawTooltip(context, x, y, lines, maxX, maxY) {
    const boxWidth = 168;
    const boxHeight = lines.length * 18 + 16;
    const drawX = Math.min(x, maxX);
    const drawY = Math.min(y, maxY);
    context.fillStyle = 'rgba(8,10,16,0.92)';
    context.strokeStyle = 'rgba(255,255,255,0.14)';
    context.lineWidth = 1;
    context.fillRect(drawX, drawY, boxWidth, boxHeight);
    context.strokeRect(drawX, drawY, boxWidth, boxHeight);
    context.fillStyle = '#f8fafc';
    context.font = '11px Inter';
    lines.forEach((line, index) => {
        context.fillText(line, drawX + 10, drawY + 18 + index * 16);
    });
}

function buildRsiMarkers(rsiSeries) {
    const markers = [];
    for (let i = 1; i < rsiSeries.length; i += 1) {
        if (rsiSeries[i] === null) continue;
        if (rsiSeries[i] < 30) markers.push({ index: i, type: 'buy', value: rsiSeries[i] });
        if (rsiSeries[i] > 70) markers.push({ index: i, type: 'sell', value: rsiSeries[i] });
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

function formatAxisDate(token, weekly = false) {
    if (!token || token.length !== 8) return '';
    return weekly ? `${token.slice(4, 6)}/${token.slice(6, 8)}` : `${token.slice(4, 6)}.${token.slice(6, 8)}`;
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

function toDate(token) {
    return new Date(Number(token.slice(0, 4)), Number(token.slice(4, 6)) - 1, Number(token.slice(6, 8)));
}

function fromDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
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
