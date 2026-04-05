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

const mergedDirectory = InvestmentLogic.mergeCompanyDirectories([
    { name: 'NAVER', stockCode: '035420', corpCode: '00266961', market: 'AUTO', aliases: ['NAVER CORPORATION'] },
    { name: '코리아에프티', stockCode: '123456', corpCode: '00999999', market: 'AUTO', aliases: ['KOREA F/T'] }
], directory);

const mergedNaver = mergedDirectory.find((item) => item.stockCode === '035420');
assert(mergedNaver.name === 'NAVER', 'Remote company directory should be the primary source when available');
assert(mergedNaver.aliases.includes('네이버'), 'Merged directory should preserve local Korean aliases');
assert(mergedNaver.aliases.includes('NAVER'), 'Merged directory should preserve the remote primary name as an alias');
assert(mergedNaver.displayLabel === 'NAVER · 035420', 'Merged company directory should keep the display label format');

const mergedMatches = InvestmentLogic.matchCompanies(mergedDirectory, '네이버');
assert(mergedMatches.length === 1 && mergedMatches[0].stockCode === '035420', 'Alias search should resolve merged directory entries');

const matches = InvestmentLogic.matchCompanies(directory, '00593');
assert(matches.length === 1 && matches[0].stockCode === '005930', 'Stock code prefix should find Samsung Electronics');

const trailingDirectory = InvestmentLogic.buildCompanyDirectory({
    '가나': { corpCode: '00000001', stockCode: '111111', market: 'KOSPI' },
    '가나다': { corpCode: '00000002', stockCode: '222222', market: 'KOSPI' },
    '가나다라': { corpCode: '00000003', stockCode: '333333', market: 'KOSPI' }
});
const trailingMatch = InvestmentLogic.pickTrailingCompanyMatch(trailingDirectory, '가');
assert(trailingMatch && trailingMatch.stockCode === '333333', 'Fallback autocomplete selection should use the trailing suggestion for the current query');
assert(InvestmentLogic.pickTrailingCompanyMatch(trailingDirectory, '') === null, 'Fallback autocomplete selection should ignore blank queries');
assert(InvestmentLogic.moveSuggestionSelectionIndex(-1, 3, 1) === 0, 'Arrow-down should move to the first autocomplete suggestion when none is active');
assert(InvestmentLogic.moveSuggestionSelectionIndex(0, 3, 1) === 1, 'Arrow-down should advance to the next autocomplete suggestion');
assert(InvestmentLogic.moveSuggestionSelectionIndex(2, 3, 1) === 0, 'Arrow-down should wrap back to the first suggestion at the end of the list');
assert(InvestmentLogic.moveSuggestionSelectionIndex(0, 3, -1) === 2, 'Arrow-up should wrap to the last suggestion from the first row');

const groupedReports = InvestmentLogic.groupReportsBySection([
    { title: '사업보고서 (2025.12)', type: '사업보고서', date: '20260331', url: '#' },
    { title: '[기재정정]사업보고서 (2025.12)', type: '사업보고서', date: '20260311', url: '#' },
    { title: '분기보고서 (2025.09)', type: '분기보고서', date: '20251114', url: '#' },
    { title: '반기보고서 (2025.06)', type: '반기보고서', date: '20250813', url: '#' },
    { title: '분기보고서 (2024.03)', type: '분기보고서', date: '20240515', url: '#' }
]);
assert(groupedReports.annualReports.length === 2, 'Annual report section should keep 사업보고서 entries separate from quarterly reports');
assert(groupedReports.quarterlyYears.length === 2, 'Quarterly section should group 분기/반기 reports by fiscal year');
assert(groupedReports.quarterlyYears[0].year === '2025', 'Quarterly report groups should sort newest fiscal year first');
assert(groupedReports.quarterlyYears[0].reports.length === 2, 'Quarterly report year groups should include 반기보고서 with the same fiscal year');
assert(groupedReports.quarterlyYears[1].year === '2024', 'Quarterly report groups should keep older fiscal years as separate toggles');

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
    removedKeys.join(',') === 'invest_nav_kakao_token,invest_nav_kakao_error,invest_nav_kakao_return_url,invest_nav_kakao_profile',
    'Kakao session cleanup should remove every stored auth key'
);
assert(clearedAccessToken === null, 'Kakao session cleanup should clear the SDK access token');

const kakaoProfileFromNestedAccount = InvestmentLogic.extractKakaoProfile({
    kakao_account: {
        profile: {
            nickname: '모하이',
            thumbnail_image_url: 'https://example.com/kakao-thumb.png'
        }
    }
});
assert(kakaoProfileFromNestedAccount.nickname === '모하이', 'Kakao profile helper should read nickname from kakao_account.profile when properties are missing');
assert(kakaoProfileFromNestedAccount.image === 'https://example.com/kakao-thumb.png', 'Kakao profile helper should read thumbnail image from kakao_account.profile');

const kakaoProfileFromLegacyProperties = InvestmentLogic.extractKakaoProfile({
    properties: {
        nickname: '레거시유저',
        thumbnail_image: 'https://example.com/legacy-thumb.png'
    }
});
assert(kakaoProfileFromLegacyProperties.nickname === '레거시유저', 'Kakao profile helper should continue supporting legacy properties.nickname');
assert(kakaoProfileFromLegacyProperties.image === 'https://example.com/legacy-thumb.png', 'Kakao profile helper should continue supporting legacy properties.thumbnail_image');

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

const chartSample = [
    { date: '20260105', open: 100, high: 110, low: 99, close: 108, volume: 10, change: 8, changePct: 8 },
    { date: '20260106', open: 108, high: 112, low: 107, close: 111, volume: 11, change: 3, changePct: 2.78 },
    { date: '20260120', open: 111, high: 120, low: 110, close: 118, volume: 12, change: 7, changePct: 6.31 },
    { date: '20260203', open: 118, high: 122, low: 117, close: 121, volume: 13, change: 3, changePct: 2.54 },
    { date: '20260204', open: 121, high: 126, low: 120, close: 125, volume: 14, change: 4, changePct: 3.31 },
    { date: '20260302', open: 125, high: 129, low: 123, close: 127, volume: 15, change: 2, changePct: 1.6 },
    { date: '20270104', open: 127, high: 140, low: 125, close: 138, volume: 16, change: 11, changePct: 8.66 }
];

const weeklySeries = InvestmentLogic.aggregateChartPoints(chartSample, 'week');
assert(weeklySeries.length === 5, 'Weekly aggregation should merge rows within the same ISO week');
assert(weeklySeries[0].open === 100 && weeklySeries[0].close === 111, 'Weekly aggregation should preserve first open and last close');
assert(weeklySeries[0].high === 112 && weeklySeries[0].low === 99, 'Weekly aggregation should preserve weekly high and low');
assert(weeklySeries[0].volume === 21, 'Weekly aggregation should sum weekly volume');

