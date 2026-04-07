ObjC.import('Foundation');

function readText(path) {
    const content = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
    if (!content) {
        throw new Error(`Unable to read file: ${path}`);
    }
    return ObjC.unwrap(content);
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const root = '/Users/huiyong/Desktop/Vibe Investment';
const htmlSource = readText(`${root}/index.html`);
const scriptSource = readText(`${root}/script.js`);
const styleSource = readText(`${root}/style.css`);

assert(htmlSource.includes('id="briefing-generate-btn"'), 'AI 리포트 섹션 should include a dedicated 보고서 작성 button.');
assert(scriptSource.includes("document.getElementById('briefing-generate-btn').addEventListener('click', onBriefingGenerateClick);"), '보고서 작성 button should bind a dedicated click handler.');
assert(scriptSource.includes('function onBriefingGenerateClick()'), 'A manual briefing trigger handler should exist.');
assert(scriptSource.includes("setBriefingGenerateButtonState('loading')"), 'Manual briefing flow should enter a loading button state.');
assert(scriptSource.includes("setBriefingGenerateButtonState('complete')"), 'Manual briefing flow should enter a completion button state after success.');
assert(scriptSource.includes("setSourceBadge('source-gemini', '보고서 작성 대기'"), 'Gemini source badge should default to a manual waiting state.');
assert(!scriptSource.includes('maybeStartInitialBriefing(analysisToken);'), 'Initial analysis sync should not auto-trigger Gemini anymore.');
assert(!scriptSource.includes("briefingRefreshTimer = setTimeout(() => {\n        briefingRefreshTimer = null;\n        void generateBriefing();"), 'Valuation/module changes should not auto-trigger Gemini regeneration.');
assert(styleSource.includes('.briefing-generate-btn'), 'Styles should define the primary 보고서 작성 button.');
assert(styleSource.includes('.briefing-generate-btn.is-loading'), 'Styles should define the loading state for the report button.');

console.log('manual_briefing_trigger_test: ok');
