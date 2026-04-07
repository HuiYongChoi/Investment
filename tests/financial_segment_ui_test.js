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

assert(htmlSource.includes('class="fin-seg-controls"'), 'Financial section should expose segmented controls.');
assert(htmlSource.includes('data-fin-seg-period="annual"'), 'Financial section should include an annual segment button.');
assert(htmlSource.includes('data-fin-seg-period="quarterly"'), 'Financial section should include a quarterly segment button.');
assert(htmlSource.includes('data-fin-seg-type="performance"'), 'Financial section should include a performance segment button.');
assert(htmlSource.includes('data-fin-seg-type="metrics"'), 'Financial section should include a metrics segment button.');
assert(htmlSource.includes('id="fin-active-table"'), 'Financial section should render into a single active table viewport.');
assert(!htmlSource.includes('data-fin-toggle="annual"'), 'Legacy accordion markup should be removed from the financial section.');

assert(scriptSource.includes("finSegPeriod: 'annual'"), 'State should track the active financial period segment.');
assert(scriptSource.includes("finSegType: 'performance'"), 'State should track the active financial type segment.');
assert(scriptSource.includes('function renderActiveFinancialTable()'), 'Script should render the active financial table from segment state.');
assert(scriptSource.includes('function onFinSegClick(event)'), 'Script should handle financial segment button clicks.');
assert(!scriptSource.includes('function onFinancialSectionToggle(event)'), 'Legacy financial accordion handler should be removed.');

assert(styleSource.includes('.fin-seg-controls'), 'Styles should define financial segment controls.');
assert(styleSource.includes('.fin-seg-btn.active'), 'Styles should define the active financial segment state.');
assert(styleSource.includes('.fin-table-viewport'), 'Styles should define the active financial table viewport.');

console.log('financial_segment_ui_test: ok');
