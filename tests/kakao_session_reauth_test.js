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

    assert(scriptSource.includes('async function restoreKakaoSession()'), 'Expected restoreKakaoSession to exist.');
    assert(scriptSource.includes('const profile = await requestKakaoUserProfile(accessToken);'), 'Expected session restore to validate the token through proxy before restoring login UI.');
    assert(scriptSource.includes("expireKakaoSession('카카오 세션이 만료되어 다시 로그인이 필요합니다.');"), 'Expected invalid restored tokens to be expired explicitly.');
    assert(!scriptSource.includes("applyKakaoProfile(storedProfile, { fallback: true });"), 'Session restore should no longer mark cached profiles as logged-in when token validation fails.');
    assert(!scriptSource.includes("syncKakaoAuthUI({ nickname: '카카오 사용자', image: '' }, { loggedIn: true, fallback: true });"), 'Session restore should no longer display a logged-in UI from cached fallback profile data.');

    console.log('kakao_session_reauth_test: ok');
}

run();
