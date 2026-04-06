(function (root) {
    function normalizeSearch(value) {
        return String(value || '').toLowerCase().replace(/\s+/g, '');
    }

    const KAKAO_STORAGE_KEYS = Object.freeze({
        token: 'invest_nav_kakao_token',
        error: 'invest_nav_kakao_error',
        returnUrl: 'invest_nav_kakao_return_url',
        profile: 'invest_nav_kakao_profile'
    });

    const VALUATION_SECTOR_PRESETS = Object.freeze({
        intelligent_machines: Object.freeze({
            key: 'intelligent_machines',
            label: '지능형 기계 (AI/반도체/로봇)',
            targetPer: 22,
            requiredReturn: 6,
            premiumRate: 25,
            badgeText: 'AI 슈퍼사이클 할증 +25%',
            guideText: 'AI 슈퍼사이클 및 로보틱스 융합 가치 할증 적용 중',
            badgeTone: 'sector-badge-ai'
        }),
        biotech_innovation: Object.freeze({
            key: 'biotech_innovation',
            label: '바이오/혁신신약',
            targetPer: 35,
            requiredReturn: 12,
            premiumRate: 40,
            badgeText: '혁신 파이프라인 프리미엄 +40%',
            guideText: '임상 파이프라인 및 미래 신약 특허 가치 집중 반영 중',
            badgeTone: 'sector-badge-bio'
        }),
        growth_platform: Object.freeze({
            key: 'growth_platform',
            label: '일반 성장주/플랫폼',
            targetPer: 25,
            requiredReturn: 8,
            premiumRate: 20,
            badgeText: '플랫폼 성장 프리미엄 +20%',
            guideText: '산업 표준 멀티플 및 유무형 자산 가치 반영 중',
            badgeTone: 'sector-badge-growth'
        }),
        value_dividend: Object.freeze({
            key: 'value_dividend',
            label: '가치주/배당주',
            targetPer: 8,
            requiredReturn: 9,
            premiumRate: 0,
            badgeText: '현금흐름 프리미엄 0%',
            guideText: '보수적 자산 가치 및 현금흐름 기반 밸류에이션 적용 중',
            badgeTone: 'sector-badge-value'
        }),
        general_manufacturing: Object.freeze({
            key: 'general_manufacturing',
            label: '일반 제조',
            targetPer: 12,
            requiredReturn: 8,
            premiumRate: 10,
            badgeText: '제조 프리미엄 +10%',
            guideText: '산업 표준 멀티플 및 유무형 자산 가치 반영 중',
            badgeTone: 'sector-badge-industrial'
        })
    });

    const STATEMENT_ACCOUNT_ALIASES = Object.freeze({
        revenue: Object.freeze(['매출액', '영업수익', '수익(매출액)', '보험영업수익']),
        operatingIncome: Object.freeze(['영업이익', '영업손실']),
        netIncome: Object.freeze(['당기순이익', '당기순손익', '분기순이익', '반기순이익', '연결당기순이익', '당기순이익(손실)']),
        assets: Object.freeze(['자산총계']),
        liabilities: Object.freeze(['부채총계']),
        equity: Object.freeze(['자본총계']),
        cash: Object.freeze(['현금및현금성자산', '현금성자산']),
        currentAssets: Object.freeze(['유동자산']),
        currentLiabilities: Object.freeze(['유동부채']),
        inventory: Object.freeze(['재고자산']),
        receivables: Object.freeze(['매출채권', '매출채권및기타채권', '매출채권 및 기타채권']),
        financeCost: Object.freeze(['이자비용', '금융비용', '금융원가']),
        operatingCashFlow: Object.freeze(['영업활동현금흐름', '영업활동으로인한현금흐름'])
    });

    const BALANCE_SHEET_KEYS = Object.freeze([
        'assets',
        'liabilities',
        'equity',
        'cash',
        'currentAssets',
        'currentLiabilities',
        'inventory',
        'receivables'
    ]);

    const FLOW_KEYS = Object.freeze([
        'revenue',
        'operatingIncome',
        'netIncome',
        'financeCost',
        'operatingCashFlow'
    ]);

    function parseNumberText(value) {
        if (value === null || value === undefined) return null;
        const normalized = String(value).replace(/,/g, '').trim();
        if (!normalized) return null;
        const numeric = Number(normalized);
        return Number.isFinite(numeric) ? numeric : null;
    }

    function parseFormattedNumber(value) {
        return parseNumberText(value) ?? 0;
    }

    function parseStatementAmount(value) {
        if (value === null || value === undefined) return 0;
        const normalized = String(value).replace(/,/g, '').trim();
        if (!normalized || normalized === '-') return 0;
        const negative = normalized.includes('(') && normalized.includes(')');
        const numeric = Number(normalized.replace(/[()]/g, ''));
        if (!Number.isFinite(numeric)) return 0;
        return negative ? -numeric : numeric;
    }

    function normalizeAccountName(value) {
        return String(value || '').replace(/\s+/g, '').replace(/[()]/g, '');
    }

    function getFsDiv(row) {
        return String(row?.fs_div ?? row?.div_cd ?? '').trim().toUpperCase();
    }

    function getStatementSection(row) {
        return String(row?.sj_div ?? '').trim().toUpperCase();
    }

    function getStatementName(row) {
        return String(row?.sj_nm ?? '').trim();
    }

    function safeDivide(numerator, denominator) {
        if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || !denominator) return null;
        return numerator / denominator;
    }

    function findStatementAmount(list, aliases) {
        const rows = Array.isArray(list) ? list : [];
        const normalizedAliases = (aliases || []).map(normalizeAccountName);
        const match = rows.find((item) => {
            const accountName = normalizeAccountName(item?.account_nm || item?.accountName || '');
            return normalizedAliases.some((alias) => accountName.includes(alias));
        });
        if (!match) return 0;
        return parseStatementAmount(match.thstrm_amount ?? match.amount ?? match.value);
    }

    function selectPreferredFsRows(list) {
        const rows = Array.isArray(list) ? list.filter(Boolean) : [];
        const cfsRows = rows.filter((row) => getFsDiv(row) === 'CFS');
        if (cfsRows.length) return cfsRows;

        const ofsRows = rows.filter((row) => getFsDiv(row) === 'OFS');
        if (ofsRows.length) return ofsRows;

        return rows;
    }

    function filterStatementRowsByMetric(list, metricKey) {
        const rows = selectPreferredFsRows(list);
        const sectionPredicate = (() => {
            if (metricKey === 'operatingCashFlow') {
                return (row) => getStatementSection(row) === 'CF' || getStatementName(row).includes('현금흐름');
            }
            if (BALANCE_SHEET_KEYS.includes(metricKey)) {
                return (row) => getStatementSection(row) === 'BS' || getStatementName(row).includes('재무상태표');
            }
            return (row) => ['IS', 'CIS'].includes(getStatementSection(row)) || /(손익계산서|포괄손익계산서)/.test(getStatementName(row));
        })();

        const filtered = rows.filter(sectionPredicate);
        return filtered.length ? filtered : rows;
    }

    function summarizeStatement(list) {
        const revenue = findStatementAmount(filterStatementRowsByMetric(list, 'revenue'), STATEMENT_ACCOUNT_ALIASES.revenue);
        const operatingIncome = findStatementAmount(filterStatementRowsByMetric(list, 'operatingIncome'), STATEMENT_ACCOUNT_ALIASES.operatingIncome);
        const netIncome = findStatementAmount(filterStatementRowsByMetric(list, 'netIncome'), STATEMENT_ACCOUNT_ALIASES.netIncome);
        const assets = findStatementAmount(filterStatementRowsByMetric(list, 'assets'), STATEMENT_ACCOUNT_ALIASES.assets);
        const liabilities = findStatementAmount(filterStatementRowsByMetric(list, 'liabilities'), STATEMENT_ACCOUNT_ALIASES.liabilities);
        const equity = findStatementAmount(filterStatementRowsByMetric(list, 'equity'), STATEMENT_ACCOUNT_ALIASES.equity);
        const cash = findStatementAmount(filterStatementRowsByMetric(list, 'cash'), STATEMENT_ACCOUNT_ALIASES.cash);
        const currentAssets = findStatementAmount(filterStatementRowsByMetric(list, 'currentAssets'), STATEMENT_ACCOUNT_ALIASES.currentAssets);
        const currentLiabilities = findStatementAmount(filterStatementRowsByMetric(list, 'currentLiabilities'), STATEMENT_ACCOUNT_ALIASES.currentLiabilities);
        const inventory = findStatementAmount(filterStatementRowsByMetric(list, 'inventory'), STATEMENT_ACCOUNT_ALIASES.inventory);
        const receivables = findStatementAmount(filterStatementRowsByMetric(list, 'receivables'), STATEMENT_ACCOUNT_ALIASES.receivables);
        const financeCost = findStatementAmount(filterStatementRowsByMetric(list, 'financeCost'), STATEMENT_ACCOUNT_ALIASES.financeCost);
        const operatingCashFlow = findStatementAmount(filterStatementRowsByMetric(list, 'operatingCashFlow'), STATEMENT_ACCOUNT_ALIASES.operatingCashFlow);

        const operatingMargin = percentage(operatingIncome, revenue);
        const netMargin = percentage(netIncome, revenue);
        const debtRatio = percentage(liabilities, equity);
        const roe = percentage(netIncome, equity);
        const roa = percentage(netIncome, assets);
        const assetTurnover = safeDivide(revenue, assets);
        const currentRatio = percentage(currentAssets, currentLiabilities);
        const inventoryTurnover = safeDivide(revenue, inventory);
        const receivableTurnover = safeDivide(revenue, receivables);
        const interestCoverage = financeCost ? safeDivide(operatingIncome, Math.abs(financeCost)) : null;

        return {
            revenue,
            operatingIncome,
            netIncome,
            assets,
            liabilities,
            equity,
            cash,
            currentAssets,
            currentLiabilities,
            inventory,
            receivables,
            financeCost,
            operatingCashFlow,
            operatingMargin,
            netMargin,
            debtRatio,
            roe,
            roa,
            assetTurnover,
            currentRatio,
            inventoryTurnover,
            receivableTurnover,
            interestCoverage
        };
    }

    function recomputeSummaryRatios(summary) {
        const source = summary || {};
        const revenue = parseNumberText(source.revenue) ?? 0;
        const operatingIncome = parseNumberText(source.operatingIncome) ?? 0;
        const netIncome = parseNumberText(source.netIncome) ?? 0;
        const assets = parseNumberText(source.assets) ?? 0;
        const liabilities = parseNumberText(source.liabilities) ?? 0;
        const equity = parseNumberText(source.equity) ?? 0;
        const currentAssets = parseNumberText(source.currentAssets) ?? 0;
        const currentLiabilities = parseNumberText(source.currentLiabilities) ?? 0;
        const inventory = parseNumberText(source.inventory) ?? 0;
        const receivables = parseNumberText(source.receivables) ?? 0;
        const financeCost = parseNumberText(source.financeCost) ?? 0;

        return {
            ...source,
            operatingMargin: percentage(operatingIncome, revenue),
            netMargin: percentage(netIncome, revenue),
            debtRatio: percentage(liabilities, equity),
            roe: percentage(netIncome, equity),
            roa: percentage(netIncome, assets),
            assetTurnover: safeDivide(revenue, assets),
            currentRatio: percentage(currentAssets, currentLiabilities),
            inventoryTurnover: safeDivide(revenue, inventory),
            receivableTurnover: safeDivide(revenue, receivables),
            interestCoverage: financeCost ? safeDivide(operatingIncome, Math.abs(financeCost)) : null
        };
    }

    function createSyntheticQuarterSummary(baseSummary, overrides) {
        return recomputeSummaryRatios({
            ...(baseSummary || {}),
            ...(overrides || {})
        });
    }

    function subtractQuarterValues(currentSummary, previousSummary, balanceSheetBaseSummary) {
        const base = balanceSheetBaseSummary || currentSummary || {};
        const overrides = {};
        FLOW_KEYS.forEach((key) => {
            const currentValue = parseNumberText(currentSummary?.[key]);
            if (!Number.isFinite(currentValue)) return;
            const previousValue = parseNumberText(previousSummary?.[key]) ?? 0;
            overrides[key] = currentValue - previousValue;
        });
        return createSyntheticQuarterSummary(base, overrides);
    }

    function sumQuarterField(periods, key) {
        return (periods || []).reduce((sum, period) => sum + (parseNumberText(period?.summary?.[key]) ?? 0), 0);
    }

    function normalizeQuarterlySummaries(rawQuarterPeriods, annualSummary) {
        const q1 = rawQuarterPeriods.find((period) => period.period === 'Q1');
        const q2 = rawQuarterPeriods.find((period) => period.period === 'Q2');
        const q3 = rawQuarterPeriods.find((period) => period.period === 'Q3');
        const available = [q1, q2, q3].filter(Boolean);

        const annualRevenue = parseNumberText(annualSummary?.revenue) ?? 0;
        const rawRevenueSum = sumQuarterField(available, 'revenue');
        const cumulativeLabelDetected = available.some((period) => {
            const label = String(period?.label || '').trim();
            const reportLabel = String(period?.list?.[0]?.thstrm_nm || '').trim();
            return /누적/.test(label) || /누적/.test(reportLabel);
        });
        const usesCumulativeMode = cumulativeLabelDetected || (annualRevenue > 0 && rawRevenueSum > annualRevenue * 1.05);

        const normalized = [];
        if (q1) {
            normalized.push({ ...q1, summary: q1.summary });
        }
        if (q2) {
            normalized.push({
                ...q2,
                summary: usesCumulativeMode && q1
                    ? subtractQuarterValues(q2.summary, q1.summary, q2.summary)
                    : q2.summary
            });
        }
        if (q3) {
            normalized.push({
                ...q3,
                summary: usesCumulativeMode && q2
                    ? subtractQuarterValues(q3.summary, q2.summary, q3.summary)
                    : q3.summary
            });
        }

        return {
            periods: normalized,
            usesCumulativeMode
        };
    }

    function buildDartAnnualPeriods(rawPeriods, limit = 3) {
        return (Array.isArray(rawPeriods) ? rawPeriods : [])
            .filter((period) => String(period?.reportCode || '').trim() === '11011' || period?.period === 'ANNUAL')
            .map((period) => ({
                ...period,
                period: 'ANNUAL',
                summary: period.summary || summarizeStatement(period.list)
            }))
            .sort((left, right) => (right.year || 0) - (left.year || 0))
            .slice(0, limit);
    }

    function buildDartQuarterlyPeriods(rawPeriods) {
        const grouped = new Map();
        (Array.isArray(rawPeriods) ? rawPeriods : []).forEach((period) => {
            if (!period || !period.year) return;
            const prepared = {
                ...period,
                summary: period.summary || summarizeStatement(period.list)
            };
            if (!grouped.has(prepared.year)) {
                grouped.set(prepared.year, []);
            }
            grouped.get(prepared.year).push(prepared);
        });

        const timeline = [];
        Array.from(grouped.keys()).sort((left, right) => right - left).forEach((year) => {
            const periods = grouped.get(year) || [];
            const annualPeriod = periods.find((item) => String(item.reportCode || '').trim() === '11011' || item.period === 'Q4' || item.period === 'ANNUAL');
            const rawQuarterPeriods = periods
                .filter((item) => ['Q1', 'Q2', 'Q3'].includes(String(item.period || '')))
                .sort((left, right) => (left.rank || 0) - (right.rank || 0));

            const normalizedQuarterPack = normalizeQuarterlySummaries(rawQuarterPeriods, annualPeriod?.summary || null);
            timeline.push(...normalizedQuarterPack.periods);

            if (annualPeriod && normalizedQuarterPack.periods.length) {
                const q4Summary = normalizedQuarterPack.usesCumulativeMode
                    ? subtractQuarterValues(annualPeriod.summary, rawQuarterPeriods.find((item) => item.period === 'Q3')?.summary || null, annualPeriod.summary)
                    : createSyntheticQuarterSummary(annualPeriod.summary, {
                        revenue: (parseNumberText(annualPeriod.summary?.revenue) ?? 0) - sumQuarterField(normalizedQuarterPack.periods, 'revenue'),
                        operatingIncome: (parseNumberText(annualPeriod.summary?.operatingIncome) ?? 0) - sumQuarterField(normalizedQuarterPack.periods, 'operatingIncome'),
                        netIncome: (parseNumberText(annualPeriod.summary?.netIncome) ?? 0) - sumQuarterField(normalizedQuarterPack.periods, 'netIncome')
                    });

                timeline.push({
                    ...annualPeriod,
                    label: `${year} 4분기`,
                    period: 'Q4',
                    rank: 4,
                    sortKey: year * 10 + 4,
                    isAnnual: false,
                    derived: true,
                    summary: q4Summary
                });
            }
        });

        return sortPeriods(timeline.map((period) => ({
            ...period,
            sortKey: period.sortKey || ((period.year || 0) * 10 + (period.rank || 0))
        })));
    }

    function mean(values) {
        const numbers = (values || []).filter((value) => Number.isFinite(value));
        if (!numbers.length) return null;
        return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    }

    function stdDev(values, average) {
        const numbers = (values || []).filter((value) => Number.isFinite(value));
        if (numbers.length < 2 || !Number.isFinite(average)) return null;
        const variance = numbers.reduce((sum, value) => sum + ((value - average) ** 2), 0) / numbers.length;
        return variance > 0 ? Math.sqrt(variance) : null;
    }

    function zScore(value, values) {
        if (!Number.isFinite(value)) return null;
        const average = mean(values);
        const deviation = stdDev(values, average);
        if (!Number.isFinite(average) || !Number.isFinite(deviation) || deviation === 0) return null;
        return (value - average) / deviation;
    }

    function detectAnomalies(currentSummary, pastSummariesArray) {
        if (!currentSummary || typeof currentSummary !== 'object') return [];

        const pastSummaries = (Array.isArray(pastSummariesArray) ? pastSummariesArray : [])
            .filter((item) => item && typeof item === 'object');
        const warnings = [];

        const currentNetIncome = parseNumberText(currentSummary.netIncome);
        const currentOperatingCashFlow = parseNumberText(currentSummary.operatingCashFlow);
        const positiveNetIncome = Number.isFinite(currentNetIncome) && currentNetIncome > 0;

        if (positiveNetIncome && Number.isFinite(currentOperatingCashFlow) && currentOperatingCashFlow < 0) {
            warnings.push('흑자부도 위험: 순이익은 흑자이지만 영업활동현금흐름이 적자입니다. 이익의 현금화가 약합니다.');
        }

        const currentCashConversion = positiveNetIncome
            ? safeDivide(currentOperatingCashFlow, currentNetIncome)
            : null;
        const pastCashConversions = pastSummaries
            .filter((item) => Number.isFinite(item.netIncome) && item.netIncome > 0)
            .map((item) => safeDivide(item.operatingCashFlow, item.netIncome))
            .filter((value) => Number.isFinite(value));
        const cashConversionZ = zScore(currentCashConversion, pastCashConversions);
        if (cashConversionZ !== null && cashConversionZ < -1.5) {
            warnings.push('흑자부도 위험: 영업현금흐름/순이익 비율이 과거 대비 급락했습니다. 이익의 질 저하를 점검해야 합니다.');
        }

        const inventoryTurnoverZ = zScore(parseNumberText(currentSummary.inventoryTurnover), pastSummaries.map((item) => item.inventoryTurnover));
        if (inventoryTurnoverZ !== null && inventoryTurnoverZ < -1.5) {
            warnings.push('악성 재고 위험: 재고자산회전율이 과거 평균 대비 급락했습니다. 재고 누적 가능성을 점검해야 합니다.');
        }

        const receivableTurnoverZ = zScore(parseNumberText(currentSummary.receivableTurnover), pastSummaries.map((item) => item.receivableTurnover));
        if (receivableTurnoverZ !== null && receivableTurnoverZ < -1.5) {
            warnings.push('가짜 매출 위험: 매출채권회전율이 과거 평균 대비 급락했습니다. 매출 인식과 회수 지연 여부를 점검해야 합니다.');
        }

        return warnings;
    }

    function formatWonInputValue(value) {
        const raw = String(value || '').trim();
        const negative = raw.startsWith('-');
        const digits = raw.replace(/\D/g, '');
        if (!digits) return '';
        const formatted = Number.parseInt(digits, 10).toLocaleString('en-US');
        return negative ? `-${formatted}` : formatted;
    }

    function resolveBaseValuationVariables(values) {
        const source = values || {};
        const manualEps = parseFormattedNumber(source.adjustedEps);
        const forwardEps = parseFormattedNumber(source.forwardEps);
        const trailingEps = parseFormattedNumber(source.trailingEps);
        const manualPer = parseNumberText(source.targetPer) ?? 0;
        const forwardPer = parseNumberText(source.forwardPer) ?? 0;
        const epsSource = manualEps ? 'manual' : forwardEps ? 'forward' : trailingEps ? 'ttm' : 'none';
        const forwardOverheat = forwardEps > 0 && trailingEps > 0 && forwardEps >= (trailingEps * 1.5);

        return {
            baseEPS: manualEps || forwardEps || trailingEps || 0,
            basePER: manualPer || forwardPer || 0,
            usingManualEps: manualEps > 0,
            usingManualPer: manualPer > 0,
            epsSource,
            forwardOverheat
        };
    }

    function resolveValuationSectorPreset(key) {
        const normalizedKey = String(key || '').trim();
        return VALUATION_SECTOR_PRESETS[normalizedKey] || null;
    }

    function computeValuationOutputs(values) {
        const source = values || {};
        const currentPrice = parseFormattedNumber(source.currentPrice);
        const baseEPS = parseFormattedNumber(source.baseEPS);
        const basePER = parseNumberText(source.basePER) ?? 0;
        const bps = parseFormattedNumber(source.bps);
        const roePct = parseNumberText(source.roe) ?? 0;
        const growthPct = parseNumberText(source.epsGrowth) ?? 0;
        const requiredReturnPct = parseNumberText(source.requiredReturn) ?? 0;
        const premiumRatePct = parseNumberText(source.premiumRate) ?? 0;
        const lossMaking = baseEPS < 0;

        const perFairValueRaw = baseEPS > 0 && basePER > 0 ? baseEPS * basePER : 0;
        const perFairValue = perFairValueRaw ? Math.round(perFairValueRaw) : 0;
        const finalTargetPriceRaw = lossMaking ? 0 : perFairValue * (1 + (premiumRatePct / 100));
        const finalTargetPrice = finalTargetPriceRaw ? Math.round(finalTargetPriceRaw) : 0;
        const pegRatio = growthPct > 0 && basePER > 0 ? basePER / growthPct : null;
        const pegTone = pegRatio === null ? '' : pegRatio < 1 ? 'good' : 'bad';

        const roeDecimal = roePct / 100;
        const requiredReturnDecimal = requiredReturnPct / 100;
        const srimFairValueRaw = bps > 0 && requiredReturnDecimal > 0
            ? bps + (bps * ((roeDecimal - requiredReturnDecimal) / requiredReturnDecimal))
            : 0;
        const srimFairValue = srimFairValueRaw ? Math.round(srimFairValueRaw) : 0;

        const upsidePct = currentPrice > 0 && finalTargetPrice
            ? percentage(finalTargetPrice - currentPrice, currentPrice)
            : 0;
        const upsideTone = upsidePct > 0 ? 'hot' : upsidePct < 0 ? 'cool' : '';

        return {
            perFairValue,
            finalTargetPrice,
            premiumRatePct,
            lossMaking,
            pegRatio,
            pegTone,
            srimFairValue,
            upsidePct,
            upsideTone
        };
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

    function reportFiscalYear(report) {
        const titleMatch = String(report?.title || '').match(/\((\d{4})\.\d{2}\)/);
        if (titleMatch) return titleMatch[1];

        const dateToken = normalizeDateToken(report?.date);
        return dateToken ? dateToken.slice(0, 4) : '';
    }

    function groupReportsBySection(reports) {
        const annualReports = [];
        const quarterlyByYear = new Map();

        (reports || []).forEach((report) => {
            const type = String(report?.type || '').trim();
            if (type === '사업보고서') {
                annualReports.push(report);
                return;
            }

            const year = reportFiscalYear(report) || '기타';
            if (!quarterlyByYear.has(year)) {
                quarterlyByYear.set(year, []);
            }
            quarterlyByYear.get(year).push(report);
        });

        annualReports.sort((left, right) => String(right?.date || '').localeCompare(String(left?.date || '')));

        const quarterlyYears = Array.from(quarterlyByYear.entries())
            .map(([year, yearReports]) => ({
                year,
                reports: yearReports.sort((left, right) => String(right?.date || '').localeCompare(String(left?.date || '')))
            }))
            .sort((left, right) => (
                Number(right.year) - Number(left.year)
                || String(right.year).localeCompare(String(left.year))
            ));

        return {
            annualReports,
            quarterlyYears
        };
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
            forwardEps: parseNumberText(payload?.epsForward ?? payload?.forwardEps),
            trailingEps: parseNumberText(payload?.trailingEps ?? payload?.epsTrailing ?? payload?.ttmEps),
            forwardPer: parseNumberText(payload?.forwardPE ?? payload?.forwardPer ?? payload?.trailingPE),
            bps: parseNumberText(payload?.bookValue ?? payload?.bps),
            roe: parseNumberText(payload?.returnOnEquity ?? payload?.roe),
            sharesOutstanding: parseNumberText(payload?.sharesOutstanding),
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

    function resolveChartAnchorRatio(window, absoluteIndex, fallbackRatio) {
        const safeFallback = Math.max(0, Math.min(1, Number(fallbackRatio) || 0));
        const start = Math.max(0, Math.round(Number(window?.start) || 0));
        const end = Math.max(start, Math.round(Number(window?.end) || start));
        const size = Math.max(1, end - start);
        if (absoluteIndex === null || absoluteIndex === undefined || absoluteIndex === '') {
            return safeFallback;
        }

        const numericIndex = Number(absoluteIndex);
        if (!Number.isFinite(numericIndex)) {
            return safeFallback;
        }

        const clampedIndex = Math.max(start, Math.min(end - 1, Math.round(numericIndex)));
        return Math.max(0, Math.min(1, ((clampedIndex - start) + 0.5) / size));
    }

    function resolvePinchZoomFactor(startDistance, currentDistance) {
        const start = Math.max(1, Number(startDistance) || 0);
        const current = Math.max(1, Number(currentDistance) || 0);
        if (!start || !current) return 1;
        return Math.max(0.5, Math.min(1.8, start / current));
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

    function sliceChartSeriesWindow(series, window) {
        const list = Array.isArray(series) ? series : [];
        const total = list.length;
        const normalized = normalizeChartWindow(
            total,
            window?.start ?? 0,
            (window?.end ?? total) - (window?.start ?? 0),
            1
        );
        return list.slice(normalized.start, normalized.end);
    }

    function sliceTechnicalSeriesWindow(technicals, window) {
        if (!technicals) return null;
        return {
            ...technicals,
            ma5: sliceChartSeriesWindow(technicals.ma5, window),
            ma20: sliceChartSeriesWindow(technicals.ma20, window),
            rsi: sliceChartSeriesWindow(technicals.rsi, window),
            macd: {
                macd: sliceChartSeriesWindow(technicals.macd?.macd, window),
                signal: sliceChartSeriesWindow(technicals.macd?.signal, window),
                histogram: sliceChartSeriesWindow(technicals.macd?.histogram, window)
            },
            stoch: {
                k: sliceChartSeriesWindow(technicals.stoch?.k, window),
                d: sliceChartSeriesWindow(technicals.stoch?.d, window)
            },
            boll: sliceChartSeriesWindow(technicals.boll, window)
        };
    }

    function buildChartSeriesSignature(series) {
        const list = Array.isArray(series) ? series : [];
        if (!list.length) return '0|||0|0';

        const first = list[0] || {};
        const last = list[list.length - 1] || {};
        return [
            list.length,
            String(first.date || ''),
            String(last.date || ''),
            Number(last.close || 0),
            Number(last.volume || 0)
        ].join('|');
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

    function computePeriodChange(current, previous) {
        if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
        return ((current / previous) - 1) * 100;
    }

    function selectQuarterlyMetricPeriods(periods) {
        const sorted = sortPeriods((Array.isArray(periods) ? periods : []).filter(Boolean));
        const preferred = sorted.filter((period) => period.isAnnual !== true && /^Q[1-4]$/.test(String(period?.period || '').trim()));
        if (preferred.length) {
            return preferred;
        }

        const qLabelFallback = sorted.filter((period) => /^Q[1-4]$/.test(String(period?.period || '').trim()));
        if (qLabelFallback.length) {
            return qLabelFallback;
        }

        return sorted.filter((period) => period.isAnnual !== true);
    }

    function extractAnnualShareCount(rows) {
        const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
        if (!list.length) return 0;

        const preferredRows = [
            ...list.filter((row) => String(row?.se || '').trim() === '합계'),
            ...list.filter((row) => String(row?.se || '').trim() !== '합계')
        ];

        for (const row of preferredRows) {
            const candidates = [
                row?.istc_totqy,
                row?.distb_stock_co,
                row?.now_to_isu_stock_totqy,
                row?.isu_stock_totqy
            ];
            for (const candidate of candidates) {
                const parsed = parseNumberText(candidate);
                if (parsed && parsed > 0) {
                    return parsed;
                }
            }
        }

        return 0;
    }

    function mergeAnnualHistoryPeriods(existingPeriods, incomingPeriods) {
        const merged = new Map();
        [...(existingPeriods || []), ...(incomingPeriods || [])]
            .filter(Boolean)
            .forEach((period) => {
                const year = Number(period?.year) || 0;
                if (!year) return;
                const previous = merged.get(year);
                merged.set(year, {
                    ...(previous || {}),
                    ...period,
                    year
                });
            });

        return Array.from(merged.values())
            .sort((left, right) => (right.year || 0) - (left.year || 0))
            .map((period) => ({
                ...period,
                sortKey: period.sortKey || ((period.year || 0) * 10) + 4
            }));
    }

    function buildYearEndCloseMap(points) {
        return (Array.isArray(points) ? points : []).reduce((accumulator, point) => {
            const date = String(point?.date || '').trim();
            const year = Number(date.slice(0, 4)) || 0;
            const close = parseNumberText(point?.close);
            if (!year || !Number.isFinite(close)) return accumulator;
            accumulator[year] = close;
            return accumulator;
        }, {});
    }

    function computeHistoricalRoic(summary) {
        const operatingIncome = parseNumberText(summary?.operatingIncome) ?? 0;
        const equity = parseNumberText(summary?.equity) ?? 0;
        const liabilities = parseNumberText(summary?.liabilities) ?? 0;
        const currentLiabilities = parseNumberText(summary?.currentLiabilities) ?? 0;
        const investedCapital = equity + Math.max(liabilities - currentLiabilities, 0);
        return percentage(operatingIncome, investedCapital);
    }

    function buildHistoricalInvestmentRows(periods, yearEndCloseMap, fallbackShareCount) {
        const closeMap = yearEndCloseMap || {};
        const defaultShareCount = parseNumberText(fallbackShareCount) ?? 0;

        const rows = (Array.isArray(periods) ? periods : [])
            .filter(Boolean)
            .map((period) => {
                const summary = period?.summary || {};
                const shareCount = parseNumberText(period?.shareCount) ?? defaultShareCount;
                const close = parseNumberText(closeMap[period?.year]);
                const eps = shareCount > 0 ? safeDivide(parseNumberText(summary?.netIncome) ?? 0, shareCount) : null;
                const bps = shareCount > 0 ? safeDivide(parseNumberText(summary?.equity) ?? 0, shareCount) : null;
                const per = close !== null && eps && eps > 0 ? safeDivide(close, eps) : null;
                const pbr = close !== null && bps && bps > 0 ? safeDivide(close, bps) : null;

                return {
                    year: Number(period?.year) || 0,
                    label: period?.label || '',
                    yearEndClose: close,
                    shareCount: shareCount || null,
                    eps,
                    bps,
                    per,
                    pbr,
                    roe: parseNumberText(summary?.roe),
                    roic: computeHistoricalRoic(summary)
                };
            })
            .sort((left, right) => (right.year || 0) - (left.year || 0));

        return rows.map((row, index) => {
            const previous = rows[index + 1] || null;
            const changeKeys = ['yearEndClose', 'shareCount', 'eps', 'bps', 'per', 'pbr', 'roe', 'roic'];
            const changes = changeKeys.reduce((accumulator, key) => {
                accumulator[key] = computePeriodChange(row[key], previous?.[key]);
                return accumulator;
            }, {});

            return {
                ...row,
                changes
            };
        });
    }

    function buildBriefingCacheKey(companyName, signature) {
        return `invest_nav_briefing_v2_${String(companyName || '').trim()}_${String(signature || '').trim()}`;
    }

    function normalizeBriefingHeading(line) {
        return String(line || '')
            .replace(/^#{1,6}\s*/, '')
            .replace(/^\d+\.\s*/, '')
            .replace(/^\p{Extended_Pictographic}\s*/u, '')
            .replace(/^\*\*(.+?)\*\*$/u, '$1')
            .replace(/\*\*/g, '')
            .replace(/:$/, '')
            .trim();
    }

    function isBriefingHeading(line) {
        const value = String(line || '').trim();
        if (!value) return false;
        return /^#{1,6}\s+/.test(value)
            || /^\d+\.\s+/.test(value)
            || /^[🎯📈⚠⚖]/u.test(value)
            || /^\*\*.+\*\*$/.test(value);
    }

    function normalizeBriefingSections(text) {
        const lines = String(text || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        if (!lines.length) return [];

        const sections = [];
        let currentSection = null;

        lines.forEach((line) => {
            if (isBriefingHeading(line)) {
                if (currentSection) {
                    currentSection.listLike = currentSection.body.length > 0 && currentSection.body.every((item) => /^[-*•]/.test(item));
                    sections.push(currentSection);
                }
                currentSection = {
                    title: normalizeBriefingHeading(line),
                    body: [],
                    listLike: false
                };
                return;
            }

            if (!currentSection) {
                currentSection = {
                    title: '',
                    body: [],
                    listLike: false
                };
            }
            currentSection.body.push(line);
        });

        if (currentSection) {
            currentSection.listLike = currentSection.body.length > 0 && currentSection.body.every((item) => /^[-*•]/.test(item));
            sections.push(currentSection);
        }

        return sections;
    }

    function buildFallbackBriefingSections(input) {
        const payload = input || {};
        const company = String(payload.company || '해당 기업').trim();
        const macro = payload.macro || {};
        const ratings = payload.ratings || {};
        const summary = payload.summary || {};
        const metrics = payload.metrics || {};
        const technicalSignals = Array.isArray(payload.technicalSignals) ? payload.technicalSignals.filter(Boolean) : [];
        const anomalies = Array.isArray(payload.anomalies) ? payload.anomalies.filter(Boolean) : [];
        const chartSource = String(payload.chartSource || '차트 미연결').trim();

        const totalPct = parseNumberText(ratings.totalPct) ?? 0;
        const profitability = parseNumberText(ratings.profitability) ?? 0;
        const stability = parseNumberText(ratings.stability) ?? 0;
        const efficiency = parseNumberText(ratings.efficiency) ?? 0;
        const upside = parseNumberText(metrics.upside);
        const targetPrice = parseNumberText(metrics.targetPrice);
        const operatingMargin = parseNumberText(summary.operatingMargin);
        const debtRatio = parseNumberText(summary.debtRatio);
        const roe = parseNumberText(summary.roe);

        const opinion = totalPct >= 80 && (upside ?? 0) >= 10
            ? 'Buy'
            : totalPct >= 65
                ? 'Hold'
                : 'Reduce';

        const anomalyLine = anomalies.length
            ? anomalies.join(' / ')
            : '재무 법의학상 중대한 이상치는 아직 식별되지 않았습니다.';

        return [
            {
                title: '핵심 요약 (Investment Thesis)',
                body: [
                    `${company}의 종합 재무 점수는 ${totalPct.toFixed(0)}%이며, 수익성 ${profitability}/5, 건전성 ${stability}/5, 효율성 ${efficiency}/5 조합입니다.`,
                    `현재 적정가 추정치는 ${targetPrice ? `${Math.round(targetPrice).toLocaleString()}원` : '-'}이며, 현재가 대비 상승여력은 ${upside === null ? '-' : `${upside > 0 ? '+' : ''}${upside.toFixed(1)}%`}입니다.`,
                    `거시 환경은 USD/KRW ${macro.usdKrw || '-'}, VIX ${macro.vix || '-'}, WTI ${macro.wti || '-'} 수준입니다.`
                ],
                listLike: false
            },
            {
                title: '상승 촉매 및 강점 (Catalysts & Strengths)',
                body: [
                    `- 영업이익률 ${operatingMargin === null ? '-' : `${operatingMargin.toFixed(1)}%`}와 ROE ${roe === null ? '-' : `${roe.toFixed(1)}%`}를 기준으로 수익성 체력을 점검할 수 있습니다.`,
                    `- 기술적 시그널은 ${technicalSignals.length ? technicalSignals.join(', ') : '뚜렷한 우위 없음'}으로 요약됩니다.`,
                    `- 차트 데이터 소스는 ${chartSource} 기준입니다.`
                ],
                listLike: true
            },
            {
                title: '핵심 리스크 및 매크로 역풍 (Risks & Headwinds)',
                body: [
                    `- 부채비율은 ${debtRatio === null ? '-' : `${debtRatio.toFixed(1)}%`} 수준으로, 금리와 환율 환경 변화에 민감할 수 있습니다.`,
                    `- USD/KRW ${macro.usdKrw || '-'}, VIX ${macro.vix || '-'}, WTI ${macro.wti || '-'} 환경은 실적 추정치와 할인율에 직접 영향을 줄 수 있습니다.`,
                    `- ${anomalyLine}`,
                    `- VIX와 유가 변동성 확대는 멀티플 수축과 원가 부담 확대로 이어질 수 있습니다.`
                ],
                listLike: true
            },
            {
                title: '최종 투자의견 (Strong Buy / Buy / Hold / Reduce) 및 대응 전략',
                body: [
                    `${opinion} 의견입니다.`,
                    `${company}은 현재 적정주가, 재무 점수, 기술적 집계, DART 원문을 함께 교차 검증하는 접근이 적합합니다.`,
                    'Gemini 실시간 응답이 불가할 때도 동일한 기관 보고서 프레임으로 핵심 판단축을 유지합니다.'
                ],
                listLike: false
            }
        ];
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
            storage.removeItem(KAKAO_STORAGE_KEYS.profile);
        }

        if (auth && typeof auth.setAccessToken === 'function') {
            auth.setAccessToken(null);
        }
    }

    function extractKakaoProfile(profile) {
        const properties = profile && typeof profile === 'object' ? (profile.properties || {}) : {};
        const accountProfile = profile && typeof profile === 'object'
            ? (((profile.kakao_account || {}).profile) || {})
            : {};

        const nickname = [
            properties.nickname,
            accountProfile.nickname
        ].find((value) => typeof value === 'string' && value.trim()) || '카카오 사용자';

        const image = [
            properties.thumbnail_image,
            properties.profile_image,
            accountProfile.thumbnail_image_url,
            accountProfile.profile_image_url
        ].find((value) => typeof value === 'string' && value.trim()) || '';

        return {
            nickname,
            image
        };
    }

    root.InvestmentLogic = {
        aggregateChartPoints,
        buildBriefingCacheKey,
        buildBusinessDateTokens,
        buildCompanyDirectory,
        buildDartAnnualPeriods,
        buildDartQuarterlyPeriods,
        buildFallbackBriefingSections,
        buildYahooSymbol,
        chartBucketKey,
        clearKakaoSessionState,
        describePriceDelta,
        detectAnomalies,
        extractAnnualShareCount,
        extractKakaoProfile,
        generateAnchoredSyntheticChart,
        groupReportsBySection,
        getQuarterlyReportConfigs,
        buildHistoricalInvestmentRows,
        buildYearEndCloseMap,
        matchCompanies,
        mergeAnnualHistoryPeriods,
        mergeCompanyDirectories,
        moveSuggestionSelectionIndex,
        normalizeBriefingSections,
        normalizeChartWindow,
        normalizeKiwoomChartRows,
        normalizeKiwoomQuote,
        normalizePublicQuote,
        normalizeYfinanceChartRows,
        normalizeYfinanceQuote,
        computeValuationOutputs,
        parseFormattedNumber,
        panChartWindow,
        resolveChartAnchorRatio,
        resolveBaseValuationVariables,
        resolvePinchZoomFactor,
        resolveValuationSectorPreset,
        sliceChartSeriesWindow,
        sliceTechnicalSeriesWindow,
        buildChartSeriesSignature,
        formatWonInputValue,
        resolveChartTooltipLayout,
        resolveChartSeries,
        resolveKakaoCallbackUri,
        resolveKakaoRedirectUri,
        resolveKakaoReturnUrl,
        selectQuarterlyMetricPeriods,
        sortPeriods,
        summarizeStatement,
        pickTrailingCompanyMatch,
        zoomChartWindow
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
