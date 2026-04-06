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

function run() {
    const InvestmentLogic = loadInvestmentLogic();

    assert(typeof InvestmentLogic.normalizeBriefingSections === 'function', 'normalizeBriefingSections should be exported.');
    assert(typeof InvestmentLogic.buildFallbackBriefingSections === 'function', 'buildFallbackBriefingSections should be exported.');
    assert(typeof InvestmentLogic.buildBriefingCacheKey === 'function', 'buildBriefingCacheKey should be exported.');

    const parsedSections = InvestmentLogic.normalizeBriefingSections(`
🎯 **핵심 요약 (Investment Thesis)**
- 수익성과 현금흐름이 동반 개선되고 있습니다.
- 환율 상승 수혜가 일부 기대됩니다.

⚠️ **핵심 리스크 및 매크로 역풍 (Risks & Headwinds)**
- VIX 상승은 단기 변동성을 키울 수 있습니다.
    `.trim());

    assertEqual(parsedSections.length, 2, 'normalizeBriefingSections should split emoji/markdown headings into sections.');
    assert(parsedSections[0].title.includes('핵심 요약'), 'normalizeBriefingSections should preserve the Gemini heading title.');
    assert(parsedSections[0].listLike === true, 'normalizeBriefingSections should detect markdown bullet sections.');

    const fallbackSections = InvestmentLogic.buildFallbackBriefingSections({
        company: '삼성전자',
        macro: {
            usdKrw: '1,520.00원',
            vix: '34.1',
            wti: '82.4달러'
        },
        ratings: {
            totalPct: 78,
            profitability: 4,
            stability: 3,
            efficiency: 4
        },
        summary: {
            operatingMargin: 15.2,
            debtRatio: 42.5,
            roe: 18.4
        },
        metrics: {
            targetPrice: 98000,
            upside: 12.3
        },
        technicalSignals: ['RSI(중립)', 'MACD(매수)'],
        anomalies: ['흑자부도 위험: 영업현금흐름이 순이익 대비 급감했습니다.'],
        chartSource: 'Yahoo Finance (yfinance Python)'
    });

    assertEqual(fallbackSections.length, 4, 'buildFallbackBriefingSections should always return four institutional sections.');
    assert(fallbackSections[0].body.some((line) => String(line).includes('삼성전자')), 'Fallback briefing should include the company name.');
    assert(fallbackSections[1].body.some((line) => String(line).includes('MACD(매수)')), 'Fallback briefing should include dynamic technical signals.');
    assert(fallbackSections[2].body.some((line) => String(line).includes('흑자부도 위험')), 'Fallback briefing should surface anomaly warnings.');
    assert(fallbackSections[2].body.some((line) => String(line).includes('1,520.00원')), 'Fallback briefing should include macro data context.');

    const cacheKey = InvestmentLogic.buildBriefingCacheKey('삼성전자', 'sig-123');
    assertEqual(cacheKey, 'invest_nav_briefing_v2_삼성전자_sig-123', 'buildBriefingCacheKey should produce a stable cache key.');

    const scriptSource = readFile('/Users/huiyong/Desktop/Vibe Investment/script.js');
    assert(scriptSource.includes('readBriefingCache('), 'script.js should read cached Gemini briefings before falling back.');
    assert(scriptSource.includes('writeBriefingCache('), 'script.js should persist successful Gemini briefings.');
    assert(scriptSource.includes('maxOutputTokens: 2048'), 'Gemini generation config should raise maxOutputTokens to 2048 for long briefings.');
    assert(!scriptSource.includes('stopSequences'), 'Gemini requests should not include stopSequences that truncate the briefing early.');
    assert(scriptSource.includes('collectGeminiResponseText(response)'), 'Gemini briefing should join text from all returned content parts instead of only the first line.');
    assert(scriptSource.includes(".replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')"), 'Briefing formatter should convert markdown bold syntax to strong tags.');
    assert(scriptSource.includes(".replace(/\\n/g, '<br>')"), 'Briefing formatter should preserve every newline as an HTML line break.');
    assert(scriptSource.includes("console.error('Gemini briefing fallback'"), 'Gemini fallback path should log rendering/API failures with console.error.');
    assert(scriptSource.includes("console.error('formatBriefingText failed'"), 'Briefing formatter should log markdown/rendering failures before falling back.');
    assert(scriptSource.includes("console.error('Briefing render failed'"), 'Briefing renderer should log UI rendering failures before showing a fallback briefing.');

    console.log('briefing_resilience_test: ok');
}

run();