const monthlySeries = InvestmentLogic.aggregateChartPoints(chartSample, 'month');
assert(monthlySeries.length === 4, 'Monthly aggregation should merge rows within the same month');
assert(monthlySeries[0].date === '20260120', 'Monthly aggregation should keep the last date token in the bucket');
assert(monthlySeries[0].open === 100 && monthlySeries[0].close === 118, 'Monthly aggregation should preserve first open and last close for the month');

const yearlySeries = InvestmentLogic.aggregateChartPoints(chartSample, 'year');
assert(yearlySeries.length === 2, 'Yearly aggregation should merge rows within the same year');
assert(yearlySeries[0].high === 129 && yearlySeries[0].volume === 75, 'Yearly aggregation should preserve yearly high and summed volume');

const ytdSeries = InvestmentLogic.resolveChartSeries(chartSample, 'YTD', { currentYear: 2026 });
assert(ytdSeries.length === 6, 'YTD range should keep only rows from the selected current year');

const monthlyRange = InvestmentLogic.resolveChartSeries(chartSample, 'MONTH', { currentYear: 2026 });
assert(monthlyRange.length === 4, 'MONTH range should return monthly aggregated candles');

const clampedWindow = InvestmentLogic.normalizeChartWindow(100, 90, 20, 12);
assert(clampedWindow.start === 80 && clampedWindow.end === 100, 'Chart window should clamp to the available right edge');

const zoomedWindow = InvestmentLogic.zoomChartWindow({ start: 0, end: 100 }, 100, 0.5, 0.5, 20);
assert(zoomedWindow.start === 25 && zoomedWindow.end === 75, 'Chart zoom helper should zoom toward the anchor point');

const hoveredAnchorRatio = InvestmentLogic.resolveChartAnchorRatio({ start: 80, end: 100 }, 99, 0.35);
assert(Math.round(hoveredAnchorRatio * 1000) / 1000 === 0.975, 'Hovered chart dates should resolve to a right-anchored zoom ratio near the latest candle');

const fallbackAnchorRatio = InvestmentLogic.resolveChartAnchorRatio({ start: 80, end: 100 }, null, 0.35);
assert(fallbackAnchorRatio === 0.35, 'Chart anchor helper should fall back to the pointer ratio when no hovered candle exists');

const pinchZoomInFactor = InvestmentLogic.resolvePinchZoomFactor(100, 130);
assert(Math.round(pinchZoomInFactor * 1000) / 1000 === 0.769, 'Pinch-out gestures should zoom into fewer candles');

const pinchZoomOutFactor = InvestmentLogic.resolvePinchZoomFactor(100, 70);
assert(Math.round(pinchZoomOutFactor * 1000) / 1000 === 1.429, 'Pinch-in gestures should zoom back out to a wider window');

const pannedWindow = InvestmentLogic.panChartWindow({ start: 25, end: 75 }, 20, 100);
assert(pannedWindow.start === 45 && pannedWindow.end === 95, 'Chart pan helper should move the window without changing its size');

const slicedSeries = InvestmentLogic.sliceChartSeriesWindow([10, 20, 30, 40], { start: 1, end: 3 });
assert(slicedSeries.length === 2 && slicedSeries[0] === 20 && slicedSeries[1] === 30, 'Chart series slicing should follow the shared viewport window');

const slicedTechnicals = InvestmentLogic.sliceTechnicalSeriesWindow({
    ma5: [1, 2, 3, 4],
    ma20: [10, 20, 30, 40],
    rsi: [11, 22, 33, 44],
    macd: {
        macd: [101, 102, 103, 104],
        signal: [201, 202, 203, 204],
        histogram: [301, 302, 303, 304]
    },
    stoch: {
        k: [51, 52, 53, 54],
        d: [61, 62, 63, 64]
    },
    boll: [
        null,
        { upper: 1, middle: 2, lower: 3 },
        { upper: 4, middle: 5, lower: 6 },
        { upper: 7, middle: 8, lower: 9 }
    ],
    cards: [{ key: 'RSI' }]
}, { start: 1, end: 4 });
assert(slicedTechnicals.ma5.join(',') === '2,3,4', 'Sliced technical overlays should follow the chart window');
assert(slicedTechnicals.macd.signal.join(',') === '202,203,204', 'Nested MACD series should slice with the shared viewport');
assert(slicedTechnicals.stoch.k.join(',') === '52,53,54', 'Nested stochastic series should slice with the shared viewport');
assert(slicedTechnicals.boll[0].middle === 2 && slicedTechnicals.boll[2].middle === 8, 'Bollinger window slicing should preserve visible indicator points');

const daySignature = InvestmentLogic.buildChartSeriesSignature([
    { date: '20260401', close: 100, volume: 1000 },
    { date: '20260402', close: 110, volume: 1200 }
]);
assert(daySignature === '2|20260401|20260402|110|1200', 'Chart series signatures should summarize the current full-series identity for technical caching');
assert(InvestmentLogic.buildChartSeriesSignature([]) === '0|||0|0', 'Empty chart series should still produce a stable signature');
assert(InvestmentLogic.formatWonInputValue('1234567') === '1,234,567', 'Won input formatting should add thousands separators');
assert(InvestmentLogic.formatWonInputValue('0012300원') === '12,300', 'Won input formatting should strip non-digits and leading zeros');
assert(InvestmentLogic.parseFormattedNumber('1,234,567') === 1234567, 'Formatted numeric text should parse back to a number');
assert(InvestmentLogic.parseFormattedNumber('') === 0, 'Blank numeric text should parse to 0');
const valuationFallback = InvestmentLogic.resolveBaseValuationVariables({
    adjustedEps: '',
    forwardEps: '12,300',
    trailingEps: '9,800',
    targetPer: '',
    forwardPer: '8.6'
});
assert(valuationFallback.baseEPS === 12300, 'Base EPS should fall back to the API forward EPS when the adjusted EPS is blank');
assert(Math.round(valuationFallback.basePER * 10) / 10 === 8.6, 'Base PER should fall back to the API forward PER when the target PER is blank');
assert(!valuationFallback.usingManualEps && !valuationFallback.usingManualPer, 'Fallback valuation variables should report that manual overrides are inactive');
assert(valuationFallback.epsSource === 'forward', 'Base EPS should prefer forward EPS over trailing TTM EPS when both are available');

