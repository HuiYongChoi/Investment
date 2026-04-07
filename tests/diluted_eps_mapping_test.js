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

function buildDartRows(options) {
    const valueMap = options || {};
    const rows = [
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '매출액', thstrm_amount: String(valueMap.revenue ?? 1000) },
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '영업이익', thstrm_amount: String(valueMap.operatingIncome ?? 100) },
        { fs_div: 'CFS', sj_div: 'IS', sj_nm: '손익계산서', account_nm: '당기순이익(손실)', thstrm_amount: String(valueMap.netIncome ?? 80) },
        { fs_div: 'CFS', sj_div: 'BS', sj_nm: '재무상태표', account_nm: '자본총계', thstrm_amount: String(valueMap.equity ?? 500) }
    ];

    if (valueMap.dilutedEps !== undefined) {
        rows.push({
            fs_div: 'CFS',
            sj_div: 'IS',
            sj_nm: '손익계산서',
            account_nm: '희석주당이익',
            thstrm_amount: String(valueMap.dilutedEps)
        });
    }

    if (valueMap.basicEps !== undefined) {
        rows.push({
            fs_div: 'CFS',
            sj_div: 'IS',
            sj_nm: '손익계산서',
            account_nm: '기본주당순이익',
            thstrm_amount: String(valueMap.basicEps)
        });
    }

    return rows;
}

function run() {
    const InvestmentLogic = loadInvestmentLogic();

    const summaryWithDilution = InvestmentLogic.summarizeStatement(buildDartRows({
        netIncome: 120,
        equity: 800,
        dilutedEps: 1540,
        basicEps: 1490
    }));
    assertEqual(summaryWithDilution.dilutedEps, 1540, 'DART summary should prefer 희석주당이익 when it exists.');
    assertEqual(summaryWithDilution.basicEps, 1490, 'DART summary should preserve the 기본주당이익 fallback value when present.');

    const summaryWithBasicFallback = InvestmentLogic.summarizeStatement(buildDartRows({
        netIncome: 120,
        equity: 800,
        basicEps: 980
    }));
    assertEqual(summaryWithBasicFallback.dilutedEps, 980, 'DART summary should fall back to 기본주당이익 when 희석주당이익 is absent.');
    assertEqual(summaryWithBasicFallback.basicEps, 980, 'DART summary should keep the basic EPS value available for reference.');

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
                dilutedEps: 15,
                basicEps: 14,
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
                dilutedEps: 10,
                basicEps: 9,
                roe: 20
            }
        }
    ], {
        2025: 300,
        2024: 200
    });
    assertEqual(investmentRows[0].eps, 15, 'Historical investment rows should use the parsed diluted EPS instead of net income divided by shares.');
    assertEqual(investmentRows[0].basicEps, 14, 'Historical investment rows should keep the basic EPS value for parallel rendering.');
    assertApprox(investmentRows[0].per, 20, 0.001, 'Historical PER should use the mapped diluted EPS value.');
    assertApprox(investmentRows[0].changes.eps, 50, 0.001, 'Historical diluted EPS should still carry the year-over-year delta.');
    assertApprox(investmentRows[0].changes.basicEps, ((14 - 9) / 9) * 100, 0.001, 'Historical basic EPS should also carry the year-over-year delta.');

    const normalizedQuote = InvestmentLogic.normalizeYfinanceQuote({
        currentPrice: 250,
        previousClose: 200,
        dilutedEPS: 0,
        basicEps: 6.2,
        trailingEps: 6.2,
        epsForward: 9.4
    }, '');
    assertEqual(normalizedQuote.trailingEps, 6.2, 'Yahoo quote normalization should fall back to basic/trailing EPS when dilutedEPS is zero.');

    const bridgeSource = readFile('/Users/huiyong/Desktop/Vibe Investment/yfinance_bridge.py');
    const scriptSource = readFile('/Users/huiyong/Desktop/Vibe Investment/script.js');
    const htmlSource = readFile('/Users/huiyong/Desktop/Vibe Investment/index.html');

    assert(bridgeSource.includes('info.get("dilutedEPS")'), 'yfinance bridge should map dilutedEPS directly from Yahoo Finance.');
    assert(bridgeSource.includes('"basicEps": basic_eps'), 'yfinance bridge should expose a basic EPS fallback payload when diluted EPS is unavailable.');
    assert(scriptSource.includes('summary?.dilutedEps'), 'Valuation fallback logic should reference the parsed diluted EPS from DART summaries.');
    assert(!scriptSource.includes("safeDivide(summary?.netIncome || 0, lastTrade.sharesOutstanding)"), 'Valuation fallback should no longer derive EPS from net income divided by shares.');
    assert(scriptSource.includes("label: '희석 EPS'"), 'Historical investment table should relabel EPS as 희석 EPS.');
    assert(scriptSource.includes("label: 'EPS'"), 'Historical and quarterly investment tables should also render a separate EPS row.');
    assert(htmlSource.includes('선행 희석 EPS (원)'), 'Read-only valuation form should relabel the forward EPS field as diluted EPS.');
    assert(htmlSource.includes('TTM 희석 EPS (원)'), 'Read-only valuation form should relabel the TTM EPS field as diluted EPS.');
    assert(htmlSource.includes('조정 희석 EPS (원)'), 'Manual valuation override field should relabel the adjusted EPS input as diluted EPS.');

    console.log('diluted_eps_mapping_test: ok');
}

run();
