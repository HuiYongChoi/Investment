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
const htmlSource = readText(`${cwd}/index.html`);
const scriptSource = readText(`${cwd}/script.js`);
const styleSource = readText(`${cwd}/style.css`);
const phpProxySource = readText(`${cwd}/proxy.php`);

assert(!htmlSource.includes('class="indicator-chip active"'), 'Technical indicator chips should start inactive by default.');
assert(htmlSource.includes('data-fin-toggle="annual"'), 'Financial section should include an annual-results toggle.');
assert(htmlSource.includes('data-fin-toggle="metrics"'), 'Financial section should include an investment-metrics toggle.');
assert(htmlSource.includes('data-fin-toggle="quarterly"'), 'Financial section should include a quarterly-results toggle.');
assert(htmlSource.includes('data-fin-body="annual"'), 'Financial section should include an annual-results body container.');
assert(htmlSource.includes('data-fin-body="metrics"'), 'Financial section should include an investment-metrics body container.');
assert(htmlSource.includes('data-fin-body="quarterly"'), 'Financial section should include a quarterly-results body container.');
assert(htmlSource.includes('class="fin-section-body hidden"'), 'Financial section bodies should start collapsed.');

assert(scriptSource.includes('selectedIndicators: new Set()'), 'Selected indicators should initialize as an empty set.');
assert(scriptSource.includes('syncIndicatorChipState();'), 'Frontend should synchronize indicator chip active state from the shared selection set.');
assert(scriptSource.includes('resetFinancialSectionToggles();'), 'Frontend should reset financial section toggles on load and new analysis.');
assert(scriptSource.includes("document.getElementById('card-financials')?.addEventListener('click', onFinancialSectionToggle);"), 'Financial section should delegate toggle clicks from the financial card.');
assert(scriptSource.includes('function onFinancialSectionToggle(event) {'), 'Financial section toggle handler should exist.');
assert(scriptSource.includes('function setFinancialSectionExpanded(sectionKey, expanded) {'), 'Financial section expansion helper should exist.');
assert(scriptSource.includes("['annual', 'metrics', 'quarterly'].forEach"), 'Financial toggle reset should collapse annual, metrics, and quarterly sections together.');
assert(scriptSource.includes('state.selectedIndicators = new Set();'), 'New analyses should reset technical indicators back to the OFF state.');

assert(styleSource.includes('.fin-section-toggle'), 'Styles should include the financial section toggle treatment.');
assert(styleSource.includes('.fin-section-body'), 'Styles should include the financial section body treatment.');
assert(styleSource.includes('.fin-section-chevron'), 'Styles should include the financial section chevron treatment.');

assert(phpProxySource.includes("'gemini-3-flash-preview'"), 'Gemini proxy fallback list should include the latest preview flash model first.');
assert(phpProxySource.includes("if ($upstream['status'] >= 200 && $upstream['status'] < 300) {\n                continue;"), 'Gemini proxy should continue to the next model when a 2xx response arrives without text.');

console.log('ui_toggle_behavior_test: ok');