const valuationTtmFallback = InvestmentLogic.resolveBaseValuationVariables({
    adjustedEps: '',
    forwardEps: '',
    trailingEps: '9,800',
    targetPer: '',
    forwardPer: '8.6'
});
assert(valuationTtmFallback.baseEPS === 9800, 'Base EPS should fall back to TTM EPS when forward EPS is missing');
assert(valuationTtmFallback.epsSource === 'ttm', 'Base EPS source should report the TTM fallback when forward EPS is unavailable');
assert(valuationTtmFallback.forwardOverheat === false, 'TTM fallback alone should not trigger the forward-overheat warning');

const valuationOverride = InvestmentLogic.resolveBaseValuationVariables({
    adjustedEps: '15,000',
    forwardEps: '12,300',
    trailingEps: '9,800',
    targetPer: '11.2',
    forwardPer: '8.6'
});
assert(valuationOverride.baseEPS === 15000, 'Base EPS should immediately prefer the manually entered adjusted EPS');
assert(Math.round(valuationOverride.basePER * 10) / 10 === 11.2, 'Base PER should immediately prefer the manually entered target PER');
assert(valuationOverride.usingManualEps && valuationOverride.usingManualPer, 'Override valuation variables should report that manual inputs are active');
assert(valuationOverride.epsSource === 'manual', 'Manual adjusted EPS should remain the selected EPS source');

const valuationOverheat = InvestmentLogic.resolveBaseValuationVariables({
    adjustedEps: '',
    forwardEps: '15,500',
    trailingEps: '10,000',
    targetPer: '',
    forwardPer: '9.0'
});
assert(valuationOverheat.forwardOverheat === true, 'Forward EPS should raise the overheat flag when it exceeds TTM EPS by 50% or more');

const intelligentMachinesPreset = InvestmentLogic.resolveValuationSectorPreset('intelligent_machines');
assert(intelligentMachinesPreset.label === '지능형 기계 (AI/반도체/로봇)', 'Intelligent machines preset should expose the expected 2026 label');
assert(intelligentMachinesPreset.targetPer === 22, 'Intelligent machines preset should auto-fill the target PER to 22x');
assert(intelligentMachinesPreset.requiredReturn === 6, 'Intelligent machines preset should auto-fill the required return to 6%');
assert(intelligentMachinesPreset.premiumRate === 25, 'Intelligent machines preset should expose a 25% intangible premium');
assert(intelligentMachinesPreset.guideText === 'AI 슈퍼사이클 및 로보틱스 융합 가치 할증 적용 중', 'Intelligent machines preset should expose the final dynamic guide copy');
assert(intelligentMachinesPreset.badgeTone === 'sector-badge-ai', 'Intelligent machines preset should expose the blue premium badge tone');

const biotechPreset = InvestmentLogic.resolveValuationSectorPreset('biotech_innovation');
assert(biotechPreset.targetPer === 35, 'Biotech preset should auto-fill the target PER to 35x');
assert(biotechPreset.requiredReturn === 12, 'Biotech preset should auto-fill the required return to 12%');
assert(biotechPreset.premiumRate === 40, 'Biotech preset should expose a 40% intangible premium');
assert(biotechPreset.guideText === '임상 파이프라인 및 미래 신약 특허 가치 집중 반영 중', 'Biotech preset should expose the final dynamic guide copy');
assert(biotechPreset.badgeTone === 'sector-badge-bio', 'Biotech preset should expose the emerald premium badge tone');

const valueDividendPreset = InvestmentLogic.resolveValuationSectorPreset('value_dividend');
assert(valueDividendPreset.targetPer === 8, 'Value/dividend preset should auto-fill the target PER to 8x');
assert(valueDividendPreset.requiredReturn === 9, 'Value/dividend preset should auto-fill the required return to 9%');
assert(valueDividendPreset.premiumRate === 0, 'Value/dividend preset should carry no intangible premium');
assert(valueDividendPreset.guideText === '보수적 자산 가치 및 현금흐름 기반 밸류에이션 적용 중', 'Value/dividend preset should expose the final dynamic guide copy');

const valuationCards = InvestmentLogic.computeValuationOutputs({
    currentPrice: '10,000',
    baseEPS: 1000,
    basePER: 12,
    bps: '8,000',
    roe: '12',
    epsGrowth: '20',
    requiredReturn: '8',
    premiumRate: '10'
});
assert(valuationCards.perFairValue === 12000, 'PER-model fair value should equal base EPS times base PER');
assert(valuationCards.finalTargetPrice === 13200, 'Final target price should apply the intangible-asset premium on top of the PER-model fair value');
assert(Math.round(valuationCards.pegRatio * 100) / 100 === 0.6, 'PEG should divide base PER by the expected EPS growth rate');
assert(valuationCards.pegTone === 'good', 'PEG under 1.0 should use the green tone');
assert(valuationCards.srimFairValue === 12000, 'S-RIM fair value should apply the ROE spread over the required return to BPS');
assert(valuationCards.upsidePct === 32, 'Upside should compare the premium-adjusted final target price against the current price');
assert(valuationCards.upsideTone === 'hot', 'Positive upside should use the red tone');

const valuationCardsNegative = InvestmentLogic.computeValuationOutputs({
    currentPrice: '10,000',
    baseEPS: 500,
    basePER: 10,
    bps: '8,000',
    roe: '6',
    epsGrowth: '5',
    requiredReturn: '8',
    premiumRate: '0'
});
assert(valuationCardsNegative.pegTone === 'bad', 'PEG of 1.0 or higher should use the red tone');
assert(valuationCardsNegative.upsidePct === -50, 'Negative upside should preserve the signed percentage');
assert(valuationCardsNegative.upsideTone === 'cool', 'Negative upside should use the blue tone');

const lossMakingCards = InvestmentLogic.computeValuationOutputs({
    currentPrice: '10,000',
    baseEPS: -500,
    basePER: 35,
    bps: '8,000',
    roe: '-6',
    epsGrowth: '20',
    requiredReturn: '12',
    premiumRate: '40'
});
assert(lossMakingCards.lossMaking === true, 'Negative EPS should mark the valuation output as loss-making');
assert(lossMakingCards.finalTargetPrice === 0, 'Loss-making EPS should suppress the final target price');
assert(lossMakingCards.upsidePct === 0, 'Loss-making EPS should suppress upside calculations');

const tooltipRight = InvestmentLogic.resolveChartTooltipLayout({
    anchorX: 60,
    anchorY: 20,
    boxWidth: 140,
    boxHeight: 120,
    bounds: { left: 18, top: 10, right: 320, bottom: 280 },
    gap: 12
});
assert(tooltipRight.x === 72, 'Tooltip layout should place the box to the right when enough space exists');
assert(tooltipRight.y === 20, 'Tooltip layout should keep the requested vertical anchor when it fits');
assert(tooltipRight.side === 'right', 'Tooltip layout should report right placement');

