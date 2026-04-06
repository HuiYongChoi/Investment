require 'date'
require 'json'
require 'net/http'
require 'open3'
require 'rexml/document'
require 'time'
require 'tempfile'
require 'tmpdir'
require 'uri'
require 'webrick'

APP_ROOT = File.expand_path(__dir__)
AWS_FILE = File.join(APP_ROOT, 'AWS.txt')
YFINANCE_BRIDGE = File.join(APP_ROOT, 'yfinance_bridge.py')

DART_BASE = 'https://opendart.fss.or.kr/api'
KRX_BASE = 'https://data-dbg.krx.co.kr/svc/apis/sto'
KIWOOM_BASE = 'https://api.kiwoom.com'
KIWOOM_TOKEN_URL = 'https://api.kiwoom.com/oauth2/token'
NAVER_STOCK_BASE = 'https://m.stock.naver.com/api/stock'
GEMINI_MODEL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'].freeze
KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
KAKAO_USER_URL = 'https://kapi.kakao.com/v2/user/me'
COMPANY_DIRECTORY_CACHE = File.join(Dir.tmpdir, 'investment-navigator-company-directory.json')

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
KAKAO_CLIENT_SECRET = env_or_aws('KAKAO_CLIENT_SECRET', inline_prefix: 'Client Secret:')
KIWOOM_APP_KEY = ENV.fetch('KIWOOM_APP_KEY', '').strip
KIWOOM_SECRET_KEY = ENV.fetch('KIWOOM_SECRET_KEY', '').strip
KIWOOM_TOKEN_CACHE = File.join(Dir.tmpdir, 'investment-navigator-kiwoom-token.json')

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

def gemini_model_candidates(requested)
  (Array(requested) + GEMINI_MODELS).map { |model| model.to_s.strip }.reject(&:empty?).uniq
end

def extract_gold_usd_ounce(payload)
  if payload.is_a?(Array)
    payload.each do |item|
      next unless item.is_a?(Hash)
      gold_value = item['gold'].to_f
      return gold_value if gold_value.positive?
      price_value = item['price'].to_f
      return price_value if price_value.positive?
    end
  elsif payload.is_a?(Hash)
    gold_value = payload['gold'].to_f
    return gold_value if gold_value.positive?
    price_value = payload['price'].to_f
    return price_value if price_value.positive?
  end

  nil
end

def resolve_gold_usd_ounce
  loaders = [
    -> { parse_json(perform_request(method: :get, url: 'https://api.metals.live/v1/spot/gold')[:body]) },
    -> { parse_json(perform_request(method: :get, url: 'https://api.gold-api.com/price/XAU')[:body]) },
    -> { request_yfinance_bridge('quote', stock_code: 'GC=F', market: 'COMMODITY') }
  ]

  loaders.each do |load|
    begin
      value = extract_gold_usd_ounce(load.call)
      return value if value&.positive?
    rescue StandardError
      nil
    end
  end

  nil
end

def read_cached_company_directory(allow_stale: false)
  return nil unless File.readable?(COMPANY_DIRECTORY_CACHE)

  payload = parse_json(File.read(COMPANY_DIRECTORY_CACHE, encoding: 'UTF-8'))
  return nil unless payload.is_a?(Hash) && payload['directory'].is_a?(Array)

  cached_at = Time.parse(payload['cachedAt'].to_s)
  is_fresh = cached_at >= (Time.now - (12 * 60 * 60))
  return nil if !allow_stale && !is_fresh

  payload
rescue StandardError
  nil
end

def write_cached_company_directory(payload)
  File.write(COMPANY_DIRECTORY_CACHE, JSON.generate(payload))
  File.chmod(0o600, COMPANY_DIRECTORY_CACHE)
rescue StandardError
  nil
end

def build_company_directory_entries(xml_raw)
  document = REXML::Document.new(xml_raw)
  entries = []

  document.elements.each('result/list') do |node|
    stock_code = node.elements['stock_code']&.text.to_s.gsub(/\D/, '')
    next unless stock_code.length == 6

    name = node.elements['corp_name']&.text.to_s.strip
    next if name.empty?

    corp_code = node.elements['corp_code']&.text.to_s.strip
    corp_eng_name = node.elements['corp_eng_name']&.text.to_s.strip
    aliases = []
    aliases << corp_eng_name unless corp_eng_name.empty? || corp_eng_name.casecmp?(name)
    entries << {
      name: name,
      stockCode: stock_code,
      corpCode: corp_code,
      market: 'AUTO',
      aliases: aliases
    }
  end

  entries.sort_by { |entry| [entry[:name], entry[:stockCode]] }
