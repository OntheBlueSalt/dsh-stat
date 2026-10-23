/**
 * token-stat — Host half.
 *
 * Registers one session-projection unit, `tokenUsageDaily`, and nothing else:
 *
 *  - The fold mirrors the shipped token-meter usage unit's rules — each
 *    Assistant settlement's usage sample replaces the previous sample of the
 *    same (turn, step); `llm/retry-started` closes that replacement slot so a
 *    retried attempt adds. Samples are attributed to the route of the latest
 *    `request/header` and grouped by the event's local day.
 *  - State is `{ days: { 'YYYY-MM-DD': { 'provider\0model': [input, output,
 *    cacheRead, cacheWrite] } } }`; the wire view serves `days` directly, so
 *    the value rides `session/list` rows and `session/projections` like any
 *    other projection and the Client never folds session events.
 *  - Registration is optional (`ctx.inject(['sessionProjections'], …)`): a
 *    composition without the projection registry keeps every other surface of
 *    this plugin alive, just without daily detail.
 *  - The composer-dock pill and the settings page read served values only —
 *    the shipped token-meter `tokenUsage` projection and the session
 *    controller's `session/list` / `session/projections` Remotes.
 */

const KEY = 'tokenUsageDaily';
const STATE_VERSION = 1;

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBucketArray(value) {
	return Array.isArray(value) && value.length === 4 && value.every((n) => Number.isSafeInteger(n) && n >= 0);
}

function isDayMap(value) {
	if (!isPlainObject(value)) return false;
	for (const date of Object.keys(value)) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isPlainObject(value[date])) return false;
		for (const routeKey of Object.keys(value[date])) {
			if (!isBucketArray(value[date][routeKey])) return false;
		}
	}
	return true;
}