const tooltipLeft = InvestmentLogic.resolveChartTooltipLayout({
    anchorX: 280,
    anchorY: 20,
    boxWidth: 140,
    boxHeight: 120,
    bounds: { left: 18, top: 10, right: 320, bottom: 280 },
    gap: 12
});
assert(tooltipLeft.x === 128, 'Tooltip layout should flip to the left when the right side is cramped');
assert(tooltipLeft.side === 'left', 'Tooltip layout should report left placement');

const tooltipClamped = InvestmentLogic.resolveChartTooltipLayout({
    anchorX: 280,
    anchorY: 250,
    boxWidth: 140,
    boxHeight: 120,
    bounds: { left: 18, top: 10, right: 320, bottom: 280 },
    gap: 12
});
assert(tooltipClamped.y === 160, 'Tooltip layout should clamp vertically inside the chart bounds');

const scriptSource = readText(`${cwd}/script.js`);
assert(scriptSource.includes("context.textAlign = 'left';"), 'Tooltip text should explicitly left-align inside the box');
assert(scriptSource.includes("context.textBaseline = 'top';"), 'Tooltip text should use top baseline for consistent vertical rhythm');
assert(scriptSource.includes("context.fillStyle = 'rgba(255, 255, 255, 0.84)';"), 'Tooltip should use a translucent white background for readability');
assert(scriptSource.includes("document.querySelectorAll('[data-number-format=\"won\"]')"), 'Won-denominated valuation inputs should register live comma formatting');
assert(scriptSource.includes("setFormattedInputValue('m-forward-eps'"), 'Auto-filled valuation data should populate the forward EPS read-only field');
assert(scriptSource.includes("setFormattedInputValue('m-bps'"), 'Auto-filled valuation data should populate the BPS read-only field');
assert(scriptSource.includes("document.getElementById('m-required-return').value = '8';"), 'Required return should default to 8%');
assert(scriptSource.includes("InvestmentLogic.resolveBaseValuationVariables({"), 'Valuation calculations should derive base EPS and PER through the shared override helper');
assert(scriptSource.includes("InvestmentLogic.computeValuationOutputs({"), 'Valuation calculations should derive the result cards through the shared valuation helper');
assert(scriptSource.includes("InvestmentLogic.resolveValuationSectorPreset("), 'Sector preset selection should resolve shared preset metadata through dashboard logic');
assert(scriptSource.includes("forwardOverheat"), 'Valuation rendering should surface the forward-vs-TTM EPS overheat state');
assert(scriptSource.includes("document.getElementById('m-adjusted-eps').value = '';"), 'Adjusted EPS should start blank so the API forward EPS can remain the default base value');
assert(scriptSource.includes("document.getElementById('m-target-per').value = '';"), 'Target PER should start blank so the API forward PER can remain the default base value');
assert(scriptSource.includes("input.addEventListener('input', onValuationManualInput);"), 'Manual valuation inputs should trigger immediate recalculation on each keystroke');
assert(scriptSource.includes("document.getElementById('m-sector-preset')"), 'Valuation controls should wire the sector preset dropdown');
assert(scriptSource.includes("document.getElementById('m-trailing-eps')"), 'Valuation controls should populate the trailing TTM EPS read-only field');
assert(scriptSource.includes("document.getElementById('forward-eps-warning')"), 'Valuation rendering should target the forward EPS warning indicator');
assert(scriptSource.includes("최종 목표가"), 'Valuation output should include the premium-adjusted final target card');
assert(scriptSource.includes("metric-result-primary"), 'Valuation output should mark the final target card as the primary emphasized result');
assert(scriptSource.includes("document.getElementById('mobile-tabbar')"), 'Mobile UX should wire the bottom tab bar container');
assert(scriptSource.includes("dashboard.dataset.mobileTab = tab"), 'Mobile UX should store the active mobile tab on the dashboard root');
assert(scriptSource.includes("window.matchMedia('(max-width: 768px)')"), 'Mobile UX should explicitly gate the hybrid layout to mobile widths');
assert(scriptSource.includes("document.querySelectorAll('[data-mobile-tab-target]')"), 'Mobile UX should bind click handlers to bottom-tab buttons');
assert(scriptSource.includes('InvestmentLogic.extractKakaoProfile('), 'Kakao session restore should normalize profile payloads through shared logic');
assert(scriptSource.includes("document.getElementById('btn-kakao-login').classList.add('hidden');"), 'Kakao profile application should hide the login button after session restore');
assert(scriptSource.includes('syncKakaoAuthUI('), 'Kakao auth rendering should sync desktop and mobile auth surfaces through one helper');
assert(scriptSource.includes("localStorage.setItem(KAKAO_STORAGE_RETURN_URL, location.href);"), 'Kakao login should persist the return URL to localStorage for mobile redirect resilience');
assert(scriptSource.includes("localStorage.getItem(KAKAO_STORAGE_TOKEN)"), 'Kakao session restore should also read the localStorage token fallback');
assert(scriptSource.includes("const KAKAO_STORAGE_PROFILE = 'invest_nav_kakao_profile';"), 'Kakao auth should define a dedicated storage key for the cached profile payload');
assert(scriptSource.includes("writeKakaoStorage(KAKAO_STORAGE_PROFILE"), 'Kakao auth should persist the normalized profile payload for later session restoration');
assert(scriptSource.includes("const storedProfile = readStoredKakaoProfile();"), 'Kakao session restore should load a cached profile before requesting a fresh one');
assert(scriptSource.includes("if (storedProfile) {\n            applyKakaoProfile(storedProfile, { fallback: true });"), 'Kakao session restore should immediately reflect a cached profile when available');
assert(scriptSource.includes("document.getElementById('mobile-fx-usdkrw').textContent"), 'Mobile market strip should render the USD/KRW quick tab value');
assert(scriptSource.includes("document.getElementById('mobile-kakao-login')"), 'Mobile auth strip should wire the compact Kakao login button');
assert(scriptSource.includes("document.querySelectorAll('[data-mobile-content-target]')"), 'Mobile chart/finance area should bind the secondary horizontal content tabs');
assert(scriptSource.includes("const allowedTabs = new Set(['home', 'chart-finance', 'valuation', 'briefing']);"), 'Mobile UX should include a dedicated Home tab alongside analysis tabs');
assert(scriptSource.includes("const shouldShowHome = !isMobile || !dashboardVisible || state.mobileTab === 'home';"), 'Mobile UX should keep the search screen visible only on the Home tab');
assert(scriptSource.includes("dashboard.classList.toggle('mobile-home-hidden'"), 'Mobile UX should hide dashboard cards entirely while the Home tab is active');
assert(scriptSource.includes("setMobileTab('chart-finance');"), 'Searching should still jump directly into the chart/finance analysis tab');
assert(scriptSource.includes("body.classList.toggle('mobile-dashboard-active'"), 'Mobile header chrome should collapse once the dashboard is visible');
assert(!scriptSource.includes('drawXP();'), 'XP UI should no longer initialize on page load');
assert(!scriptSource.includes('function addXP('), 'XP progression logic should be removed from the frontend');
assert(!scriptSource.includes("localStorage.getItem('invest_nav_xp')"), 'XP localStorage state should be removed from the frontend');
assert(scriptSource.includes('당신은 월스트리트 탑티어 헤지펀드의 수석 퀀트 애널리스트입니다.'), 'Gemini prompt should use the hedge-fund quant analyst persona');
assert(scriptSource.includes("[거시 경제(Macro) 환경]"), 'Gemini prompt should include a dedicated macro environment section');
assert(scriptSource.includes("document.getElementById('fx-usdkrw')?.innerText || '-'"), 'Gemini prompt should inject USD/KRW from the market bar');
assert(scriptSource.includes("document.getElementById('vix-value')?.innerText || '-'"), 'Gemini prompt should inject VIX from the market bar');
assert(scriptSource.includes("document.getElementById('wti-value')?.innerText || '-'"), 'Gemini prompt should inject WTI from the market bar');
assert(scriptSource.includes('[재무 이상치 / Red Flags]'), 'Gemini prompt should include the anomaly/red-flag section when briefing data exists');
assert(scriptSource.includes('기관 투자자 클라이언트를 위한 냉철하고 날카로운 투자 브리핑'), 'Gemini prompt should frame the output as an institutional investor briefing');
assert(scriptSource.includes('현재 환율과 유가 등 거시 환경이 해당 기업의 실적'), 'Gemini prompt should explicitly require macro impact inference');
assert(scriptSource.includes('Strong Buy / Buy / Hold / Reduce'), 'Gemini prompt should require the four-tier final opinion scale');
assert(scriptSource.includes("EPS 기준:"), 'Valuation output should annotate the active EPS source in small helper text');
assert(scriptSource.includes("이익 미발생 구간 - PBR 밴드 활용 권장"), 'Loss-making sectors should render the negative-EPS fallback message in the final-target card');
assert(scriptSource.includes("preset.badgeTone"), 'Valuation preset rendering should apply sector-specific badge tone classes');
assert(scriptSource.includes("PEG 지표"), 'Valuation output should include the PEG result card');
assert(scriptSource.includes("S-RIM 적정주가"), 'Valuation output should include the S-RIM result card');
assert(scriptSource.includes("sector-premium-badge"), 'Valuation output should render the intangible-premium badge');
assert(scriptSource.includes("metrics-guide"), 'Valuation output should render the dynamic sector guide block');

