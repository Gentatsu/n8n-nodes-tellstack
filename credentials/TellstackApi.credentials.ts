import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TellstackApi implements ICredentialType {
	name = 'tellstackApi';

	displayName = 'Tellstack API';

	icon: Icon = { light: 'file:../icons/tellstack.svg', dark: 'file:../icons/tellstack.svg' };

	documentationUrl = 'https://tellstack.onibaku.co.uk/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Sign in at tellstack.onibaku.co.uk/app and copy your key (it starts with tsk_). The free plan includes 100 lookups a month.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://tellstack.onibaku.co.uk/v1',
			url: '/me',
		},
	};
}
