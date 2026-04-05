ObjC.import('Foundation');

function readFile(path) {
    const content = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
    if (!content) {
        throw new Error(`Unable to read file: ${path}`);
    }
    return ObjC.unwrap(content);
}

function loadInvestmentLogic() {
    const source = readFile('/Users/huiyong/Desktop/Vibe Investment/dashboard_logic.js');
    const globalObject = Function('return this')();
    eval(source);
    if (!globalObject.InvestmentLogic) {
        throw new Error('InvestmentLogic was not initialized.');
    }
    return globalObject.InvestmentLogic;
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message} (expected: ${expected}, actual: ${actual})`);
    }
}

function assertApprox(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message} (expected: ${expected}, actual: ${actual})`);
    }
}

function run() {
    const InvestmentLogic = loadInvestmentLogic();

    assert(typeof InvestmentLogic.extractAnnualShareCount === 'function', 'extractAnnualShareCount should be exported.');
    assert(typeof InvestmentLogic.mergeAnnualHistoryPeriods === 'function', 'mergeAnnualHistoryPeriods should be exported.');
    assert(typeof InvestmentLogic.buildYearEndCloseMap === 'function', 'buildYearEndCloseMap should be exported.');
    assert(typeof InvestmentLogic.buildHistoricalInvestmentRows === 'function', 'buildHistoricalInvestmentRows should be exported.');

    const shareCount = InvestmentLogic.extractAnnualShareCount([
        { se: '보통주', istc_totqy: '9,500' },
        { se: '합계', istc_totqy: '10,000', distb_stock_co: '9,100' }
    ]);
    assertEqual(shareCount, 10000, 'extractAnnualShareCount should prefer the annual total row.');

    const merged = InvestmentLogic.mergeAnnualHistoryPeriods([
        { year: 2025, label: '2025 사업보고서' },
        { year: 2024, label: '2024 사업보고서' },
        { year: 2023, label: '2023 사업보고서' }
    ], [
        { year: 2024, label: '2024 중복' },
        { year: 2022, label: '2022 사업보고서' },
        { year: 2021, label: '2021 사업보고서' }
    ]);
    assertEqual(merged.length, 5, 'mergeAnnualHistoryPeriods should dedupe by year and keep all available annual periods.');
    assertEqual(merged[0].year, 2025, 'mergeAnnualHistoryPeriods should sort latest year first.');
    assertEqual(merged[4].year, 2021, 'mergeAnnualHistoryPeriods should keep older fetched years after the initial three.');

    const priceMap = InvestmentLogic.buildYearEndCloseMap([
        { date: '20241227', close: 180 },
        { date: '20241230', close: 190 },
        { date: '20241231', close: 200 },
        { date: '20251229', close: 280 },
        { date: '20251230', close: 300 },
        { date: '20260102', close: 330 }
    ]);
    assertEqual(priceMap[2024], 200, 'buildYearEndCloseMap should keep the last close of each year.');
    assertEqual(priceMap[2025], 300, 'buildYearEndCloseMap should map the most recent close within the fiscal year.');

    const investmentRows = InvestmentLogic.buildHistoricalInvestmentRows([
        {
            year: 2025,
            label: '2025 사업보고서',
            shareCount: 10,
            summary: {
                netIncome: 100,
                equity: 500,
                operatingIncome: 120,
                liabilities: 200,
                currentLiabilities: 50,
                cash: 20,
                roe: 20
            }
        },
        {
            year: 2024,
            label: '2024 사업보고서',
            shareCount: 20,
            summary: {
                netIncome: 80,
                equity: 400,
                operatingIncome: 90,
                liabilities: 180,
                currentLiabilities: 40,
                cash: 10,
                roe: 20
            }
        }
    ], {
        2025: 300,
        2024: 200
    });

    assertEqual(investmentRows.length, 2, 'buildHistoricalInvestmentRows should create one valuation row per annual summary.');
    assertEqual(investmentRows[0].year, 2025, 'buildHistoricalInvestmentRows should keep the latest year first.');
    assertEqual(investmentRows[0].eps, 10, 'Historical EPS should use annual net income divided by year share count.');
    assertEqual(investmentRows[0].bps, 50, 'Historical BPS should use annual equity divided by year share count.');
    assertApprox(investmentRows[0].per, 30, 0.001, 'Historical PER should use mapped year-end close divided by EPS.');
    assertApprox(investmentRows[0].pbr, 6, 0.001, 'Historical PBR should use mapped year-end close divided by BPS.');
    assertApprox(investmentRows[0].roe, 20, 0.001, 'Historical ROE should use the annual summary value.');
    assertApprox(investmentRows[0].roic, 18.4615, 0.001, 'Historical ROIC should use the invested-capital proxy from annual statements.');

    const scriptSource = readFile('/Users/huiyong/Desktop/Vibe Investment/script.js');
    const htmlSource = readFile('/Users/huiyong/Desktop/Vibe Investment/index.html');
    assert(scriptSource.includes('ensureFinancialHistoryCoverage('), 'script.js should add on-demand annual history fetching.');
    assert(scriptSource.includes('renderHistoricalMetricsTable('), 'script.js should render the historical investment metrics table.');
    assert(htmlSource.includes('fin-period-select'), 'index.html should expose the financial history period select.');
    assert(htmlSource.includes('fin-metrics-table'), 'index.html should include the investment metrics table container.');

    console.log('on_demand_financial_history_test: ok');
}

run();
