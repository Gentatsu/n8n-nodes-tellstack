// Live check of the trigger against the Tellstack API: TELLSTACK_KEY=tsk_... node test/trigger.mjs (after npm run build)
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { TellstackTrigger, validSignature } from '../dist/nodes/TellstackTrigger/TellstackTrigger.node.js';

const key = process.env.TELLSTACK_KEY;
assert.ok(key, 'set TELLSTACK_KEY');
const staticData = {};
const params = { events: ['job.completed'] };

async function request(_cred, o) {
	const res = await fetch(o.url, {
		method: o.method ?? 'GET',
		headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
		body: o.body ? JSON.stringify(o.body) : undefined,
	});
	const body = res.status === 204 ? undefined : await res.json();
	if (!res.ok) throw Object.assign(new Error(body?.detail), { httpCode: String(res.status) });
	return body;
}

const hooks = {
	getNode: () => ({ name: 'Tellstack Trigger' }),
	getWorkflowStaticData: () => staticData,
	getNodeParameter: (name) => params[name],
	getNodeWebhookUrl: () => 'https://example.com/n8n-tellstack-test',
	helpers: { httpRequestWithAuthentication: request },
};
const methods = new TellstackTrigger().webhookMethods.default;

assert.equal(await methods.checkExists.call(hooks), false);
assert.equal(await methods.create.call(hooks), true);
assert.match(staticData.secret, /^whsec_/);
const listed = await request(null, { url: 'https://tellstack.onibaku.co.uk/v1/webhooks' });
assert.deepEqual(listed.data.find((h) => h.id === staticData.webhookId).events, ['job.completed']);
assert.equal(await methods.checkExists.call(hooks), true);

// A delivery signed the way Tellstack signs them becomes one item; a bad signature gets a 401
const body = JSON.stringify({ event: 'job.completed', jobId: 7, name: null, total: 2 });
const t = Math.floor(Date.now() / 1000);
const sig = `t=${t},v1=${createHmac('sha256', staticData.secret).update(`${t}.${body}`).digest('hex')}`;
let status;
const delivery = (header) => ({
	getRequestObject: () => ({ rawBody: Buffer.from(body), headers: { 'tellstack-signature': header } }),
	getResponseObject: () => ({ status: (s) => ((status = s), { send() {} }) }),
	getWorkflowStaticData: () => staticData,
	getBodyData: () => JSON.parse(body),
	helpers: { returnJsonArray: (a) => [a].flat().map((json) => ({ json })) },
});
const trigger = new TellstackTrigger();
const ok = await trigger.webhook.call(delivery(sig));
assert.equal(ok.workflowData[0][0].json.jobId, 7);
assert.deepEqual(await trigger.webhook.call(delivery(`t=${t},v1=${'0'.repeat(64)}`)), { noWebhookResponse: true });
assert.equal(status, 401);
assert.equal(validSignature(staticData.secret, body, `t=${t - 600},v1=x`), false);

assert.equal(await methods.delete.call(hooks), true);
assert.equal(staticData.webhookId, undefined);
console.log('trigger ok');