const phpProxySource = readText(`${cwd}/proxy.php`);
assert(phpProxySource.includes('https://api.gold-api.com/price/XAU'), 'PHP proxy should include the gold-api fallback source');
assert(phpProxySource.includes('GC=F'), 'PHP proxy should include the Yahoo gold futures fallback');
assert(phpProxySource.includes("'kospi'"), 'PHP market summary should expose a KOSPI field');
assert(phpProxySource.includes("'kospiChangePct'"), 'PHP market summary should expose KOSPI change percentage');
assert(phpProxySource.includes("'kosdaq'"), 'PHP market summary should expose a KOSDAQ field');
assert(phpProxySource.includes("'kosdaqChangePct'"), 'PHP market summary should expose KOSDAQ change percentage');
assert(phpProxySource.includes("^KS11"), 'PHP market summary should fetch the KOSPI Yahoo index symbol');
assert(phpProxySource.includes("^KQ11"), 'PHP market summary should fetch the KOSDAQ Yahoo index symbol');
assert(phpProxySource.includes("$action === 'company_directory'"), 'PHP proxy should expose the company_directory action');
assert(phpProxySource.includes('corpCode.xml'), 'PHP proxy should fetch the DART corpCode directory');

const pythonProxySource = readText(`${cwd}/api_proxy.py`);
assert(pythonProxySource.includes('https://api.gold-api.com/price/XAU'), 'Python proxy should include the gold-api fallback source');
assert(pythonProxySource.includes('GC=F'), 'Python proxy should include the Yahoo gold futures fallback');
assert(pythonProxySource.includes('/company-directory'), 'Python proxy should expose the company directory endpoint');
assert(pythonProxySource.includes('name_hint = params.get("name_hint", "").strip()'), 'Python proxy should forward company name hints to the yfinance bridge');
assert(pythonProxySource.includes('KAKAO_CLIENT_SECRET = env_or_aws("KAKAO_CLIENT_SECRET"'), 'Python proxy should load an optional Kakao client secret');
assert(pythonProxySource.includes('"client_secret": KAKAO_CLIENT_SECRET'), 'Python proxy should include the Kakao client secret during token exchange');

const rubyProxySource = readText(`${cwd}/api_proxy.rb`);
assert(rubyProxySource.includes('https://api.gold-api.com/price/XAU'), 'Ruby proxy should include the gold-api fallback source');
assert(rubyProxySource.includes('GC=F'), 'Ruby proxy should include the Yahoo gold futures fallback');
assert(rubyProxySource.includes('/company-directory'), 'Ruby proxy should expose the company directory endpoint');
assert(rubyProxySource.includes('name_hint = (req.query[\'name_hint\'] || \'\').strip'), 'Ruby proxy should forward company name hints to the yfinance bridge');
assert(rubyProxySource.includes("KAKAO_CLIENT_SECRET = env_or_aws('KAKAO_CLIENT_SECRET'"), 'Ruby proxy should load an optional Kakao client secret');
assert(rubyProxySource.includes('client_secret: KAKAO_CLIENT_SECRET'), 'Ruby proxy should include the Kakao client secret during token exchange');

const yfinanceBridgeSource = readText(`${cwd}/yfinance_bridge.py`);
assert(yfinanceBridgeSource.includes('--name-hint'), 'yfinance bridge should accept company name hints for AUTO market resolution');
assert(yfinanceBridgeSource.includes('read_cached_payload('), 'yfinance bridge should read short-lived cached payloads before calling Yahoo Finance');
assert(yfinanceBridgeSource.includes('write_cached_payload('), 'yfinance bridge should persist successful Yahoo Finance responses for reuse');
assert(yfinanceBridgeSource.includes('"sharesOutstanding"'), 'yfinance bridge should expose sharesOutstanding for valuation inputs');
assert(yfinanceBridgeSource.includes('"trailingEps"'), 'yfinance bridge should expose trailing TTM EPS for valuation fallback');

