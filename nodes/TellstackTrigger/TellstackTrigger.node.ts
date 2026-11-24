import { createHmac, timingSafeEqual } from 'crypto';
import {
	NodeApiError,
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type IHttpRequestMethods,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
	type JsonObject,
} from 'n8n-workflow';

const API = 'https://tellstack.onibaku.co.uk/v1';

async function tellstackRequest(
	this: IHookFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
) {
	try {
		return (await this.helpers.httpRequestWithAuthentication.call(this, 'tellstackApi', {
			method,
			url: `${API}${path}`,
			body,
			json: true,
		})) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

// Tellstack-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${body}`>
export function validSignature(secret: string, body: string, header: string, now = Date.now()) {
	const parts = Object.fromEntries(header.split(',').map((part) => part.split('=')));
	const t = Number(parts.t);
	if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 300) return false;
	const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${body}`).digest('hex'));
	const given = Buffer.from(String(parts.v1 ?? ''));
	return given.length === expected.length && timingSafeEqual(given, expected);
}

export class TellstackTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tellstack Trigger',
		name: 'tellstackTrigger',
		icon: { light: 'file:../../icons/tellstack.svg', dark: 'file:../../icons/tellstack.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when a watched website changes or a bulk lookup finishes',
		defaults: { name: 'Tellstack Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'tellstackApi', required: true }],
		webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }],
		properties: [
			{
				displayName:
					'Domain and technology events come from your watches: add them with the Tellstack node (Watch, Create) or in the dashboard. Needs a key with the webhooks:write scope.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				options: [
					{
						name: 'Bulk Lookup Finished',
						value: 'job.completed',
						description: 'A bulk lookup has scanned every domain',
					},
					{
						name: 'Domain Changed',
						value: 'domain.changed',
						description: 'A watched domain added, removed or upgraded a technology',
					},
					{
						name: 'Technology Added',
						value: 'technology.added',
						description: 'A website started using a watched technology',
					},
				],
				default: ['domain.changed', 'technology.added'],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (!data.webhookId) return false;
				const hooks = (await tellstackRequest.call(this, 'GET', '/webhooks')) as {
					data: Array<{ id: number }>;
				};
				if (hooks.data.some((h) => h.id === data.webhookId)) return true;
				delete data.webhookId;
				delete data.secret;
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const hook = await tellstackRequest.call(this, 'POST', '/webhooks', {
					url: this.getNodeWebhookUrl('default'),
					events: this.getNodeParameter('events') as string[],
				});
				const data = this.getWorkflowStaticData('node');
				data.webhookId = hook.id;
				data.secret = hook.secret;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (data.webhookId) {
					try {
						await tellstackRequest.call(this, 'DELETE', `/webhooks/${data.webhookId as number}`);
					} catch (error) {
						if ((error as NodeApiError).httpCode !== '404') return false;
					}
				}
				delete data.webhookId;
				delete data.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const secret = this.getWorkflowStaticData('node').secret as string | undefined;
		const raw = (req as unknown as { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';
		if (!secret || !validSignature(secret, raw, String(req.headers['tellstack-signature'] ?? ''))) {
			this.getResponseObject().status(401).send('Invalid signature');
			return { noWebhookResponse: true };
		}
		return { workflowData: [this.helpers.returnJsonArray(this.getBodyData())] };
	}
}