/** Local (Host timezone) calendar day of an epoch-milliseconds stamp. */
function dayOf(timestamp) {
	const date = new Date(timestamp);
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

function isRoute(value) {
	return isPlainObject(value)
		&& typeof value.provider === 'string' && value.provider !== ''
		&& typeof value.model === 'string' && value.model !== '';
}

function routeKeyOf(route) {
	return isRoute(route) ? route.provider + '\u0000' + route.model : '?';
}

/** Provider usage of one Assistant settlement event, if it reports any. */
function isUsage(value) {
	return isPlainObject(value)
		&& Number.isSafeInteger(value.inputTokens) && value.inputTokens >= 0
		&& Number.isSafeInteger(value.outputTokens) && value.outputTokens >= 0;
}

function usageOf(event) {
	const data = event.data;
	if (data === void 0 || typeof data !== 'object') return void 0;
	if (isUsage(data.usage)) return data.usage;
	// Settlements may embed the usage in their compact stream instead; scan
	// the tail for the last frame that carries one.
	const stream = data.stream;
	if (Array.isArray(stream)) {
		for (let index = stream.length - 1; index >= 0; index -= 1) {
			const item = stream[index];
			if (item === null || typeof item !== 'object') continue;
			if (isUsage(item.usage)) return item.usage;
			const chunk = item.chunk;
			if (chunk !== null && typeof chunk === 'object' && isUsage(chunk.usage)) return chunk.usage;
		}
	}
	return void 0;
}

function bucketsFrom(usage) {
	return [
		usage.inputTokens,
		usage.outputTokens,
		typeof usage.cacheReadTokens === 'number' && Number.isSafeInteger(usage.cacheReadTokens) && usage.cacheReadTokens >= 0 ? usage.cacheReadTokens : 0,
		typeof usage.cacheWriteTokens === 'number' && Number.isSafeInteger(usage.cacheWriteTokens) && usage.cacheWriteTokens >= 0 ? usage.cacheWriteTokens : 0,
	];
}

function sameBuckets(left, right) {
	return left[0] === right[0] && left[1] === right[1] && left[2] === right[2] && left[3] === right[3];
}

/** Add `add` into a copy of `base`; drop the entry when it becomes all-zero. */
function addBuckets(base, add) {
	const next = [base[0] + add[0], base[1] + add[1], base[2] + add[2], base[3] + add[3]];
	return next.every((n) => n === 0) ? void 0 : next;
}

/** Immutably record one sample's buckets under (date, routeKey). */
function recordSample(days, date, routeKey, buckets) {
	const routes = isPlainObject(days[date]) ? days[date] : {};
	const updatedRoutes = { ...routes, [routeKey]: addBuckets(routes[routeKey] ?? [0, 0, 0, 0], buckets) ?? undefined };
	if (updatedRoutes[routeKey] === void 0) delete updatedRoutes[routeKey];
	const updatedDays = { ...days, [date]: updatedRoutes };
	if (Object.keys(updatedRoutes).length === 0) delete updatedDays[date];
	return updatedDays;
}

/** Immutably remove a previously recorded sample (replacement semantics). */
function dropSample(days, date, routeKey, buckets) {
	const routes = days[date];
	if (!isPlainObject(routes)) return days;
	const current = routes[routeKey];
	if (!isBucketArray(current)) return days;
	return recordSample(days, date, routeKey, [-buckets[0], -buckets[1], -buckets[2], -buckets[3]]);
}

const definition = {
	key: KEY,
	stateVersion: STATE_VERSION,
	stateSchema: {
		parse(value) {
			if (!isPlainObject(value)) throw new TypeError('tokenUsageDaily state: expected an object');
			if (value.route !== null && !isRoute(value.route)) throw new TypeError('tokenUsageDaily state: bad route');
			const last = value.last;
			if (last !== null && last !== void 0) {
				if (!isPlainObject(last)
					|| !Number.isSafeInteger(last.turn) || last.turn < 0
					|| !Number.isSafeInteger(last.step) || last.step < 0
					|| !/^\d{4}-\d{2}-\d{2}$/.test(last.date)
					|| typeof last.routeKey !== 'string'
					|| !isBucketArray(last.buckets)) throw new TypeError('tokenUsageDaily state: bad last sample');
			}
			if (!isDayMap(value.days)) throw new TypeError('tokenUsageDaily state: bad days map');
			return value;
		},
	},
	init: () => ({ route: null, last: null, days: {} }),
	apply: (state, event) => {
		const type = event.type;
		if (type === 'request/header') {
			const config = isPlainObject(event.data) ? event.data.header : void 0;
			const route = isPlainObject(config) && isRoute(config.config) ? { provider: config.config.provider, model: config.config.model } : state.route;
			return route === state.route || (isRoute(route) && isRoute(state.route) && route.provider === state.route.provider && route.model === state.route.model)
				? state
				: { ...state, route };
		}
		if (type === 'llm/retry-started') {
			const data = isPlainObject(event.data) ? event.data : void 0;
			if (state.last !== null && data !== void 0 && state.last.turn === data.turn && state.last.step === data.step) {
				return { ...state, last: null };
			}
			return state;
		}
		if (type !== 'assistant/message' && type !== 'assistant/attempt') return state;
		const sample = usageOf(event);
		if (sample === void 0) return state;
		const data = event.data;
		if (!isPlainObject(data) || !Number.isSafeInteger(data.turn) || !Number.isSafeInteger(data.step)) return state;
		const buckets = bucketsFrom(sample);
		const date = Number.isFinite(event.time) ? dayOf(event.time) : dayOf(Date.now());
		const routeKey = routeKeyOf(state.route);
		const previous = state.last !== null && state.last.turn === data.turn && state.last.step === data.step ? state.last : void 0;
		if (previous !== void 0 && previous.date === date && previous.routeKey === routeKey && sameBuckets(previous.buckets, buckets)) {
			return state;
		}
		let days = state.days;
		if (previous !== void 0) days = dropSample(days, previous.date, previous.routeKey, previous.buckets);
		days = recordSample(days, date, routeKey, buckets);
		return {
			route: state.route,
			last: { turn: data.turn, step: data.step, date, routeKey, buckets },
			days,
		};
	},
	wire: {
		viewSchema: {
			parse(value) {
				if (!isDayMap(value)) throw new TypeError('tokenUsageDaily view: expected a day map');
				return value;
			},
		},
		view: (state) => state.days,
	},
};

export const inject = [];

/** The projection unit itself, exposed for unit tests; the runtime path is apply() above. */
export { definition };

export function apply(ctx) {
	ctx.inject(['sessionProjections'], (projectionCtx) => {
		projectionCtx.effect(() => projectionCtx.sessionProjections.register(definition), 'token-stat: tokenUsageDaily projection');
	});
}
