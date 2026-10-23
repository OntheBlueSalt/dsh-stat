/**
 * Unit tests for the tokenUsageDaily session projection's fold logic.
 *
 * The fold must mirror the shipped token-meter rules: a settlement's usage
 * sample replaces the previous sample of the same (turn, step); an
 * `llm/retry-started` closes the replacement slot so a retried attempt adds.
 * Samples are attributed to the latest `request/header` route and grouped by
 * the event's local day — so replays and re-settlements never double count.
 *
 * Run with: node --test test/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { definition } from '../index.js';

const KEY = 'tokenUsageDaily';

/** Epoch ms of local noon on a date — safely inside a calendar day. */
const at = (year, month, day, hour = 12) => new Date(year, month - 1, day, hour).getTime();

/** Local calendar-day key the fold derives from a timestamp. */
const dayOf = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const usage = (inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0) =>
	({ inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens });

/** An Assistant settlement carrying `usage` at the top of its data. */
const settlement = (turn, step, time, buckets, type = 'assistant/message') => ({
	type,
	time,
	data: { turn, step, usage: usage(...buckets) },
});

/** A settlement whose usage rides the tail of its compact stream instead. */
const streamedSettlement = (turn, step, time, frames) => ({
	type: 'assistant/message',
	time,
	data: { turn, step, stream: frames },
});

const header = (provider, model) => ({
	type: 'request/header',
	time: 0,
	data: { header: { config: { provider, model } } },
});

const retry = (turn, step) => ({ type: 'llm/retry-started', time: 0, data: { turn, step } });

const fold = (state, ...events) => events.reduce(definition.apply, state);
const total = (state, date, routeKey) => state.days[date]?.[routeKey];

test('projection identity and version', () => {
	assert.equal(definition.key, KEY);
	assert.equal(definition.stateVersion, 1);
	assert.deepEqual(definition.init(), { route: null, last: null, days: {} });
});

test('first settlement records its buckets under the unknown route', () => {
	const state = fold(definition.init(), settlement(0, 0, at(2026, 10, 23), [100, 50, 20, 5]));
	assert.deepEqual(total(state, dayOf(2026, 10, 23), '?'), [100, 50, 20, 5]);
	assert.deepEqual(state.last, { turn: 0, step: 0, date: dayOf(2026, 10, 23), routeKey: '?', buckets: [100, 50, 20, 5] });
});

test('assistant/attempt settles like assistant/message', () => {
	const state = fold(definition.init(), settlement(2, 1, at(2026, 10, 23), [7, 3], 'assistant/attempt'));
	assert.deepEqual(total(state, dayOf(2026, 10, 23), '?'), [7, 3, 0, 0]);
});

test('same (turn, step) re-settlement replaces instead of accumulating', () => {
	const state = fold(
		definition.init(),
		settlement(0, 0, at(2026, 10, 23), [100, 50, 0, 0]),
		settlement(0, 0, at(2026, 10, 23), [120, 60, 10, 0]),
	);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), '?'), [120, 60, 10, 0]);
});

test('an identical re-settlement is a no-op (no double count)', () => {
	const first = fold(definition.init(), settlement(0, 0, at(2026, 10, 23), [100, 50, 0, 0]));
	const second = fold(first, settlement(0, 0, at(2026, 10, 23), [100, 50, 0, 0]));
	assert.equal(second, first);
	assert.deepEqual(total(second, dayOf(2026, 10, 23), '?'), [100, 50, 0, 0]);
});

test('llm/retry-started closes the replacement slot so the retried attempt adds', () => {
	const state = fold(
		definition.init(),
		settlement(0, 0, at(2026, 10, 23), [100, 50, 0, 0]),
		retry(0, 0),
		settlement(0, 0, at(2026, 10, 23), [30, 10, 0, 0]),
	);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), '?'), [130, 60, 0, 0]);
});

test('retry-started for another (turn, step) leaves the replacement slot closed', () => {
	const state = fold(
		definition.init(),
		settlement(0, 0, at(2026, 10, 23), [100, 50, 0, 0]),
		retry(1, 1),
		settlement(0, 0, at(2026, 10, 23), [30, 10, 0, 0]),
	);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), '?'), [30, 10, 0, 0]);
});

test('retry-started without a prior sample keeps state untouched', () => {
	const state = definition.init();
	assert.equal(fold(state, retry(0, 0)), state);
});

