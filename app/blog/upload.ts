interface UploadResult {
	url: string
}

interface MultiUploadResult {
	results: UploadResult[]
}

export { UploadResult, MultiUploadResult }
