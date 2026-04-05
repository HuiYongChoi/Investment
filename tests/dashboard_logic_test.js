ObjC.import('Foundation');

function readText(path) {
    const fileManager = $.NSFileManager.defaultManager;
    if (!fileManager.fileExistsAtPath(path)) {
        throw new Error(`Missing file: ${path}`);
    }
    const content = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(content);
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const cwd = ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath);
const logicPath = `${cwd}/dashboard_logic.js`;
const source = readText(logicPath);
eval(source);

assert(typeof InvestmentLogic === 'object', 'InvestmentLogic should be defined');

const directory = InvestmentLogic.buildCompanyDirectory({
    '삼성전자': { corpCode: '00126380', stockCode: '005930', market: 'KOSPI' },
    '네이버': { corpCode: '00266961', stockCode: '035420', market: 'KOSPI' },
    'NAVER': { corpCode: '00266961', stockCode: '035420', market: 'KOSPI' }
});

assert(directory.length === 2, 'Company directory should dedupe aliases by stock code');
assert(directory[0].displayLabel === '삼성전자 · 005930', 'Display label should include company name and stock code on one line');

const matches = InvestmentLogic.matchCompanies(directory, '00593');
assert(matches.length === 1 && matches[0].stockCode === '005930', 'Stock code prefix should find Samsung Electronics');

const quote = InvestmentLogic.normalizePublicQuote({
    closePrice: '186,200',
    compareToPreviousClosePrice: '7,800',
    fluctuationsRatio: '4.37',
    localTradedAt: '2026-04-03T16:10:21+09:00'
});

assert(quote.close === 186200, 'Quote close should parse numeric text');
assert(quote.change === 7800, 'Quote change should parse numeric text');
assert(quote.changePct === 4.37, 'Quote changePct should parse decimal text');

const openDelta = InvestmentLogic.describePriceDelta(184200, 178400);
assert(openDelta.change === 5800, 'Price delta helper should derive signed delta from the reference close');
assert(Math.round(openDelta.changePct * 100) / 100 === 3.25, 'Price delta helper should derive signed percentage from the reference close');
assert(openDelta.direction === 'up', 'Price delta helper should mark positive deltas as up');

const lowDelta = InvestmentLogic.describePriceDelta(170500, 178400);
assert(lowDelta.change === -7900, 'Price delta helper should preserve negative deltas');
assert(Math.round(lowDelta.changePct * 100) / 100 === -4.43, 'Price delta helper should preserve negative percentage deltas');
assert(lowDelta.direction === 'down', 'Price delta helper should mark negative deltas as down');

const kiwoomQuote = InvestmentLogic.normalizeKiwoomQuote({
    stk_nm: '삼성전자',
    cur_prc: '171,200',
    pred_pre: '-2,800',
    flu_rt: '-1.61',
    open_pric: '173,000',
    high_pric: '173,400',
    low_pric: '170,500',
    trde_qty: '15,220,331'
}, '2026-04-04T09:01:00+09:00');

assert(kiwoomQuote.name === '삼성전자', 'Kiwoom quote should preserve stock name');
assert(kiwoomQuote.close === 171200, 'Kiwoom quote close should parse current price');
assert(kiwoomQuote.change === -2800, 'Kiwoom quote change should preserve signed delta');
assert(kiwoomQuote.changePct === -1.61, 'Kiwoom quote changePct should preserve signed ratio');
assert(kiwoomQuote.open === 173000 && kiwoomQuote.high === 173400 && kiwoomQuote.low === 170500, 'Kiwoom quote should parse OHLC');
assert(kiwoomQuote.volume === 15220331, 'Kiwoom quote should parse volume');
assert(kiwoomQuote.asOf === '2026-04-04T09:01:00+09:00', 'Kiwoom quote should include fetch timestamp');

assert(InvestmentLogic.buildYahooSymbol('005930', 'KOSPI') === '005930.KS', 'KOSPI stocks should map to .KS Yahoo Finance tickers');
assert(InvestmentLogic.buildYahooSymbol('035720', 'KOSDAQ') === '035720.KQ', 'KOSDAQ stocks should map to .KQ Yahoo Finance tickers');
assert(InvestmentLogic.buildYahooSymbol('AAPL', 'NASDAQ') === 'AAPL', 'Non-KRX tickers should pass through unchanged');

const yfinanceQuote = InvestmentLogic.normalizeYfinanceQuote({
    symbol: '005930.KS',
    shortName: 'Samsung Electronics Co., Ltd.',
    currentPrice: 84500,
    previousClose: 83300,
    open: 83600,
    dayHigh: 84600,
    dayLow: 83200,
    volume: 15400321,
    regularMarketTime: '2026-04-05T15:30:00+09:00'
}, '2026-04-05T15:31:00+09:00');

assert(yfinanceQuote.symbol === '005930.KS', 'yfinance quote should preserve the Yahoo symbol');
assert(yfinanceQuote.close === 84500, 'yfinance quote should prefer currentPrice as the close');
assert(yfinanceQuote.change === 1200, 'yfinance quote should derive the delta from previousClose');
assert(Math.round(yfinanceQuote.changePct * 100) / 100 === 1.44, 'yfinance quote should derive the percentage delta from previousClose');
assert(yfinanceQuote.open === 83600 && yfinanceQuote.high === 84600 && yfinanceQuote.low === 83200, 'yfinance quote should parse OHLC fields');
assert(yfinanceQuote.volume === 15400321, 'yfinance quote should parse volume');
assert(yfinanceQuote.asOf === '2026-04-05T15:30:00+09:00', 'yfinance quote should prefer market timestamp when present');

