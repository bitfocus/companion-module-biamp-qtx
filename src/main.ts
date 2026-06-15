import { InstanceBase, InstanceStatus, runEntrypoint, type SomeCompanionConfigField } from '@companion-module/base'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import type { ZoneData, ZoneSummary } from './types.js'

interface ApiResponse<T> {
	statusCode: number
	body: T
	rawBody: string
}

const MIN_MASKING_LEVEL = -1000
const MAX_MASKING_LEVEL = 200
const MAX_RAW_VARIABLE_LENGTH = 4000

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

function clampMaskingLevel(value: number): number {
	return clamp(Math.round(value), MIN_MASKING_LEVEL, MAX_MASKING_LEVEL)
}

function truncateVariableValue(value: string): string {
	return value.length > MAX_RAW_VARIABLE_LENGTH ? `${value.slice(0, MAX_RAW_VARIABLE_LENGTH)}...` : value
}

function getZoneId(zone: ZoneData): string | undefined {
	const id = zone.Id ?? zone.ID ?? zone.id ?? zone.Guid ?? zone.GUID ?? zone.guid
	return typeof id === 'string' && id.trim() ? id.trim() : undefined
}

function getZoneName(zone: ZoneData, id: string): string {
	const name = zone.Name ?? zone.name
	return typeof name === 'string' && name.trim() ? name.trim() : id
}

function getZoneValue(
	zone: ZoneData,
	key: 'BackgroundLevel' | 'MaskingEnabled' | 'MaskingLevel' | 'Muted' | 'PagingLevel',
): number | boolean | undefined {
	return zone.Data?.[key] ?? zone[key]
}

function uiDbToApiLevel(value: number): number {
	return clampMaskingLevel((value - 10) * 10)
}

function getOutputMap(value: unknown): Map<string, string> {
	const outputs = new Map<string, string>()

	if (!value || typeof value !== 'object') return outputs
	const devices = (value as Record<string, unknown>).Devices
	if (!devices || typeof devices !== 'object') return outputs

	for (const device of Object.values(devices)) {
		if (!device || typeof device !== 'object') continue
		const deviceOutputs = (device as Record<string, unknown>).Outputs
		if (!deviceOutputs || typeof deviceOutputs !== 'object') continue

		for (const [outputName, output] of Object.entries(deviceOutputs)) {
			if (!output || typeof output !== 'object') continue
			const zoneId = (output as Record<string, unknown>).Zone
			if (typeof zoneId === 'string' && zoneId.trim()) outputs.set(zoneId, outputName)
		}
	}

	return outputs
}

function levelDeltaToApiDelta(value: number, format: 'api' | 'ui'): number {
	return format === 'ui' ? Math.round(value * 10) : Math.round(value)
}

function findZones(value: unknown): ZoneData[] {
	const zones: ZoneData[] = []
	const seen = new Set<object>()

	function visit(item: unknown): void {
		if (!item || typeof item !== 'object') return
		if (seen.has(item)) return
		seen.add(item)

		if (Array.isArray(item)) {
			for (const child of item) visit(child)
			return
		}

		const record = item as Record<string, unknown>

		if ('Zones' in record && record.Zones && typeof record.Zones === 'object' && !Array.isArray(record.Zones)) {
			for (const [id, zone] of Object.entries(record.Zones)) {
				if (!zone || typeof zone !== 'object') continue
				zones.push({ ...(zone as ZoneData), Id: id })
			}
			return
		}

		const hasZoneShape =
			('MaskingLevel' in record ||
				'BackgroundLevel' in record ||
				'MaskingEnabled' in record ||
				'PagingLevel' in record ||
				('Data' in record &&
					record.Data &&
					typeof record.Data === 'object' &&
					('MaskingLevel' in record.Data ||
						'MaskingEnabled' in record.Data ||
						'BackgroundLevel' in record.Data ||
						'PagingLevel' in record.Data))) &&
			('Id' in record || 'ID' in record || 'id' in record || 'Guid' in record || 'GUID' in record || 'guid' in record)

		if (hasZoneShape) {
			zones.push(record)
			return
		}

		for (const child of Object.values(record)) visit(child)
	}

	visit(value)
	return zones
}

