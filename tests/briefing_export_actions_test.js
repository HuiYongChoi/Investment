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

assert(htmlSource.includes('id="briefing-copy-btn"'), 'AI 리포트 header should include a 텍스트 복사 button.');
assert(htmlSource.includes('class="header-actions briefing-actions"'), 'AI 리포트 header actions should use the dedicated full-width briefing actions layout.');
assert(scriptSource.includes('async function copyBriefingText()'), 'Briefing copy handler should exist.');
assert(scriptSource.includes("navigator.clipboard.writeText"), 'Briefing copy handler should use navigator.clipboard.writeText.');
assert(scriptSource.includes("setBriefingCopyButtonState('complete')"), 'Briefing copy handler should show a completion state.');
assert(scriptSource.includes("document.getElementById('dashboard')"), 'PDF export should capture the stable dashboard container.');
assert(scriptSource.includes("exportTarget.classList.add('pdf-export-mode')"), 'PDF export should enable pdf-export-mode before capture.');
assert(scriptSource.includes("exportTarget.classList.remove('pdf-export-mode')"), 'PDF export should always remove pdf-export-mode after capture.');
assert(styleSource.includes('.pdf-export-mode'), 'Styles should define pdf-export-mode overrides for PDF export.');
assert(styleSource.includes('.briefing-copy-btn'), 'Styles should define the 텍스트 복사 button.');
assert(styleSource.includes('.briefing-actions'), 'Styles should define the dedicated AI report action layout.');

console.log('briefing_export_actions_test: ok');