end

def fetch_company_directory_payload
  raise 'DART API key is not configured' if DART_KEY.empty?

  upstream = perform_request(
    method: :get,
    url: "#{DART_BASE}/corpCode.xml",
    params: { 'crtfc_key' => DART_KEY }
  )

  xml_raw = Tempfile.create(%w[dart-corp .zip]) do |file|
    file.binmode
    file.write(upstream[:body])
    file.flush
    stdout, stderr, status = Open3.capture3('unzip', '-p', file.path, 'CORPCODE.xml')
    raise(stderr.to_s.empty? ? 'Unable to extract DART corpCode XML' : stderr.to_s) unless status.success?
    stdout
  end

  entries = build_company_directory_entries(xml_raw)
  payload = {
    live: true,
    source: 'dart_corp_code',
    cachedAt: Time.now.getlocal('+09:00').iso8601,
    count: entries.length,
    directory: entries
  }
  write_cached_company_directory(payload)
  payload
end

def company_directory_payload
  cached = read_cached_company_directory
  return cached if cached

  fetch_company_directory_payload
rescue StandardError => error
  stale = read_cached_company_directory(allow_stale: true)
  return stale.merge('stale' => true, 'error' => error.message) if stale

  {
    live: false,
    source: 'dart_corp_code',
    cachedAt: Time.now.getlocal('+09:00').iso8601,
    count: 0,
    directory: [],
    error: error.message
  }
end

def parse_kiwoom_expiry_timestamp(raw)
  value = raw.to_s.strip
  return (Time.now + (23 * 60 * 60)).to_i if value.empty?

  ['%Y%m%d%H%M%S', '%Y-%m-%d %H:%M:%S'].each do |format|
    begin
      return Time.strptime(value, format).to_i
    rescue ArgumentError
      next
    end
  end

  Time.parse(value).to_i
rescue ArgumentError
  (Time.now + (23 * 60 * 60)).to_i
end

def read_cached_kiwoom_token
  return {} unless File.readable?(KIWOOM_TOKEN_CACHE)

  payload = parse_json(File.read(KIWOOM_TOKEN_CACHE, encoding: 'UTF-8'))
  token = payload['token'].to_s.strip
  expires_ts = payload['expires_ts'].to_i
  return {} if token.empty? || expires_ts <= (Time.now.to_i + 300)

  payload
end

def write_cached_kiwoom_token(payload)
  File.write(KIWOOM_TOKEN_CACHE, JSON.generate(payload))
  File.chmod(0o600, KIWOOM_TOKEN_CACHE)
rescue StandardError
  nil
end

def invalidate_cached_kiwoom_token
  File.delete(KIWOOM_TOKEN_CACHE) if File.exist?(KIWOOM_TOKEN_CACHE)
rescue StandardError
  nil
end

def ensure_kiwoom_token(force_refresh: false)
  if KIWOOM_APP_KEY.empty? || KIWOOM_SECRET_KEY.empty?
    raise 'Kiwoom App Key/Secret가 설정되지 않았습니다.'
  end

  unless force_refresh
    cached = read_cached_kiwoom_token
    unless cached.empty?
      token_type = cached['token_type'].to_s.strip
      token_type = 'Bearer' if token_type.empty?
      return "#{token_type} #{cached['token']}"
    end
  end

  upstream = perform_request(
    method: :post,
    url: KIWOOM_TOKEN_URL,
    json_body: {
      grant_type: 'client_credentials',
      appkey: KIWOOM_APP_KEY,
      secretkey: KIWOOM_SECRET_KEY
    }
  )
  payload = parse_json(upstream[:body])
  token = payload['token'].to_s.strip
  raise(payload['return_msg'].to_s.empty? ? 'Kiwoom access token issuance failed' : payload['return_msg'].to_s) if upstream[:status] >= 400 || token.empty?

  token_type = payload['token_type'].to_s.strip
  token_type = 'Bearer' if token_type.empty?
  write_cached_kiwoom_token(
    'token' => token,
    'token_type' => token_type,
    'expires_dt' => payload['expires_dt'].to_s,
    'expires_ts' => parse_kiwoom_expiry_timestamp(payload['expires_dt'].to_s)
  )
  "#{token_type} #{token}"