assert(scriptSource.includes('name_hint'), 'Frontend yfinance requests should forward company name hints');
assert(phpProxySource.includes('$nameHint = trim((string) ($_GET[\'name_hint\'] ?? \'\'));'), 'PHP proxy should read company name hints for yfinance bridge requests');
assert(phpProxySource.includes('function kakao_client_secret(): string'), 'PHP proxy should expose a Kakao client-secret helper for token exchange');
assert(phpProxySource.includes("'client_secret' => kakao_client_secret()"), 'PHP proxy should include the Kakao client secret during token exchange');
assert(phpProxySource.includes('https://kapi.kakao.com/v2/user/me'), 'PHP proxy should fetch Kakao profile data after exchanging the login token');
assert(phpProxySource.includes("$responsePayload['profile'] = $profilePayload;"), 'PHP proxy should return the Kakao profile payload with the token response when available');
assert(scriptSource.includes("document.getElementById('kospi-value').textContent"), 'Market summary rendering should populate the KOSPI card value');
assert(scriptSource.includes("setMarketChg('kospi-chg'"), 'Market summary rendering should populate the KOSPI change badge');
assert(scriptSource.includes("document.getElementById('kospi-note').textContent = '코스피 종합지수';"), 'KOSPI card note should describe the composite index');
assert(scriptSource.includes("document.getElementById('kosdaq-value').textContent"), 'Market summary rendering should populate the KOSDAQ card value');
assert(scriptSource.includes("setMarketChg('kosdaq-chg'"), 'Market summary rendering should populate the KOSDAQ change badge');
assert(scriptSource.includes("document.getElementById('kosdaq-note').textContent = '코스닥 종합지수';"), 'KOSDAQ card note should describe the composite index');
assert(scriptSource.includes("document.getElementById('wti-value').textContent"), 'Market summary rendering should populate the WTI card value');
assert(scriptSource.includes("document.getElementById('brent-value').textContent"), 'Market summary rendering should populate the Brent card value');
assert(scriptSource.includes("setMarketChg('wti-chg', data.wtiChangePct ?? null, { inverse: true })"), 'WTI card should invert change colors so higher oil reads as cost pressure');
assert(scriptSource.includes("setMarketChg('brent-chg', data.brentChangePct ?? null, { inverse: true })"), 'Brent card should invert change colors so higher oil reads as cost pressure');
assert(scriptSource.includes("event.key === 'ArrowDown'"), 'Search input should support arrow-down autocomplete navigation');
assert(scriptSource.includes('syncCompanyInputValue(company);'), 'Search should synchronize the input text with the resolved autocomplete match');
assert(!scriptSource.includes('companyInput.value = selected.displayLabel;'), 'Arrow-key navigation should not overwrite the typed input before the selection is committed');
assert(scriptSource.includes('const dailyChartPromise = fetchYfinanceChart('), 'Initial market loading should start the daily chart request immediately');
assert(scriptSource.includes('const quotePromise = fetchYfinanceQuote('), 'The live quote request should run in parallel instead of blocking chart fetch startup');
assert(!scriptSource.includes("fetchYfinanceChart(company.stockCode, company.market, 'weekly'"), 'The frontend should not request a redundant weekly chart when weekly candles are derived locally');
assert(scriptSource.includes('const fullRangeTechnicals = ensureFullSeriesTechnicals(state.chartFullSeries);'), 'Chart rendering should reuse cached full-series technical calculations');
assert(!scriptSource.includes('const fullRangeTechnicals = computeTechnicals(state.chartFullSeries);'), 'Chart rendering should not recompute technicals from scratch on every viewport update');
assert(scriptSource.includes('InvestmentLogic.sliceTechnicalSeriesWindow(fullRangeTechnicals, state.chartWindow)'), 'Technical overlays should slice from the shared viewport state');
assert(scriptSource.includes('setupZoomPan(canvas, padding.left, padding.right);'), 'Indicator chart should attach the shared zoom/pan behavior');
assert(scriptSource.includes('InvestmentLogic.groupReportsBySection(reports)'), 'Report rendering should use grouped annual and quarterly sections');
assert(scriptSource.includes('class="report-year-toggle"'), 'Quarterly report groups should render toggle buttons per fiscal year');
assert(scriptSource.includes('class="report-section-toggle"'), 'Report sections should render toggle buttons so annual and quarterly blocks can start collapsed');
assert(scriptSource.includes('class="report-section-body hidden"'), 'Report sections should start collapsed until the user expands them');
assert(scriptSource.includes('page_no: page'), 'DART report fetching should request additional pages when the first page does not include quarterly reports');
assert(scriptSource.includes('while (page <= totalPages && relevantReports.length < 12)'), 'DART report fetching should keep scanning pages until enough recent reports are collected');
assert(scriptSource.includes('buildDartCompanySearchUrl(company)'), 'The DART 원문 button should use the company search URL helper');
assert(scriptSource.includes('https://dart.fss.or.kr/dsab007/main.do?autoSearch=Y'), 'The DART 원문 button should point to the public DART disclosure search board');
assert(scriptSource.includes('textCrpCik=${encodedCorpCode}'), 'The DART company search URL should include the corpCode filter when available');
assert(scriptSource.includes('textCrpNm=${encodedName}'), 'The DART company search URL should include the company name filter');
assert(!scriptSource.includes('https://dart.fss.or.kr/dsaf001/main.do?corpCode=${company.corpCode}'), 'The DART 원문 button should not use the rejected corpCode direct link');

