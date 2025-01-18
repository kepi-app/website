enum ApiError {
	Internal = "INTERNAl",
	Unauthorized = "UNAUTHORIZED",
	Conflict = "CONFLICT",
	BadRequest = "BAD_REQUEST",
	Network = "NETWORK_ERROR",
}

interface ErrorResponse {
	error: ApiError
}

function isErrorResponse(res: unknown): res is ErrorResponse {
	return typeof res === "object" && res !== null && "error" in res
}

export { ApiError, isErrorResponse }
export type { ErrorResponse }
