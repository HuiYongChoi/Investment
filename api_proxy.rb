require 'date'
require 'json'
require 'net/http'
require 'uri'
require 'webrick'

APP_ROOT = File.expand_path(__dir__)
AWS_FILE = File.join(APP_ROOT, 'AWS.txt')

DART_BASE = 'https://opendart.fss.or.kr/api'
KRX_BASE = 'https://data-dbg.krx.co.kr/svc/apis/sto'
NAVER_STOCK_BASE = 'https://m.stock.naver.com/api/stock'
GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token'

def aws_lines
  @aws_lines ||= File.exist?(AWS_FILE) ? File.readlines(AWS_FILE, chomp: true, encoding: 'UTF-8').map(&:strip) : []
end

def read_next_value(label)
  index = aws_lines.find_index { |line| line.include?(label) }
  return '' unless index

  aws_lines[(index + 1)..].to_a.find { |line| !line.empty? && !line.start_with?('[', '#') } || ''
end

def read_inline_value(prefix)
  line = aws_lines.find { |entry| entry.start_with?(prefix) }
  return '' unless line

  line.split(':', 2).last.to_s.strip
end

def env_or_aws(env_name, next_label: nil, inline_prefix: nil)
  value = ENV[env_name].to_s.strip
  return value unless value.empty?
  return read_inline_value(inline_prefix) if inline_prefix
  return read_next_value(next_label) if next_label

  ''
end

DART_KEY = env_or_aws('DART_API_KEY', next_label: 'DART 오픈 API')
KRX_KEY = env_or_aws('KRX_AUTH_KEY', next_label: 'KRX Open API')
GEMINI_KEY = env_or_aws('GEMINI_API_KEY', next_label: 'Gemini API KEY')
KAKAO_REST_KEY = env_or_aws('KAKAO_REST_API_KEY', inline_prefix: 'Rest API:')

def json_response(res, status, payload)
  res.status = status
  res['Content-Type'] = 'application/json; charset=utf-8'
  res.body = JSON.generate(payload)
end