function makeZoneUpdateBody(zone: ZoneData, patch: Partial<ZoneData>): ZoneData {
	return {
		BackgroundLevel: Number(getZoneValue(zone, 'BackgroundLevel') ?? -100),
		MaskingLevel: Number(getZoneValue(zone, 'MaskingLevel') ?? -100),
		Muted: Boolean(getZoneValue(zone, 'Muted') ?? false),
		PagingLevel: Number(getZoneValue(zone, 'PagingLevel') ?? -100),
		...patch,
	}
}

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig
	private zones = new Map<string, ZoneSummary>()
	private configGeneration = 0

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.configGeneration++
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.updateVariables('Not connected')
		await this.refreshZones()
	}

	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
		this.configGeneration++
		this.zones.clear()
		this.updateStatus(InstanceStatus.Disconnected)
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.configGeneration++
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.updateVariables('Config updated')
		await this.refreshZones()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	isZoneMuted(zoneId: string): boolean {
		const id = this.resolveZoneId(zoneId)
		return this.zones.get(id)?.muted === true
	}

	isMaskingEnabled(zoneId: string): boolean {
		const id = this.resolveZoneId(zoneId)
		const zone = this.zones.get(id)
		if (!zone) return false
		return zone.maskingLevel === undefined ? zone.maskingEnabled === true : zone.maskingLevel > -400
	}

	getMaskingLevel(zoneId: string): number | undefined {
		const id = this.resolveZoneId(zoneId)
		return this.zones.get(id)?.maskingLevel
	}

	formatMaskingLevel(zoneId: string, format: 'api' | 'ui', emptyText: string): string {
		const level = this.getMaskingLevel(zoneId)
		if (level === undefined) return emptyText
		if (format === 'ui') return `${level / 10 + 10} dB`
		return String(level)
	}

	async refreshZones(): Promise<void> {
		const generation = this.configGeneration
		try {
			this.updateStatus(InstanceStatus.Connecting, 'Refreshing zones')
			const response = await this.request<unknown>('GET', '/api/v1/Config')
			if (generation !== this.configGeneration) return

			const zones = findZones(response.body)
			const outputs = getOutputMap(response.body)
			this.zones.clear()

			for (const zone of zones) {
				const id = getZoneId(zone)
				if (!id) continue

				this.zones.set(id, {
					id,
					name: getZoneName(zone, id),
					maskingEnabled:
						typeof getZoneValue(zone, 'MaskingEnabled') === 'boolean'
							? Boolean(getZoneValue(zone, 'MaskingEnabled'))
							: undefined,
					maskingLevel:
						typeof getZoneValue(zone, 'MaskingLevel') === 'number'
							? Number(getZoneValue(zone, 'MaskingLevel'))
							: undefined,
					backgroundLevel:
						typeof getZoneValue(zone, 'BackgroundLevel') === 'number'
							? Number(getZoneValue(zone, 'BackgroundLevel'))
							: undefined,
					pagingLevel:
						typeof getZoneValue(zone, 'PagingLevel') === 'number'
							? Number(getZoneValue(zone, 'PagingLevel'))
							: undefined,
					muted: typeof getZoneValue(zone, 'Muted') === 'boolean' ? Boolean(getZoneValue(zone, 'Muted')) : undefined,
					output: outputs.get(id),
				})
			}

			this.updateStatus(InstanceStatus.Ok)
			this.updateVariables(`Found ${this.zones.size} zone(s)`, response.rawBody)
			this.checkFeedbacks('zone_muted', 'masking_enabled', 'masking_level_compare', 'masking_level_text')
		} catch (error) {
			this.handleError(error)
		}
	}

	async setMaskingLevel(zoneId: string, level: number, format: 'api' | 'ui'): Promise<void> {
		const apiLevel = format === 'ui' ? uiDbToApiLevel(level) : clampMaskingLevel(level)
		await this.updateZone(zoneId, { MaskingLevel: apiLevel })
	}

	async setMaskingEnabled(
		zoneId: string,
		state: 'true' | 'false' | 'toggle',
		onLevel = -100,
		offLevel = -400,
	): Promise<void> {
		const zone = await this.getZone(zoneId)
		const currentLevel = Number(getZoneValue(zone, 'MaskingLevel') ?? offLevel)
		const currentActive = currentLevel > offLevel
		const nextActive = state === 'toggle' ? !currentActive : state === 'true'
		await this.updateZone(
			zoneId,
			{ MaskingLevel: nextActive ? clampMaskingLevel(onLevel) : clampMaskingLevel(offLevel) },
			zone,
		)
	}

	async adjustMaskingLevel(zoneId: string, amount: number, format: 'api' | 'ui'): Promise<void> {
		const zone = await this.getZone(zoneId)
		const current = Number(getZoneValue(zone, 'MaskingLevel') ?? -100)
		await this.updateZone(
			zoneId,
			{ MaskingLevel: clampMaskingLevel(current + levelDeltaToApiDelta(amount, format)) },
			zone,
		)
	}

	async setZoneMuted(zoneId: string, muted: boolean): Promise<void> {
		await this.updateZone(zoneId, { Muted: muted })
	}

	async putCustomZoneJson(zoneId: string, json: string): Promise<void> {
		const id = this.resolveZoneId(zoneId)
		if (!id) throw new Error('Zone ID is required')
		let body: ZoneData
		try {
			body = JSON.parse(json) as ZoneData
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			throw new Error(`Invalid JSON body: ${message}`)
		}
		const response = await this.request<unknown>('PUT', `/api/v1/Config/Zone/${encodeURIComponent(id)}`, body)
		this.updateStatus(InstanceStatus.Ok)
		this.updateVariables(`PUT zone ${id}`, response.rawBody)
		await this.refreshZone(id)
	}

	private async updateZone(zoneId: string, patch: Partial<ZoneData>, currentZone?: ZoneData): Promise<void> {
		const id = this.resolveZoneId(zoneId)
		if (!id) throw new Error('Zone ID is required')

		const zone = currentZone ?? (await this.getZone(id))
		const body = makeZoneUpdateBody(zone, patch)
		const response = await this.request<unknown>('PUT', `/api/v1/Config/Zone/${encodeURIComponent(id)}`, body)
		this.updateStatus(InstanceStatus.Ok)
		this.updateVariables(`Updated zone ${id}`, response.rawBody, id, body)
		await this.refreshZone(id)
	}

	private async refreshZone(zoneId: string): Promise<void> {
		try {
			const zone = await this.getZone(zoneId)
			const id = getZoneId(zone) ?? this.resolveZoneId(zoneId)
			const summary = {
				id,
				name: getZoneName(zone, id),
				maskingEnabled:
					typeof getZoneValue(zone, 'MaskingEnabled') === 'boolean'
						? Boolean(getZoneValue(zone, 'MaskingEnabled'))
						: undefined,
				maskingLevel:
					typeof getZoneValue(zone, 'MaskingLevel') === 'number'
						? Number(getZoneValue(zone, 'MaskingLevel'))
						: undefined,
				backgroundLevel:
					typeof getZoneValue(zone, 'BackgroundLevel') === 'number'
						? Number(getZoneValue(zone, 'BackgroundLevel'))
						: undefined,
				pagingLevel:
					typeof getZoneValue(zone, 'PagingLevel') === 'number' ? Number(getZoneValue(zone, 'PagingLevel')) : undefined,
				muted: typeof getZoneValue(zone, 'Muted') === 'boolean' ? Boolean(getZoneValue(zone, 'Muted')) : undefined,
				output: this.zones.get(id)?.output,
			}
			this.zones.set(id, summary)
			this.updateVariables('Zone refreshed', JSON.stringify(zone), id, zone)
			this.checkFeedbacks('zone_muted', 'masking_enabled', 'masking_level_compare', 'masking_level_text')
		} catch (error) {
			this.handleError(error)
		}
	}

	private async getZone(zoneId: string): Promise<ZoneData> {
		const id = this.resolveZoneId(zoneId)
		if (!id) throw new Error('Zone ID is required')
		const response = await this.request<ZoneData>('GET', `/api/v1/Config/Zone/${encodeURIComponent(id)}`)
		return { ...response.body, Id: getZoneId(response.body) ?? id }
	}

	private resolveZoneId(value: string): string {
		const input = value.trim()
		if (!input) return ''
		if (this.zones.has(input)) return input

		const normalized = input.toLowerCase()
		const outputName = /^\d+$/.test(input) ? `output${input}` : normalized

		for (const zone of this.zones.values()) {
			if (zone.name.toLowerCase() === normalized) return zone.id
			if (zone.output?.toLowerCase() === outputName) return zone.id
		}

		return input
	}

	private buildUrl(path: string): URL {
		const protocol = this.config.protocol || 'http'
		const port = Number(this.config.port || (protocol === 'https' ? 443 : 80))
		const host = this.config.host?.trim()
		if (!host) throw new Error('Target host is required')
		return new URL(`${protocol}://${host}:${port}${path}`)
	}

	private async request<T>(method: 'GET' | 'PUT', path: string, body?: unknown): Promise<ApiResponse<T>> {
		const url = this.buildUrl(path)
		const timeoutMs = Number(this.config.timeoutMs || 5000)
		const payload = body === undefined ? undefined : JSON.stringify(body)
		const transport = url.protocol === 'https:' ? https : http
		const agent =
			url.protocol === 'https:' ? new https.Agent({ rejectUnauthorized: !this.config.allowSelfSigned }) : undefined

		return await new Promise((resolve, reject) => {
			const request = transport.request(
				url,
				{
					method,
					agent,
					timeout: timeoutMs,
					headers: {
						Accept: 'application/json',
						...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
					},
				},
				(response) => {
					const chunks: Buffer[] = []
					response.on('data', (chunk: Buffer) => chunks.push(chunk))
					response.on('end', () => {
						const rawBody = Buffer.concat(chunks).toString('utf8')
						const statusCode = response.statusCode ?? 0
						if (statusCode < 200 || statusCode >= 300) {
							reject(new Error(`${method} ${path} failed with HTTP ${statusCode}: ${rawBody}`))
							return
						}

						try {
							const trimmedBody = rawBody.trim()
							const parsed =
								trimmedBody.startsWith('{') || trimmedBody.startsWith('[')
									? (JSON.parse(trimmedBody) as T)
									: ((trimmedBody || {}) as T)
							resolve({ statusCode, body: parsed, rawBody })
						} catch (error) {
							reject(error instanceof Error ? error : new Error(String(error)))
						}
					})
				},
			)

			request.on('timeout', () => {
				request.destroy(new Error(`${method} ${path} timed out after ${timeoutMs}ms`))
			})
			request.on('error', reject)

			if (payload) request.write(payload)
			request.end()
		})
	}

	private updateVariables(status: string, response = '', zoneId = '', zone?: Partial<ZoneData>): void {
		const summary = [...this.zones.values()]
		const zoneName = zoneId ? (this.zones.get(zoneId)?.name ?? getZoneName(zone ?? {}, zoneId)) : ''
		const maskingLevel =
			typeof getZoneValue(zone ?? {}, 'MaskingLevel') === 'number'
				? String(getZoneValue(zone ?? {}, 'MaskingLevel'))
				: zoneId
					? String(this.zones.get(zoneId)?.maskingLevel ?? '')
					: ''
		const zoneVariables: Record<string, string> = {}

		for (let index = 0; index < 16; index++) {
			const zoneNumber = index + 1
			const item = summary[index]
			zoneVariables[`zone_${zoneNumber}_id`] = item?.id ?? ''
			zoneVariables[`zone_${zoneNumber}_name`] = item?.name ?? ''
			zoneVariables[`zone_${zoneNumber}_masking_enabled`] =
				item?.maskingEnabled === undefined ? '' : item.maskingEnabled ? 'on' : 'off'
			zoneVariables[`zone_${zoneNumber}_masking_level`] =
				item?.maskingLevel === undefined ? '' : String(item.maskingLevel)
			zoneVariables[`zone_${zoneNumber}_output`] = item?.output ?? ''
		}

		this.setVariableValues({
			connection_status: status,
			zone_count: summary.length,
			zones_list: summary.map((item) => `${item.output ? `${item.output}: ` : ''}${item.name} (${item.id})`).join('\n'),
			zones_json: truncateVariableValue(JSON.stringify(summary)),
			last_zone_id: zoneId,
			last_zone_name: zoneName,
			last_masking_level: maskingLevel,
			last_error: '',
			last_response: truncateVariableValue(response),
			...zoneVariables,
		})
	}

	handleError(error: unknown): void {
		const message = error instanceof Error ? error.message : String(error)
		const isConnectionError =
			/(\bECONNREFUSED\b|\bECONNRESET\b|\bENOTFOUND\b|\bEHOSTUNREACH\b|\bETIMEDOUT\b|\btimed out\b|socket hang up|Target host is required)/i.test(
				message,
			)

		this.log(isConnectionError ? 'error' : 'warn', message)
		if (isConnectionError) {
			this.updateStatus(InstanceStatus.ConnectionFailure, message)
		}
		this.setVariableValues({
			connection_status: isConnectionError ? 'Connection error' : 'Request error',
			last_error: message,
		})
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
