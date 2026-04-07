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

assert(!scriptSource.includes("classList.add('keyboard-active')"), 'Mobile search focus should not collapse the hero layout with a keyboard-active class.');
assert(!scriptSource.includes("classList.remove('keyboard-active')"), 'Mobile search blur should not restore a collapsed hero layout class.');
assert(!styleSource.includes('#search-hero.keyboard-active h1'), 'Hero title should not collapse when the mobile keyboard opens.');
assert(!styleSource.includes('#search-hero.keyboard-active > p'), 'Hero subtitle should not collapse when the mobile keyboard opens.');
assert(styleSource.includes('.company-suggestions {\n    position: absolute;'), 'Suggestion list should stay absolutely anchored under the input.');
assert(styleSource.includes('max-height: var(--suggestions-max-height, 320px);'), 'Suggestion list should still clamp to the visual viewport height.');

console.log('mobile_search_keyboard_stability_test: ok');
