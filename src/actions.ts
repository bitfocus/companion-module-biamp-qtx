import type { CompanionActionDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

function parseLevelFormat(value: unknown): 'api' | 'ui' {
	return value === 'ui' ? 'ui' : 'api'
}

async function runWriteAction(self: ModuleInstance, task: () => Promise<void>): Promise<void> {
	try {
		await task()
	} catch (error) {
		self.handleError(error)
	}
}

export function UpdateActions(self: ModuleInstance): void {
	const actions: CompanionActionDefinitions = {
		refresh_zones: {
			name: 'Refresh zones',
			options: [],
			callback: async () => {
				await self.refreshZones()
			},
		},
		set_masking_level: {
			name: 'Set masking level',
			options: [
				{
					id: 'zoneId',
					type: 'textinput',
					label: 'Zone ID / name / output',
					default: 'output1',
					useVariables: true,
				},
				{
					id: 'level',
					type: 'number',
					label: 'Level (API -1000 to 200, or UI -90 dB to 30 dB)',
					default: -100,
					min: -1000,
					max: 200,
					step: 1,
				},
				{
					id: 'levelFormat',
					type: 'dropdown',
					label: 'Level format',
					default: 'api',
					choices: [
						{ id: 'api', label: 'Qt X API value' },
						{ id: 'ui', label: 'Qt X UI dB value' },
					],
				},
			],
			callback: async (action) => {
				await runWriteAction(self, async () => {
					const zoneId = await self.parseVariablesInString(String(action.options.zoneId ?? ''))
					await self.setMaskingLevel(
						zoneId,
						Number(action.options.level ?? -100),
						parseLevelFormat(action.options.levelFormat),
					)
				})
			},
		},
		adjust_masking_level: {
			name: 'Adjust masking level',
			options: [
				{
					id: 'zoneId',
					type: 'textinput',
					label: 'Zone ID / name / output',
					default: 'output1',
					useVariables: true,
				},
				{
					id: 'amount',
					type: 'number',
					label: 'Amount (API units, or UI dB)',
					default: 10,
					min: -200,
					max: 200,
					step: 1,
				},
				{
					id: 'levelFormat',
					type: 'dropdown',
					label: 'Amount format',
					default: 'api',
					choices: [
						{ id: 'api', label: 'Qt X API value' },
						{ id: 'ui', label: 'Qt X UI dB value' },
					],
				},
			],
			callback: async (action) => {
				await runWriteAction(self, async () => {
					const zoneId = await self.parseVariablesInString(String(action.options.zoneId ?? ''))
					await self.adjustMaskingLevel(
						zoneId,
						Number(action.options.amount ?? 10),
						parseLevelFormat(action.options.levelFormat),
					)
				})
			},
		},
		masking_enable: {
			name: 'Masking on / off / toggle',
			options: [
				{
					id: 'zoneId',
					type: 'textinput',
					label: 'Zone ID / name / output',
					default: 'output1',
					useVariables: true,
				},
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					default: 'toggle',
					choices: [
						{ id: 'true', label: 'On' },
						{ id: 'false', label: 'Off' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
				{
					id: 'onLevel',
					type: 'number',
					label: 'On level (API value)',
					default: -100,
					min: -400,
					max: 200,
					step: 1,
				},
				{
					id: 'offLevel',
					type: 'number',
					label: 'Off level (API value)',
					default: -400,
					min: -1000,
					max: 0,
					step: 1,
				},
			],
			callback: async (action) => {
				await runWriteAction(self, async () => {
					const zoneId = await self.parseVariablesInString(String(action.options.zoneId ?? ''))
					const state = String(action.options.state ?? 'toggle')
					await self.setMaskingEnabled(
						zoneId,
						state === 'true' || state === 'false' ? state : 'toggle',
						Number(action.options.onLevel ?? -100),
						Number(action.options.offLevel ?? -400),
					)
				})
			},
		},
		mute_zone: {
			name: 'Mute / unmute zone',
			options: [
				{
					id: 'zoneId',
					type: 'textinput',
					label: 'Zone ID / name / output',
					default: 'output1',
					useVariables: true,
				},
				{
					id: 'muted',
					type: 'dropdown',
					label: 'State',
					default: 'true',
					choices: [
						{ id: 'true', label: 'Mute' },
						{ id: 'false', label: 'Unmute' },
					],
				},
			],
			callback: async (action) => {
				await runWriteAction(self, async () => {
					const zoneId = await self.parseVariablesInString(String(action.options.zoneId ?? ''))
					await self.setZoneMuted(zoneId, action.options.muted === 'true')
				})
			},
		},
		put_zone_json: {
			name: 'PUT custom zone JSON',
			options: [
				{
					id: 'zoneId',
					type: 'textinput',
					label: 'Zone ID / name / output',
					default: 'output1',
					useVariables: true,
				},
				{
					id: 'json',
					type: 'textinput',
					label: 'JSON body',
					default: '{"MaskingLevel":-100}',
					useVariables: true,
				},
			],
			callback: async (action) => {
				await runWriteAction(self, async () => {
					const zoneId = await self.parseVariablesInString(String(action.options.zoneId ?? ''))
					const json = await self.parseVariablesInString(String(action.options.json ?? '{}'))
					await self.putCustomZoneJson(zoneId, json)
				})
			},
		},
	}

	self.setActionDefinitions(actions)
}
