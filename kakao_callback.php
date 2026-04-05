<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kakao Callback</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #080a10;
            color: #f8fafc;
            font-family: Inter, system-ui, sans-serif;
        }

        .box {
            max-width: 420px;
            padding: 28px;
            border-radius: 22px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(15, 23, 42, 0.82);
            text-align: center;
        }

        p {
            color: #94a3b8;
            line-height: 1.7;
        }
    </style>
</head>
<body>
    <div class="box">
        <h1>카카오 로그인 처리 중</h1>
        <p id="message">인가 코드를 확인하고 있습니다.</p>
    </div>
    <script src="dashboard_logic.js"></script>
    <script>
        const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const proxyBase = isLocal ? 'http://localhost:8081/kakao/token' : '/proxy.php?action=kakao';
        const STORAGE_KEYS = {
            token: 'invest_nav_kakao_token',
            error: 'invest_nav_kakao_error',
            returnUrl: 'invest_nav_kakao_return_url',
            profile: 'invest_nav_kakao_profile'
        };
        function readAuthValue(key) {
            return sessionStorage.getItem(key) || localStorage.getItem(key) || '';
        }
        function writeAuthValue(key, value) {
            if (value === null || value === undefined || value === '') {
                sessionStorage.removeItem(key);
                localStorage.removeItem(key);
                return;
            }
            sessionStorage.setItem(key, value);
            localStorage.setItem(key, value);
        }
        const returnUrl = InvestmentLogic.resolveKakaoReturnUrl(
            readAuthValue(STORAGE_KEYS.returnUrl),
            location.href
        );
        const redirectUri = InvestmentLogic.resolveKakaoCallbackUri(location.href);
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const error = params.get('error_description') || params.get('error');
        const message = document.getElementById('message');

        async function finish() {
            if (!code) {
                if (error) writeAuthValue(STORAGE_KEYS.error, error);
                location.replace(returnUrl);
                return;
            }

            try {
                const response = await fetch(proxyBase, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code,
                        redirectUri
                    })
                });
                const data = await response.json();
                if (!response.ok || !data.access_token) {
                    throw new Error(data.error || data.msg || 'access token 발급 실패');
                }
                writeAuthValue(STORAGE_KEYS.token, data.access_token);
                if (data.profile) {
                    writeAuthValue(STORAGE_KEYS.profile, JSON.stringify(data.profile));
                } else {
                    writeAuthValue(STORAGE_KEYS.profile, '');
                }
                writeAuthValue(STORAGE_KEYS.error, '');
                message.textContent = '로그인 처리가 완료되어 원래 페이지로 이동합니다.';
            } catch (requestError) {
                writeAuthValue(STORAGE_KEYS.error, requestError.message);
                message.textContent = '로그인 처리 중 문제가 발생했습니다. 원래 페이지로 돌아갑니다.';
            }

            setTimeout(() => location.replace(returnUrl), 600);
        }

        finish();
    </script>
</body>
</html>
