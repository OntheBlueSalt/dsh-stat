/**
 * token-stat — Client half (browser bundle).
 *
 * Three surfaces, one data story:
 *
 * 1. `conversation.composer.dock` pill — aggregates the shipped `tokenUsage`
 *    projection across every session in the sessions snapshot (the built-in
 *    UsagePill covers the current session only).
 * 2. `settings.section` page — "Token 用量": single-width page with a summary
 *    card, a per-day usage line chart (one colored line per model, hover
 *    tooltip), a per-model bar chart, and compact per-model/per-session
 *    tables. No horizontal scrolling; the settings column scrolls vertically.
 * 3. Data: `session/list` rows carry the provider-reported `tokenUsage`, the
 *    durable `modelSelection`, and — once this plugin's Host half is mounted —
 *    the `tokenUsageDaily` projection (day → model route → four buckets).
 *    Sessions folded before the projection existed lack the daily value; the
 *    page backfills those through `session/projections` (a sanctioned cold
 *    read) two at a time and reports progress.
 *
 *  - No Harness Client package is required as a module; React comes from the
 *    module table and every service arrives through the fiber `inject` list.
 *  - Locale: dictionaries registered on the Client locale service under one
 *    namespace; the bound `t` rides each registration's own `inject` prop
 *    supplier, and labels stay thunks so localized text follows switches.
 *  - Styles: `--dsw-alias-*` token references for all structure; chart series
 *    colors are artwork (a fixed palette, gray for unknown routes), injected
 *    through the idempotent data-plugin-css pattern.
 */
