ObjC.import('Foundation');

function readFile(path) {
    const nsString = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
    if (!nsString) {
        throw new Error(`Unable to read file: ${path}`);
    }
    return ObjC.unwrap(nsString);
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

function assertIncludes(haystack, needle, message) {
    if (!String(haystack).includes(needle)) {
        throw new Error(`${message} (missing: ${needle})`);
    }
}

function run() {
    const InvestmentLogic = loadInvestmentLogic();

    assert(typeof InvestmentLogic.summarizeStatement === 'function', 'summarizeStatement should be exported.');
    assert(typeof InvestmentLogic.detectAnomalies === 'function', 'detectAnomalies should be exported.');

    const summary = InvestmentLogic.summarizeStatement([
        { account_nm: '매출액', thstrm_amount: '1,000' },
        { account_nm: '당기순이익', thstrm_amount: '120' },
        { account_nm: '영업활동으로인한현금흐름', thstrm_amount: '(30)' },
        { account_nm: '재고자산', thstrm_amount: '200' },
        { account_nm: '매출채권', thstrm_amount: '100' }
    ]);
    assertEqual(summary.operatingCashFlow, -30, 'summarizeStatement should parse operating cash flow.');

    const currentSummary = {
        revenue: 1000,
        netIncome: 120,
        operatingCashFlow: -30,
        inventoryTurnover: 2.2,
        receivableTurnover: 2.4
    };
    const pastSummaries = [
        {
            revenue: 1000,
            netIncome: 100,
            operatingCashFlow: 110,
            inventoryTurnover: 5.4,
            receivableTurnover: 5.8
        },
        {
            revenue: 1000,
            netIncome: 95,
            operatingCashFlow: 105,
            inventoryTurnover: 5.1,
            receivableTurnover: 5.4
        }
    ];
    const anomalies = InvestmentLogic.detectAnomalies(currentSummary, pastSummaries);
    assert(anomalies.length >= 3, 'detectAnomalies should return multiple warnings for severe deterioration.');
    assert(anomalies.some((item) => item.includes('흑자부도 위험')), 'detectAnomalies should flag positive earnings with negative operating cash flow.');
    assert(anomalies.some((item) => item.includes('악성 재고 위험')), 'detectAnomalies should flag inventory turnover deterioration.');
    assert(anomalies.some((item) => item.includes('가짜 매출 위험')), 'detectAnomalies should flag receivable turnover deterioration.');

    const currentRatioSummary = {
        revenue: 1000,
        netIncome: 100,
        operatingCashFlow: 10,
        inventoryTurnover: 4.9,
        receivableTurnover: 4.8
    };
    const ratioPastSummaries = [
        { revenue: 1000, netIncome: 100, operatingCashFlow: 105, inventoryTurnover: 5.0, receivableTurnover: 5.1 },
        { revenue: 1000, netIncome: 100, operatingCashFlow: 95, inventoryTurnover: 5.2, receivableTurnover: 5.0 },
        { revenue: 1000, netIncome: 100, operatingCashFlow: 100, inventoryTurnover: 5.1, receivableTurnover: 5.2 }
    ];
    const ratioAnomalies = InvestmentLogic.detectAnomalies(currentRatioSummary, ratioPastSummaries);
    assert(ratioAnomalies.some((item) => item.includes('영업현금흐름/순이익 비율')), 'detectAnomalies should flag cash conversion ratio collapse.');

    const scriptSource = readFile('/Users/huiyong/Desktop/Vibe Investment/script.js');
    const styleSource = readFile('/Users/huiyong/Desktop/Vibe Investment/style.css');
    assertIncludes(scriptSource, 'InvestmentLogic.detectAnomalies(', 'script.js should call anomaly detection.');
    assertIncludes(scriptSource, 'anomaly-warning-icon', 'script.js should render the anomaly warning icon.');
    assertIncludes(scriptSource, 'state.lastAnalysis.anomalies', 'script.js should persist anomaly warnings for briefing reuse.');
    assertIncludes(styleSource, '.anomaly-warning-icon', 'style.css should style the anomaly warning icon.');
    assertIncludes(styleSource, '.anomaly-tooltip', 'style.css should style the anomaly tooltip.');

    console.log('forensic_anomaly_test: ok');
}

run();
