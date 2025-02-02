import {
	type ApplicationError,
	type CheckedPromise,
	ERROR_TYPE,
	applicationError,
	asInternalError,
	promiseOrThrow,
} from "~/errors"
import { slugify } from "~/slugify"

interface NotebookMetadata {
	name: string
	description: string | null
	slug: string
}

async function notebooksDirectory() {
	const root = await navigator.storage.getDirectory()
	return root.getDirectoryHandle("notebooks", { create: true })
}

async function findAllNotebooks(): CheckedPromise<
	NotebookMetadata[],
	ApplicationError
> {
	const notebooksDir = await notebooksDirectory()

	const ps: Promise<NotebookMetadata>[] = []
	for await (const [_, handle] of notebooksDir) {
		if (handle.kind === "directory") {
			ps.push(readNotebookMetadata(handle as FileSystemDirectoryHandle))
		}
	}

	return promiseOrThrow(Promise.all(ps), asInternalError)
}

async function createNotebook({
	name,
	description = null,
}: { name: string; description: string | null }): CheckedPromise<
	NotebookMetadata,
	ApplicationError
> {
	const slug = slugify(name)
	const notebooksDir = await notebooksDirectory()

	try {
		await notebooksDir.getDirectoryHandle(slug)
	} catch (error) {
		if (error instanceof DOMException && error.name === "NotFoundError") {
			const file = await notebooksDir
				.getDirectoryHandle(slug, { create: true })
				.then((handle) =>
					handle.getFileHandle("metadata.json", { create: true }),
				)
				.then((handle) => handle.createWritable())

			const metadata: NotebookMetadata = { name, slug, description }
			await file.write(JSON.stringify(metadata))
			await file.close()

			return metadata
		}

		throw applicationError({ error: ERROR_TYPE.internal })
	}

	throw applicationError({
		error: ERROR_TYPE.conflict,
		conflictingField: "name",
		conflictingValue: name,
	})
}

async function readNotebookMetadata(
	handle: FileSystemDirectoryHandle,
): Promise<NotebookMetadata> {
	const jsonStr = await handle
		.getFileHandle("metadata.json")
		.then((it) => it.getFile())
		.then((f) => f.text())
	return JSON.parse(jsonStr)
}

function isValidNotebookName(name: string) {
	return !/[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(name)
}

export { findAllNotebooks, createNotebook, isValidNotebookName }
export type { NotebookMetadata }