const styleSource = readText(`${cwd}/style.css`);
assert(styleSource.includes('.report-year-toggle'), 'Styles should include the yearly quarterly-report toggle treatment');
assert(styleSource.includes('.report-section'), 'Styles should include grouped report section layout');
assert(styleSource.includes('.report-section-toggle'), 'Styles should include the report section toggle treatment');
assert(styleSource.includes('.market-label-row'), 'Styles should include the VIX label row layout for the inline help icon');
assert(styleSource.includes('.help-icon'), 'Styles should include the circular help icon treatment');
assert(styleSource.includes('.vix-tooltip'), 'Styles should include the VIX tooltip surface');
assert(styleSource.includes('backdrop-filter: blur(8px);'), 'VIX tooltip should use a blurred glass background');
assert(styleSource.includes('right: 0;'), 'VIX tooltip should anchor to the right edge to avoid clipping at the viewport edge');
assert(styleSource.includes('max-width: 280px;'), 'VIX tooltip should cap its width for mobile screens');
assert(styleSource.includes('.help-icon:hover .vix-tooltip'), 'VIX tooltip should open on hover');
assert(styleSource.includes('.help-icon:focus-within .vix-tooltip'), 'VIX tooltip should also open on keyboard focus');
assert(styleSource.includes('white-space: normal;'), 'VIX tooltip should allow wrapped content inside the bounded panel');
assert(styleSource.includes('.market-groups'), 'Styles should include the grouped market-bar layout wrapper');
assert(styleSource.includes('.market-global-group'), 'Styles should include the global market-card group');
assert(styleSource.includes('.market-domestic-group'), 'Styles should include the domestic index-card group');
assert(styleSource.includes('repeat(auto-fit, minmax(160px, 1fr))'), 'Market card groups should use auto-fit minmax responsive columns');
assert(styleSource.includes('.market-bar > *'), 'Market bar should flatten child wrappers so every card participates in the same compact grid');
assert(styleSource.includes('.market-tooltip'), 'Styles should include the shared market tooltip surface for oil cards');
assert(styleSource.includes('.market-chg.cost-up'), 'Styles should include the inverse commodity-up change tone');
assert(styleSource.includes('.market-chg.cost-down'), 'Styles should include the inverse commodity-down change tone');
assert(styleSource.includes('@media (max-width: 768px)'), 'Styles should include a dedicated mobile-only breakpoint for the hybrid UX');
assert(styleSource.includes('overflow-x: auto;'), 'Mobile market bar should allow horizontal swipe scrolling');
assert(styleSource.includes('flex-wrap: nowrap;'), 'Mobile market bar should keep the market cards on one swipe row');
assert(styleSource.includes('-webkit-overflow-scrolling: touch;'), 'Mobile market bar should enable smooth momentum scrolling');
assert(styleSource.includes('.mobile-tabbar'), 'Styles should include the fixed mobile bottom tab bar');
assert(styleSource.includes('position: fixed;'), 'Mobile bottom tab bar should be fixed to the viewport bottom');
assert(styleSource.includes('backdrop-filter: blur(18px);'), 'Mobile bottom tab bar should use a glassmorphism blur treatment');
assert(styleSource.includes('[data-mobile-panel]'), 'Styles should target dashboard cards by mobile panel group');
assert(styleSource.includes('.mobile-utility-strip'), 'Styles should include the compact mobile utility strip');
assert(styleSource.includes('.mobile-market-tabs'), 'Styles should include the horizontal market quick-tab row');
assert(styleSource.includes('.mobile-market-tab'), 'Styles should include the compact market quick-tab card');
assert(styleSource.includes('.mobile-header-auth'), 'Styles should include the compact mobile header auth area');
assert(styleSource.includes('.mobile-auth-chip'), 'Styles should include the compact mobile Kakao auth chip');
assert(styleSource.includes('.mobile-content-tabbar'), 'Styles should include the secondary horizontal tab bar for chart/finance/technical content');
assert(styleSource.includes('.mobile-dashboard-active'), 'Styles should include the collapsed mobile header mode');
assert(styleSource.includes('min-height: 44px;'), 'Mobile bottom-tab buttons should be shorter to save vertical space');
assert(styleSource.includes('.dashboard.mobile-home-hidden'), 'Styles should hide dashboard cards entirely while the mobile Home tab is active');
assert(styleSource.includes('.mobile-header-auth .mobile-auth-meta span:last-child'), 'Mobile auth chip should hide the subtitle text to save header space');
assert(styleSource.includes('border-left: 1px solid'), 'Domestic market group should be visually separated from the global group on wide screens');
assert(styleSource.includes('.valuation-preset-row'), 'Styles should include the sector preset row treatment');
assert(styleSource.includes('.sector-badge'), 'Styles should include the premium badge treatment');
assert(styleSource.includes('.metrics-guide'), 'Styles should include the dynamic sector guide block');
assert(styleSource.includes('.field-warning-icon'), 'Styles should include the forward EPS warning indicator');
assert(styleSource.includes('.field-label-row'), 'Styles should include the inline label/warning row for EPS fields');
assert(styleSource.includes('.metric-result-primary'), 'Styles should include the emphasized final-target card treatment');
assert(styleSource.includes('.sector-badge-ai'), 'Styles should include the AI-sector glow badge tone');
assert(styleSource.includes('.sector-badge-bio'), 'Styles should include the biotech-sector glow badge tone');
assert(styleSource.includes('.btn-kakao'), 'Styles should include the Kakao login button treatment');
assert(styleSource.includes('@media (max-width: 560px)'), 'Styles should include the smallest mobile breakpoint');
assert(!styleSource.includes('.xp-pill'), 'XP pill styles should be removed once the gamification header is deleted');
assert(!styleSource.includes('.xp-track'), 'XP progress-track styles should be removed once the gamification header is deleted');
assert(!styleSource.includes('.helper-row'), 'Search helper chip styles should be removed with the mobile-home cleanup');
assert(!styleSource.includes('.helper-chip'), 'Search helper chips should no longer be styled once removed from the UI');

const htmlSource = readText(`${cwd}/index.html`);
assert(htmlSource.includes('API 연동값 (읽기 전용)'), 'Valuation form should include a read-only API track');
assert(htmlSource.includes('수동 입력 / 가정 조정'), 'Valuation form should include a manual override track');
assert(htmlSource.includes('id="m-forward-eps"'), 'Valuation form should expose the forward EPS read-only field');
assert(htmlSource.includes('id="m-trailing-eps"'), 'Valuation form should expose the trailing TTM EPS read-only field');
assert(htmlSource.includes('id="forward-eps-warning"'), 'Valuation form should include the forward EPS overheat warning indicator');
assert(htmlSource.includes('id="m-forward-per"'), 'Valuation form should expose the forward PER read-only field');
assert(htmlSource.includes('id="m-bps"'), 'Valuation form should expose the BPS read-only field');
assert(htmlSource.includes('id="m-adjusted-eps"'), 'Valuation form should expose the adjusted EPS input');
assert(htmlSource.includes('id="m-eps-growth"'), 'Valuation form should expose the EPS growth input');
assert(htmlSource.includes('id="m-required-return"'), 'Valuation form should expose the required return input');
assert(!htmlSource.includes('id="m-shares"'), 'Valuation form should remove the listed shares input');
assert(!htmlSource.includes('id="m-expected-op"'), 'Valuation form should remove the expected operating income input');
assert(htmlSource.includes('id="m-sector-preset"'), 'Valuation form should expose the sector preset dropdown');
assert(htmlSource.includes('지능형 기계 (AI/반도체/로봇)'), 'Valuation form should include the intelligent-machines preset option');
assert(htmlSource.includes('바이오/혁신신약'), 'Valuation form should include the biotech preset option');
assert(htmlSource.includes('일반 성장주/플랫폼'), 'Valuation form should include the growth-platform preset option');
assert(htmlSource.includes('가치주/배당주'), 'Valuation form should include the value-dividend preset option');
assert(htmlSource.includes('WTI 유가'), 'Market bar should include the WTI oil card');
assert(htmlSource.includes('브렌트유'), 'Market bar should include the Brent oil card');
assert(htmlSource.includes('서부 텍사스산 원유(WTI). 글로벌 금융 시장의 심리적 기준이 되는 유가입니다.'), 'WTI card should include the requested tooltip copy');
assert(htmlSource.includes('북해산 원유(Brent). 글로벌 실물 원유 거래의 2/3 기준이 됩니다.'), 'Brent card should include the requested tooltip copy');

