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

function run() {
    const scriptSource = readText('/Users/huiyong/Desktop/Vibe Investment/script.js');

    assert(scriptSource.includes('function logKakaoSendError(error)'), 'Expected a dedicated Kakao send error logger helper.');
    assert(scriptSource.includes("console.error('[Kakao Send Error] Full Error Response:'"), 'Expected raw Kakao error response logging.');
    assert(scriptSource.includes("console.error(`[Kakao Send Error] code: ${String(code)} | msg: ${String(msg)}`"), 'Expected formatted Kakao code/msg logging.');
    assert(scriptSource.includes("alert('카카오톡 전송에 실패했습니다. 메시지 API 권한과 로그인 상태를 확인해주세요.');"), 'Expected the user-facing Kakao failure alert to remain.');

    console.log('kakao_send_error_logging_test: ok');
}

run();
