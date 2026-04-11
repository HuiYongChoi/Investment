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
const styleSource = readText(`${cwd}/style.css`);
const scriptSource = readText(`${cwd}/script.js`);

assert(htmlSource.includes('Invest Navigator'), 'Header should use the expanded Invest Navigator brand label');
assert(htmlSource.includes('class="mobile-auth-inline hidden" hidden aria-hidden="true"'), 'Header should keep the mobile auth inline wrapper hidden by default in the HTML.');
assert(htmlSource.includes('id="mobile-kakao-login" class="mobile-auth-chip hidden" type="button" hidden'), 'Header should keep the mobile Kakao login chip hidden by default in the HTML.');
assert(styleSource.includes('.mobile-auth-inline'), 'Styles should include the inline wrapper used to keep the mobile profile and logout controls on one row');
assert(styleSource.includes('.mobile-auth-inline {\n    display: none;'), 'Desktop header should hide the mobile auth inline wrapper by default.');
assert(styleSource.includes('.mobile-header-auth .mobile-auth-inline,\n.mobile-header-auth #mobile-kakao-login,'), 'Desktop styles should force-hide mobile auth controls inside the shared header container.');
assert(styleSource.includes('.mobile-auth-inline {\n        display: inline-flex;'), 'Mobile header should re-enable the inline mobile auth wrapper inside the mobile media query.');
assert(scriptSource.includes('function syncKakaoAuthSurfaceVisibility(isLoggedIn = false)'), 'Kakao auth rendering should include a dedicated viewport visibility sync helper.');
assert(scriptSource.includes("mobileInline?.classList.add('hidden');"), 'Desktop viewport sync should hide the mobile auth inline wrapper explicitly.');
assert(scriptSource.includes("mobileInline?.setAttribute('hidden', '');"), 'Desktop viewport sync should also restore the native hidden attribute on the mobile auth inline wrapper.');
assert(scriptSource.includes("desktopAuthArea?.classList.add('hidden');"), 'Mobile viewport sync should hide the desktop auth area explicitly.');

console.log('mobile_header_layout_test: ok');
