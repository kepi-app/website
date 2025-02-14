import {
	type RawCipher,
	SymmetricKey,
	base64StringFromBytes,
	encryptToRaw,
	uint8ArrayFromRawCipher,
} from "~/crypt"
import { ERROR_TYPE, applicationError, asInternalError } from "~/errors"

type RpcMessage = [string, number, unknown[]]

self.onmessage = async (event: MessageEvent<RpcMessage>) => {
	const [method, id, args] = event.data
	switch (method) {
		case "writeFile": {
			const result = await writeFile(...(args as Parameters<typeof writeFile>))
			postMessage([id, result])
			break
		}
	}
}

function parsePath(path: string): string[] {
	return path.split("/")
}

async function openHandle(
	path: string | string[],
	create: boolean,
): Promise<FileSystemHandle> {
	try {
		const components = typeof path === "string" ? parsePath(path) : path
		const len = components.length
		let fileHandle: FileSystemFileHandle | null = null
		let currentDirHandle: FileSystemDirectoryHandle =
			await navigator.storage.getDirectory()
		for (let i = 0; i < len; ++i) {
			if ((i === len - 2 && components[i + 1] === "") || i !== len - 1) {
				// directory component
				currentDirHandle = await currentDirHandle.getDirectoryHandle(
					components[i],
					{ create },
				)
			} else if (i === len - 1 && components[i]) {
				fileHandle = await currentDirHandle.getFileHandle(components[i], {
					create,
				})
			}
		}
		return fileHandle || currentDirHandle
	} catch (error) {
		if (error instanceof DOMException && error.name === "NotFoundError") {
			throw applicationError({ error: ERROR_TYPE.notFound })
		}
		throw asInternalError(error)
	}
}

async function writeFile(
	path: string,
	data: Uint8Array | ReadableStream<Uint8Array>,
	key: Uint8Array | null,
): Promise<{ fileName: string }> {
	const components = parsePath(path)
	if (components.length < 2) {
		throw asInternalError(new Error(`invalid path ${path}`))
	}

	// biome-ignore lint/style/noNonNullAssertion: we already checked the min length of components
	const fileName = components.at(-1)!

	const parentPath = [...components.slice(0, -1), ""]
	const parentDir = await openHandle(parentPath, true)
	if (!(parentDir instanceof FileSystemDirectoryHandle)) {
		throw asInternalError(
			new Error(`for some reason parent of ${path} is not a directory`),
		)
	}

	let fileHandle: FileSystemFileHandle
	let encKey: SymmetricKey | null = null
	let fileNameCipher: RawCipher | null = null

	if (key) {
		encKey = new SymmetricKey(key)
	}

	try {
		if (encKey) {
			// if a key is provided, then a new file is created without deleting the previous one
			// because it is impossible to determine the name of the previous file without auth tag & iv
			// it is up to the caller to remove the previous file
			fileNameCipher = await encryptToRaw(fileName, encKey)
		} else {
			await parentDir.getFileHandle(fileName)
			await parentDir.removeEntry(fileName)
		}
	} catch (error) {
		if (!(error instanceof DOMException && error.name === "NotFoundError")) {
			throw error
		}
	} finally {
		fileHandle = await parentDir.getFileHandle(
			fileNameCipher
				? await base64StringFromBytes(fileNameCipher.text)
				: fileName,
			{
				create: true,
			},
		)
	}

	try {
		const writeHandle = await fileHandle.createSyncAccessHandle()
		const isStream = data instanceof ReadableStream

		if (isStream && !key) {
			for await (const chunk of data) {
				writeHandle.write(chunk)
			}
		} else {
			let bytes: Uint8Array
			if (isStream) {
				bytes = new Uint8Array(await new Response(data).arrayBuffer())
			} else {
				bytes = data
			}

			let buffer: ArrayBuffer = bytes
			if (encKey) {
				const encrypted = await encryptToRaw(bytes, encKey)
				buffer = uint8ArrayFromRawCipher(encrypted)
			}

			if (fileNameCipher) {
				writeHandle.write(fileNameCipher.authTag)
				writeHandle.write(fileNameCipher.iv)
			}

			writeHandle.write(buffer)
		}

		writeHandle.close()

		return { fileName: fileHandle.name }
	} catch (error) {
		throw asInternalError(error)
	}
}