end

def request_kiwoom_api(path, api_id, body, cont_yn: '', next_key: '', force_refresh: false)
  headers = {
    'Authorization' => ensure_kiwoom_token(force_refresh: force_refresh),
    'api-id' => api_id
  }
  headers['cont-yn'] = cont_yn unless cont_yn.to_s.empty?
  headers['next-key'] = next_key unless next_key.to_s.empty?

  upstream = perform_request(
    method: :post,
    url: "#{KIWOOM_BASE}#{path}",
    headers: headers,
    json_body: body
  )

  if [401, 403].include?(upstream[:status]) && !force_refresh
    invalidate_cached_kiwoom_token
    return request_kiwoom_api(path, api_id, body, cont_yn: cont_yn, next_key: next_key, force_refresh: true)
  end

  upstream
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

def yfinance_python_candidates
  configured = ENV.fetch('YFINANCE_PYTHON_BIN', '').strip
  candidates = [configured, 'python3', 'python'].reject(&:empty?)
  candidates.uniq
end

def run_yfinance_bridge(*args)
  yfinance_python_candidates.each do |python_bin|
    stdout, stderr, status = Open3.capture3(python_bin, YFINANCE_BRIDGE, *args.map(&:to_s), chdir: APP_ROOT)
    return { stdout: stdout, stderr: stderr, status: status.exitstatus } if status.exitstatus || status.success?
  rescue Errno::ENOENT
    next
  end

  {
    stdout: '',
    stderr: 'Python runtime was not found for yfinance bridge',
    status: 127
  }
end

def request_yfinance_bridge(command, query)
  args = [command]
  query.each do |key, value|
    next if value.to_s.empty?

    args << "--#{key.to_s.tr('_', '-')}"
    args << value.to_s
  end
  result = run_yfinance_bridge(*args)
  payload = result[:stdout].to_s.empty? ? {} : parse_json(result[:stdout].to_s)
  payload = {} unless payload.is_a?(Hash)
  payload['live'] = false if payload['live'].nil?
  payload['source'] ||= 'yfinance_python'
  if result[:status].to_i != 0 && payload['error'].to_s.empty?
    payload['error'] = result[:stderr].to_s.strip.empty? ? 'yfinance bridge failed' : result[:stderr].to_s.strip
  end
  payload
end

def kiwoom_chart_config(interval)
  case interval.to_s.strip.downcase
  when 'weekly'
    { interval: 'weekly', api_id: 'ka10082', series_key: 'stk_stk_pole_chart_qry', date_key: 'dt', time_key: '' }
  when 'minute'
    { interval: 'minute', api_id: 'ka10080', series_key: 'stk_min_pole_chart_qry', date_key: '', time_key: 'cntr_tm' }
  else
    { interval: 'daily', api_id: 'ka10081', series_key: 'stk_dt_pole_chart_qry', date_key: 'dt', time_key: '' }
  end
end

def kiwoom_chart_body(stock_code, config, end_date, adjusted, tick_scope)
  body = {
    'stk_cd' => stock_code,
    'upd_stkpc_tp' => adjusted.to_s == '0' ? '0' : '1'
  }

  if config[:interval] == 'minute'
    body['tic_scope'] = tick_scope.to_s.empty? ? '1' : tick_scope.to_s
    body['base_dt'] = end_date unless end_date.to_s.empty?
    return body
  end

  body['base_dt'] = end_date
  body
end

def kiwoom_row_date_token(row, config)
  if !config[:date_key].to_s.empty? && row[config[:date_key]]
    return row[config[:date_key]].to_s.gsub(/\D/, '')
  end
  if !config[:time_key].to_s.empty? && row[config[:time_key]]
    return row[config[:time_key]].to_s.gsub(/\D/, '')
  end

  ''
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

