(function (root) {
    function normalizeSearch(value) {
        return String(value || '').toLowerCase().replace(/\s+/g, '');
    }

    const KAKAO_STORAGE_KEYS = Object.freeze({
        token: 'invest_nav_kakao_token',
        error: 'invest_nav_kakao_error',
        returnUrl: 'invest_nav_kakao_return_url'
    });

    function parseNumberText(value) {
        if (value === null || value === undefined) return null;
        const normalized = String(value).replace(/,/g, '').trim();
        if (!normalized) return null;
        const numeric = Number(normalized);
        return Number.isFinite(numeric) ? numeric : null;
    }

    function parseSignedNumberText(value) {
        return parseNumberText(value);
    }

    function parsePriceText(value) {
        const numeric = parseSignedNumberText(value);
        return numeric === null ? null : Math.abs(numeric);
    }

    function buildYahooSymbol(stockCode, market) {
        const raw = String(stockCode || '').trim().toUpperCase();
        if (!raw) return '';
        if (raw.includes('.')) return raw;

        const digits = raw.replace(/\D/g, '');
        if (digits.length === 6 && digits === raw) {
            return `${digits}.${String(market || '').toUpperCase() === 'KOSDAQ' ? 'KQ' : 'KS'}`;
        }

        return raw;
    }

    function normalizeDateToken(value) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits.slice(0, 8);
    }

    function percentage(numerator, denominator) {
        if (!denominator) return 0;
        return (numerator / denominator) * 100;
    }

    function describePriceDelta(price, referencePrice) {
        const current = parseNumberText(price);
        const reference = parseNumberText(referencePrice);
        if (current === null || reference === null || !reference) {
            return {
                change: null,
                changePct: null,
                direction: 'flat'
            };
        }

        const change = current - reference;
        return {
            change,
            changePct: percentage(change, reference),
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
        };
    }

    function numericSeed(value) {
        return String(value).split('').reduce((seed, char, index) => seed + (char.charCodeAt(0) * (index + 11)), 0);
    }

    function buildBusinessDateTokens(startToken, endToken) {
        const tokens = [];
        const start = new Date(`${startToken.slice(0, 4)}-${startToken.slice(4, 6)}-${startToken.slice(6, 8)}T00:00:00+09:00`);
        const end = new Date(`${endToken.slice(0, 4)}-${endToken.slice(4, 6)}-${endToken.slice(6, 8)}T00:00:00+09:00`);
        for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
            const day = cursor.getDay();
            if (day === 0 || day === 6) continue;
            const year = cursor.getFullYear();
            const month = String(cursor.getMonth() + 1).padStart(2, '0');
            const date = String(cursor.getDate()).padStart(2, '0');
            tokens.push(`${year}${month}${date}`);
        }
        return tokens;
    }

    function buildCompanyDirectory(companyMap) {
        const byStockCode = new Map();
        Object.entries(companyMap).forEach(([name, info]) => {
            const stockCode = info.stockCode;
            if (!byStockCode.has(stockCode)) {
                byStockCode.set(stockCode, {
                    name,
                    stockCode,
                    corpCode: info.corpCode,
                    market: info.market,
                    aliases: [name]
                });
                return;
            }
            const current = byStockCode.get(stockCode);
            if (!current.aliases.includes(name)) current.aliases.push(name);
        });

        return Array.from(byStockCode.values()).map((entry) => ({
            ...entry,
            displayLabel: `${entry.name} · ${entry.stockCode}`
        }));
    }

    function normalizeCompanyDirectoryEntry(entry) {
        const name = String(entry?.name || '').trim();
        const stockCode = String(entry?.stockCode ?? entry?.stock_code ?? '').trim();
        if (!name || !stockCode) return null;

        const aliasCandidates = Array.isArray(entry?.aliases) ? entry.aliases : [];
        const aliases = Array.from(new Set(
            [name, ...aliasCandidates]
                .map((item) => String(item || '').trim())
                .filter(Boolean)
        ));

        return {
            name,
            stockCode,
            corpCode: String(entry?.corpCode ?? entry?.corp_code ?? '').trim(),
            market: String(entry?.market || 'AUTO').trim().toUpperCase() || 'AUTO',
            aliases,
            displayLabel: `${name} · ${stockCode}`
        };
    }

    function mergeCompanyDirectories(primaryDirectory, fallbackDirectory) {
        const merged = new Map();

        function applyEntries(entries, preferred) {
            (entries || []).forEach((item) => {
                const entry = normalizeCompanyDirectoryEntry(item);
                if (!entry) return;

                if (!merged.has(entry.stockCode)) {
                    merged.set(entry.stockCode, entry);
                    return;
                }

                const current = merged.get(entry.stockCode);
                const aliasSet = new Set([...(current.aliases || []), ...(entry.aliases || [])]);
                const next = {
                    ...current,
                    aliases: Array.from(aliasSet)
                };

                if (preferred) {
                    next.name = entry.name || current.name;
                    next.displayLabel = `${next.name} · ${next.stockCode}`;
                }
                if (!next.corpCode && entry.corpCode) next.corpCode = entry.corpCode;
                if ((!next.market || next.market === 'AUTO') && entry.market) next.market = entry.market;
                if (!next.aliases.includes(next.name)) next.aliases.unshift(next.name);
                merged.set(entry.stockCode, next);
            });
        }

        applyEntries(fallbackDirectory, false);
        applyEntries(primaryDirectory, true);

        return Array.from(merged.values()).sort((left, right) => (
            left.name.localeCompare(right.name) || left.stockCode.localeCompare(right.stockCode)
        ));
    }

    function matchCompanies(directory, rawQuery, limit) {
        const max = limit || 8;
        const query = normalizeSearch(rawQuery);
        if (!query) return directory.slice(0, max);

        return directory
            .map((entry) => {
                const haystacks = [entry.name, entry.stockCode, ...(entry.aliases || [])]
                    .map(normalizeSearch)
                    .filter(Boolean);
                let rank = Infinity;
                haystacks.forEach((item) => {
                    if (item === query) rank = Math.min(rank, 0);
                    else if (item.startsWith(query)) rank = Math.min(rank, 1);
                    else if (item.includes(query)) rank = Math.min(rank, 2);
                });
                return { entry, rank };
            })
            .filter((item) => Number.isFinite(item.rank))
            .sort((left, right) => (
                left.rank - right.rank
                || left.entry.name.length - right.entry.name.length
                || left.entry.name.localeCompare(right.entry.name)
            ))
            .map((item) => item.entry)
            .slice(0, max);
    }

    function pickTrailingCompanyMatch(directory, rawQuery, limit) {
        const query = String(rawQuery || '').trim();
        if (!query) return null;
        const matches = matchCompanies(Array.isArray(directory) ? directory : [], query, limit);
        return matches.length ? matches[matches.length - 1] : null;
    }

    function moveSuggestionSelectionIndex(currentIndex, itemCount, step) {
        const size = Number(itemCount) || 0;
        if (size <= 0) return -1;

        const offset = Number(step) || 0;
        if (!offset) return Math.min(Math.max(Number(currentIndex) || 0, 0), size - 1);

        const baseIndex = Number.isInteger(currentIndex) ? currentIndex : -1;
        const normalizedBase = baseIndex >= 0 ? baseIndex : (offset > 0 ? -1 : 0);
        return (normalizedBase + offset + size) % size;
    }

    function normalizePublicQuote(payload) {
        const afterMarket = payload && payload.overMarketPriceInfo ? payload.overMarketPriceInfo : null;
        const sessionClose = parseNumberText(payload?.closePrice);
        const afterClose = parseNumberText(afterMarket?.overPrice);
        const useAfterMarket = sessionClose === null && afterClose !== null;
        const close = useAfterMarket ? afterClose : (sessionClose ?? afterClose ?? 0);
        const change = parseNumberText(
            useAfterMarket ? afterMarket?.compareToPreviousClosePrice : payload?.compareToPreviousClosePrice
        ) ?? parseNumberText(afterMarket?.compareToPreviousClosePrice) ?? 0;
        const changePct = Number(
            useAfterMarket ? (afterMarket?.fluctuationsRatio ?? 0) : (payload?.fluctuationsRatio ?? afterMarket?.fluctuationsRatio ?? 0)
        );
        return {
            close,
            sessionClose: sessionClose ?? 0,
            extendedClose: afterClose,
            change: change ?? 0,
            changePct,
            asOf: useAfterMarket ? (afterMarket?.localTradedAt || payload?.localTradedAt || '') : (payload?.localTradedAt || afterMarket?.localTradedAt || ''),
            source: 'naver_public_quote'
        };
    }

    function normalizeKiwoomQuote(payload, fetchedAt) {
        return {
            name: String(payload?.stk_nm || '').trim(),
            close: parsePriceText(payload?.cur_prc) ?? 0,
            change: parseSignedNumberText(payload?.pred_pre) ?? 0,
            changePct: parseSignedNumberText(payload?.flu_rt) ?? 0,
            open: parsePriceText(payload?.open_pric) ?? 0,
            high: parsePriceText(payload?.high_pric) ?? 0,
            low: parsePriceText(payload?.low_pric) ?? 0,
            volume: parsePriceText(payload?.trde_qty) ?? 0,
            asOf: fetchedAt || payload?.fetched_at || '',
            source: 'kiwoom_rest'
        };
    }

    function normalizeYfinanceQuote(payload, fetchedAt) {
        const close = parseNumberText(
            payload?.currentPrice ?? payload?.regularMarketPrice ?? payload?.lastPrice ?? payload?.close
        ) ?? 0;
        const previousClose = parseNumberText(
            payload?.previousClose ?? payload?.regularMarketPreviousClose ?? payload?.chartPreviousClose
        );
        const explicitChange = parseSignedNumberText(payload?.change ?? payload?.regularMarketChange);
        const explicitChangePct = parseSignedNumberText(payload?.changePct ?? payload?.regularMarketChangePercent);
        const change = explicitChange ?? (previousClose !== null ? close - previousClose : 0);
        const changePct = explicitChangePct ?? (previousClose ? percentage(change, previousClose) : 0);

        return {
            name: String(payload?.shortName ?? payload?.longName ?? payload?.name ?? '').trim(),
            symbol: String(payload?.symbol ?? '').trim(),
            close,
            previousClose: previousClose ?? 0,
            change,
            changePct,
            open: parseNumberText(payload?.open ?? payload?.regularMarketOpen ?? payload?.dayOpen) ?? 0,
            high: parseNumberText(payload?.dayHigh ?? payload?.high ?? payload?.regularMarketDayHigh) ?? 0,
            low: parseNumberText(payload?.dayLow ?? payload?.low ?? payload?.regularMarketDayLow) ?? 0,
            volume: parseNumberText(payload?.volume ?? payload?.regularMarketVolume ?? payload?.lastVolume) ?? 0,
            asOf: String(payload?.regularMarketTime ?? payload?.asOf ?? fetchedAt ?? ''),
            source: 'yfinance_python'
        };
    }

    function normalizeKiwoomChartRows(rows, options) {
        const config = options || {};
        const dateKey = config.dateKey || 'dt';
        const timeKey = config.timeKey || '';
        const startDate = config.startDate || '';

        return (rows || [])
            .map((row) => {
                const rawDate = String(row?.[dateKey] || row?.date || '').replace(/\D/g, '');
                const rawTime = timeKey ? String(row?.[timeKey] || '').replace(/\D/g, '') : '';
                const date = (rawDate || rawTime).slice(0, 8);
                if (!date) return null;

                return {
                    date,
                    time: rawTime,
                    open: parsePriceText(row?.open_pric) ?? 0,
                    high: parsePriceText(row?.high_pric) ?? 0,
                    low: parsePriceText(row?.low_pric) ?? 0,
                    close: parsePriceText(row?.cur_prc ?? row?.close_pric) ?? 0,
                    volume: parsePriceText(row?.trde_qty) ?? 0,
                    change: parseSignedNumberText(row?.pred_pre ?? row?.pre) ?? 0,
                    changePct: parseSignedNumberText(row?.trde_tern_rt ?? row?.flu_rt) ?? 0,
                    listedShares: 0
                };
            })
            .filter((point) => point && (!startDate || point.date >= startDate))
            .sort((left, right) => {
                const leftKey = `${left.date}${left.time || ''}`;
                const rightKey = `${right.date}${right.time || ''}`;
                return leftKey.localeCompare(rightKey);
            });
    }

    function normalizeYfinanceChartRows(rows, options) {
        const config = options || {};
        const startDate = config.startDate || '';

        const parsed = (rows || [])
            .map((row) => ({
                date: normalizeDateToken(row?.date ?? row?.Date ?? row?.dt),
                time: String(row?.time ?? row?.Time ?? ''),
                open: parseNumberText(row?.open ?? row?.Open) ?? 0,
                high: parseNumberText(row?.high ?? row?.High) ?? 0,
                low: parseNumberText(row?.low ?? row?.Low) ?? 0,
                close: parseNumberText(row?.close ?? row?.Close) ?? 0,
                volume: parseNumberText(row?.volume ?? row?.Volume) ?? 0,
                previousClose: parseNumberText(
                    row?.previousClose ?? row?.previous_close ?? row?.chartPreviousClose
                ),
                change: parseSignedNumberText(row?.change ?? row?.Change),
                changePct: parseSignedNumberText(row?.changePct ?? row?.change_pct ?? row?.ChangePercent),
                listedShares: parseNumberText(row?.listedShares ?? row?.listed_shares) ?? 0
            }))
            .filter((point) => point.date)
            .sort((left, right) => {
                const leftKey = `${left.date}${left.time || ''}`;
                const rightKey = `${right.date}${right.time || ''}`;
                return leftKey.localeCompare(rightKey);
            });

        return parsed
            .map((point, index) => {
                const previousClose = point.previousClose ?? parsed[index - 1]?.close ?? null;
                const change = point.change ?? (previousClose !== null ? point.close - previousClose : point.close - point.open);
                const base = previousClose ?? point.open;
                const changePct = point.changePct ?? (base ? percentage(change, base) : 0);
                return {
                    date: point.date,
                    time: point.time,
                    open: point.open,
                    high: point.high,
                    low: point.low,
                    close: point.close,
                    volume: point.volume,
                    change,
                    changePct,
                    listedShares: point.listedShares
                };
            })
            .filter((point) => !startDate || point.date >= startDate);
    }

    function tokenToDate(value) {
        const token = normalizeDateToken(value);
        if (!token || token.length !== 8) return null;
        return new Date(Number(token.slice(0, 4)), Number(token.slice(4, 6)) - 1, Number(token.slice(6, 8)));
    }

    function chartWeekKey(token) {
        const date = tokenToDate(token);
        if (!date) return '';
        const pivot = new Date(date.getTime());
        const day = pivot.getDay() || 7;
        pivot.setDate(pivot.getDate() + 4 - day);
        const yearStart = new Date(pivot.getFullYear(), 0, 1);
        const week = Math.ceil((((pivot - yearStart) / 86400000) + 1) / 7);
        return `${pivot.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }

    function chartBucketKey(token, granularity) {
        const normalized = normalizeDateToken(token);
        if (!normalized) return '';
        if (granularity === 'week') return chartWeekKey(normalized);
        if (granularity === 'month') return normalized.slice(0, 6);
        if (granularity === 'year') return normalized.slice(0, 4);
        return normalized;
    }

    function aggregateChartPoints(points, granularity) {
        const mode = String(granularity || 'day').toLowerCase();
        const sorted = (points || [])
            .filter((point) => normalizeDateToken(point?.date))
            .map((point) => ({
                ...point,
                date: normalizeDateToken(point.date)
            }))
            .sort((left, right) => left.date.localeCompare(right.date));

        if (!sorted.length || mode === 'day') return sorted;

        const groups = new Map();
        sorted.forEach((point) => {
            const key = chartBucketKey(point.date, mode);
            if (!key) return;

            if (!groups.has(key)) {
                groups.set(key, { ...point });
                return;
            }

            const bucket = groups.get(key);
            bucket.high = Math.max(bucket.high ?? point.high ?? 0, point.high ?? 0);
            bucket.low = Math.min(bucket.low ?? point.low ?? 0, point.low ?? 0);
            bucket.close = point.close;
            bucket.volume = (bucket.volume ?? 0) + (point.volume ?? 0);
            bucket.date = point.date;
            bucket.time = point.time || bucket.time || '';
            bucket.listedShares = point.listedShares ?? bucket.listedShares ?? 0;
        });

        return Array.from(groups.values()).map((point) => {
            const change = (point.close ?? 0) - (point.open ?? 0);
            return {
                ...point,
                change,
                changePct: point.open ? percentage(change, point.open) : 0
            };
        });
    }

    function resolveChartSeries(dailyPoints, range, options) {
        const mode = String(range || 'DAY').toUpperCase();
        const config = options || {};
        const currentYear = Number(config.currentYear || 0)
            || Number(String(config.currentDateToken || '').slice(0, 4))
            || new Date().getFullYear();
        const sorted = aggregateChartPoints(dailyPoints, 'day');

        if (mode === 'WEEK') return aggregateChartPoints(sorted, 'week');
        if (mode === 'MONTH') return aggregateChartPoints(sorted, 'month');
        if (mode === 'YEAR') return aggregateChartPoints(sorted, 'year');
        if (mode === 'YTD') return sorted.filter((point) => Number(point.date.slice(0, 4)) === currentYear);
        return sorted;
    }

    function normalizeChartWindow(totalPoints, startIndex, windowSize, minPoints) {
        const total = Math.max(0, Math.round(Number(totalPoints) || 0));
        if (!total) return { start: 0, end: 0 };

        const safeMin = Math.max(1, Math.min(total, Math.round(Number(minPoints) || 1)));
        const safeSize = Math.max(safeMin, Math.min(total, Math.round(Number(windowSize) || total)));
        let start = Math.max(0, Math.round(Number(startIndex) || 0));
        if (start + safeSize > total) start = total - safeSize;
        return { start, end: start + safeSize };
    }

    function zoomChartWindow(window, totalPoints, factor, anchorRatio, minPoints) {
        const current = normalizeChartWindow(
            totalPoints,
            window?.start ?? 0,
            (window?.end ?? totalPoints) - (window?.start ?? 0),
            minPoints
        );
        const total = Math.max(0, Math.round(Number(totalPoints) || 0));
        if (!total) return current;

        const safeFactor = Number(factor) || 1;
        const safeAnchor = Math.max(0, Math.min(1, Number(anchorRatio) || 0));
        const size = current.end - current.start;
        const nextSize = Math.max(
            Math.max(1, Math.min(total, Math.round(Number(minPoints) || 1))),
            Math.min(total, Math.round(size * safeFactor))
        );
        const anchorIndex = current.start + (size * safeAnchor);
        const nextStart = Math.round(anchorIndex - (nextSize * safeAnchor));
        return normalizeChartWindow(total, nextStart, nextSize, minPoints);
    }

    function panChartWindow(window, deltaPoints, totalPoints) {
        const current = normalizeChartWindow(
            totalPoints,
            window?.start ?? 0,
            (window?.end ?? totalPoints) - (window?.start ?? 0),
            1
        );
        return normalizeChartWindow(totalPoints, current.start + (Number(deltaPoints) || 0), current.end - current.start, 1);
    }

    function resolveChartTooltipLayout(options) {
        const config = options || {};
        const bounds = config.bounds || {};
        const gap = Math.max(0, Number(config.gap) || 0);
        const boxWidth = Math.max(0, Number(config.boxWidth) || 0);
        const boxHeight = Math.max(0, Number(config.boxHeight) || 0);
        const left = Number(bounds.left) || 0;
        const top = Number(bounds.top) || 0;
        const right = Math.max(left, Number(bounds.right) || left);
        const bottom = Math.max(top, Number(bounds.bottom) || top);
        const anchorX = Number(config.anchorX) || left;
        const anchorY = Number(config.anchorY) || top;

        const availableRight = right - anchorX;
        const availableLeft = anchorX - left;
        const preferRight = availableRight >= boxWidth + gap || availableRight >= availableLeft;
        const x = preferRight
            ? Math.min(anchorX + gap, right - boxWidth)
            : Math.max(left, anchorX - gap - boxWidth);
        const y = Math.min(Math.max(anchorY, top), Math.max(top, bottom - boxHeight));

        return {
            x,
            y,
            side: preferRight ? 'right' : 'left'
        };
    }

    function generateAnchoredSyntheticChart(options) {
        const stockCode = options.stockCode;
        const startDate = options.startDate;
        const endDate = options.endDate;
        const anchorClose = options.anchorClose || 0;
        const anchorChange = options.anchorChange ?? null;
        const baseHints = options.baseHints || {};
        const tokens = buildBusinessDateTokens(startDate, endDate);
        const base = anchorClose || baseHints[stockCode] || ((numericSeed(stockCode) % 180000) + 12000);
        let lastClose = base;
        let phase = numericSeed(`${stockCode}-phase`) % 7;

        const points = tokens.map((dateToken, index) => {
            phase += 1;
            const wave = Math.sin((index + phase) / 6) * 0.012;
            const drift = ((numericSeed(`${stockCode}-${index}`) % 13) - 6) / 1000;
            const open = Math.max(1000, Math.round(lastClose * (1 + drift / 2)));
            const close = Math.max(1000, Math.round(open * (1 + wave + drift)));
            const high = Math.max(open, close) + Math.round(Math.abs(close - open) * 0.4 + base * 0.004);
            const low = Math.min(open, close) - Math.round(Math.abs(close - open) * 0.35 + base * 0.003);
            const volume = Math.round((numericSeed(`vol-${stockCode}-${index}`) % 4000000) + 600000);
            const change = close - open;
            const changePct = open ? percentage(change, open) : 0;
            lastClose = close;
            return {
                date: dateToken,
                open,
                high,
                low: Math.max(500, low),
                close,
                volume,
                change,
                changePct,
                listedShares: 0
            };
        });

        if (!points.length || !anchorClose) return points;

        const currentTail = points[points.length - 1];
        const scale = currentTail.close ? anchorClose / currentTail.close : 1;
        const scaled = points.map((point) => {
            const open = Math.max(1000, Math.round(point.open * scale));
            const high = Math.max(1000, Math.round(point.high * scale));
            const low = Math.max(500, Math.round(point.low * scale));
            const close = Math.max(1000, Math.round(point.close * scale));
            const change = close - open;
            return {
                ...point,
                open,
                high,
                low,
                close,
                change,
                changePct: open ? percentage(change, open) : 0
            };
        });

        const latest = scaled[scaled.length - 1];
        latest.close = anchorClose;
        if (anchorChange !== null) {
            latest.open = Math.max(1000, anchorClose - anchorChange);
        }
        latest.high = Math.max(latest.high, latest.open, latest.close);
        latest.low = Math.max(500, Math.min(latest.low, latest.open, latest.close));
        latest.change = latest.close - latest.open;
        latest.changePct = latest.open ? percentage(latest.change, latest.open) : 0;
        return scaled;
    }

    function getQuarterlyReportConfigs() {
        return [
            { code: '11011', label: '4분기', rank: 4, period: 'Q4', annual: true },
            { code: '11014', label: '3분기', rank: 3, period: 'Q3', annual: false },
            { code: '11012', label: '반기', rank: 2, period: 'Q2', annual: false },
            { code: '11013', label: '1분기', rank: 1, period: 'Q1', annual: false }
        ];
    }

    function sortPeriods(periods) {
        return periods.slice().sort((left, right) => right.sortKey - left.sortKey);
    }

    function parseAbsoluteUrl(value) {
        const match = String(value || '').trim().match(/^(https?):\/\/([^\/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i);
        if (!match) return null;

        return {
            origin: `${match[1].toLowerCase()}://${match[2]}`,
            path: match[3] || '/',
            query: match[4] || '',
            hash: match[5] || ''
        };
    }

    function resolveAbsoluteUrl(candidate, currentUrl) {
        const base = parseAbsoluteUrl(currentUrl) || parseAbsoluteUrl('https://example.com/index.html');
        const value = String(candidate || '').trim();
        if (!value) return '';

        const absolute = parseAbsoluteUrl(value);
        if (absolute) {
            return `${absolute.origin}${absolute.path}${absolute.query}${absolute.hash}`;
        }

        if (value.startsWith('/')) {
            return `${base.origin}${value}`;
        }

        const directory = base.path.endsWith('/')
            ? base.path
            : base.path.slice(0, base.path.lastIndexOf('/') + 1);
        return `${base.origin}${directory}${value}`;
    }

    function resolveKakaoRedirectUri(currentUrl) {
        return resolveAbsoluteUrl('auth/kakao/callback', currentUrl || 'https://example.com/index.html');
    }

    function resolveKakaoCallbackUri(currentUrl) {
        const parsed = parseAbsoluteUrl(currentUrl) || parseAbsoluteUrl('https://example.com/auth/kakao/callback');
        return `${parsed.origin}${parsed.path}`;
    }

    function resolveKakaoReturnUrl(candidate, currentUrl) {
        const base = parseAbsoluteUrl(currentUrl) || parseAbsoluteUrl('https://example.com/kakao_callback.php');
        const fallback = `${base.origin}/index.html`;
        if (!candidate) return fallback;

        const resolved = resolveAbsoluteUrl(candidate, fallback);
        const parsed = parseAbsoluteUrl(resolved);
        return parsed && parsed.origin === base.origin ? resolved : fallback;
    }

    function clearKakaoSessionState(storage, auth) {
        if (storage && typeof storage.removeItem === 'function') {
            storage.removeItem(KAKAO_STORAGE_KEYS.token);
            storage.removeItem(KAKAO_STORAGE_KEYS.error);
            storage.removeItem(KAKAO_STORAGE_KEYS.returnUrl);
        }

        if (auth && typeof auth.setAccessToken === 'function') {
            auth.setAccessToken(null);
        }
    }

    root.InvestmentLogic = {
        aggregateChartPoints,
        buildBusinessDateTokens,
        buildCompanyDirectory,
        buildYahooSymbol,
        chartBucketKey,
        clearKakaoSessionState,
        describePriceDelta,
        generateAnchoredSyntheticChart,
        getQuarterlyReportConfigs,
        matchCompanies,
        mergeCompanyDirectories,
        moveSuggestionSelectionIndex,
        normalizeChartWindow,
        normalizeKiwoomChartRows,
        normalizeKiwoomQuote,
        normalizePublicQuote,
        normalizeYfinanceChartRows,
        normalizeYfinanceQuote,
        panChartWindow,
        resolveChartTooltipLayout,
        resolveChartSeries,
        resolveKakaoCallbackUri,
        resolveKakaoRedirectUri,
        resolveKakaoReturnUrl,
        sortPeriods,
        pickTrailingCompanyMatch,
        zoomChartWindow
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
