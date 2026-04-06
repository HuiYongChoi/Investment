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
const scriptSource = readText(`${cwd}/script.js`);

assert(scriptSource.includes('const FETCH_TIMEOUT_MS = Object.freeze('), 'Search flow should define fetch timeouts for slow upstream APIs.');
assert(scriptSource.includes('const controller = new AbortController();'), 'fetchJson should abort stalled upstream requests.');
assert(scriptSource.includes('void continueAnalysisSync({'), 'Search flow should continue heavy sync work in the background after the initial UI reset.');
assert(scriptSource.includes('const annualsPromise = fetchMultiYearDart('), 'DART annual financial sync should be decoupled from the rest of the startup flow.');
assert(scriptSource.includes('const reportsPromise = fetchDartReportList('), 'DART report-list sync should not block the financial statement render path.');
assert(scriptSource.includes('applyCachedChartPreview(company.stockCode);'), 'Search flow should render cached chart data immediately when available.');

console.log('search_sync_resilience_test: ok');
