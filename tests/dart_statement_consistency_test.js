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

function findPeriod(periods, year, period) {
    return periods.find((item) => item.year === year && item.period === period);
}

function buildIncomeRows(valueMap, fsDiv, reprtCode, thstrmNm) {
    return [
        { fs_div: fsDiv, sj_div: 'IS', sj_nm: '손익계산서', reprt_code: reprtCode, thstrm_nm: thstrmNm, account_nm: '매출액', thstrm_amount: String(valueMap.revenue) },
        { fs_div: fsDiv, sj_div: 'IS', sj_nm: '손익계산서', reprt_code: reprtCode, thstrm_nm: thstrmNm, account_nm: '영업이익', thstrm_amount: String(valueMap.operatingIncome) },
        { fs_div: fsDiv, sj_div: 'IS', sj_nm: '손익계산서', reprt_code: reprtCode, thstrm_nm: thstrmNm, account_nm: '당기순이익(손실)', thstrm_amount: String(valueMap.netIncome) },
        { fs_div: fsDiv, sj_div: 'BS', sj_nm: '재무상태표', reprt_code: reprtCode, thstrm_nm: thstrmNm, account_nm: '자산총계', thstrm_amount: String(valueMap.assets || 1000) },
        { fs_div: fsDiv, sj_div: 'BS', sj_nm: '재무상태표', reprt_code: reprtCode, thstrm_nm: thstrmNm, account_nm: '부채총계', thstrm_amount: String(valueMap.liabilities || 300) },
        { fs_div: fsDiv, sj_div: 'BS', sj_nm: '재무상태표', reprt_code: reprtCode, thstrm_nm: thstrmNm, account_nm: '자본총계', thstrm_amount: String(valueMap.equity || 700) }
    ];
}

