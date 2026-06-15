import { combineRgb, type CompanionPresetDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

const DEFAULT_ZONE_ID = 'output1'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	for (const level of [-100, -50, 0]) {
		presets[`masking_${level}`] = {
			type: 'button',
			category: 'Masking',
			name: `Masking ${level}`,
			style: {
				text: `MASK\\n${level}`,
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(30, 70, 120),
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_masking_level',
							options: {
								zoneId: DEFAULT_ZONE_ID,
								level,
								levelFormat: 'api',
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}
	}

	presets.masking_toggle = {
		type: 'button',
		category: 'Masking',
		name: 'Masking toggle',
		style: {
			text: 'MASK\\nTOGGLE',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(35, 105, 55),
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'masking_enable',
						options: {
							zoneId: DEFAULT_ZONE_ID,
							state: 'toggle',
							onLevel: -100,
							offLevel: -400,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'masking_enabled',
				options: {
					zoneId: DEFAULT_ZONE_ID,
				},
				style: {
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 150, 65),
				},
			},
		],
	}

	self.setPresetDefinitions(presets)
}