window.__ModuleLoader__.load({
	id: '@local/token-stat',
	factory(require) {
		const React = require('react');
		const h = React.createElement;
		const NS = 'token-stat';
		const CSS_ID = '@local/token-stat/ui.css';
		const CSS = [
			// — composer dock pill (mirrors the shipped StatsPills pattern) —
			'.token-stat-anchor{min-width:0;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));display:inline-flex}',
			'.token-stat-pill{box-sizing:border-box;border-radius:var(--dsw-radius-sm);max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}',
			'.token-stat-pill svg{flex:none;width:14px;height:14px}',
			'.token-stat-label{text-overflow:ellipsis;min-width:0;overflow:hidden}',
			// — settings page (single column, no horizontal scrolling) —
			'.tsp-section{min-width:0;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}',
			'.tsp-head{align-items:center;gap:10px;display:flex}',
			'.tsp-title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px;flex:1;min-width:0}',
			'.tsp-state{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;flex:none}',
			'.tsp-refresh{box-sizing:border-box;border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;padding:3px 10px;cursor:pointer;flex:none}',
			'.tsp-refresh:hover:not(:disabled){color:var(--dsw-alias-label-primary)}',
			'.tsp-refresh:disabled{opacity:.6;cursor:default}',
			'.tsp-intro{color:var(--dsw-alias-label-secondary);margin:0;font-size:14px;line-height:22px}',
			'.tsp-error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px;line-height:18px}',
			'.tsp-empty{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:20px;padding:20px 0;text-align:center}',
			'.tsp-card{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);flex-direction:column;gap:12px;padding:14px 16px;display:flex}',
			'.tsp-total-row{align-items:baseline;gap:8px;flex-wrap:wrap;display:flex}',
			'.tsp-total-label{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}',
			'.tsp-total-value{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums;line-height:28px}',
			'.tsp-buckets{gap:18px;flex-wrap:wrap;display:flex}',
			'.tsp-bucket{flex-direction:column;gap:2px;display:flex}',
			'.tsp-bucket-label{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}',
			'.tsp-bucket-value{font-size:13px;font-variant-numeric:tabular-nums;line-height:18px}',
			'.tsp-meta{color:var(--dsw-alias-label-secondary);font-size:12px;gap:12px;flex-wrap:wrap;line-height:18px;display:flex}',
			'.tsp-block-title{color:var(--dsw-alias-label-primary);margin:0;font-size:13px;font-weight:600;line-height:20px}',
			'.tsp-chart{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);flex-direction:column;gap:10px;padding:12px 14px 10px;display:flex}',
			'.tsp-chart svg{display:block;width:100%;height:auto;touch-action:none}',
			'.tsp-axis{fill:var(--dsw-alias-label-tertiary);font-size:10px}',
			'.tsp-grid{stroke:var(--dsw-alias-border-l1);stroke-width:1}',
			'.tsp-guide{stroke:var(--dsw-alias-border-l2);stroke-width:1;stroke-dasharray:3 3}',
			'.tsp-tooltip{position:absolute;pointer-events:none;background:var(--dsw-alias-bg-overlay);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);box-shadow:0 6px 20px rgba(0,0,0,.14);color:var(--dsw-alias-label-primary);font-size:11px;line-height:17px;padding:7px 10px;top:6px;z-index:2;white-space:nowrap}',
			'.tsp-tooltip-title{color:var(--dsw-alias-label-secondary);margin-bottom:2px}',
			'.tsp-tooltip-row{display:flex;align-items:center;gap:6px;min-width:0}',
			'.tsp-tooltip-row .tsp-tooltip-name{overflow:hidden;text-overflow:ellipsis;max-width:150px}',
			'.tsp-tooltip-row .tsp-tooltip-value{margin-left:auto;font-variant-numeric:tabular-nums;padding-left:12px}',
			'.tsp-dot{border-radius:50%;flex:none;display:inline-block;height:8px;width:8px}',
			'.tsp-legend{gap:6px;flex-wrap:wrap;display:flex}',
			'.tsp-chip{align-items:center;border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;color:var(--dsw-alias-label-secondary);display:inline-flex;gap:5px;font-size:11px;line-height:16px;padding:2px 8px}',
			'.tsp-table{border-collapse:collapse;width:100%;font-size:12px;line-height:18px;table-layout:fixed}',
			'.tsp-table th{border-bottom:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-weight:500;padding:6px 8px;text-align:right;white-space:nowrap}',
			'.tsp-table td{border-bottom:.5px solid var(--dsw-alias-border-l1);font-variant-numeric:tabular-nums;padding:7px 8px;text-align:right;vertical-align:top;word-break:break-all}',
			'.tsp-table th:first-child,.tsp-table td:first-child{text-align:left;padding-left:0}',
			'.tsp-table th.tsp-left,.tsp-table td.tsp-left{text-align:left}',
			'.tsp-table th:last-child,.tsp-table td:last-child{padding-right:0}',
			'.tsp-cell-main{color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px;min-width:0}',
			'.tsp-cell-sub{color:var(--dsw-alias-label-secondary);font-size:11px;margin-top:2px;line-height:16px;word-break:normal}',
			'.tsp-clip{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
			'.tsp-tag{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);display:inline-block;font-size:10px;line-height:14px;margin-left:6px;padding:0 5px;flex:none}',
			'.tsp-hint{color:var(--dsw-alias-label-secondary);margin:0;font-size:11px;line-height:16px}',
		].join('\n');
		// Idempotent style injection (official data-plugin-css pattern).
		if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_ID) + ']') === null) {
			const tag = document.createElement('style');
			tag.setAttribute('data-plugin-css', CSS_ID);
			tag.textContent = CSS;
			document.head.append(tag);
		}

		/** Chart series artwork: one hue per model route, gray for unknown. */
		const PALETTE = ['#3d7fff', '#8957e5', '#0ea5a4', '#f59e0b', '#ef4444', '#d946ef', '#22c55e', '#eab308'];
		const UNKNOWN_COLOR = '#98a2b3';
		const UNKNOWN_KEY = '?';
		const DAILY_DAY_CAP = 180;

		const dictionaries = {
			zh: {
				// pill
				'label': '累计 Token',
				'pill.label': '累计 {total} · {n} 会话',
				'tip.headline': '全部会话累计 Token：{total}',
				'tip.input': '未缓存输入：{value}',
				'tip.cacheRead': '缓存读取：{value}',
				'tip.cacheWrite': '缓存写入：{value}',
				'tip.output': '输出：{value}',
				'tip.cacheHit': '缓存命中率：{percent}%',
				'tip.current': '当前会话：{value}',
				// settings section
				'nav': 'Token 用量',
				'section.summary': '查看所有会话的 Token 用量与对应模型。',
				'section.title': 'Token 用量',
				'section.intro': '汇总所有会话的模型 Token 消耗，数字来自服务端上报的 provider 用量。',
				'section.refresh': '刷新',
				'section.refreshing': '刷新中…',
				'section.loading': '统计中…',
				'section.loadFailed': '用量数据加载失败',
				'section.retry': '重试',
				'section.empty': '还没有可统计的 Token 用量。',
				'total.label': '累计',
				'today.title': '今日用量',
				'today.empty': '今天还没有 Token 用量。',
				'split.total': '总量',
				'split.cacheHit': '缓存命中',
				'split.cacheMiss': '缓存未命中',
				'split.cacheWrite': '缓存写入',
				'chart.daily.title': '每日用量',
				'chart.daily.hint': '按会话日志的逐日、逐模型明细绘制；悬停查看当天各模型用量。安装本插件前已结束且未再打开的会话，其逐日明细会在打开后补全。',
				'chart.daily.empty': '暂无按日明细。',
				'chart.bar.title': '模型用量对比',
				'sessions.title': '会话明细',
				'byModel.title': '按模型统计',
				'byModel.hint': '会话的用量按其最近一次请求使用的模型归类；会话中途切换过模型时，全部用量会归入最近的模型。图表按每次请求的实际模型统计，口径更精确。',
				'col.session': '会话',
				'col.model': '模型',
				'col.sessions': '会话数',
				'col.input': '输入',
				'col.cacheRead': '缓存读',
				'col.cacheWrite': '缓存写',
				'col.output': '输出',
				'col.total': '合计',
				'label.untitled': '未命名会话',
				'label.subagent': '子会话',
				'label.unknownModel': '未知模型',
				'meta.sessions': '{n} 个会话',
				'meta.cacheHit': '缓存命中率 {percent}%',
				'label.fillPending': '正在补充历史按日明细 {done}/{total}…',
				'tip.grand': '输入 {input} · 缓存读 {cacheRead} · 缓存写 {cacheWrite} · 输出 {output}',
				'tooltip.total': '合计',
			},
			en: {
				'label': 'Token stats',
				'pill.label': '{total} · {n} sessions',
				'tip.headline': 'All-session tokens: {total}',
				'tip.input': 'Uncached input: {value}',
				'tip.cacheRead': 'Cache read: {value}',
				'tip.cacheWrite': 'Cache write: {value}',
				'tip.output': 'Output: {value}',
				'tip.cacheHit': 'Cache hit: {percent}%',
				'tip.current': 'Current session: {value}',
				'nav': 'Token usage',
				'section.summary': 'Token usage of every session and the models behind it.',
				'section.title': 'Token usage',
				'section.intro': 'Model token consumption across all sessions, from provider-reported usage.',
				'section.refresh': 'Refresh',
				'section.refreshing': 'Refreshing…',
				'section.loading': 'Crunching…',
				'section.loadFailed': 'Failed to load usage data',
				'section.retry': 'Retry',
				'section.empty': 'No token usage to report yet.',
				'total.label': 'Total',
				'today.title': 'Today',
				'today.empty': 'No token usage today yet.',
				'split.total': 'Total',
				'split.cacheHit': 'Cache hit',
				'split.cacheMiss': 'Cache miss',
				'split.cacheWrite': 'Cache write',
				'chart.daily.title': 'Daily usage',
				'chart.daily.hint': 'Per-day, per-model usage folded from session logs; hover a day for its breakdown. Sessions that finished before this plugin was installed and were not reopened fill in once opened.',
				'chart.daily.empty': 'No daily detail yet.',
				'chart.bar.title': 'Usage by model',
				'sessions.title': 'Sessions',
				'byModel.title': 'By model',
				'byModel.hint': "Each session's usage is grouped under its most recently used model; a session that switched models counts entirely toward the latest one. Charts use the exact model of every request.",
				'col.session': 'Session',
				'col.model': 'Model',
				'col.sessions': 'Sessions',
				'col.input': 'Input',
				'col.cacheRead': 'Cache read',
				'col.cacheWrite': 'Cache write',
				'col.output': 'Output',
				'col.total': 'Total',
				'label.untitled': 'Untitled session',
				'label.subagent': 'Subagent',
				'label.unknownModel': 'Unknown model',
				'meta.sessions': '{n} sessions',
				'meta.cacheHit': 'Cache hit {percent}%',
				'label.fillPending': 'Filling in daily detail {done}/{total}…',
				'tip.grand': 'Input {input} · Cache read {cacheRead} · Cache write {cacheWrite} · Output {output}',
				'tooltip.total': 'Total',
			},
		};

		/** Coerce one projection bucket to a non-negative finite count. */
		function count(value) {
			const n = Number(value);
			return Number.isFinite(n) && n > 0 ? n : 0;
		}

		/**
		 * Compact token count mirroring the shipped pill format:
		 * 517 / 12.2K / 517K / 1.2M.
		 */
		function formatCompact(value) {
			if (value < 1e3) return String(value);
			const scaled = (candidate) => (candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10));
			if (value < 1e6) return scaled(value / 1e3) + 'K';
			return scaled(value / 1e6) + 'M';
		}

		/** Exact integer count with locale digit grouping. */
		function formatExact(value) {
			try {
				return new Intl.NumberFormat().format(value);
			} catch {
				return String(value);
			}
		}

		/** Short absolute stamp (MM/DD HH:mm in the browser locale). */
		function formatTime(ts) {
			if (!Number.isFinite(ts) || ts <= 0) return '';
			try {
				return new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
			} catch {
				return '';
			}
		}

		/** `9/24`-style axis label for a `YYYY-MM-DD` day key. */
		function shortDay(day) {
			const parts = day.split('-');
			return String(Number(parts[1])) + '/' + String(Number(parts[2]));
		}

		/** The browser's local calendar day, matching the Host fold's day keys. */
		function todayKey() {
			const now = new Date();
			return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
		}

		/** Round a maximum up to a friendly axis bound (1/2/2.5/5×10^k). */
		function niceMax(value) {
			if (!(value > 0)) return 1;
			const power = Math.pow(10, Math.floor(Math.log10(value)));
			for (const multiple of [1, 2, 2.5, 5, 10]) {
				if (value <= multiple * power) return multiple * power;
			}
			return 10 * power;
		}

		/**
		 * Unwrap a RemoteResult envelope; plain values pass through, a failed
		 * envelope becomes null so the caller can raise its own error.
		 */
		function unwrapRemote(value) {
			if (value && typeof value === 'object' && 'ok' in value) return value.ok ? value.value : null;
			return value;
		}

		/** Fold one sessions-snapshot entry into the pill totals. */
		function foldTotals(snapshot, sessionId) {
			const totals = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, sessions: 0, current: 0 };
			if (!snapshot || !Array.isArray(snapshot.ids) || !snapshot.byId) return totals;
			for (const id of snapshot.ids) {
				const entry = snapshot.byId[id];
				const usage = entry && entry.projectionValues ? entry.projectionValues.tokenUsage : void 0;
				if (!usage || typeof usage !== 'object') continue;
				const input = count(usage.uncachedInputTokens);
				const cacheRead = count(usage.cacheReadTokens);
				const cacheWrite = count(usage.cacheWriteTokens);
				const output = count(usage.outputTokens);
				if (input + cacheRead + cacheWrite + output === 0) continue;
				totals.input += input;
				totals.cacheRead += cacheRead;
				totals.cacheWrite += cacheWrite;
				totals.output += output;
				totals.sessions += 1;
				if (id === sessionId) totals.current = input + cacheRead + cacheWrite + output;
			}
			return totals;
		}

		/** Provider/model display name from the model catalog, or the raw route. */
		function modelLabel(catalog, provider, model) {
			if (typeof provider !== 'string' || typeof model !== 'string') return null;
			const named = catalog instanceof Map ? catalog.get(provider + '\u0000' + model) : void 0;
			return typeof named === 'string' && named !== '' ? named : provider + '/' + model;
		}

		function isDayMap(value) {
			return value !== null && typeof value === 'object' && !Array.isArray(value);
		}

		/**
		 * Build the page view from `session/list` rows plus the controller's
		 * backfilled daily cache. Rows without a served tokenUsage projection
		 * (cold sessions, no provider report yet) or with an all-zero total
		 * contribute nothing to tables; the daily series additionally needs the
		 * `tokenUsageDaily` projection, from the row or the backfill cache.
		 */
		function buildView(items, catalog, dailyCache) {
			const rows = [];
			const byModel = new Map();
			const totals = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, sessions: 0 };
			for (const item of Array.isArray(items) ? items : []) {
				if (!item || typeof item !== 'object') continue;
				const values = item.projections && item.projections.values ? item.projections.values : void 0;
				const usage = values ? values.tokenUsage : void 0;
				if (!usage || typeof usage !== 'object') continue;
				const input = count(usage.uncachedInputTokens);
				const cacheRead = count(usage.cacheReadTokens);
				const cacheWrite = count(usage.cacheWriteTokens);
				const output = count(usage.outputTokens);
				const total = input + cacheRead + cacheWrite + output;
				if (total === 0) continue;
				const selection = values.modelSelection;
				const last = selection && typeof selection === 'object' ? selection.lastUsed || selection.next || null : null;
				const provider = last && typeof last.provider === 'string' && last.provider !== '' ? last.provider : void 0;
				const model = last && typeof last.model === 'string' && last.model !== '' ? last.model : void 0;
				let daily = values.tokenUsageDaily;
				if (!isDayMap(daily) && dailyCache instanceof Map && dailyCache.has(item.sessionId)) daily = dailyCache.get(item.sessionId);
				rows.push({
					id: item.sessionId,
					title: typeof values.title === 'string' && values.title !== '' ? values.title : void 0,
					updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0,
					blank: item.blank === true,
					formatStatus: item.formatStatus,
					subagent: item.origin === 'subagent',
					provider,
					model,
					label: modelLabel(catalog, provider, model),
					daily: isDayMap(daily) ? daily : void 0,
					input,
					cacheRead,
					cacheWrite,
					output,
					total,
				});
				totals.input += input;
				totals.cacheRead += cacheRead;
				totals.cacheWrite += cacheWrite;
				totals.output += output;
				totals.sessions += 1;
				const key = provider === void 0 ? UNKNOWN_KEY : provider + '\u0000' + model;
				let group = byModel.get(key);
				if (group === void 0) {
					group = { key, provider, model, label: modelLabel(catalog, provider, model), sessions: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, total: 0 };
					byModel.set(key, group);
				}
				group.sessions += 1;
				group.input += input;
				group.cacheRead += cacheRead;
				group.cacheWrite += cacheWrite;
				group.output += output;
				group.total += total;
			}
			rows.sort((a, b) => b.updatedAt - a.updatedAt);
			const models = [...byModel.values()].sort((a, b) => b.total - a.total);
			const daily = buildDailySeries(rows, catalog, models);
			const colorByKey = {};
			let colorIndex = 0;
			for (const group of models) {
				if (colorByKey[group.key] === void 0) {
					colorByKey[group.key] = group.key === UNKNOWN_KEY ? void 0 : PALETTE[colorIndex % PALETTE.length];
					colorIndex += 1;
				}
			}
			for (const series of daily.models) {
				if (colorByKey[series.key] === void 0) {
					colorByKey[series.key] = series.key === UNKNOWN_KEY ? void 0 : PALETTE[colorIndex % PALETTE.length];
					colorIndex += 1;
				}
			}
			return { rows, byModel: models, totals, daily, colorByKey };
		}

		/**
		 * Fold every session's daily map into one per-day, per-model series.
		 * The date axis spans the first to the last day with data (capped at
		 * the most recent {@link DAILY_DAY_CAP} days), zero-filled between.
		 */
		function buildDailySeries(rows, catalog, byModelOrder) {
			const perDate = new Map();
			const modelTotals = new Map();
			for (const row of rows) {
				if (!row.daily) continue;
				for (const date of Object.keys(row.daily)) {
					const routes = row.daily[date];
					if (!isDayMap(routes)) continue;
					let dayMap = perDate.get(date);
					if (dayMap === void 0) perDate.set(date, dayMap = new Map());
					for (const key of Object.keys(routes)) {
						const buckets = routes[key];
						if (!Array.isArray(buckets) || buckets.length !== 4) continue;
						const current = dayMap.get(key) ?? [0, 0, 0, 0];
						dayMap.set(key, [current[0] + count(buckets[0]), current[1] + count(buckets[1]), current[2] + count(buckets[2]), current[3] + count(buckets[3])]);
					}
				}
			}
			const labels = new Map();
			const labelOf = (key) => {
				if (key === UNKNOWN_KEY) return null;
				let label = labels.get(key);
				if (label === void 0) {
					const [provider, model] = key.split('\u0000');
					label = modelLabel(catalog, provider, model);
					labels.set(key, label);
				}
				return label;
			};
			for (const group of byModelOrder) {
				if (group.key !== UNKNOWN_KEY && !labels.has(group.key)) {
					const [provider, model] = group.key.split('\u0000');
					labels.set(group.key, modelLabel(catalog, provider, model));
				}
			}
			for (const dayMap of perDate.values()) {
				for (const [key, buckets] of dayMap) {
					const current = modelTotals.get(key) ?? [0, 0, 0, 0];
					modelTotals.set(key, [current[0] + buckets[0], current[1] + buckets[1], current[2] + buckets[2], current[3] + buckets[3]]);
				}
			}
			if (perDate.size === 0) return { dates: [], models: [], dayTotals: [], days: {} };
			const allDates = [...perDate.keys()].sort();
			let dates = allDates;
			if (allDates.length > DAILY_DAY_CAP) {
				const first = allDates.length - DAILY_DAY_CAP;
				dates = allDates.slice(first);
				for (const date of allDates.slice(0, first)) perDate.delete(date);
			}
			const first = dates[0];
			const last = dates[dates.length - 1];
			const axis = [];
			for (let cursor = new Date(first + 'T00:00:00'); cursor <= new Date(last + 'T00:00:00'); cursor.setDate(cursor.getDate() + 1)) {
				const date = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0') + '-' + String(cursor.getDate()).padStart(2, '0');
				axis.push(date);
				if (axis.length > 400) break;
			}
			const order = [...modelTotals.keys()].sort((a, b) => {
				const sum = (buckets) => buckets[0] + buckets[1] + buckets[2] + buckets[3];
				return sum(modelTotals.get(b)) - sum(modelTotals.get(a));
			});
			const seriesModels = order.map((key) => ({
				key,
				label: labelOf(key),
				values: axis.map((date) => {
					const buckets = perDate.get(date)?.get(key);
					return buckets === void 0 ? 0 : buckets[0] + buckets[1] + buckets[2] + buckets[3];
				}),
			}));
			const dayTotals = axis.map((date) => {
				let sum = 0;
				for (const buckets of perDate.get(date)?.values() ?? []) sum += buckets[0] + buckets[1] + buckets[2] + buckets[3];
				return sum;
			});
			const days = {};
			for (const date of axis) {
				const dayMap = perDate.get(date);
				if (dayMap === void 0) continue;
				const record = {};
				for (const [key, buckets] of dayMap) record[key] = buckets;
				days[date] = record;
			}
			return { dates: axis, models: seriesModels, dayTotals, days };
		}

		/** Original artwork: three rising bars, currentColor for theming. */
		function PillIcon() {
			return h('svg', { viewBox: '0 0 16 16', 'aria-hidden': true, fill: 'currentColor' },
				h('rect', { x: 2.5, y: 8, width: 3, height: 5.5, rx: 1 }),
				h('rect', { x: 6.5, y: 5, width: 3, height: 8.5, rx: 1 }),
				h('rect', { x: 10.5, y: 2.5, width: 3, height: 11, rx: 1 }));
		}

		const TokenStatPill = React.memo(function TokenStatPill(props) {
			const useSessions = props.useSessions;
			const sessionId = props.sessionId;
			const t = props.t;
			if (typeof useSessions !== 'function' || typeof t !== 'function') return null;
			// Identity selector: the snapshot object keeps its reference
			// between store commits, so the subscription stays cheap and the
			// fold below decides whether anything actually changed.
			const snapshot = useSessions((list) => list);
			const totals = React.useMemo(() => foldTotals(snapshot, sessionId), [snapshot, sessionId]);
			const billedInput = totals.input + totals.cacheRead + totals.cacheWrite;
			const grand = billedInput + totals.output;
			if (totals.sessions === 0 || grand === 0) return null;
			const cacheHit = billedInput > 0 ? Math.round((totals.cacheRead / billedInput) * 1000) / 10 : null;
			const lines = [
				t('tip.headline', { total: formatExact(grand) }),
				t('tip.input', { value: formatExact(totals.input) }),
				t('tip.cacheRead', { value: formatExact(totals.cacheRead) }),
				t('tip.cacheWrite', { value: formatExact(totals.cacheWrite) }),
				t('tip.output', { value: formatExact(totals.output) }),
			];
			if (cacheHit !== null) lines.push(t('tip.cacheHit', { percent: cacheHit }));
			if (totals.current > 0) lines.push(t('tip.current', { value: formatExact(totals.current) }));
			return h('span', { className: 'token-stat-anchor', 'data-token-stat': '' },
				h('span', { className: 'token-stat-pill', title: lines.join('\n') },
					h(PillIcon, null),
					h('span', { className: 'token-stat-label' }, t('pill.label', { total: formatCompact(grand), n: totals.sessions }))));
		});

		/**
		 * Usage page controller: pages the `session/list` Remote, best-effort
		 * joins the model catalog for display names, backfills the daily
		 * projection for sessions whose rows predate it, and publishes one
		 * immutable snapshot for `useSyncExternalStore`.
		 */
		class UsageController {
			constructor(remote) {
				this.remote = remote;
				this.listeners = new Set();
				this.generation = 0;
				this.fillRun = 0;
				this.loading = false;
				this.pending = false;
				this.disposed = false;
				this.refreshTimer = null;
				this.lastItems = void 0;
				this.lastCatalog = void 0;
				this.dailyCache = new Map();
				this.fill = null;
				this.snapshot = {
					status: 'idle',
					rows: [],
					byModel: [],
					totals: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, sessions: 0 },
					daily: { dates: [], models: [], dayTotals: [], days: {} },
					colorByKey: {},
					fill: null,
					error: void 0,
				};
			}
			subscribe = (listener) => {
				this.listeners.add(listener);
				// Reopening a previously loaded page freshens it once; background
				// invalidations only refresh while the page is actually mounted.
				if (this.listeners.size === 1 && this.snapshot.status !== 'idle') this.refreshIfLoaded();
				return () => this.listeners.delete(listener);
			};
			getSnapshot = () => this.snapshot;
			publish(next) {
				this.snapshot = next;
				for (const listener of this.listeners) listener();
			}
			ensureLoaded() {
				if (this.snapshot.status === 'idle') this.load();
			}
			/** Coalesced reload for push invalidations; mounted pages only. */
			refreshIfLoaded() {
				if (this.disposed || this.listeners.size === 0 || this.snapshot.status === 'idle') return;
				if (this.refreshTimer === null) {
					this.refreshTimer = setTimeout(() => {
						this.refreshTimer = null;
						if (!this.disposed) this.load();
					}, 600);
				}
			}
			/** Drop everything and require an explicit reload (reconnect). */
			reset() {
				this.generation += 1;
				this.fillRun += 1;
				this.loading = false;
				this.pending = false;
				this.lastItems = void 0;
				this.lastCatalog = void 0;
				this.dailyCache.clear();
				this.fill = null;
				this.publish({
					status: 'idle',
					rows: [],
					byModel: [],
					totals: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, sessions: 0 },
					daily: { dates: [], models: [], dayTotals: [], days: {} },
					colorByKey: {},
					fill: null,
					error: void 0,
				});
			}
			async load() {
				if (this.disposed) return;
				if (this.loading) {
					this.pending = true;
					return;
				}
				const gen = this.generation;
				this.loading = true;
				if (this.snapshot.status === 'idle') this.publish({ ...this.snapshot, status: 'loading' });
				try {
					const items = [];
					let cursor;
					for (let page = 0; page < 200; page += 1) {
						const response = unwrapRemote(await this.remote.session.list(cursor === void 0 ? {} : { cursor }));
						if (response === null || typeof response !== 'object') throw new Error('session/list failed');
						if (Array.isArray(response.items)) items.push(...response.items);
						cursor = typeof response.nextCursor === 'string' && response.nextCursor !== '' ? response.nextCursor : void 0;
						if (cursor === void 0) break;
					}
					const catalog = await this.loadCatalog();
					if (gen !== this.generation) return;
					this.lastItems = items;
					this.lastCatalog = catalog;
					this.loading = false;
					this.recompute();
					if (this.pending) {
						this.pending = false;
						this.load();
						return;
					}
					this.fillDaily(gen);
				} catch (error) {
					if (gen !== this.generation) return;
					this.loading = false;
					this.pending = false;
					const message = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : String(error);
					if (this.snapshot.status === 'ready') this.publish({ ...this.snapshot, error: message });
					else this.publish({ ...this.snapshot, status: 'error', error: message });
				}
			}
			/** Rebuild the ready snapshot from the last list and daily cache. */
			recompute() {
				if (this.lastItems === void 0) return;
				const view = buildView(this.lastItems, this.lastCatalog instanceof Map ? this.lastCatalog : new Map(), this.dailyCache);
				this.publish({
					status: 'ready',
					...view,
					fill: this.fill === null ? null : { ...this.fill },
					error: void 0,
				});
			}
			/**
			 * Backfill the daily projection for sessions whose list rows lack
			 * it (folded before this plugin mounted). `session/projections`
			 * performs the sanctioned cold read; two run at a time and each
			 * result is cached for the page's lifetime.
			 */
			async fillDaily(gen) {
				const missing = [];
				for (const row of this.snapshot.rows) {
					if (row.daily !== void 0 || this.dailyCache.has(row.id)) continue;
					if (row.blank || row.formatStatus === 'migration-required') continue;
					missing.push(row);
				}
				if (missing.length === 0 || this.disposed || gen !== this.generation) return;
				const run = ++this.fillRun;
				this.fill = { done: 0, total: missing.length };
				this.recompute();
				const queue = [...missing];
				const worker = async () => {
					while (queue.length > 0 && !this.disposed && run === this.fillRun && gen === this.generation) {
						const row = queue.shift();
						let daily = null;
						try {
							const response = unwrapRemote(await this.remote.session.projections({ sessionId: row.id }));
							const values = response && typeof response === 'object' ? response.values : void 0;
							if (isDayMap(values) && isDayMap(values.tokenUsageDaily)) daily = values.tokenUsageDaily;
						} catch {
							daily = null;
						}
						if (this.disposed || run !== this.fillRun || gen !== this.generation) return;
						this.dailyCache.set(row.id, daily);
						this.fill.done += 1;
						this.recompute();
					}
				};
				await Promise.all([worker(), worker()]);
				if (this.disposed || run !== this.fillRun || gen !== this.generation) return;
				this.fill = null;
				this.recompute();
			}
			/** Display names only; a catalog failure never fails the page. */
			async loadCatalog() {
				try {
					const response = unwrapRemote(await this.remote.session.modelCatalog());
					const map = new Map();
					if (response && typeof response === 'object' && Array.isArray(response.groups)) {
						for (const group of response.groups) {
							if (!group || typeof group.id !== 'string' || !Array.isArray(group.models)) continue;
							for (const model of group.models) {
								if (model && typeof model.id === 'string') map.set(group.id + '\u0000' + model.id, typeof model.name === 'string' && model.name !== '' ? model.name : model.id);
							}
						}
					}
					return map;
				} catch {
					return new Map();
				}
			}
			dispose() {
				this.disposed = true;
				this.generation += 1;
				this.fillRun += 1;
				if (this.refreshTimer !== null) {
					clearTimeout(this.refreshTimer);
					this.refreshTimer = null;
				}
				this.listeners.clear();
			}
		}

		/** Shared color for a model key ('?' → neutral gray). */
		function colorOf(colorByKey, key) {
			const color = colorByKey ? colorByKey[key] : void 0;
			return typeof color === 'string' ? color : UNKNOWN_COLOR;
		}

		/** Colored dot + display name, shared by tables, legend, and tooltip. */
		function ModelName({ color, label, fallback, className }) {
			return h('span', { className: className ?? 'tsp-cell-main' },
				h('span', { className: 'tsp-dot', style: { background: color, flex: 'none' } }),
				h('span', { className: 'tsp-clip' }, label ?? fallback));
		}

		/** Usage tooltip rows: date header, per-model lines, total. */
		function ChartTooltip({ left, title, rows, totalLabel }) {
			return h('div', { className: 'tsp-tooltip', style: {
				left: left + '%',
				transform: left > 55 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
			} },
				h('div', { className: 'tsp-tooltip-title' }, title),
				rows.map((row) => h('div', { className: 'tsp-tooltip-row', key: row.key },
					h('span', { className: 'tsp-dot', style: { background: row.color } }),
					h('span', { className: 'tsp-tooltip-name' }, row.label ?? totalLabel),
					h('span', { className: 'tsp-tooltip-value' }, formatExact(row.value)))),
				h('div', { className: 'tsp-tooltip-row', style: { borderTop: '0.5px solid var(--dsw-alias-border-l1)', marginTop: '3px', paddingTop: '3px' } },
					h('span', { className: 'tsp-tooltip-name' }, totalLabel),
					h('span', { className: 'tsp-tooltip-value' }, formatExact(rows.reduce((sum, row) => sum + row.value, 0)))));
		}

		const LINE_VB = { w: 520, h: 200 };
		const LINE_PAD = { left: 46, right: 12, top: 12, bottom: 24 };

		/**
		 * Daily usage line chart: one colored polyline per model over a
		 * zero-filled day axis, with a hover guide, markers, and tooltip.
		 */
		const DailyLineChart = React.memo(function DailyLineChart({ daily, colorByKey, t }) {
			const [hover, setHover] = React.useState(void 0);
			const { dates, models, dayTotals } = daily;
			const count_ = dates.length;
			const innerWidth = LINE_VB.w - LINE_PAD.left - LINE_PAD.right;
			const innerHeight = LINE_VB.h - LINE_PAD.top - LINE_PAD.bottom;
			const maxY = niceMax(Math.max(1, ...dayTotals));
			const xAt = (index) => LINE_PAD.left + (count_ <= 1 ? innerWidth / 2 : (index * innerWidth) / (count_ - 1));
			const yAt = (value) => LINE_PAD.top + innerHeight * (1 - value / maxY);
			const onMove = (event) => {
				const rect = event.currentTarget.getBoundingClientRect();
				const dataX = ((event.clientX - rect.left) * LINE_VB.w) / rect.width;
				const step = count_ <= 1 ? innerWidth : innerWidth / (count_ - 1);
				const index = Math.round((dataX - LINE_PAD.left) / step);
				setHover(Math.max(0, Math.min(count_ - 1, index)));
			};
			const tickIndexes = [];
			if (count_ > 0) {
				const wanted = Math.min(count_, 5);
				for (let i = 0; i < wanted; i += 1) {
					const index = Math.round((i * (count_ - 1)) / (wanted - 1 || 1));
					if (!tickIndexes.includes(index)) tickIndexes.push(index);
				}
			}
			const yTicks = [0, maxY / 2, maxY];
			const hoverRows = hover === void 0 ? [] : models
				.map((series) => ({ key: series.key, label: series.label ?? t('label.unknownModel'), color: colorOf(colorByKey, series.key), value: series.values[hover] ?? 0 }))
				.filter((row) => row.value > 0)
				.sort((a, b) => b.value - a.value);
			return h('div', { style: { position: 'relative' } },
				h('svg', {
					viewBox: '0 0 ' + LINE_VB.w + ' ' + LINE_VB.h,
					role: 'img',
					'aria-label': t('chart.daily.title'),
					onMouseMove: count_ > 0 ? onMove : void 0,
					onMouseLeave: count_ > 0 ? () => setHover(void 0) : void 0,
				},
					yTicks.map((tick) => h('g', { key: 'y' + tick },
						h('line', { className: 'tsp-grid', x1: LINE_PAD.left, x2: LINE_VB.w - LINE_PAD.right, y1: yAt(tick), y2: yAt(tick) }),
						h('text', { className: 'tsp-axis', x: LINE_PAD.left - 6, y: yAt(tick) + 3, textAnchor: 'end' }, formatCompact(Math.round(tick))))),
					tickIndexes.map((index) => h('text', {
						className: 'tsp-axis', key: 'x' + index,
						x: xAt(index), y: LINE_VB.h - 6, textAnchor: index === 0 ? 'start' : index === count_ - 1 ? 'end' : 'middle',
					}, shortDay(dates[index]))),
					models.map((series) => h('polyline', {
						key: series.key,
						fill: 'none',
						stroke: colorOf(colorByKey, series.key),
						strokeWidth: 1.6,
						strokeLinejoin: 'round',
						strokeLinecap: 'round',
						points: series.values.map((value, index) => xAt(index).toFixed(1) + ',' + yAt(value).toFixed(1)).join(' '),
					})),
					hover !== void 0 ? h('line', { className: 'tsp-guide', x1: xAt(hover), x2: xAt(hover), y1: LINE_PAD.top, y2: LINE_PAD.top + innerHeight }) : null,
					hover !== void 0 ? models.map((series) => {
						const value = series.values[hover] ?? 0;
						return h('circle', {
							key: 'hover' + series.key, cx: xAt(hover), cy: yAt(value), r: 3,
							fill: 'var(--dsw-alias-bg-overlay)', stroke: colorOf(colorByKey, series.key), strokeWidth: 1.5,
						});
					}) : null),
				hover !== void 0 ? h(ChartTooltip, {
					left: (xAt(hover) / LINE_VB.w) * 100,
					title: dates[hover],
					rows: hoverRows,
					totalLabel: t('tooltip.total'),
				}) : null);
		});

		const BAR_VB = { w: 520, h: 170 };
		const BAR_PAD = { left: 46, right: 12, top: 10, bottom: 8 };

		/** Generic label/value hover tooltip (bar charts). */
		function ValueTooltip({ left, top, transform, title, rows }) {
			return h('div', { className: 'tsp-tooltip', style: {
				left: left + '%',
				top: (top ?? 0) + '%',
				transform: transform ?? 'translateX(-50%)',
			} },
				h('div', { className: 'tsp-tooltip-title' }, title),
				rows.map((row) => h('div', {
					className: 'tsp-tooltip-row',
					key: row.label,
					style: row.strong ? { color: 'var(--dsw-alias-label-primary)', fontWeight: 600 } : void 0,
				},
					h('span', { className: 'tsp-tooltip-name' }, row.label),
					h('span', { className: 'tsp-tooltip-value' }, row.value))));
		}

		/**
		 * Per-model bar chart with a hover tooltip splitting each bar into
		 * total / cache hit / cache miss / cache write / output. Bars need
		 * `{ key, total, input, cacheRead, cacheWrite, output }` plus an
		 * optional `label`; `fallbackLabel` covers unknown routes.
		 */
		const ModelBarChart = React.memo(function ModelBarChart({ models, colorByKey, height, fallbackLabel, t }) {
			const [hover, setHover] = React.useState(void 0);
			const count_ = models.length;
			const vbH = height ?? BAR_VB.h;
			const pad = { left: BAR_PAD.left, right: BAR_PAD.right, top: BAR_PAD.top, bottom: BAR_PAD.bottom };
			const innerWidth = BAR_VB.w - pad.left - pad.right;
			const innerHeight = vbH - pad.top - pad.bottom;
			const maxY = niceMax(Math.max(1, ...models.map((model) => model.total)));
			const yAt = (value) => pad.top + innerHeight * (1 - value / maxY);
			const slot = innerWidth / Math.max(1, count_);
			const barWidth = Math.min(40, slot * 0.6);
			const yTicks = [0, maxY / 2, maxY];
			const onMove = (event) => {
				const rect = event.currentTarget.getBoundingClientRect();
				const dataX = ((event.clientX - rect.left) * BAR_VB.w) / rect.width;
				if (dataX < pad.left) {
					setHover(void 0);
					return;
				}
				// Nearest bar center, not a slot split: bars are narrow, so the
				// pointer should follow the bar it is actually closest to.
				const index = Math.round((dataX - pad.left - slot / 2) / slot);
				setHover(index >= 0 && index < count_ ? index : void 0);
			};
			const hovered = hover === void 0 ? void 0 : models[hover];
			const tooltipRows = hovered === void 0 ? [] : [
				{ label: t('split.total'), value: formatExact(hovered.total), strong: true },
				{ label: t('split.cacheHit'), value: formatExact(hovered.cacheRead ?? 0) },
				{ label: t('split.cacheMiss'), value: formatExact(hovered.input ?? 0) },
				(hovered.cacheWrite ?? 0) > 0 ? { label: t('split.cacheWrite'), value: formatExact(hovered.cacheWrite) } : null,
				{ label: t('col.output'), value: formatExact(hovered.output ?? 0) },
			].filter(Boolean);
			// Anchor the tooltip to the hovered bar's top center: above the
			// bar when there is headroom, beside its top when the bar nearly
			// fills the plot; flipped horizontally near the chart edges.
			const barCenterX = pad.left + slot * (hover ?? 0) + slot / 2;
			const barTopY = hovered === void 0 ? 0 : yAt(hovered.total);
			const anchorX = (barCenterX / BAR_VB.w) * 100;
			const anchorY = (barTopY / vbH) * 100;
			let tooltipTransform;
			if (anchorY > 30) {
				tooltipTransform = anchorX > 82
					? 'translateX(calc(-100% + 10px)) translateY(calc(-100% - 8px))'
					: anchorX < 18
						? 'translateX(10px) translateY(calc(-100% - 8px))'
						: 'translateX(-50%) translateY(calc(-100% - 8px))';
			} else {
				tooltipTransform = anchorX > 60
					? 'translateX(calc(-100% - 14px)) translateY(-30%)'
					: 'translateX(14px) translateY(-30%)';
			}
			return h('div', { style: { position: 'relative' } },
				h('svg', {
					viewBox: '0 0 ' + BAR_VB.w + ' ' + vbH,
					role: 'img',
					onMouseMove: count_ > 0 ? onMove : void 0,
					onMouseLeave: count_ > 0 ? () => setHover(void 0) : void 0,
				},
					yTicks.map((tick) => h('g', { key: 'y' + tick },
						h('line', { className: 'tsp-grid', x1: pad.left, x2: BAR_VB.w - pad.right, y1: yAt(tick), y2: yAt(tick) }),
						h('text', { className: 'tsp-axis', x: pad.left - 6, y: yAt(tick) + 3, textAnchor: 'end' }, formatCompact(Math.round(tick))))),
					models.map((model, index) => {
						const barHeight = Math.max(2, innerHeight * (model.total / maxY));
						return h('rect', {
							key: model.key,
							x: pad.left + slot * index + (slot - barWidth) / 2,
							y: yAt(model.total),
							width: barWidth,
							height: barHeight,
							rx: 3,
							fill: colorOf(colorByKey, model.key),
							opacity: hover === void 0 || hover === index ? 1 : 0.45,
						});
					})),
				hovered !== void 0 ? h(ValueTooltip, {
					left: anchorX,
					top: anchorY,
					transform: tooltipTransform,
					title: hovered.label ?? fallbackLabel,
					rows: tooltipRows,
				}) : null);
		});

		/**
		 * Today card: the local day's total and a per-model bar chart, sourced
		 * from the daily projection's entry for the browser's calendar day.
		 */
		const TodayCard = React.memo(function TodayCard({ daily, colorByKey, t }) {
			const key = todayKey();
			const routes = daily.days ? daily.days[key] : void 0;
			const items = [];
			let total = 0;
			if (isDayMap(routes)) {
				for (const modelKey of Object.keys(routes)) {
					const buckets = routes[modelKey];
					if (!Array.isArray(buckets) || buckets.length !== 4) continue;
					const sum = buckets[0] + buckets[1] + buckets[2] + buckets[3];
					if (sum <= 0) continue;
					total += sum;
					items.push({ key: modelKey, total: sum, input: buckets[0], output: buckets[1], cacheRead: buckets[2], cacheWrite: buckets[3] });
				}
			}
			items.sort((a, b) => b.total - a.total);
			const labels = new Map(daily.models.map((series) => [series.key, series.label]));
			for (const item of items) item.label = labels.get(item.key) ?? null;
			return h('div', { className: 'tsp-chart' },
				h('div', { className: 'tsp-head' },
					h('h3', { className: 'tsp-block-title' }, t('today.title')),
					h('span', { className: 'tsp-state' }, shortDay(key))),
				total === 0 ? h('p', { className: 'tsp-empty' }, t('today.empty')) : [
					h('div', { className: 'tsp-total-row' },
						h('span', { className: 'tsp-total-value' }, formatExact(total)),
						h('span', { className: 'tsp-total-label' }, t('tooltip.total'))),
					h(ModelBarChart, { models: items, colorByKey, height: 130, fallbackLabel: t('label.unknownModel'), t }),
					h('div', { className: 'tsp-legend' }, items.map((item) => h('span', { className: 'tsp-chip', key: item.key },
						h('span', { className: 'tsp-dot', style: { background: colorOf(colorByKey, item.key) } }),
						h('span', { className: 'tsp-clip' }, labels.get(item.key) ?? t('label.unknownModel')),
						h('span', { style: { fontVariantNumeric: 'tabular-nums' } }, formatCompact(item.total))))),
				]);
		});

		/** Numeric table cell. */
		function Num({ value }) {
			return h('td', null, formatExact(value));
		}

		/** Breakdown sub-line: the four buckets behind a total. */
		function Breakdown({ t, input, cacheRead, cacheWrite, output }) {
			return h('div', { className: 'tsp-cell-sub' }, t('tip.grand', {
				input: formatCompact(input),
				cacheRead: formatCompact(cacheRead),
				cacheWrite: formatCompact(cacheWrite),
				output: formatCompact(output),
			}));
		}

		/** One usage table: by-model or per-session rows over shared columns. */
		function UsageTable({ headers, widths, children }) {
			return h('table', { className: 'tsp-table' },
				h('thead', null, h('tr', null, headers.map((label, index) => h('th', {
					key: label,
					scope: 'col',
					style: widths && widths[index] !== void 0 ? { width: widths[index] } : void 0,
				}, label)))),
				h('tbody', null, children));
		}

		const TokenUsageSection = React.memo(function TokenUsageSection(props) {
			const t = props.t;
			const controller = props.controller;
			if (typeof t !== 'function' || !controller || typeof controller.getSnapshot !== 'function') return null;
			if (props.view === 'summary') return t('section.summary');
			const snapshot = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot);
			if (snapshot.status === 'idle') controller.ensureLoaded();
			const busy = snapshot.status === 'loading';
			const billedInput = snapshot.totals.input + snapshot.totals.cacheRead + snapshot.totals.cacheWrite;
			const grand = billedInput + snapshot.totals.output;
			const cacheHit = billedInput > 0 ? Math.round((snapshot.totals.cacheRead / billedInput) * 1000) / 10 : null;
			const hasDaily = snapshot.daily.dates.length > 0;
			return h('div', { className: 'tsp-section' },
				h('div', { className: 'tsp-head' },
					h('h2', { className: 'tsp-title' }, t('section.title')),
					snapshot.fill !== null ? h('span', { className: 'tsp-state', role: 'status' }, t('label.fillPending', { done: snapshot.fill.done, total: snapshot.fill.total })) : null,
					busy ? h('span', { className: 'tsp-state', role: 'status' }, t('section.refreshing')) : null,
					h('button', {
						type: 'button',
						className: 'tsp-refresh',
						disabled: busy,
						onClick: () => controller.load(),
					}, t('section.refresh'))),
				h('p', { className: 'tsp-intro' }, t('section.intro')),
				snapshot.status === 'error' ? h('p', { className: 'tsp-error', role: 'alert' },
					t('section.loadFailed') + (snapshot.error ? ': ' + snapshot.error : ''),
					' ',
					h('button', { type: 'button', className: 'tsp-refresh', onClick: () => controller.load() }, t('section.retry'))) : null,
				snapshot.status === 'idle' || snapshot.status === 'loading' ? h('p', { className: 'tsp-empty', role: 'status' }, t('section.loading')) :
					snapshot.rows.length === 0 ? h('p', { className: 'tsp-empty' }, t('section.empty')) : [
						h(TodayCard, { daily: snapshot.daily, colorByKey: snapshot.colorByKey, t, key: 'today' }),
						h('div', { className: 'tsp-card', key: 'total' },
							h('div', { className: 'tsp-total-row' },
								h('span', { className: 'tsp-total-label' }, t('total.label')),
								h('span', { className: 'tsp-total-value', title: t('tip.grand', {
									input: formatExact(snapshot.totals.input),
									cacheRead: formatExact(snapshot.totals.cacheRead),
									cacheWrite: formatExact(snapshot.totals.cacheWrite),
									output: formatExact(snapshot.totals.output),
								}) }, formatExact(grand))),
							h('div', { className: 'tsp-buckets' },
								h('span', { className: 'tsp-bucket' }, h('span', { className: 'tsp-bucket-label' }, t('col.input')), h('span', { className: 'tsp-bucket-value' }, formatExact(snapshot.totals.input))),
								h('span', { className: 'tsp-bucket' }, h('span', { className: 'tsp-bucket-label' }, t('col.cacheRead')), h('span', { className: 'tsp-bucket-value' }, formatExact(snapshot.totals.cacheRead))),
								h('span', { className: 'tsp-bucket' }, h('span', { className: 'tsp-bucket-label' }, t('col.cacheWrite')), h('span', { className: 'tsp-bucket-value' }, formatExact(snapshot.totals.cacheWrite))),
								h('span', { className: 'tsp-bucket' }, h('span', { className: 'tsp-bucket-label' }, t('col.output')), h('span', { className: 'tsp-bucket-value' }, formatExact(snapshot.totals.output)))),
							h('div', { className: 'tsp-meta' },
								h('span', null, t('meta.sessions', { n: snapshot.totals.sessions })),
								cacheHit !== null ? h('span', null, t('meta.cacheHit', { percent: cacheHit })) : null)),
						h('div', { className: 'tsp-chart', key: 'daily' },
							h('h3', { className: 'tsp-block-title' }, t('chart.daily.title')),
							hasDaily ? h(DailyLineChart, { daily: snapshot.daily, colorByKey: snapshot.colorByKey, t }) : h('p', { className: 'tsp-empty' }, t('chart.daily.empty')),
							h('p', { className: 'tsp-hint' }, t('chart.daily.hint'))),
						h('div', { className: 'tsp-chart', key: 'bar' },
							h('h3', { className: 'tsp-block-title' }, t('chart.bar.title')),
							h(ModelBarChart, { models: snapshot.byModel, colorByKey: snapshot.colorByKey, fallbackLabel: t('label.unknownModel'), t }),
							h('div', { className: 'tsp-legend' }, snapshot.byModel.map((group) => h('span', { className: 'tsp-chip', key: group.key },
								h('span', { className: 'tsp-dot', style: { background: colorOf(snapshot.colorByKey, group.key) } }),
								group.label ?? t('label.unknownModel'),
								h('span', { style: { fontVariantNumeric: 'tabular-nums' } }, formatCompact(group.total)))))),
						h('div', { key: 'byModel' },
							h('h3', { className: 'tsp-block-title' }, t('byModel.title')),
							h(UsageTable, {
								headers: [t('col.model'), t('col.sessions'), t('col.total')],
								widths: ['auto', '64px', '30%'],
							}, snapshot.byModel.map((group) => h('tr', { key: group.key },
								h('td', null,
									h(ModelName, { color: colorOf(snapshot.colorByKey, group.key), label: group.label, fallback: t('label.unknownModel'), className: 'tsp-cell-main' }),
									group.provider !== void 0 ? h('div', { className: 'tsp-cell-sub' }, group.provider + '/' + group.model) : null,
									h(Breakdown, { t, input: group.input, cacheRead: group.cacheRead, cacheWrite: group.cacheWrite, output: group.output })),
								h('td', null, formatExact(group.sessions)),
								h(Num, { value: group.total })))),
							h('p', { className: 'tsp-hint' }, t('byModel.hint'))),
						h('div', { key: 'sessions' },
							h('h3', { className: 'tsp-block-title' }, t('sessions.title')),
							h(UsageTable, {
								headers: [t('col.session'), t('col.model'), t('col.total')],
								widths: ['auto', '34%', '30%'],
							}, snapshot.rows.map((row) => h('tr', { key: row.id },
								h('td', null,
									h('div', { className: 'tsp-cell-main tsp-clip', title: row.title ?? row.id }, row.title ?? t('label.untitled'),
										row.subagent ? h('span', { className: 'tsp-tag' }, t('label.subagent')) : null),
									h('div', { className: 'tsp-cell-sub' }, formatTime(row.updatedAt))),
								h('td', { className: 'tsp-left' },
									h(ModelName, { color: colorOf(snapshot.colorByKey, row.provider === void 0 ? UNKNOWN_KEY : row.provider + '\u0000' + row.model), label: row.label, fallback: t('label.unknownModel'), className: 'tsp-cell-main' })),
								h('td', null,
									h('div', { className: 'tsp-cell-main' }, formatExact(row.total)),
									h(Breakdown, { t, input: row.input, cacheRead: row.cacheRead, cacheWrite: row.cacheWrite, output: row.output })))))),
					]);
		});

		/** Required services (cordis fiber inject). */
		const inject = ['slots', 'locale', 'remote', 'remote.session'];

		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, dictionaries));
			// — composer dock pill (unchanged surface) —
			ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
				name: 'conversation.composer.dock',
				id: 'token-stat',
				order: 50,
				label: () => t('label'),
				locale: NS,
				inject: () => ({ t }),
			}, TokenStatPill));
			// — settings section: Token 用量 —
			const usage = new UsageController(ctx.remote);
			ctx.effect(() => () => {
				usage.dispose();
			}, 'token-stat: usage controller');
			ctx.effect(() => {
				const disposers = [
					ctx.remote.$on('api-session/added', () => usage.refreshIfLoaded()),
					ctx.remote.$on('api-session/removed', () => usage.refreshIfLoaded()),
					ctx.remote.$on('api-session/status', () => usage.refreshIfLoaded()),
					ctx.remote.$on('api-session/activity', () => usage.refreshIfLoaded()),
				];
				const resetDisposer = ctx.on('connection/reset', () => usage.reset());
				return () => {
					resetDisposer();
					for (const dispose of disposers) dispose();
				};
			}, 'token-stat: usage invalidations');
			ctx.slots.inject('settings.section', () => ctx.slots.register({
				name: 'settings.section',
				id: 'token-stat',
				order: 15,
				label: () => t('nav'),
				locale: NS,
				inject: () => ({ t, controller: usage }),
			}, TokenUsageSection));
		}

		return { inject, apply };
	},
});