server.mount_proc '/kiwoom/quote' do |req, res|
  next unless with_cors(req, res)

  if KIWOOM_APP_KEY.empty? || KIWOOM_SECRET_KEY.empty?
    json_response(res, 200, live: false, error: 'Kiwoom App Key/Secret가 설정되지 않았습니다.')
    next
  end

  stock_code = (req.query['stock_code'] || '').strip
  if stock_code.empty?
    json_response(res, 400, error: 'stock_code 파라미터가 필요합니다.')
    next
  end

  begin
    upstream = request_kiwoom_api('/api/dostk/stkinfo', 'ka10001', { 'stk_cd' => stock_code })
    payload = parse_json(upstream[:body])
    payload['live'] = upstream[:status] < 400
    payload['source'] = 'kiwoom_rest'
    payload['fetched_at'] = Time.now.iso8601
    json_response(res, upstream[:status], payload)
  rescue StandardError => error
    json_response(res, 500, error: error.message)
  end
end

server.mount_proc '/kiwoom/chart' do |req, res|
  next unless with_cors(req, res)

  if KIWOOM_APP_KEY.empty? || KIWOOM_SECRET_KEY.empty?
    json_response(
      res,
      200,
      live: false,
      source: 'kiwoom_rest',
      error: 'Kiwoom App Key/Secret가 설정되지 않았습니다.',
      interval: (req.query['interval'] || 'daily').to_s.downcase,
      series_key: '',
      date_key: '',
      time_key: '',
      rows: []
    )
    next
  end

  stock_code = (req.query['stock_code'] || '').strip
  if stock_code.empty?
    json_response(res, 400, error: 'stock_code 파라미터가 필요합니다.', rows: [])
    next
  end

  interval = (req.query['interval'] || 'daily').strip.downcase
  start_date = (req.query['start_date'] || "#{Date.today.year}0101").gsub(/\D/, '')
  end_date = (req.query['end_date'] || Date.today.strftime('%Y%m%d')).gsub(/\D/, '')
  adjusted = (req.query['adjusted'] || '1').strip
  tick_scope = (req.query['tick_scope'] || '1').strip
  config = kiwoom_chart_config(interval)

  rows = []
  error_message = nil
  cont_yn = ''
  next_key = ''
  page = 0

  begin
    loop do
      page += 1
      upstream = request_kiwoom_api(
        '/api/dostk/chart',
        config[:api_id],
        kiwoom_chart_body(stock_code, config, end_date, adjusted, tick_scope),
        cont_yn: cont_yn,
        next_key: next_key
      )
      payload = parse_json(upstream[:body])

      if upstream[:status] >= 400
        error_message = payload['return_msg'].to_s
        error_message = payload['msg'].to_s if error_message.empty?
        error_message = 'Kiwoom chart request failed' if error_message.empty?
        break
      end

      chunk = payload[config[:series_key]] || []
      break unless chunk.is_a?(Array) && !chunk.empty?

      rows.concat(chunk)
      cont_yn = upstream[:headers]['cont-yn'].to_a.first.to_s.strip.upcase
      next_key = upstream[:headers]['next-key'].to_a.first.to_s.strip

      earliest = chunk.map { |row| kiwoom_row_date_token(row, config) }.reject(&:empty?).min
      break if cont_yn != 'Y' || next_key.empty?
      break if !start_date.empty? && earliest && earliest[0, 8] < start_date
      break if page >= 20
    end

    json_response(
      res,
      200,
      live: error_message.nil? && !rows.empty?,
      source: 'kiwoom_rest',
      error: error_message,
      interval: config[:interval],
      fetched_at: Time.now.iso8601,
      series_key: config[:series_key],
      date_key: config[:date_key],
      time_key: config[:time_key],
      rows: rows
    )
  rescue StandardError => error
    json_response(res, 500, error: error.message, rows: [])
  end
end

server.mount_proc '/yfinance/quote' do |req, res|
  next unless with_cors(req, res)

  stock_code = (req.query['stock_code'] || '').strip
  market = (req.query['market'] || 'KOSPI').strip
  name_hint = (req.query['name_hint'] || '').strip
  if stock_code.empty?
    json_response(res, 400, live: false, source: 'yfinance_python', error: 'stock_code 파라미터가 필요합니다.')
    next
  end

  payload = request_yfinance_bridge('quote', stock_code: stock_code, market: market, name_hint: name_hint)
  json_response(res, 200, payload)
end

