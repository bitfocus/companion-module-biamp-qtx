export interface ZoneData {
	Id?: string
	ID?: string
	id?: string
	Guid?: string
	GUID?: string
	guid?: string
	Name?: string
	name?: string
	Data?: {
		BackgroundLevel?: number
		MaskingEnabled?: boolean
		MaskingLevel?: number
		Muted?: boolean
		PagingLevel?: number
		[key: string]: unknown
	}
	BackgroundLevel?: number
	MaskingEnabled?: boolean
	MaskingLevel?: number
	Muted?: boolean
	PagingLevel?: number
	[key: string]: unknown
}

export interface ZoneSummary {
	id: string
	name: string
	maskingEnabled?: boolean
	maskingLevel?: number
	backgroundLevel?: number
	pagingLevel?: number
	muted?: boolean
	output?: string
}
