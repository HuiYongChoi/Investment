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
assert(htmlSource.includes('id="briefing-share-btn"'), 'AI 리포트 header should include a 공유하기 button.');
assert(htmlSource.includes('class="header-actions briefing-actions"'), 'AI 리포트 header actions should use the dedicated full-width briefing actions layout.');
assert(scriptSource.includes('async function copyBriefingText()'), 'Briefing copy handler should exist.');
assert(scriptSource.includes('async function shareBriefingExternally()'), 'Briefing share handler should exist.');
assert(scriptSource.includes("navigator.clipboard.writeText"), 'Briefing copy handler should use navigator.clipboard.writeText.');
assert(scriptSource.includes('navigator.share'), 'Briefing share handler should use navigator.share when available.');
assert(scriptSource.includes("setBriefingCopyButtonState('complete')"), 'Briefing copy handler should show a completion state.');
assert(scriptSource.includes("setBriefingShareButtonState('complete')"), 'Briefing share handler should show a completion state.');
assert(scriptSource.includes('function extractBriefingPdfModel()'), 'PDF export should extract a structured briefing model instead of screen-capturing the live UI.');
assert(scriptSource.includes('function renderBriefingPdfCanvases('), 'PDF export should render dedicated PDF canvases.');
assert(scriptSource.includes('function buildPdfBlobFromCanvases('), 'PDF export should build a PDF blob from rendered canvases.');
assert(scriptSource.includes("pushString('%PDF-1.4"), 'PDF export should write a valid PDF header.');
assert(scriptSource.includes('function dataUriToUint8Array('), 'PDF export should decode canvas images into binary data.');
assert(scriptSource.includes('function triggerPdfDownload('), 'PDF export should trigger a blob download explicitly.');
assert(scriptSource.includes('/Subtype /Image'), 'PDF export should embed rendered page images into the PDF.');
assert(!scriptSource.includes('window.jspdf?.jsPDF'), 'PDF export should no longer depend on a global jsPDF binding.');
assert(!scriptSource.includes("html2pdf().from(exportTarget)"), 'PDF export should no longer rely on html2pdf screen capture.');
assert(styleSource.includes('.briefing-actions'), 'Styles should define the dedicated AI report action layout.');
assert(styleSource.includes('.briefing-copy-btn'), 'Styles should define the 텍스트 복사 button.');

console.log('briefing_export_actions_test: ok');
