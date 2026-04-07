ObjC.import('Foundation');

function readText(path) {
    const content = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
    if (!content) {
        throw new Error(`Unable to read file: ${path}`);
    }
    return ObjC.unwrap(content);
}

function loadInvestmentLogic() {
    const source = readText('/Users/huiyong/Desktop/Vibe Investment/dashboard_logic.js');
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

function run() {
    const InvestmentLogic = loadInvestmentLogic();
    const root = '/Users/huiyong/Desktop/Vibe Investment';
    const scriptSource = readText(`${root}/script.js`);
    const styleSource = readText(`${root}/style.css`);

    const summaryWithZeroDiluted = InvestmentLogic.summarizeStatement([
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '매출액', thstrm_amount: '1000' },
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '당기순이익(손실)', thstrm_amount: '100' },
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '희석주당이익', thstrm_amount: '0' },
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '기본주당순이익', thstrm_amount: '321' }
    ]);
    assertEqual(summaryWithZeroDiluted.dilutedEps, 321, 'Summary EPS should fall back to 기본주당이익 when 희석 EPS is zero.');

    const annualRows = InvestmentLogic.buildHistoricalInvestmentRows([
        {
            year: 2025,
            summary: { equity: 1000, dilutedEps: 0, basicEps: 55, roe: 10, operatingIncome: 100, liabilities: 300, currentLiabilities: 50 },
            shareCount: 10
        }
    ], { 2025: 1100 }, 10);
    assertEqual(annualRows[0].eps, 55, 'Annual investment row EPS should fall back to 기본 EPS when 희석 EPS is zero.');

    assert(scriptSource.includes("label: '희석 EPS'"), 'Investment metrics table should show the simplified 희석 EPS label.');
    assert(!scriptSource.includes("label: '희석 EPS (Diluted EPS)'"), 'Investment metrics table should remove the Diluted EPS English suffix.');
    assert(!scriptSource.includes('해당 연도 마지막 종가'), 'Historical metrics table should remove the year-end close helper copy.');
    assert(scriptSource.includes('metric-help-icon'), 'Investment metrics renderer should include an EPS help icon.');
    assert(scriptSource.includes('positionMetricTooltips()'), 'Script should dynamically position metric tooltips to avoid viewport clipping.');

    assert(styleSource.includes('.metric-help-icon'), 'Styles should define the investment metric help icon.');
    assert(styleSource.includes('.metric-help-tooltip'), 'Styles should define the investment metric tooltip.');
    assert(styleSource.includes('.metric-tooltip-right'), 'Styles should support flipping the tooltip to stay inside the viewport.');

    console.log('investment_metrics_clarity_test: ok');
}

run();