const kiwoomDaily = InvestmentLogic.normalizeKiwoomChartRows([
    {
        dt: '20260404',
        cur_prc: '171,200',
        open_pric: '173,000',
        high_pric: '173,400',
        low_pric: '170,500',
        trde_qty: '15,220,331',
        pred_pre: '-2,800',
        trde_tern_rt: '-1.61'
    },
    {
        dt: '20260403',
        cur_prc: '174,000',
        open_pric: '169,200',
        high_pric: '174,300',
        low_pric: '168,900',
        trde_qty: '18,103,204',
        pred_pre: '7,800',
        trde_tern_rt: '4.69'
    }
], {
    dateKey: 'dt',
    startDate: '20260404'
});

assert(kiwoomDaily.length === 1, 'Kiwoom chart rows should honor startDate trimming');
assert(kiwoomDaily[0].date === '20260404', 'Kiwoom chart rows should normalize the date field');
assert(kiwoomDaily[0].close === 171200, 'Kiwoom chart rows should parse close prices');
assert(kiwoomDaily[0].change === -2800, 'Kiwoom chart rows should preserve signed daily change');

const yfinanceDaily = InvestmentLogic.normalizeYfinanceChartRows([
    {
        date: '2026-04-04',
        open: 83600,
        high: 84600,
        low: 83200,
        close: 84500,
        volume: 15400321,
        previousClose: 83300
    },
    {
        date: '2026-04-03',
        open: 82100,
        high: 83400,
        low: 81900,
        close: 83300,
        volume: 17802124,
        previousClose: 82500
    }
], {
    startDate: '20260404'
});

assert(yfinanceDaily.length === 1, 'yfinance chart rows should honor startDate trimming');
assert(yfinanceDaily[0].date === '20260404', 'yfinance chart rows should normalize ISO date strings');
assert(yfinanceDaily[0].close === 84500, 'yfinance chart rows should parse close prices');
assert(yfinanceDaily[0].change === 1200, 'yfinance chart rows should derive the daily change from previousClose');
assert(Math.round(yfinanceDaily[0].changePct * 100) / 100 === 1.44, 'yfinance chart rows should derive the daily percentage change from previousClose');

const prodRedirectUri = InvestmentLogic.resolveKakaoRedirectUri('https://hyfin.duckdns.org/index.html');
assert(prodRedirectUri === 'https://hyfin.duckdns.org/auth/kakao/callback', 'Kakao authorize URI should use the registered auth callback path');

const localRedirectUri = InvestmentLogic.resolveKakaoRedirectUri('http://localhost:8080/index.html');
assert(localRedirectUri === 'http://localhost:8080/auth/kakao/callback', 'Kakao authorize URI should support local auth callback path');

const rootCallbackUri = InvestmentLogic.resolveKakaoCallbackUri('https://hyfin.duckdns.org/kakao_callback.php?code=abc');
assert(rootCallbackUri === 'https://hyfin.duckdns.org/kakao_callback.php', 'Kakao callback URI should preserve the current callback path without query params');

const authCallbackUri = InvestmentLogic.resolveKakaoCallbackUri('https://hyfin.duckdns.org/auth/kakao/callback?code=abc');
assert(authCallbackUri === 'https://hyfin.duckdns.org/auth/kakao/callback', 'Kakao callback URI should also support the legacy auth callback path');

const safeReturnUrl = InvestmentLogic.resolveKakaoReturnUrl(
    'https://hyfin.duckdns.org/dashboard?tab=briefing',
    'https://hyfin.duckdns.org/auth/kakao/callback'
);
assert(safeReturnUrl === 'https://hyfin.duckdns.org/dashboard?tab=briefing', 'Stored Kakao return URL should be preserved when same-origin');

const fallbackReturnUrl = InvestmentLogic.resolveKakaoReturnUrl(
    'https://evil.example/steal',
    'https://hyfin.duckdns.org/auth/kakao/callback'
);
assert(fallbackReturnUrl === 'https://hyfin.duckdns.org/index.html', 'Kakao return URL should fall back to same-origin dashboard when storage is cross-origin');

const removedKeys = [];
let clearedAccessToken = 'unchanged';
InvestmentLogic.clearKakaoSessionState(
    {
        removeItem(key) {
            removedKeys.push(key);
        }
    },
    {
        setAccessToken(value) {
            clearedAccessToken = value;
        }
    }
);
assert(
    removedKeys.join(',') === 'invest_nav_kakao_token,invest_nav_kakao_error,invest_nav_kakao_return_url',
    'Kakao session cleanup should remove every stored auth key'
);
assert(clearedAccessToken === null, 'Kakao session cleanup should clear the SDK access token');

const chart = InvestmentLogic.generateAnchoredSyntheticChart({
    stockCode: '005930',
    startDate: '20260102',
    endDate: '20260109',
    anchorClose: 186200,
    baseHints: { '005930': 81000 }
});

assert(chart.length > 0, 'Anchored synthetic chart should create business-day points');
assert(chart[chart.length - 1].close === 186200, 'Last fallback chart close should match the live anchor price');

const quarterConfigs = InvestmentLogic.getQuarterlyReportConfigs();
assert(quarterConfigs[0].code === '11011' && quarterConfigs[0].rank === 4, 'Quarterly configs should prioritize annual report as Q4');

const orderedPeriods = InvestmentLogic.sortPeriods([
    { label: '2025 3분기', sortKey: 20253 },
    { label: '2025 4분기', sortKey: 20254 },
    { label: '2026 1분기', sortKey: 20261 }
]);
assert(orderedPeriods[0].label === '2026 1분기', 'Latest quarterly periods should sort newest-first');

console.log('dashboard_logic_test: ok');