def with_cors(req, res)
  origin = req['Origin'] || '*'
  res['Access-Control-Allow-Origin'] = origin
  res['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  res['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  res['Vary'] = 'Origin'
  return true unless req.request_method == 'OPTIONS'

  res.status = 200
  res.body = ''
  false
end

def perform_request(method:, url:, params: nil, headers: {}, json_body: nil, form_body: nil)
  uri = URI.parse(url)
  uri.query = URI.encode_www_form(params) if params && !params.empty?

  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == 'https')
  http.open_timeout = 12
  http.read_timeout = 20

  request =
    case method
    when :get then Net::HTTP::Get.new(uri.request_uri)
    when :post then Net::HTTP::Post.new(uri.request_uri)
    else raise ArgumentError, "Unsupported method #{method}"
    end

  headers.each { |key, value| request[key] = value }

  if json_body
    request['Content-Type'] ||= 'application/json'
    request.body = JSON.generate(json_body)
  elsif form_body
    request['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8'
    request.body = URI.encode_www_form(form_body)
  end

  response = http.request(request)
  {
    status: response.code.to_i,
    body: response.body.to_s,
    headers: response.to_hash
  }
end

def parse_json(body)
  JSON.parse(body)
rescue JSON::ParserError
  { 'raw' => body }
end

def business_dates(start_date, end_date)
  dates = []
  cursor = start_date
  while cursor <= end_date
    dates << cursor if (1..5).cover?(cursor.wday)
    cursor += 1
  end
  dates
end

def krx_api_id_for(market)
  case market.to_s.upcase
  when 'KOSDAQ' then 'ksq_bydd_trd'
  when 'KONEX' then 'knx_bydd_trd'
  else 'stk_bydd_trd'
  end
end

def normalize_krx_item(item)
  open = item['TDD_OPNPRC'].to_i
  close = item['TDD_CLSPRC'].to_i
  change = item['CMPPREVDD_PRC'].to_i
  {
    date: item['BAS_DD'],
    open: open,
    high: item['TDD_HGPRC'].to_i,
    low: item['TDD_LWPRC'].to_i,
    close: close,
    volume: item['ACC_TRDVOL'].to_i,
    change: change,
    changePct: item['FLUC_RT'].to_f,
    listedShares: item['LIST_SHRS'].to_i
  }
end

server = WEBrick::HTTPServer.new(
  Port: 8081,
  BindAddress: '0.0.0.0',
  Logger: WEBrick::Log.new($stderr, WEBrick::Log::INFO),
  AccessLog: []
)

server.mount_proc '/dart' do |req, res|
  next unless with_cors(req, res)

  if DART_KEY.empty?
    json_response(res, 503, error: 'DART API 키가 설정되지 않았습니다.')
    next
  end

  endpoint = req.path.sub('/dart', '')
  params = req.query.dup
  params['crtfc_key'] = DART_KEY

  begin
    upstream = perform_request(method: :get, url: "#{DART_BASE}#{endpoint}", params: params)
    res.status = upstream[:status]
    res['Content-Type'] = 'application/json; charset=utf-8'
    res.body = upstream[:body]
  rescue StandardError => error
    json_response(res, 500, error: error.message)
  end
end

server.mount_proc '/krx/chart' do |req, res|
  next unless with_cors(req, res)

  if KRX_KEY.empty?
    json_response(res, 200, live: false, error: 'KRX 인증키가 설정되지 않았습니다.', points: [])
    next
  end

  stock_code = (req.query['stock_code'] || req.query['isu_cd'] || '').strip
  market = (req.query['market'] || 'KOSPI').strip
  start_date = Date.strptime(req.query['start_date'] || "#{Date.today.year}0101", '%Y%m%d')
  end_date = Date.strptime(req.query['end_date'] || Date.today.strftime('%Y%m%d'), '%Y%m%d')
  dates = business_dates(start_date, end_date)

  if stock_code.empty?
    json_response(res, 400, error: 'stock_code 파라미터가 필요합니다.', points: [])
    next
  end

  api_id = krx_api_id_for(market)
  series = []
  auth_error = nil

  dates.each do |date|
    begin
      upstream = perform_request(
        method: :get,
        url: "#{KRX_BASE}/#{api_id}",
        params: { 'basDd' => date.strftime('%Y%m%d') },
        headers: { 'AUTH_KEY' => KRX_KEY }
      )
      payload = parse_json(upstream[:body])

      if payload['respCode'] == '401'
        auth_error = 'KRX Open API 인증키가 승인되지 않았거나 권한이 없습니다.'
        break
      end

      items = payload['OutBlock_1'] || []
      row = items.find { |item| item['ISU_CD'].to_s == stock_code }
      series << normalize_krx_item(row) if row
    rescue StandardError => error
      auth_error = error.message
      break
    end
  end

  json_response(
    res,
    200,
    live: auth_error.nil? && !series.empty?,
    source: 'krx_open_api',
    error: auth_error,
    points: series
  )
end

server.mount_proc '/krx' do |req, res|
  next unless with_cors(req, res)

  if KRX_KEY.empty?
    json_response(res, 503, error: 'KRX 인증키가 설정되지 않았습니다.')
    next
  end

  endpoint = req.path.sub('/krx', '')
  begin
    upstream = perform_request(
      method: :get,
      url: "#{KRX_BASE}#{endpoint}",
      params: req.query,
      headers: { 'AUTH_KEY' => KRX_KEY }
    )
    res.status = upstream[:status]
    res['Content-Type'] = 'application/json; charset=utf-8'
    res.body = upstream[:body]
  rescue StandardError => error
    json_response(res, 500, error: error.message)
  end
end

server.mount_proc '/gemini' do |req, res|
  next unless with_cors(req, res)

  if GEMINI_KEY.empty?
    json_response(res, 503, error: 'Gemini API 키가 설정되지 않았습니다.')
    next
  end

  begin
    body = parse_json(req.body.to_s)
    upstream = perform_request(
      method: :post,
      url: GEMINI_BASE,
      params: { key: GEMINI_KEY },
      json_body: body
    )
    res.status = upstream[:status]
    res['Content-Type'] = 'application/json; charset=utf-8'
    res.body = upstream[:body]
  rescue StandardError => error
    json_response(res, 500, error: error.message)
  end
end

server.mount_proc '/kakao/token' do |req, res|
  next unless with_cors(req, res)

  if KAKAO_REST_KEY.empty?
    json_response(res, 503, error: 'Kakao REST API 키가 설정되지 않았습니다.')
    next
  end

  begin
    payload = parse_json(req.body.to_s)
    code = payload['code'].to_s
    redirect_uri = payload['redirectUri'].to_s

    if code.empty? || redirect_uri.empty?
      json_response(res, 400, error: 'code와 redirectUri가 필요합니다.')
      next
    end

    upstream = perform_request(
      method: :post,
      url: KAKAO_TOKEN_URL,
      form_body: {
        grant_type: 'authorization_code',
        client_id: KAKAO_REST_KEY,
        redirect_uri: redirect_uri,
        code: code
      }
    )

    res.status = upstream[:status]
    res['Content-Type'] = 'application/json; charset=utf-8'
    res.body = upstream[:body]
  rescue StandardError => error
    json_response(res, 500, error: error.message)
  end
end

server.mount_proc '/market/summary' do |req, res|
  next unless with_cors(req, res)

  summary = {
    usdKrw: nil,
    jpyKrw: nil,
    goldKrwPerGram: nil
  }

  begin
    fx = parse_json(perform_request(method: :get, url: 'https://open.er-api.com/v6/latest/USD')[:body])
    usd_krw = fx.dig('rates', 'KRW')
    usd_jpy = fx.dig('rates', 'JPY')
    summary[:usdKrw] = usd_krw.to_f if usd_krw
    summary[:jpyKrw] = usd_krw.to_f / usd_jpy.to_f if usd_krw && usd_jpy.to_f.positive?
  rescue StandardError
    nil
  end

  begin
    gold_payload = parse_json(perform_request(method: :get, url: 'https://api.metals.live/v1/spot/gold')[:body])
    gold_usd_per_oz =
      if gold_payload.is_a?(Array)
        item = gold_payload.find { |entry| entry.is_a?(Hash) && entry.key?('gold') }
        item&.fetch('gold', nil)
      elsif gold_payload.is_a?(Hash)
        gold_payload['gold']
      end

    if gold_usd_per_oz && summary[:usdKrw]
      summary[:goldKrwPerGram] = (gold_usd_per_oz.to_f * summary[:usdKrw] / 31.1034768).round(2)
    end
  rescue StandardError
    nil
  end

  json_response(res, 200, summary)
end

server.mount_proc '/market/quote' do |req, res|
  next unless with_cors(req, res)

  stock_code = (req.query['stock_code'] || '').strip
  if stock_code.empty?
    json_response(res, 400, error: 'stock_code 파라미터가 필요합니다.')
    next
  end

  begin
    upstream = perform_request(method: :get, url: "#{NAVER_STOCK_BASE}/#{URI.encode_www_form_component(stock_code)}/basic")
    res.status = upstream[:status]
    res['Content-Type'] = 'application/json; charset=utf-8'
    res.body = upstream[:body]
  rescue StandardError => error
    json_response(res, 500, error: error.message)
  end
end

server.mount_proc '/' do |req, res|
  next unless with_cors(req, res)

  json_response(
    res,
    200,
    service: 'Investment Navigator proxy',
    dart: !DART_KEY.empty?,
    krx: !KRX_KEY.empty?,
    gemini: !GEMINI_KEY.empty?,
    kakao: !KAKAO_REST_KEY.empty?
  )
end

trap('INT') { server.shutdown }

puts '=' * 60
puts 'Investment Navigator Unified Proxy'
puts "Port: 8081"
puts "DART key: #{DART_KEY.empty? ? 'MISSING' : 'OK'}"
puts "KRX key: #{KRX_KEY.empty? ? 'MISSING' : 'OK'}"
puts "Gemini key: #{GEMINI_KEY.empty? ? 'MISSING' : 'OK'}"
puts "Kakao REST key: #{KAKAO_REST_KEY.empty? ? 'MISSING' : 'OK'}"
puts '=' * 60

server.start
