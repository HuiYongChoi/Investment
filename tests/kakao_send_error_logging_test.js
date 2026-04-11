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
    const proxySource = readText('/Users/huiyong/Desktop/Vibe Investment/proxy.php');

    assert(scriptSource.includes('function buildKakaoShareLinkUrl()'), 'Expected a dedicated Kakao share link helper.');
    assert(scriptSource.includes('function beginKakaoLogin(options = {})'), 'Expected Kakao login flow to accept scope options.');
    assert(scriptSource.includes("scope: options.scope || KAKAO_REQUIRED_SCOPES.join(',')"), 'Expected Kakao login to request required scopes.');
    assert(scriptSource.includes('function buildKakaoBriefingText('), 'Expected a dedicated Kakao briefing text helper.');
    assert(scriptSource.includes('.slice(0, 180)'), 'Expected Kakao send text to stay safely inside the text template size budget.');
    assert(scriptSource.includes('function requestKakaoUserProfile('), 'Expected Kakao token validation to go through a dedicated proxy helper.');
    assert(scriptSource.includes('function requestKakaoMemoSend('), 'Expected Kakao memo send to go through a dedicated proxy helper.');
    assert(scriptSource.includes("buildProxyPostUrl('kakao_memo', '', 'kakao_memo')"), 'Expected Kakao memo send to go through proxy.php instead of direct SDK API.request.');
    assert(scriptSource.includes("buildProxyPostUrl('kakao_user', '', 'kakao_user')"), 'Expected Kakao session validation to go through proxy.php.');
    assert(!scriptSource.includes("url: '/v2/api/talk/memo/default/send'"), 'Frontend should no longer call the Kakao memo REST path directly.');
    assert(scriptSource.includes('function getKakaoErrorMeta('), 'Expected Kakao send flow to normalize proxy errors with a helper.');
    assert(scriptSource.includes("const shouldRetryConsent = (kakaoCode === '-402'"), 'Expected Kakao send flow to retry consent only for insufficient scope errors.');
    assert(scriptSource.includes("const alreadyRetriedConsent = readKakaoStorage(KAKAO_STORAGE_MESSAGE_RETRY) === '1';"), 'Expected Kakao send flow to distinguish first insufficient-scope failure from repeated failures.');
    assert(scriptSource.includes("beginKakaoLogin({ forceConsent: true, scope: 'talk_message' });"), 'Expected Kakao send flow to trigger re-consent on insufficient-scope errors.');
    assert(scriptSource.includes("if (kakaoCode === '-401' || responseStatus === '401' || kakaoMessage.includes('access token'))"), 'Expected invalid or expired tokens to trigger a re-login path.');
    assert(scriptSource.includes("if (kakaoCode === '-403' || responseStatus === '403' || kakaoMessage.includes('forbidden'))"), 'Expected Kakao send flow to classify forbidden responses explicitly.');
    assert(scriptSource.includes('function expireKakaoSession('), 'Expected invalid Kakao sessions to be cleared explicitly.');
    assert(scriptSource.includes("alert('카카오 서버가 나에게 보내기 요청을 거부했습니다. 공유하기 버튼은 별도로 사용하시고, 나에게 보내기는 재로그인 후 다시 시도해 주세요.');"), 'Expected forbidden memo sends to show a direct-send specific message.');
    assert(!scriptSource.includes('function shareBriefingViaKakaoShare('), 'Direct send flow should no longer hide failures behind Kakao share fallback.');
    assert(!scriptSource.includes('Kakao.Share.sendDefault('), 'Kakao send flow should no longer fall back to Kakao Share automatically.');
    assert(scriptSource.includes('const shareUrl = buildKakaoShareLinkUrl();'), 'Expected Kakao send flow to use a normalized share URL.');
    assert(scriptSource.includes('function logKakaoSendError(error)'), 'Expected a dedicated Kakao send error logger helper.');
    assert(scriptSource.includes('console.error("Kakao 403 Error Details: ", error);'), 'Expected explicit Kakao 403 diagnostic logging.');
    assert(scriptSource.includes("console.error('[Kakao Send Error] Full Error Response:'"), 'Expected raw Kakao error response logging.');
    assert(scriptSource.includes("console.error(`[Kakao Send Error] code: ${String(code)} | msg: ${String(msg)}`"), 'Expected formatted Kakao code/msg logging.');
    assert(scriptSource.includes("alert('카카오톡 전송에 실패했습니다. 메시지 API 권한과 로그인 상태를 확인해주세요.');"), 'Expected the user-facing Kakao failure alert to remain.');
    assert(!scriptSource.includes('web_url: location.href'), 'Expected Kakao share to avoid raw location.href payloads.');
    assert(!scriptSource.includes('mobile_web_url: location.href'), 'Expected Kakao share to avoid raw location.href payloads.');

    assert(proxySource.includes("const KAKAO_MEMO_SEND_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';"), 'Proxy should define the Kakao memo send REST endpoint.');
    assert(proxySource.includes("if ($action === 'kakao_memo') {"), 'Proxy should expose a dedicated kakao_memo action.');
    assert(proxySource.includes("if ($action === 'kakao_user') {"), 'Proxy should expose a dedicated kakao_user action.');
    assert(proxySource.includes("'Authorization: Bearer ' . $accessToken"), 'Proxy kakao_memo action should forward the user access token to Kakao REST API.');
    assert(proxySource.includes("'template_object' => json_encode($templateObject"), 'Proxy kakao_memo action should send the text template as a form-encoded template_object payload.');

    console.log('kakao_send_error_logging_test: ok');
}

run();
