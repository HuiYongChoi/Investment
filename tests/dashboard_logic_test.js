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

const phpProxySource = readText(`${cwd}/proxy.php`);
assert(phpProxySource.includes('https://api.gold-api.com/price/XAU'), 'PHP proxy should include the gold-api fallback source');
assert(phpProxySource.includes('GC=F'), 'PHP proxy should include the Yahoo gold futures fallback');
assert(phpProxySource.includes("$action === 'company_directory'"), 'PHP proxy should expose the company_directory action');
assert(phpProxySource.includes('corpCode.xml'), 'PHP proxy should fetch the DART corpCode directory');

const pythonProxySource = readText(`${cwd}/api_proxy.py`);
assert(pythonProxySource.includes('https://api.gold-api.com/price/XAU'), 'Python proxy should include the gold-api fallback source');
assert(pythonProxySource.includes('GC=F'), 'Python proxy should include the Yahoo gold futures fallback');
assert(pythonProxySource.includes('/company-directory'), 'Python proxy should expose the company directory endpoint');
assert(pythonProxySource.includes('name_hint = params.get("name_hint", "").strip()'), 'Python proxy should forward company name hints to the yfinance bridge');

const rubyProxySource = readText(`${cwd}/api_proxy.rb`);
assert(rubyProxySource.includes('https://api.gold-api.com/price/XAU'), 'Ruby proxy should include the gold-api fallback source');
assert(rubyProxySource.includes('GC=F'), 'Ruby proxy should include the Yahoo gold futures fallback');
assert(rubyProxySource.includes('/company-directory'), 'Ruby proxy should expose the company directory endpoint');
assert(rubyProxySource.includes('name_hint = (req.query[\'name_hint\'] || \'\').strip'), 'Ruby proxy should forward company name hints to the yfinance bridge');

const yfinanceBridgeSource = readText(`${cwd}/yfinance_bridge.py`);
assert(yfinanceBridgeSource.includes('--name-hint'), 'yfinance bridge should accept company name hints for AUTO market resolution');

assert(scriptSource.includes('name_hint'), 'Frontend yfinance requests should forward company name hints');
assert(phpProxySource.includes('$nameHint = trim((string) ($_GET[\'name_hint\'] ?? \'\'));'), 'PHP proxy should read company name hints for yfinance bridge requests');
assert(scriptSource.includes("event.key === 'ArrowDown'"), 'Search input should support arrow-down autocomplete navigation');
assert(scriptSource.includes('syncCompanyInputValue(company);'), 'Search should synchronize the input text with the resolved autocomplete match');
assert(!scriptSource.includes('companyInput.value = selected.displayLabel;'), 'Arrow-key navigation should not overwrite the typed input before the selection is committed');
assert(scriptSource.includes('const fullRangeTechnicals = computeTechnicals(state.chartFullSeries);'), 'Charts should compute technical series from the full selected range before slicing the viewport');
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

console.log('dashboard_logic_test: ok');
