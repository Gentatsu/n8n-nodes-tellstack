import {
	NodeConnectionTypes,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

const show = (resource: string, operation: string[]) => ({ show: { resource: [resource], operation } });
const qs = (name: string) => ({ request: { qs: { [name]: '={{$value || undefined}}' } } });
const data = { postReceive: [{ type: 'rootProperty' as const, properties: { property: 'data' } }] };
const deleted = {
	postReceive: [{ type: 'set' as const, properties: { value: '={{ { "deleted": true } }}' } }],
};

// Return All / Limit for the offset-paged lists, which answer { data, total, limit, offset }
function paging(resource: string, operation: string, max: number, total = 'total'): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			displayOptions: show(resource, [operation]),
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			routing: {
				send: { paginate: '={{ $value }}', type: 'query', property: 'limit', value: '100' },
				operations: {
					pagination: {
						type: 'generic',
						properties: {
							continue: `={{ $response.body.data.length > 0 && $response.body.offset + $response.body.limit < $response.body.${total} }}`,
							request: { qs: { offset: '={{ $response.body.offset + $response.body.limit }}' } },
						},
					},
				},
			},
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			displayOptions: { show: { resource: [resource], operation: [operation], returnAll: [false] } },
			typeOptions: { minValue: 1, maxValue: max },
			default: 50,
			description: 'Max number of results to return',
			routing: { send: { type: 'query', property: 'limit' }, output: { maxResults: '={{$value}}' } },
		},
	];
}

const domainProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['domain'] } },
		options: [
			{
				name: 'Look Up',
				value: 'lookup',
				description:
					'Get the technologies a website uses, with version, confidence and evidence. Uses 1 credit.',
				action: 'Look up a website',
				routing: { request: { method: 'GET', url: '/lookup' } },
			},
			{
				name: 'Get History',
				value: 'history',
				description: 'Get when technologies were added, removed or upgraded on a website',
				action: 'Get a website s technology history',
				routing: {
					request: { method: 'GET', url: '=/domains/{{encodeURIComponent($parameter.domain)}}/history' },
					output: data,
				},
			},
		],
		default: 'lookup',
	},
	{
		displayName: 'Domain',
		name: 'domain',
		type: 'string',
		required: true,
		displayOptions: show('domain', ['lookup', 'history']),
		default: '',
		placeholder: 'e.g. example.com',
		description: 'A domain or URL',
	},
	{
		displayName: 'Domain Query',
		name: 'domainQuery',
		type: 'hidden',
		displayOptions: show('domain', ['lookup']),
		default: '={{$parameter.domain}}',
		routing: { send: { type: 'query', property: 'domain' } },
	},
	{
		displayName: 'Maximum Age (Days)',
		name: 'maxAge',
		type: 'number',
		displayOptions: show('domain', ['lookup']),
		typeOptions: { minValue: 0, maxValue: 365 },
		default: 30,
		description:
			'Use a scan from the index if it is newer than this many days. 0 always scans the site live.',
		routing: { send: { type: 'query', property: 'maxAge' } },
	},
];

const technologyProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['technology'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a technology, with its site count and the versions seen',
				action: 'Get a technology',
				routing: {
					request: { method: 'GET', url: '=/technologies/{{encodeURIComponent($parameter.slug)}}' },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Search the technologies Tellstack detects, by name or category. Free.',
				action: 'Get many technologies',
				routing: { request: { method: 'GET', url: '/technologies' }, output: data },
			},
			{
				name: 'Get Websites',
				value: 'getSites',
				description:
					'List websites that use a technology, most popular first. Uses 1 credit per 10 websites.',
				action: 'Get websites using a technology',
				routing: {
					request: {
						method: 'GET',
						url: '=/technologies/{{encodeURIComponent($parameter.slug)}}/sites',
					},
					output: data,
				},
			},
		],
		default: 'get',
	},
	{
		displayName: 'Technology Slug',
		name: 'slug',
		type: 'string',
		required: true,
		displayOptions: show('technology', ['get', 'getSites']),
		default: '',
		placeholder: 'e.g. shopify',
		description: 'The technology’s slug. Technology, Get Many finds it.',
	},
	...paging('technology', 'getAll', 1000),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		displayOptions: show('technology', ['getAll']),
		default: {},
		options: [
			{
				displayName: 'Name Contains',
				name: 'q',
				type: 'string',
				default: '',
				routing: qs('q'),
			},
			{
				displayName: 'Category Slug',
				name: 'category',
				type: 'string',
				default: '',
				placeholder: 'e.g. cms',
				routing: qs('category'),
			},
		],
	},
	...paging('technology', 'getSites', 1000),
	{
		displayName: 'Filters',
		name: 'siteFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		displayOptions: show('technology', ['getSites']),
		default: {},
		options: [
			{
				displayName: 'First Seen Since',
				name: 'since',
				type: 'dateTime',
				default: '',
				description: 'Only websites first seen using it at or after this time',
				routing: qs('since'),
			},
			{
				displayName: 'Minimum Confidence',
				name: 'minConfidence',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 100 },
				default: 50,
				routing: qs('minConfidence'),
			},
			{
				displayName: 'Top-Level Domain',
				name: 'tld',
				type: 'string',
				default: '',
				placeholder: 'e.g. uk',
				routing: qs('tld'),
			},
		],
	},
];

const jobProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['bulkLookup'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Look up many domains (up to 10,000) in the background. Uses 1 credit per domain.',
				action: 'Create a bulk lookup',
				routing: { request: { method: 'POST', url: '/jobs' } },
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a bulk lookup’s status and progress',
				action: 'Get a bulk lookup',
				routing: { request: { method: 'GET', url: '=/jobs/{{$parameter.jobId}}' } },
			},
			{
				name: 'Get Results',
				value: 'getResults',
				description: 'Get each domain’s technologies from a bulk lookup',
				action: 'Get bulk lookup results',
				routing: { request: { method: 'GET', url: '=/jobs/{{$parameter.jobId}}/results' }, output: data },
			},
		],
		default: 'create',
	},
	{
		displayName: 'Domains',
		name: 'domains',
		type: 'string',
		required: true,
		typeOptions: { rows: 4 },
		displayOptions: show('bulkLookup', ['create']),
		default: '',
		placeholder: 'e.g. example.com, example.org',
		description: 'Domains separated by commas, spaces or new lines',
		routing: {
			send: {
				type: 'body',
				property: 'domains',
				value: '={{ String($value).split(/[\\s,]+/).filter(Boolean) }}',
			},
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		displayOptions: show('bulkLookup', ['create']),
		default: '',
		routing: { send: { type: 'body', property: 'name', value: '={{$value || undefined}}' } },
	},
	{
		displayName: 'Bulk Lookup ID',
		name: 'jobId',
		type: 'number',
		required: true,
		displayOptions: show('bulkLookup', ['get', 'getResults']),
		default: 0,
	},
	{
		displayName: 'Include Evidence',
		name: 'evidence',
		type: 'boolean',
		displayOptions: show('bulkLookup', ['getResults']),
		default: false,
		description: 'Whether to include the evidence for each technology',
		routing: { send: { type: 'query', property: 'evidence' } },
	},
];

const watchProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['watch'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description:
					'Watch a domain for changes, or a technology for new websites using it. Use the Tellstack Trigger to act on them.',
				action: 'Create a watch',
				routing: { request: { method: 'POST', url: '/watches' } },
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Stop watching a domain or technology',
				action: 'Delete a watch',
				routing: { request: { method: 'DELETE', url: '=/watches/{{$parameter.watchId}}' }, output: deleted },
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the domains and technologies being watched',
				action: 'Get many watches',
				routing: { request: { method: 'GET', url: '/watches' }, output: data },
			},
		],
		default: 'create',
	},
	{
		displayName: 'Watch',
		name: 'kind',
		type: 'options',
		displayOptions: show('watch', ['create']),
		options: [
			{ name: 'Domain', value: 'domain' },
			{ name: 'Technology', value: 'technology' },
		],
		default: 'technology',
	},
	{
		displayName: 'Domain or Technology Slug',
		name: 'target',
		type: 'string',
		required: true,
		displayOptions: show('watch', ['create']),
		default: '',
		placeholder: 'e.g. shopify',
		routing: { send: { type: 'body', property: '={{$parameter.kind}}' } },
	},
	{
		displayName: 'Watch ID',
		name: 'watchId',
		type: 'number',
		required: true,
		displayOptions: show('watch', ['delete']),
		default: 0,
	},
];

export class Tellstack implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tellstack',
		name: 'tellstack',
		icon: { light: 'file:../../icons/tellstack.svg', dark: 'file:../../icons/tellstack.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Look up the technologies behind any website and find websites that use a technology',
		defaults: { name: 'Tellstack' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'tellstackApi', required: true }],
		requestDefaults: {
			baseURL: 'https://tellstack.onibaku.co.uk/v1',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Bulk Lookup', value: 'bulkLookup' },
					{ name: 'Domain', value: 'domain' },
					{ name: 'Technology', value: 'technology' },
					{ name: 'Watch', value: 'watch' },
				],
				default: 'domain',
			},
			...domainProperties,
			...technologyProperties,
			...jobProperties,
			...watchProperties,
		],
	};
}
