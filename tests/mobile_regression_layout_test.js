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
const styleSource = readText(`${root}/style.css`);
const scriptSource = readText(`${root}/script.js`);

assert(!scriptSource.includes("document.body.style.position = 'fixed';"), 'Mobile keyboard handling should not lock the entire body with position: fixed.');
assert(!scriptSource.includes("document.body.style.top = `-${_mobileKeyboardScrollY}px`;"), 'Mobile keyboard handling should not offset the body top during input focus.');
assert(scriptSource.includes("window.scrollTo({ top: 0, behavior: 'instant' })"), 'Mobile tab switching should force the viewport to scroll to the top.');
assert(styleSource.includes('.card-header {\n        align-items: center;\n        flex-direction: row;\n        flex-wrap: nowrap;'), 'Mobile card headers should stay on one line with centered icon and title alignment.');
assert(styleSource.includes('.search-row {\n        flex-direction: column;\n        border-radius: 22px;\n        min-height: auto;'), 'Mobile search row should release the forced min-height that causes keyboard viewport shift.');
assert(styleSource.includes('.search-input-wrap {\n        min-height: 0;'), 'Mobile search input wrapper should release extra reserved height while typing.');

console.log('mobile_regression_layout_test: ok');
