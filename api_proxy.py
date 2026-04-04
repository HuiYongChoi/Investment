import http.server
import urllib.request
import json
import urllib.parse

# API Keys from AWS.txt
DART_KEY = '514cd3e14517d866beb2f548754bb57863abc166'
KRX_KEY = '812F15DFD36448AF932465ADC001FB12556DFA38'
GEMINI_KEY = 'AIzaSyAjGEtSEmZDBsqkJZIn66Jte5H8v2lq6OM'

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        self.handle_proxy('GET')

    def do_POST(self):
        self.handle_proxy('POST')

    def handle_proxy(self, method):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        params = urllib.parse.parse_qs(parsed_path.query)
        params = {k: v[0] for k, v in params.items()}

        target_url = ""
        headers = {}

        if path.startswith('/dart/'):
            target_url = f"https://opendart.fss.or.kr/api{path[5:]}"
            params['crtfc_key'] = DART_KEY
        elif path.startswith('/krx/'):
            target_url = f"https://data-dbg.krx.co.kr/svc/apis/sto{path[4:]}"
            headers['AUTH_KEY'] = KRX_KEY
        elif path.startswith('/gemini'):
            target_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_KEY}"
        else:
            self.send_response(404)
            self.end_headers()
            return

        if params:
            target_url += ("&" if "?" in target_url else "?") + urllib.parse.urlencode(params)

        try:
            req_data = None
            if method == 'POST':
                content_length = int(self.headers.get('Content-Length', 0))
                req_data = self.rfile.read(content_length)

            req = urllib.request.Request(target_url, data=req_data, method=method)
            for k, v in headers.items():
                req.add_header(k, v)
            if 'Content-Type' in self.headers:
                req.add_header('Content-Type', self.headers['Content-Type'])

            with urllib.request.urlopen(req) as response:
                self.send_response(response.status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
                self.end_headers()
                self.wfile.write(response.read())
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode())

if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', 8081), ProxyHandler)
    print("Python Proxy listening on 8081...")
    server.serve_forever()
