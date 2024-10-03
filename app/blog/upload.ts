interface UploadResult {
	fileId: string
}

interface MultiUploadResult {
	results: UploadResult[]
}

export type { UploadResult, MultiUploadResult }