test('samples follow the latest request/header route', () => {
	const state = fold(
		definition.init(),
		header('deepseek', 'glm-5.3-flash'),
		settlement(0, 0, at(2026, 10, 23), [10, 5, 0, 0]),
	);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), 'deepseek\0glm-5.3-flash'), [10, 5, 0, 0]);
	assert.equal(total(state, dayOf(2026, 10, 23), '?'), undefined);
});

test('a mid-session route switch splits samples per route', () => {
	const state = fold(
		definition.init(),
		header('deepseek', 'glm-5.3-flash'),
		settlement(0, 0, at(2026, 10, 23), [10, 5, 0, 0]),
		header('deepseek', 'glm-5.3-flash-max'),
		settlement(1, 0, at(2026, 10, 23), [20, 8, 0, 0]),
	);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), 'deepseek\0glm-5.3-flash'), [10, 5, 0, 0]);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), 'deepseek\0glm-5.3-flash-max'), [20, 8, 0, 0]);
});

test('a replacement follows the current route and retracts the old sample', () => {
	const state = fold(
		definition.init(),
		header('deepseek', 'glm-5.3-flash'),
		settlement(0, 0, at(2026, 10, 23), [10, 5, 0, 0]),
		header('deepseek', 'glm-5.3-flash-max'),
		settlement(0, 0, at(2026, 10, 23), [12, 6, 0, 0]),
	);
	// The superseded sample is subtracted from the route it was recorded
	// under (its entry cancels away); only the current settlement remains.
	assert.equal(total(state, dayOf(2026, 10, 23), 'deepseek\0glm-5.3-flash'), undefined);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), 'deepseek\0glm-5.3-flash-max'), [12, 6, 0, 0]);
});

test('a malformed request/header keeps the previous route', () => {
	const routed = fold(definition.init(), header('deepseek', 'glm-5.3-flash'));
	const same = fold(
		routed,
		{ type: 'request/header', time: 0, data: {} },
		{ type: 'request/header', time: 0, data: { header: { config: { provider: '' } } } },
		{ type: 'request/header', time: 0, data: void 0 },
	);
	assert.equal(same, routed);
});

test('a replacement across midnight moves the sample day and drops the emptied day', () => {
	const state = fold(
		definition.init(),
		settlement(0, 0, at(2026, 10, 22), [100, 50, 0, 0]),
		settlement(0, 0, at(2026, 10, 23), [40, 20, 0, 0]),
	);
	assert.deepEqual(state.days, { [dayOf(2026, 10, 23)]: { '?': [40, 20, 0, 0] } });
});

test('settlements land on separate days independently', () => {
	const state = fold(
		definition.init(),
		settlement(0, 0, at(2026, 10, 22), [10, 5, 0, 0]),
		settlement(1, 0, at(2026, 10, 23), [20, 8, 0, 0]),
	);
	assert.deepEqual(total(state, dayOf(2026, 10, 22), '?'), [10, 5, 0, 0]);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), '?'), [20, 8, 0, 0]);
});

test('a settlement without event.time folds into the Host-local today', () => {
	const now = new Date();
	const today = dayOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
	const state = fold(definition.init(), { type: 'assistant/message', data: { turn: 0, step: 0, usage: usage(1, 2) } });
	assert.deepEqual(total(state, today, '?'), [1, 2, 0, 0]);
});

test('usage embedded in the compact stream is read from its last frame', () => {
	const state = fold(
		definition.init(),
		streamedSettlement(0, 0, at(2026, 10, 23), [
			{ text: 'no usage here' },
			{ chunk: { usage: usage(10, 5) } },
			{ usage: usage(30, 15) },
		]),
	);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), '?'), [30, 15, 0, 0]);
});

test('stream frames expose usage through chunk alone', () => {
	const state = fold(
		definition.init(),
		streamedSettlement(0, 0, at(2026, 10, 23), [{ chunk: { usage: usage(10, 5, 3, 1) } }]),
	);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), '?'), [10, 5, 3, 1]);
});

