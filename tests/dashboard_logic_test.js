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
