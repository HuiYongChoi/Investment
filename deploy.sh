#!/bin/bash
# 배포 자동화 스크립트 (사용자 터미널용)
# 배경: AI 에이전트는 macOS 샌드박스로 인해 Desktop 내부의 .pem 키를 직접 읽지 못하므로,
# 권한이 있는 사용자가 직접 터미널에서 이 스크립트를 실행하면 안전하게 배포가 진행됩니다.

echo "🚀 [Deploy] 시작: Investment Navigator 서버 배포"

echo "1. 최신 코드를 GitHub에 Push 합니다..."
git add -A
git commit -m "Auto-deploy update"
git push

echo "2. 최신 코드를 54.116.99.19 서버에 반영(Pull) 합니다..."
PEM_FILE="LightsailDefaultKey-ap-northeast-2.pem"

if [ ! -f "$PEM_FILE" ]; then
    echo "❌ 에러: $PEM_FILE 키 파일을 찾을 수 없습니다."
    exit 1
fi

ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no bitnami@54.116.99.19 << 'EOF'
    cd /opt/bitnami/apache/htdocs
    echo "💡 서버에서 최신 코드를 Pull 합니다..."
    git pull origin main
    echo "✅ 배포 완료!"
EOF

echo "🎉 배포 프로세스가 종료되었습니다!"