test('events without a usable sample leave state untouched', () => {
	const base = fold(definition.init(), settlement(0, 0, at(2026, 10, 23), [10, 5, 0, 0]));
	for (const event of [
		{ type: 'assistant/message', time: at(2026, 10, 23), data: { turn: 1, step: 0 } },
		{ type: 'assistant/message', time: at(2026, 10, 23), data: { turn: 1, step: 0, usage: {} } },
		{ type: 'assistant/message', time: at(2026, 10, 23), data: { turn: 1.5, step: 0, usage: usage(9, 9) } },
		{ type: 'assistant/message', time: at(2026, 10, 23), data: void 0 },
		{ type: 'user/message', time: at(2026, 10, 23), data: { turn: 1, step: 0, usage: usage(9, 9) } },
	]) {
		assert.equal(fold(base, event), base);
	}
});

test('folding never mutates the previous state', () => {
	const before = fold(definition.init(), settlement(0, 0, at(2026, 10, 23), [10, 5, 0, 0]));
	const snapshot = JSON.parse(JSON.stringify(before));
	fold(before, settlement(1, 0, at(2026, 10, 24), [20, 8, 0, 0]));
	assert.deepEqual(before, snapshot);
});

test('optional cache buckets default to zero', () => {
	const state = fold(
		definition.init(),
		{ type: 'assistant/message', time: at(2026, 10, 23), data: { turn: 0, step: 0, usage: { inputTokens: 4, outputTokens: 2 } } },
	);
	assert.deepEqual(total(state, dayOf(2026, 10, 23), '?'), [4, 2, 0, 0]);
});

test('wire view serves the day map and validates it', () => {
	const state = fold(definition.init(), settlement(0, 0, at(2026, 10, 23), [10, 5, 0, 0]));
	const view = definition.wire.view(state);
	assert.deepEqual(view, state.days);
	assert.deepEqual(definition.wire.viewSchema.parse(view), view);
	assert.throws(() => definition.wire.viewSchema.parse([]), TypeError);
	assert.throws(() => definition.wire.viewSchema.parse({ '2026-10-23': { '?': [1, 2, 3] } }), TypeError);
});

test('stateSchema.parse accepts a well-formed state', () => {
	const state = {
		route: { provider: 'deepseek', model: 'glm-5.3-flash' },
		last: { turn: 0, step: 0, date: dayOf(2026, 10, 23), routeKey: '?', buckets: [1, 2, 3, 4] },
		days: { [dayOf(2026, 10, 23)]: { '?': [1, 2, 3, 4] } },
	};
	assert.equal(definition.stateSchema.parse(state), state);
	assert.deepEqual(definition.stateSchema.parse({ route: null, last: null, days: {} }), { route: null, last: null, days: {} });
});

test('stateSchema.parse rejects malformed states', () => {
	const valid = () => definition.stateSchema.parse({
		route: null,
		last: { turn: 0, step: 0, date: dayOf(2026, 10, 23), routeKey: '?', buckets: [1, 2, 3, 4] },
		days: { [dayOf(2026, 10, 23)]: { '?': [1, 2, 3, 4] } },
	});
	assert.doesNotThrow(valid);
	for (const state of [
		null,
		'state',
		[],
		{ route: 'deepseek', last: null, days: {} },
		{ route: { provider: 'deepseek' }, last: null, days: {} },
		{ route: null, last: { turn: -1, step: 0, date: dayOf(2026, 10, 23), routeKey: '?', buckets: [1, 2, 3, 4] }, days: {} },
		{ route: null, last: { turn: 0, step: 0, date: '20261023', routeKey: '?', buckets: [1, 2, 3, 4] }, days: {} },
		{ route: null, last: { turn: 0, step: 0, date: dayOf(2026, 10, 23), routeKey: '?', buckets: [1, 2, 3] }, days: {} },
		{ route: null, last: { turn: 0, step: 0, date: dayOf(2026, 10, 23), routeKey: '?', buckets: [1, 2, 3, -4] }, days: {} },
		{ route: null, last: null, days: [] },
		{ route: null, last: null, days: { '20261023': {} } },
		{ route: null, last: null, days: { [dayOf(2026, 10, 23)]: [] } },
		{ route: null, last: null, days: { [dayOf(2026, 10, 23)]: { '?': [1, 2] } } },
		{ route: null, last: null, days: { [dayOf(2026, 10, 23)]: { '?': [1, 2, 3, 4.5] } } },
	]) {
		assert.throws(() => definition.stateSchema.parse(state), TypeError);
	}
});
