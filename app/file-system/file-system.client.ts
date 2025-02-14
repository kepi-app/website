import mime from "mime"
import {
	AUTH_TAG_BYTE_LENGTH,
	IV_BYTE_LENGTH,
	type RawCipher,
	type SymmetricKey,
	bytesFromBase64,
	decryptRaw,
	rawCipherFromUint8Array,
	stringFromBytes,
} from "~/crypt"
import {
	type ApplicationError,
	type CheckedPromise,
	ERROR_TYPE,
	type InternalError,
	applicationError,
	asInternalError,
} from "~/errors"
import FileSystemWorker from "./worker?worker"

const worker = new FileSystemWorker()

interface WriteFileOptions {
	key: SymmetricKey | null
}

interface WriteFileResult {
	fileName: string
}

function newRequestId() {
	return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
}

function writeFile(
	path: string,
	data: string | ReadableStream<Uint8Array>,
	opts: WriteFileOptions,
): CheckedPromise<WriteFileResult, ApplicationError> {
	return new Promise((resolve, reject) => {
		const id = newRequestId()

		function onMessage(event: MessageEvent<[number, WriteFileResult]>) {
			if (event.data[0] === id) {
				worker.removeEventListener("message", onMessage)
				worker.removeEventListener("error", onError)
				resolve(event.data[1])
			}
		}

		function onError(error: ErrorEvent) {
			worker.removeEventListener("message", onMessage)
			worker.removeEventListener("error", onError)
			reject(error)
		}

		worker.addEventListener("message", onMessage)
		worker.addEventListener("error", onError)

		let content: Uint8Array | ReadableStream<Uint8Array>
		let transferContent: Transferable
		if (typeof data === "string") {
			content = new TextEncoder().encode(data)
			transferContent = content.buffer
		} else {
			content = data
			transferContent = data
		}

		if (opts.key) {
			const key = new Uint8Array(opts.key.fullKey)
			worker.postMessage(
				[writeFile.name, id, [path, content, key]],
				[transferContent, key.buffer],
			)
		} else {
			worker.postMessage(
				[writeFile.name, id, [path, content, null]],
				[transferContent],
			)
		}
	})
}

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

async function removeFile(
	dir: FileSystemDirectoryHandle,
	name: string,
): Promise<void> {
	try {
		await dir.removeEntry(name)
	} catch (error) {
		throw asInternalError(error)
	}
}

async function decryptFileName(
	dir: FileSystemDirectoryHandle,
	encryptedNameBase64: string,
	key: SymmetricKey,
): Promise<Uint8Array> {
	try {
		const handle = await dir.getFileHandle(encryptedNameBase64)
		const file = await handle.getFile()
		const stream = file.stream()
		const len = AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH
		const authTagAndIv = new Uint8Array(len)
		let ptr = 0
		for await (const chunk of stream) {
			const bytesNeeded = len - ptr
			authTagAndIv.set(chunk.subarray(0, bytesNeeded), ptr)
			ptr += bytesNeeded
			if (ptr >= len) {
				break
			}
		}
		const cipher: RawCipher = {
			text: await bytesFromBase64(encryptedNameBase64),
			authTag: authTagAndIv.subarray(0, AUTH_TAG_BYTE_LENGTH),
			iv: authTagAndIv.subarray(AUTH_TAG_BYTE_LENGTH),
		}
		return await decryptRaw(cipher, key)
	} catch (error) {
		console.error(error)
		throw error
	}
}

async function readFile(
	dir: FileSystemDirectoryHandle,
	name: string,
	{ key }: { key: SymmetricKey | null },
): CheckedPromise<File, ApplicationError> {
	try {
		const handle = await dir.getFileHandle(name)
		const file = await handle.getFile()
		if (key) {
			const buffer = await file.arrayBuffer()
			const bytes = new Uint8Array(buffer)
			const contentCipher = rawCipherFromUint8Array(
				bytes.subarray(AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH),
			)
			const decryptedFileName = await decryptRaw(
				{
					text: await bytesFromBase64(handle.name),
					authTag: bytes.subarray(0, AUTH_TAG_BYTE_LENGTH),
					iv: bytes.subarray(
						AUTH_TAG_BYTE_LENGTH,
						AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH,
					),
				},
				key,
			).then(stringFromBytes)
			const decrypted = await decryptRaw(contentCipher, key)
			return new File([decrypted], "", {
				type: mime.getType(decryptedFileName) || "application/octet-stream",
			})
		}
		return file
	} catch (error) {
		throw error instanceof DOMException && error.name === "NotFoundError"
			? applicationError({ error: ERROR_TYPE.notFound })
			: asInternalError(error)
	}
}

async function readJsonFile<T>(
	dir: FileSystemDirectoryHandle,
	name: string,
	{ key }: { key: SymmetricKey | null },
): CheckedPromise<T, InternalError> {
	try {
		const handle = await dir.getFileHandle(name)
		const file = await handle.getFile()
		let json: string
		if (key) {
			const buffer = await file.arrayBuffer()
			const contentCipher = rawCipherFromUint8Array(
				new Uint8Array(buffer).slice(AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH),
			)
			const decrypted = await decryptRaw(contentCipher, key)
			json = new TextDecoder().decode(decrypted)
		} else {
			json = await file.text()
		}
		return await JSON.parse(json)
	} catch (error) {
		throw error instanceof DOMException && error.name === "NotFoundError"
			? applicationError({ error: ERROR_TYPE.notFound })
			: asInternalError(error)
	}
}

async function readTextFile(
	dir: FileSystemDirectoryHandle,
	name: string,
	{ key }: { key: SymmetricKey | null },
): CheckedPromise<
	{ content: string; handle: FileSystemFileHandle } | null,
	ApplicationError
> {
	try {
		const handle = await dir.getFileHandle(name)
		const file = await handle.getFile()
		let text: string
		if (key) {
			const buffer = await file.arrayBuffer()
			const contentCipher = rawCipherFromUint8Array(
				new Uint8Array(buffer).slice(AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH),
			)
			const decrypted = await decryptRaw(contentCipher, key)
			text = new TextDecoder().decode(decrypted)
		} else {
			text = await file.text()
		}
		return { content: text, handle }
	} catch (error) {
		throw error instanceof DOMException && error.name === "NotFoundError"
			? applicationError({ error: ERROR_TYPE.notFound })
			: asInternalError(error)
	}
}

export {
	readJsonFile,
	readTextFile,
	readFile,
	writeFile,
	removeFile,
	fileExists,
	decryptFileName,
}
export type { WriteFileOptions, WriteFileResult }
