import type { ModuleInstance } from './main.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions([
		{ variableId: 'connection_status', name: 'Connection status' },
		{ variableId: 'zone_count', name: 'Zone count' },
		{ variableId: 'zones_list', name: 'Zones list' },
		{ variableId: 'zones_json', name: 'Zones JSON' },
		{ variableId: 'last_zone_id', name: 'Last zone ID' },
		{ variableId: 'last_zone_name', name: 'Last zone name' },
		{ variableId: 'last_masking_level', name: 'Last masking level API value' },
		{ variableId: 'last_error', name: 'Last error' },
		{ variableId: 'last_response', name: 'Last response' },
		...Array.from({ length: 16 }, (_, index) => {
			const zoneNumber = index + 1
			return [
				{ variableId: `zone_${zoneNumber}_id`, name: `Zone ${zoneNumber} ID` },
				{ variableId: `zone_${zoneNumber}_name`, name: `Zone ${zoneNumber} name` },
				{ variableId: `zone_${zoneNumber}_masking_enabled`, name: `Zone ${zoneNumber} masking enabled` },
				{ variableId: `zone_${zoneNumber}_masking_level`, name: `Zone ${zoneNumber} masking level API value` },
				{ variableId: `zone_${zoneNumber}_output`, name: `Zone ${zoneNumber} output` },
			]
		}).flat(),
	])
}
