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
const styleSource = readText(`${root}/style.css`);

assert(htmlSource.includes('style.css?v=1.1.14'), 'HTML should bump the CSS asset version to invalidate stale layout cache.');
assert(styleSource.includes('.search-row {\n    position: relative;'), 'Search row should be explicitly positioned to anchor the suggestion layer.');
assert(styleSource.includes('min-height: 84px;'), 'Search row should reserve vertical space to prevent layout shift.');
assert(styleSource.includes('.search-input-wrap {\n    position: relative;\n    flex: 1;\n    min-height: 60px;'), 'Search input wrapper should keep a stable minimum height.');
assert(styleSource.includes('@media (max-width: 860px) {\n    header#header {\n        padding: 16px 18px;\n        align-items: center;\n        flex-direction: row;'), 'Tablet/mobile header should keep logo and auth controls on one centered row.');
assert(styleSource.includes('.header-right {\n        width: auto;\n        margin-left: auto;\n        justify-content: flex-end;\n        align-items: center;'), 'Right-side header actions should remain centered and anchored to the right on narrow screens.');

console.log('header_search_stability_test: ok');
