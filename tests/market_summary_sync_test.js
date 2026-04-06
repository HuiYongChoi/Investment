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
const proxySource = readText(`${cwd}/proxy.php`);

assert(scriptSource.includes('const MARKET_SUMMARY_CACHE_KEY ='), 'Frontend should define a dedicated market summary cache key.');
assert(scriptSource.includes('function readMarketSummaryCache() {'), 'Frontend should read a cached market summary before network refresh.');
assert(scriptSource.includes('function writeMarketSummaryCache(payload) {'), 'Frontend should persist market summary payloads after successful refresh.');
assert(scriptSource.includes('function scheduleMarketSummaryReload('), 'Frontend should schedule market summary retries after failures and periodic refreshes.');
assert(scriptSource.includes('const cachedSummary = readMarketSummaryCache();'), 'loadMarketSummary should apply cached market data immediately.');
assert(scriptSource.includes('async function loadCriticalMarketSnapshot() {'), 'Frontend should define a critical market snapshot fallback loader.');
assert(scriptSource.includes('const criticalSnapshotPromise = loadCriticalMarketSnapshot();'), 'loadMarketSummary should start the critical market snapshot in parallel.');
assert(scriptSource.includes('applyMarketSummary(snapshot);'), 'Critical market snapshot fallback should render essential market fields immediately.');

assert(proxySource.includes('function market_summary_cache_path(): string'), 'Backend should define a cache path for market summary snapshots.');
assert(proxySource.includes('function read_market_summary_cache('), 'Backend should read cached market summary payloads.');
assert(proxySource.includes('function write_market_summary_cache(array $summary): void'), 'Backend should persist market summary payloads.');
assert(proxySource.includes('read_market_summary_cache(90)'), 'Market summary endpoint should reuse a fresh cache before recomputing slow quotes.');

console.log('market_summary_sync_test: ok');