assert(phpProxySource.includes("'wti'             => null"), 'Market summary payload should expose WTI price');
assert(phpProxySource.includes("'wtiChangePct'    => null"), 'Market summary payload should expose WTI change percentage');
assert(phpProxySource.includes("'brent'           => null"), 'Market summary payload should expose Brent price');
assert(phpProxySource.includes("'brentChangePct'  => null"), 'Market summary payload should expose Brent change percentage');
assert(phpProxySource.includes("request_yfinance_bridge('quote', ['stock_code' => 'CL=F', 'market' => 'COMMODITY'])"), 'Market summary should fetch WTI quotes from Yahoo Finance');
assert(phpProxySource.includes("request_yfinance_bridge('quote', ['stock_code' => 'BZ=F', 'market' => 'COMMODITY'])"), 'Market summary should fetch Brent quotes from Yahoo Finance');
assert(htmlSource.includes('일반 제조'), 'Valuation form should include the general-manufacturing preset option');
assert(htmlSource.includes('id="metrics-guide"'), 'Valuation section should include the dynamic guide container');
assert(htmlSource.includes('id="sector-premium-badge"'), 'Valuation section should include the premium badge slot');
assert(htmlSource.includes('class="help-icon"'), 'Market bar should render a compact VIX help icon');
assert(htmlSource.includes('class="vix-tooltip"'), 'Market bar should include the VIX tooltip layer');
assert(htmlSource.includes('class="market-groups"'), 'Top market area should wrap global and domestic cards into grouped layout containers');
assert(htmlSource.includes('class="market-card-group market-global-group"'), 'Top market area should include the global market-card group');
assert(htmlSource.includes('class="market-card-group market-domestic-group"'), 'Top market area should include the domestic market-card group');
assert(htmlSource.includes('id="mobile-utility-strip"'), 'HTML should include the compact mobile utility strip');
assert(htmlSource.includes('id="mobile-fx-usdkrw"'), 'HTML should include the USD/KRW mobile quick-tab value slot');
assert(htmlSource.includes('id="mobile-vix-value"'), 'HTML should include the VIX mobile quick-tab value slot');
assert(htmlSource.includes('id="mobile-kakao-login"'), 'HTML should include the compact mobile Kakao login button');
assert(htmlSource.includes('id="mobile-kakao-profile"'), 'HTML should include the compact mobile Kakao profile chip');
assert(htmlSource.includes('class="mobile-content-tabbar"'), 'HTML should include the secondary mobile content tab bar');
assert(htmlSource.includes('data-mobile-content-target="chart"'), 'HTML should include the chart content tab');
assert(htmlSource.includes('data-mobile-content-target="finance"'), 'HTML should include the finance content tab');
assert(htmlSource.includes('data-mobile-content-target="technical"'), 'HTML should include the technical content tab');
assert(htmlSource.includes('id="mobile-tabbar"'), 'HTML should include the fixed mobile bottom tab bar container');
assert(htmlSource.includes('data-mobile-tab-target="home"'), 'HTML should include a dedicated mobile Home tab button');
assert(htmlSource.includes('data-mobile-tab-target="chart-finance"'), 'HTML should include the chart/finance mobile tab button');
assert(htmlSource.includes('data-mobile-tab-target="valuation"'), 'HTML should include the valuation mobile tab button');
assert(htmlSource.includes('data-mobile-tab-target="briefing"'), 'HTML should include the AI briefing mobile tab button');
assert(htmlSource.includes('data-mobile-panel="chart-finance"'), 'Dashboard cards should mark the chart/finance mobile panel membership');
assert(htmlSource.includes('data-mobile-panel="valuation"'), 'Dashboard cards should mark the valuation mobile panel membership');
assert(htmlSource.includes('data-mobile-panel="briefing"'), 'Dashboard cards should mark the briefing mobile panel membership');
assert(htmlSource.includes('차트/재무'), 'Mobile tab bar should include the chart/finance label');
assert(htmlSource.includes('Home'), 'Mobile tab bar should include the Home label');
assert(htmlSource.includes('가치 평가'), 'Mobile tab bar should include the valuation label');
assert(htmlSource.includes('AI 리포트'), 'Mobile tab bar should include the AI report label');
assert(htmlSource.includes('id="kospi-value"'), 'Market bar should include a KOSPI value slot');
assert(htmlSource.includes('id="kosdaq-value"'), 'Market bar should include a KOSDAQ value slot');
assert(htmlSource.includes('KOSPI 종합'), 'Market bar should label the KOSPI card');
assert(htmlSource.includes('KOSDAQ 종합'), 'Market bar should label the KOSDAQ card');
assert(htmlSource.includes('VIX 대비 S&amp;P 500 1년 뒤 기대 수익'), 'VIX tooltip should include the historical return heading');
assert(htmlSource.includes('27~35'), 'VIX tooltip should include the 27~35 historical probability row');
assert(htmlSource.includes('50이상'), 'VIX tooltip should include the panic-range historical probability row');
assert(htmlSource.includes('인사이트: VIX 30 이상은 역사적 분할 매수 구간입니다.'), 'VIX tooltip should include the highlighted insight callout');
assert(!htmlSource.includes('class="xp-pill"'), 'Header should remove the XP pill from the UI');
assert(!htmlSource.includes('id="xp-text"'), 'Header should remove the XP progress text');
assert(!htmlSource.includes('class="helper-row"'), 'Search helper chips should be removed from the Home search screen');

const authCallbackSource = readText(`${cwd}/auth/kakao/callback`);
assert(authCallbackSource.includes("profile: 'invest_nav_kakao_profile'"), 'Auth callback should treat the cached Kakao profile as first-class persisted state');
assert(authCallbackSource.includes('if (data.profile)'), 'Auth callback should persist the Kakao profile when the token exchange returns one');

const legacyCallbackSource = readText(`${cwd}/kakao_callback.php`);
assert(legacyCallbackSource.includes("profile: 'invest_nav_kakao_profile'"), 'Legacy Kakao callback should also persist the cached profile state');
assert(legacyCallbackSource.includes('if (data.profile)'), 'Legacy Kakao callback should persist the Kakao profile when available');

console.log('dashboard_logic_test: ok');
