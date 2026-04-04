(function (root) {
    function normalizeSearch(value) {
        return String(value || '').toLowerCase().replace(/\s+/g, '');
    }

    function parseNumberText(value) {
        if (value === null || value === undefined) return null;
        const normalized = String(value).replace(/,/g, '').trim();
        if (!normalized) return null;
        const numeric = Number(normalized);
        return Number.isFinite(numeric) ? numeric : null;
    }

    function percentage(numerator, denominator) {
        if (!denominator) return 0;
        return (numerator / denominator) * 100;
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

    function matchCompanies(directory, rawQuery, limit) {
        const max = limit || 8;
        const query = normalizeSearch(rawQuery);
        if (!query) return directory.slice(0, max);

        return directory
            .filter((entry) => {
                const haystacks = [entry.name, entry.stockCode, ...entry.aliases].map(normalizeSearch);
                return haystacks.some((item) => item.includes(query) || item.startsWith(query));
            })
            .slice(0, max);
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

    root.InvestmentLogic = {
        buildBusinessDateTokens,
        buildCompanyDirectory,
        generateAnchoredSyntheticChart,
        getQuarterlyReportConfigs,
        matchCompanies,
        normalizePublicQuote,
        sortPeriods
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
