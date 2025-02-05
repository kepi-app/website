import {
	type ApplicationError,
	type CheckedPromise,
	asInternalError,
} from "~/errors"

async function fileExists(
	dir: FileSystemDirectoryHandle,
	name: string,
): CheckedPromise<boolean, ApplicationError> {
	try {
		await dir.getFileHandle(name)
		return true
	} catch (error) {
		if (error instanceof DOMException && error.name === "NotFoundError") {
			return false
		}
		throw asInternalError(error)
	}
}

export { fileExists }
