require 'webrick'
require 'net/http'
require 'uri'
require 'json'

# =====================================================
# FinLit Unified Proxy Server (v1.0)
# Handles CORS and keeps API Keys secure (Server-side)
# =====================================================

DART_BASE = 'https://opendart.fss.or.kr/api'
KRX_BASE = 'https://data-dbg.krx.co.kr/svc/apis/sto'
GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

# Keys from Environment Variables (Recommended for Production/GitHub)
DART_KEY = ENV['DART_API_KEY'] || ''
KRX_KEY = ENV['KRX_AUTH_KEY'] || ''
GEMINI_KEY = ENV['GEMINI_API_KEY'] || ''

def api_call(base_url, endpoint, params, headers = {})
  uri = URI.parse("#{base_url}#{endpoint}")
  uri.query = URI.encode_www_form(params) unless params.empty?
  
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  http.open_timeout = 10
  http.read_timeout = 15

  req = Net::HTTP::Get.new(uri.request_uri)
  headers.each { |k, v| req[k] = v }

  res = http.request(req)
  res.body
rescue => e
  { error: e.message }.to_json
end

server = WEBrick::HTTPServer.new(
  Port: 8081,
  Logger: WEBrick::Log.new($stderr, WEBrick::Log::INFO),
  AccessLog: []
)

# Common CORS logic
def setup_cors(req, res)
  res['Access-Control-Allow-Origin'] = '*'
  res['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  res['Access-Control-Allow-Headers'] = 'Content-Type, AUTH_KEY'
  req.request_method == 'OPTIONS'
end

# -----------------------------------------------------
# DART Proxy
# -----------------------------------------------------
server.mount_proc '/dart' do |req, res|
  next if setup_cors(req, res)
  
  endpoint = req.path.sub('/dart', '')
  params = req.query.dup
  params['crtfc_key'] = DART_KEY # Inject key on server side
  
  res['Content-Type'] = 'application/json; charset=utf-8'
  res.body = api_call(DART_BASE, endpoint, params)
end

# -----------------------------------------------------
# KRX Proxy
# -----------------------------------------------------
server.mount_proc '/krx' do |req, res|
  next if setup_cors(req, res)
  
  endpoint = req.path.sub('/krx', '')
  params = req.query
  headers = { 'AUTH_KEY' => KRX_KEY }
  
  res['Content-Type'] = 'application/json; charset=utf-8'
  res.body = api_call(KRX_BASE, endpoint, params, headers)
end

# -----------------------------------------------------
# Gemini Proxy (POST)
# -----------------------------------------------------
server.mount_proc '/gemini' do |req, res|
  next if setup_cors(req, res)

  uri = URI.parse("#{GEMINI_BASE}?key=#{GEMINI_KEY}")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  
  post_req = Net::HTTP::Post.new(uri.request_uri, { 'Content-Type' => 'application/json' })
  post_req.body = req.body
  
  begin
    gemini_res = http.request(post_req)
    res.status = gemini_res.code.to_i
    res['Content-Type'] = 'application/json; charset=utf-8'
    res.body = gemini_res.body
  rescue => e
    res.status = 500
    res.body = { error: e.message }.to_json
  end
end

# Backward compatibility for root DART calls if any
server.mount_proc '/' do |req, res|
  next if setup_cors(req, res)
  if req.path == '/' || req.path == ''
     res.body = "FinLit Proxy Server v1.0 is running."
  else
     # Redirect or proxy root DART style calls
     params = req.query.dup
     params['crtfc_key'] = DART_KEY
     res['Content-Type'] = 'application/json; charset=utf-8'
     res.body = api_call(DART_BASE, req.path, params)
  end
end

trap('INT') { server.shutdown }
puts "=" * 50
puts " 🧭 FinLit Unified Proxy Server (v1.0)"
puts " Port: 8081"
puts " Keys: DART(#{DART_KEY.empty? ? 'MISSING' : 'OK'}), KRX(#{KRX_KEY.empty? ? 'MISSING' : 'OK'}), GEMINI(#{GEMINI_KEY.empty? ? 'MISSING' : 'OK'})"
puts "=" * 50
server.start
