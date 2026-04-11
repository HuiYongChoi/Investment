import subprocess, os, tempfile

KEY_CONTENT = """-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA02QiSA9YLWVcU1LI2BSWDyfJ38eAKMGjdngh4QylA+6WdC8V
KppCpsTo7tkS2AatHwF5bGD3wvgiFdE/GRPSTL7is+oGjuSSN4TckfG6wJnHCB4o
8LdynNFBmK4/XcR4vdVRsS48OscaN0noR6PvmKclaJCn4eG6lQsN3Ht/mQQ8B0t/
RpDlPycjaKtrdMEqMNeEg2+yIT+3LROweXYO2n3+PEStLZEUTeAr1gRCAgVlmwGF
0vJfFa5J6Rf6jljRDUi9yIXaFz74G/HuRoKvrftqcXgKanprGIwDTKdXayJlW0Uf
PomOzM/F4StPfnX2bXRUsEYcWRTemehhPDAr/wIDAQABAoIBAG9Sj18lfYlClNFo
ik6I4NGQYZaQiGRuPTg5YZYTw58DeYYr+VibLjiHACgwduT+9xKaAyjZFAFADSsy
K6l4L8qsx9R5jQSZSIsmU8Yj5/ZfxVn4EBVcdmYxKPtP4BzwR6mo+kF1mNBXY+3z
5Pg9VAMvGtsrOs4QwuKUlLMk8nhQtXNk628stGBFZmVYtKJTx3qTYLqlCiplbjCQ
OxeMV/NTgrQGWRxMsJ1cVVSjLdLmbFPhVrSeHkE+x75RYW4zTQB/7N6NNpr36QPN
5yrIpNQcZOTsqdjpYB7xufY6SRYLIxkgcympfj5UXHF4+be2TQnd51CtETQhh0Zs
OadCdOkCgYEA/7BMFKFxYbOVD6PNxYUcZ16HWRDWhe+WvD59w92sLxyJESTcX9ls
X6n/JoUSyvXBK+wnHzVXuvVyxuPdS8DiRKt7qs7PKa/SwOXr+FwAA1CmT3lXN/bi
CibVp4Q3LZabIsP/ts6OGaV4Y4UL4/s/n1XHFK6u2h/FNzFBNsx8CaMCgYEA06YH
Q/v9BLawryzBJnsmFiO+VQPfJpNhkzaTpGiF5XiEpbV7NVA+RjzfZCYpqfnRPrtp
1gTyJ1a0z2eyD9V9pTmGTRK5jRK38OUyCRuBIDwul/s5fo4vb4v/UzseQdDgloSV
F4qZSaxzg1baa8gqR/09wZ1/EE9hU6pnxnl+cfUCgYEA4ZvKlc2aAM53cXRkpat9
U4xqOuGLmGS+iV1OlVvsiSlRnEn9FaoAYSzb0T5MRb+w8jOOlY/42COpYes/oY8R
V+xD04Rl8O+OM9zsaJms/T/Vb3yuw9fYvYJktUoJcfVY78UnxkLdya1i29VSl5hj
HBGQ9yPnbtnnp3qTg2nM7KcCgYACgzQO4IzuY2TRj4xzcn7PQHlf9P3PLWy5HKrA
BuWgBcA9X1wpE9zJZKuaOsG/3NFZF0x4V/Kv+N2IoMiCW5x0O6yWeaRuQkygtXfU
l9j+kvhSoY7bK8DwaA8N4+PGED66SrSiZOjQ8RUl9//7y5KE7EKxa7c4cFjNb3Zv
6r1PiQKBgBg/4r36e3yHn9o4e+znt7NHnG1HxthpenSVNXMYe6Fal3r2wlUEctp
vWfaiUKN525x13eD4lcpsiFjuAyNyee04UXJLOop159hxO5JyknuOUjHk5dQ8JM3
Y7QYdGrli0mfK093wu/lirk0VT4k9twxH8vnQs3UhVa/EhYSetNJ
-----END RSA PRIVATE KEY-----
"""

HOST = "bitnami@hyfin.duckdns.org"
REMOTE_DIR = "/opt/bitnami/apache/htdocs/"
LOCAL_DIR = "/Users/huiyong/Desktop/Vibe Investment"
FILES = ["script.js", "proxy.php"]

key_path = os.path.join(LOCAL_DIR, "temp_deploy_key.pem")
with open(key_path, 'w') as f:
    f.write(KEY_CONTENT.strip() + '\n')
os.chmod(key_path, 0o600)

for fname in FILES:
    local_path = os.path.join(LOCAL_DIR, fname)
    cmd = [
        "scp", "-i", key_path,
        "-o", "StrictHostKeyChecking=no",
        local_path,
        f"{HOST}:{REMOTE_DIR}{fname}"
    ]
    print(f"Deploying {fname}...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"  OK: {fname} deployed")
    else:
        print(f"  FAIL: {result.stderr.strip()}")

os.unlink(key_path)
print("Done.")