server.mount_proc '/yfinance/chart' do |req, res|
  next unless with_cors(req, res)

  stock_code = (req.query['stock_code'] || '').strip
  market = (req.query['market'] || 'KOSPI').strip
  interval = (req.query['interval'] || 'daily').strip.downcase
  start_date = (req.query['start_date'] || "#{Date.today.year}0101").gsub(/\D/, '')
  end_date = (req.query['end_date'] || Date.today.strftime('%Y%m%d')).gsub(/\D/, '')
  name_hint = (req.query['name_hint'] || '').strip

  if stock_code.empty?
    json_response(res, 400, live: false, source: 'yfinance_python', error: 'stock_code 파라미터가 필요합니다.', rows: [])
    next
  end

  payload = request_yfinance_bridge(
    'chart',
    stock_code: stock_code,
    market: market,
    interval: interval,
    start_date: start_date,
    end_date: end_date,
    name_hint: name_hint
  )
  json_response(res, 200, payload)
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
    requested_models = body.is_a?(Hash) ? body.delete('models') : nil
    last_upstream = nil
    success_payload = nil
    success_status = nil

    gemini_model_candidates(requested_models).each do |model|
      upstream = perform_request(
        method: :post,
        url: "#{GEMINI_MODEL_BASE}/#{URI.encode_www_form_component(model)}:generateContent",
        params: { key: GEMINI_KEY },
        json_body: body
      )
      decoded = parse_json(upstream[:body])
      if upstream[:status] < 400 && decoded.dig('candidates', 0, 'content', 'parts', 0, 'text').to_s != ''
        decoded['modelUsed'] = model
        success_status = upstream[:status]
        success_payload = decoded
        break
      end

      last_upstream = {
        status: upstream[:status],
        body: decoded.is_a?(Hash) ? decoded.merge('modelTried' => model) : { 'raw' => upstream[:body], 'modelTried' => model }
      }
      next if upstream[:status] < 400

      break if upstream[:status] < 500 && ![404, 429].include?(upstream[:status])
    end

    if success_payload
      json_response(res, success_status, success_payload)
      next
    end

    if last_upstream
      json_response(res, last_upstream[:status], last_upstream[:body])
      next
    end

    json_response(res, 502, error: 'Gemini upstream request failed')
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
        client_secret: KAKAO_CLIENT_SECRET,
        redirect_uri: redirect_uri,
        code: code
      }.reject { |_key, value| value.to_s.strip.empty? }
    )
    payload = parse_json(upstream[:body])
    if upstream[:status].between?(200, 299) && payload.is_a?(Hash) && !payload['access_token'].to_s.empty?
        profile_upstream = perform_request(
          method: :get,
          url: KAKAO_USER_URL,
          headers: {
            'Authorization' => "Bearer #{payload['access_token'].to_s.strip}"
          }
        )
        if profile_upstream[:status].between?(200, 299)
          profile_payload = parse_json(profile_upstream[:body])
          if profile_payload.is_a?(Hash) && !profile_payload.empty?
            payload['profile'] = profile_payload
            upstream[:body] = JSON.generate(payload)
          end
        end
    end

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
    gold_usd_per_oz = resolve_gold_usd_ounce
    if gold_usd_per_oz && summary[:usdKrw]
      summary[:goldKrwPerGram] = (gold_usd_per_oz.to_f * summary[:usdKrw] / 31.1034768).round(2)
    end
  rescue StandardError
    nil
  end

  json_response(res, 200, summary)
end

server.mount_proc '/company-directory' do |req, res|
  next unless with_cors(req, res)

  json_response(res, 200, company_directory_payload)
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
    kiwoom: !KIWOOM_APP_KEY.empty? && !KIWOOM_SECRET_KEY.empty?,
    yfinance: true,
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
puts "Kiwoom key: #{KIWOOM_APP_KEY.empty? || KIWOOM_SECRET_KEY.empty? ? 'MISSING' : 'OK'}"
puts "yfinance bridge: #{File.exist?(YFINANCE_BRIDGE) ? 'OK' : 'MISSING'}"
puts "KRX key: #{KRX_KEY.empty? ? 'MISSING' : 'OK'}"
puts "Gemini key: #{GEMINI_KEY.empty? ? 'MISSING' : 'OK'}"
puts "Kakao REST key: #{KAKAO_REST_KEY.empty? ? 'MISSING' : 'OK'}"
puts '=' * 60

server.start