function run() {
    const InvestmentLogic = loadInvestmentLogic();

    assert(typeof InvestmentLogic.buildDartAnnualPeriods === 'function', 'buildDartAnnualPeriods should be exported.');
    assert(typeof InvestmentLogic.buildDartQuarterlyPeriods === 'function', 'buildDartQuarterlyPeriods should be exported.');

    const cfsPreferredSummary = InvestmentLogic.summarizeStatement([
        ...buildIncomeRows({ revenue: 100, operatingIncome: 10, netIncome: 7 }, 'OFS', '11014', '제 57 기3분기'),
        ...buildIncomeRows({ revenue: 300, operatingIncome: 40, netIncome: 30 }, 'CFS', '11014', '제 57 기3분기')
    ]);
    assertEqual(cfsPreferredSummary.revenue, 300, 'summarizeStatement should prefer CFS rows over OFS rows.');
    assertEqual(cfsPreferredSummary.operatingIncome, 40, 'summarizeStatement should parse preferred CFS income statement.');

    const ofsFallbackSummary = InvestmentLogic.summarizeStatement(
        buildIncomeRows({ revenue: 90, operatingIncome: 9, netIncome: 5 }, 'OFS', '11013', '제 57 기1분기')
    );
    assertEqual(ofsFallbackSummary.revenue, 90, 'summarizeStatement should fall back to OFS when CFS is absent.');

    const annualPeriods = InvestmentLogic.buildDartAnnualPeriods([
        { year: 2026, period: 'Q3', reportCode: '11014', label: '2026 3분기', list: buildIncomeRows({ revenue: 999, operatingIncome: 99, netIncome: 88 }, 'CFS', '11014', '제 58 기3분기') },
        { year: 2025, period: 'ANNUAL', reportCode: '11011', label: '2025 사업보고서', list: buildIncomeRows({ revenue: 100, operatingIncome: 20, netIncome: 10 }, 'CFS', '11011', '제 57 기') },
        { year: 2024, period: 'ANNUAL', reportCode: '11011', label: '2024 사업보고서', list: buildIncomeRows({ revenue: 80, operatingIncome: 16, netIncome: 9 }, 'CFS', '11011', '제 56 기') },
        { year: 2023, period: 'ANNUAL', reportCode: '11011', label: '2023 사업보고서', list: buildIncomeRows({ revenue: 70, operatingIncome: 14, netIncome: 8 }, 'CFS', '11011', '제 55 기') }
    ]);
    assertEqual(annualPeriods.length, 3, 'buildDartAnnualPeriods should keep the latest three annual reports only.');
    assert(annualPeriods.every((item) => item.period === 'ANNUAL'), 'buildDartAnnualPeriods should exclude non-annual fallback rows.');
    assertEqual(annualPeriods[0].year, 2025, 'buildDartAnnualPeriods should start from the latest complete annual year.');

    const quarterlySingleMode = InvestmentLogic.buildDartQuarterlyPeriods([
        { year: 2025, period: 'Q1', rank: 1, reportCode: '11013', label: '2025 1분기', annual: false, list: buildIncomeRows({ revenue: 10, operatingIncome: 2, netIncome: 1 }, 'CFS', '11013', '제 57 기1분기') },
        { year: 2025, period: 'Q2', rank: 2, reportCode: '11012', label: '2025 반기', annual: false, list: buildIncomeRows({ revenue: 20, operatingIncome: 4, netIncome: 2 }, 'CFS', '11012', '제 57 기반기') },
        { year: 2025, period: 'Q3', rank: 3, reportCode: '11014', label: '2025 3분기', annual: false, list: buildIncomeRows({ revenue: 30, operatingIncome: 6, netIncome: 3 }, 'CFS', '11014', '제 57 기3분기') },
        { year: 2025, period: 'Q4', rank: 4, reportCode: '11011', label: '2025 사업보고서', annual: true, list: buildIncomeRows({ revenue: 100, operatingIncome: 20, netIncome: 10, assets: 1200, liabilities: 500, equity: 700 }, 'CFS', '11011', '제 57 기') }
    ]);
    const q4Single = findPeriod(quarterlySingleMode, 2025, 'Q4');
    assert(q4Single, 'buildDartQuarterlyPeriods should synthesize Q4 from the annual report.');
    assertEqual(q4Single.summary.revenue, 40, 'Q4 revenue should be annual minus Q1+Q2+Q3 singles.');
    assertEqual(q4Single.summary.operatingIncome, 8, 'Q4 operating income should be annual minus Q1+Q2+Q3 singles.');
    assertEqual(q4Single.summary.netIncome, 4, 'Q4 net income should be annual minus Q1+Q2+Q3 singles.');
    assertEqual(q4Single.summary.assets, 1200, 'Q4 synthetic summary should keep annual balance sheet values.');

    const quarterlyCumulativeMode = InvestmentLogic.buildDartQuarterlyPeriods([
        { year: 2024, period: 'Q1', rank: 1, reportCode: '11013', label: '2024 1분기', annual: false, list: buildIncomeRows({ revenue: 10, operatingIncome: 2, netIncome: 1 }, 'CFS', '11013', '제 56 기1분기') },
        { year: 2024, period: 'Q2', rank: 2, reportCode: '11012', label: '2024 반기', annual: false, list: buildIncomeRows({ revenue: 30, operatingIncome: 6, netIncome: 3 }, 'CFS', '11012', '제 56 기반기누적') },
        { year: 2024, period: 'Q3', rank: 3, reportCode: '11014', label: '2024 3분기', annual: false, list: buildIncomeRows({ revenue: 60, operatingIncome: 12, netIncome: 6 }, 'CFS', '11014', '제 56 기3분기누적') },
        { year: 2024, period: 'Q4', rank: 4, reportCode: '11011', label: '2024 사업보고서', annual: true, list: buildIncomeRows({ revenue: 100, operatingIncome: 20, netIncome: 10 }, 'CFS', '11011', '제 56 기') }
    ]);
    assertEqual(findPeriod(quarterlyCumulativeMode, 2024, 'Q2').summary.revenue, 20, 'Q2 should be reduced to a single-quarter value when cumulative mode is detected.');
    assertEqual(findPeriod(quarterlyCumulativeMode, 2024, 'Q3').summary.revenue, 30, 'Q3 should be reduced to a single-quarter value when cumulative mode is detected.');
    assertEqual(findPeriod(quarterlyCumulativeMode, 2024, 'Q4').summary.revenue, 40, 'Q4 should be annual minus Q3 cumulative when cumulative mode is detected.');

    const scriptSource = readFile('/Users/huiyong/Desktop/Vibe Investment/script.js');
    assert(scriptSource.includes('buildDartAnnualPeriods('), 'script.js should use buildDartAnnualPeriods for annual DART data.');
    assert(scriptSource.includes('buildDartQuarterlyPeriods('), 'script.js should use buildDartQuarterlyPeriods for quarterly DART data.');

    console.log('dart_statement_consistency_test: ok');
}

run();
