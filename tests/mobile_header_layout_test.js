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

assert(htmlSource.includes('Invest Navigator'), 'Header should use the expanded Invest Navigator brand label');
assert(htmlSource.includes('class="mobile-auth-inline"'), 'Header should include an inline wrapper for the mobile profile and logout controls');
assert(styleSource.includes('.mobile-auth-inline'), 'Styles should include the inline wrapper used to keep the mobile profile and logout controls on one row');

console.log('mobile_header_layout_test: ok');
