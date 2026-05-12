import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	port: number
	protocol: 'http' | 'https'
	timeoutMs: number
	allowSelfSigned: boolean
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP / Hostname',
			width: 6,
			regex: Regex.HOSTNAME,
		},
		{
			type: 'dropdown',
			id: 'protocol',
			label: 'Protocol',
			width: 3,
			default: 'http',
			choices: [
				{ id: 'http', label: 'HTTP' },
				{ id: 'https', label: 'HTTPS' },
			],
		},
		{
			type: 'number',
			id: 'port',
			label: 'Port',
			width: 3,
			min: 1,
			max: 65535,
			default: 80,
		},
		{
			type: 'number',
			id: 'timeoutMs',
			label: 'Request timeout (ms)',
			width: 6,
			min: 500,
			max: 30000,
			default: 5000,
		},
		{
			type: 'checkbox',
			id: 'allowSelfSigned',
			label: 'Allow self-signed HTTPS certificate',
			width: 6,
			default: false,
		},
	]
}
