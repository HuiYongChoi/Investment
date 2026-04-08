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

function assertContainsInOrder(source, markers, message) {
    let lastIndex = -1;
    markers.forEach((marker) => {
        const nextIndex = source.indexOf(marker, lastIndex + 1);
        if (nextIndex === -1) {
            throw new Error(`${message} (missing marker: ${marker})`);
        }
        if (nextIndex < lastIndex) {
            throw new Error(`${message} (out of order at marker: ${marker})`);
        }
        lastIndex = nextIndex;
    });
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
    assertEqual(annualRows[0].basicEps, 55, 'Annual investment rows should preserve the basic EPS column for side-by-side rendering.');

    const summaryWithComputedEps = InvestmentLogic.summarizeStatement([
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '매출액', thstrm_amount: '2000' },
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '영업이익', thstrm_amount: '300' },
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '당기순이익(손실)', thstrm_amount: '120' },
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '가중평균유통보통주식수', thstrm_amount: '10' }
    ]);
    assertEqual(summaryWithComputedEps.basicEps, 12, 'Summary EPS should be computed from net income and weighted average shares when API EPS is missing.');
    assertEqual(summaryWithComputedEps.dilutedEps, 12, 'Summary diluted EPS should also fall back to the computed EPS when explicit data is missing.');

    const annualRowsWithComputedEps = InvestmentLogic.buildHistoricalInvestmentRows([
        {
            year: 2025,
            summary: { equity: 1000, netIncome: 120, dilutedEps: null, basicEps: null, roe: 10, operatingIncome: 100, liabilities: 300, currentLiabilities: 50 },
            shareCount: 10
        }
    ], { 2025: 1100 }, 10);
    assertEqual(annualRowsWithComputedEps[0].eps, 12, 'Annual investment rows should compute EPS from net income and share count when source EPS is missing.');
    assertEqual(annualRowsWithComputedEps[0].dilutedEps, 12, 'Annual investment rows should fill diluted EPS with the computed fallback when source diluted EPS is missing.');
    assertEqual(annualRowsWithComputedEps[0].basicEps, 12, 'Annual investment rows should fill basic EPS with the computed fallback when source EPS is missing.');

    assert(scriptSource.includes("label: '희석 EPS'"), 'Investment metrics table should show the simplified 희석 EPS label.');
    assert(scriptSource.includes("label: 'EPS'"), 'Investment metrics tables should render the basic EPS row alongside 희석 EPS.');
    assert(!scriptSource.includes("label: '희석 EPS (Diluted EPS)'"), 'Investment metrics table should remove the Diluted EPS English suffix.');
    assert(!scriptSource.includes('해당 연도 마지막 종가'), 'Historical metrics table should remove the year-end close helper copy.');
    assert(scriptSource.includes('metric-help-icon'), 'Investment metrics renderer should include an EPS help icon.');
    assert(scriptSource.includes('positionMetricTooltips()'), 'Script should dynamically position metric tooltips to avoid viewport clipping.');

    assert(styleSource.includes('.metric-help-icon'), 'Styles should define the investment metric help icon.');
    assert(styleSource.includes('.metric-help-tooltip'), 'Styles should define the investment metric tooltip.');
    assert(styleSource.includes('.metric-tooltip-right'), 'Styles should support flipping the tooltip to stay inside the viewport.');

    const historicalTableSource = scriptSource.split('function renderHistoricalMetricsTable')[1].split('function renderQuarterlyMetricsTable')[0];
    assertContainsInOrder(
        historicalTableSource,
        [
            "label: '영업이익률'",
            "label: '순이익률'",
            "label: 'EPS'",
            "label: '희석 EPS'",
            "label: 'ROE'"
        ],
        'Historical investment metrics rows should keep operating margins ahead of EPS and ROE.'
    );

    const quarterlyTableSource = scriptSource.split('function renderQuarterlyMetricsTable')[1].split('function setFinancialHistoryLoading')[0];
    assertContainsInOrder(
        quarterlyTableSource,
        [
            "label: '영업이익률'",
            "label: '순이익률'",
            "label: 'EPS'",
            "label: '희석 EPS'",
            "label: 'ROE'"
        ],
        'Quarterly investment metrics rows should keep operating margins ahead of EPS and ROE.'
    );

    console.log('investment_metrics_clarity_test: ok');
}

run();
