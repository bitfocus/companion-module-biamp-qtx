import { combineRgb, type CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

function compareLevel(current: number | undefined, comparison: string, target: number): boolean {
	if (current === undefined) return false

	switch (comparison) {
		case 'eq':
			return current === target
		case 'gt':
			return current > target
		case 'gte':
			return current >= target
		case 'lt':
			return current < target
		case 'lte':
			return current <= target
		default:
			return false
	}
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {
		zone_muted: {
			name: 'Zone is muted',
			type: 'boolean',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(180, 0, 0),
			},
			options: [
				{
					id: 'zoneId',
					type: 'textinput',
					label: 'Zone ID',
					default: '',
					useVariables: true,
				},
			],
			callback: async (feedback) => {
				const zoneId = await self.parseVariablesInString(String(feedback.options.zoneId ?? ''))
				return self.isZoneMuted(zoneId)
			},
		},
		masking_enabled: {
			name: 'Masking is enabled',
			type: 'boolean',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 120, 45),
			},
			options: [
				{
					id: 'zoneId',
					type: 'textinput',
					label: 'Zone ID / name / output',
					default: '',
					useVariables: true,
				},
			],
			callback: async (feedback) => {
				const zoneId = await self.parseVariablesInString(String(feedback.options.zoneId ?? ''))
				return self.isMaskingEnabled(zoneId)
			},
		},
		masking_level_compare: {
			name: 'Masking level matches comparison',
			type: 'boolean',
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(20, 90, 170),
			},
			options: [
				{
					id: 'zoneId',
					type: 'textinput',
					label: 'Zone ID / name / output',
					default: '',
					useVariables: true,
				},
				{
					id: 'comparison',
					type: 'dropdown',
					label: 'Comparison',
					default: 'eq',
					choices: [
						{ id: 'eq', label: 'Equal to' },
						{ id: 'gt', label: 'Above' },
						{ id: 'gte', label: 'At or above' },
						{ id: 'lt', label: 'Below' },
						{ id: 'lte', label: 'At or below' },
					],
				},
				{
					id: 'level',
					type: 'number',
					label: 'Masking level (API value)',
					default: -100,
					min: -1000,
					max: 200,
					step: 1,
				},
			],
			callback: async (feedback) => {
				const zoneId = await self.parseVariablesInString(String(feedback.options.zoneId ?? ''))
				return compareLevel(
					self.getMaskingLevel(zoneId),
					String(feedback.options.comparison ?? 'eq'),
					Number(feedback.options.level ?? -100),
				)
			},
		},
		masking_level_text: {
			name: 'Show masking level as text',
			type: 'advanced',
			options: [
				{
					id: 'zoneId',
					type: 'textinput',
					label: 'Zone ID / name / output',
					default: '',
					useVariables: true,
				},
				{
					id: 'format',
					type: 'dropdown',
					label: 'Format',
					default: 'api',
					choices: [
						{ id: 'api', label: 'API value' },
						{ id: 'ui', label: 'Qt X UI dB value' },
					],
				},
				{
					id: 'prefix',
					type: 'textinput',
					label: 'Prefix',
					default: 'MASK\\n',
					useVariables: true,
				},
				{
					id: 'emptyText',
					type: 'textinput',
					label: 'Text when unavailable',
					default: 'MASK\\n--',
					useVariables: true,
				},
			],
			callback: async (feedback) => {
				const zoneId = await self.parseVariablesInString(String(feedback.options.zoneId ?? ''))
				const prefix = await self.parseVariablesInString(String(feedback.options.prefix ?? ''))
				const emptyText = await self.parseVariablesInString(String(feedback.options.emptyText ?? ''))
				const value = self.formatMaskingLevel(zoneId, feedback.options.format === 'ui' ? 'ui' : 'api', emptyText)

				return {
					text: value === emptyText ? emptyText : `${prefix}${value}`,
				}
			},
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
