import yaml from "js-yaml"
import { ulid } from "ulid"
import {
	type ApplicationError,
	type CheckedPromise,
	ERROR_TYPE,
	applicationError,
	asInternalError,
	promiseOr,
	promiseOrThrow,
	tryOr,
} from "~/errors"
import { fileExists } from "~/opfs-util"
import { slugify } from "~/slugify"
import type { Tagged } from "~/tagged"
import { VAULT_RESERVED_NAME } from "~/vault/vault"

type NotebookHandle = Tagged<FileSystemDirectoryHandle, "NotebookHandle">
type NoteHandle = Tagged<FileSystemFileHandle, "Note">
type NoteSlug = Tagged<string, "NoteSlug">
type InternalNoteId = Tagged<string, "NoteId">

interface Notebook {
	metadata: NotebookMetadata
	index: NotebookIndex
	handle: NotebookHandle
}

interface NotebookMetadata {
	name: string
	description: string | null
	slug: string
}

interface NotebookEntry {
	internalId: InternalNoteId
	title: string
	slug: NoteSlug
	path: string[]
}

interface NotebookIndex {
	entries: Record<NoteSlug, NotebookEntry>
	idMap: Record<InternalNoteId, NoteSlug>
	root: NotebookSection
}

interface NotebookSection {
	title: string
	notes: InternalNoteId[]
	children: Record<string, NotebookSection>
}

interface Note {
	internalId: InternalNoteId
	metadata: NoteMetadata
	content: string
	handle: NoteHandle
}

interface NoteMetadata {
	title: string
	slug: NoteSlug
	path: string[]
}

interface SaveNoteResult {
	newNoteHandle: NoteHandle | null
	newSlug: NoteSlug | null
}

interface SaveFileResult {
	fileName: string
}

const FRONTMATTER_FENCE_REGEX = /^---[\s\S]*\n---\n*/g
const FRONTMATTER_CONTENT_REGEX = /(?<=^---\n)[\s\S]*(?=\n---)/

/**
 * Reserved file/directory names in a notebook directory.
 */
const NOTEBOOK_RESERVED_NAME = {
	metadata: "metadata.json",
	index: "index.json",
	files: "files",
} as const

async function notebooksDirectory() {
	const root = await navigator.storage.getDirectory()
	return root.getDirectoryHandle(VAULT_RESERVED_NAME.notebooks, {
		create: true,
	})
}

async function findAllNotebooks(): CheckedPromise<
	NotebookMetadata[],
	ApplicationError
> {
	const notebooksDir = await notebooksDirectory()

	const ps: Promise<NotebookMetadata>[] = []
	for await (const [_, handle] of notebooksDir) {
		if (handle.kind === "directory") {
			ps.push(readNotebookMetadata(handle as NotebookHandle))
		}
	}

	return promiseOrThrow(Promise.all(ps), asInternalError)
}

async function findNotebook(
	slug: string,
): CheckedPromise<Notebook | null, ApplicationError> {
	try {
		const handle = (await notebooksDirectory().then((dir) =>
			dir.getDirectoryHandle(slug),
		)) as NotebookHandle
		const [metadata, index] = await Promise.all([
			readNotebookMetadata(handle),
			readNotebookIndex(handle),
		])
		return { metadata, index, handle }
	} catch (error) {
		if (error instanceof DOMException && error.name === "NotFoundException") {
			return null
		}
		throw asInternalError(error)
	}
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
			const metadata: NotebookMetadata = { name, slug, description }
			const directory: NotebookIndex = {
				entries: {},
				idMap: {},
				root: {
					title: "",
					notes: [],
					children: {},
				},
			}

			const notebookDir = notebooksDir.getDirectoryHandle(slug, {
				create: true,
			})

			await Promise.all([
				notebookDir
					.then((handle) =>
						handle.getFileHandle(NOTEBOOK_RESERVED_NAME.metadata, {
							create: true,
						}),
					)
					.then((handle) => handle.createWritable())
					.then((file) =>
						file.write(JSON.stringify(metadata)).then(() => file.close()),
					),

				notebookDir
					.then((handle) =>
						handle.getFileHandle(NOTEBOOK_RESERVED_NAME.index, {
							create: true,
						}),
					)
					.then((handle) => handle.createWritable())
					.then((file) =>
						file.write(JSON.stringify(directory)).then(() => file.close()),
					),
			])

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

function normalizeNotePath(pathString: string | null | undefined): string[] {
	return pathString ? pathString.split("/") : []
}

async function createNote(
	notebookHandle: NotebookHandle,
	{ title, path }: { title: string; path: string[] },
): CheckedPromise<NotebookEntry, ApplicationError> {
	const internalId = ulid() as InternalNoteId
	const slug = title ? slugify(title) : internalId
	const entry: NotebookEntry = {
		title,
		path: [],
		slug: slug as NoteSlug,
		internalId,
	}

	try {
		await notebookHandle.getFileHandle(entry.slug)
	} catch (error) {
		if (!(error instanceof DOMException && error.name === "NotFoundError")) {
			throw asInternalError(error)
		}

		const fileHandle = await promiseOrThrow(
			notebookHandle.getFileHandle(entry.slug, {
				create: true,
			}),
			asInternalError,
		)

		const content = `---
title: ${entry.title || '""'}
slug: ${entry.slug}
---
`

		const f = await fileHandle.createWritable()
		await f.write(content)
		await f.close()

		return entry
	}

	throw applicationError({
		error: ERROR_TYPE.conflict,
		conflictingField: "title",
		conflictingValue: title,
	})
}

async function findNote(
	notebook: Notebook,
	slug: string,
): CheckedPromise<Note | null, ApplicationError> {
	if (!(slug in notebook.index.entries)) {
		return null
	}

	const entry = notebook.index.entries[slug as NoteSlug]
	const handle = (await promiseOr(
		notebook.handle.getFileHandle(slug),
		(error) => {
			if (error instanceof DOMException && error.name === "NotFoundError") {
				return null
			}
			throw asInternalError(error)
		},
	)) as NoteHandle | null
	if (!handle) {
		return null
	}

	const content = await promiseOrThrow(
		handle.getFile().then((f) => f.text()),
		asInternalError,
	)

	const metadata = parseNoteFrontmatter(content)

	return {
		handle,
		metadata,
		content: content.replace(FRONTMATTER_FENCE_REGEX, ""),
		internalId: entry.internalId,
	}
}

async function saveNote(note: Note, notebook: Notebook): Promise<Note> {
	const entry = notebook.index.entries[note.metadata.slug]
	if (!entry) {
		throw applicationError({ error: ERROR_TYPE.notFound })
	}

	let handle: NoteHandle
	let newSlug: string | null = null
	let prevHandle: FileSystemFileHandle | null = null

	if (note.metadata.title) {
		// if the note has a title
		// check if the title has changed, then change the file name accordingly.
		// create a new file first, then remove old file
		const slug = slugify(note.metadata.title)
		if (slug !== note.handle.name) {
			if (await fileExists(notebook.handle, slug)) {
				throw applicationError({
					error: ERROR_TYPE.conflict,
					conflictingField: "note.metadata.title",
					conflictingValue: note.metadata.title,
				})
			}
			newSlug = slug
			handle = (await notebook.handle.getFileHandle(slug, {
				create: true,
			})) as NoteHandle
			prevHandle = note.handle
		} else {
			// title has not changed, file doesn't need to be renamed
			handle = note.handle
		}
	} else {
		// if the note does not have a title
		// use its internal id as file name, but first we check if that's the case already
		if (entry.internalId !== note.handle.name) {
			handle = (await notebook.handle.getFileHandle(entry.internalId, {
				create: true,
			})) as NoteHandle
			prevHandle = note.handle
			newSlug = entry.internalId
		} else {
			handle = note.handle
		}
	}

	const metadata: NoteMetadata = {
		...note.metadata,
	}
	if (newSlug) {
		metadata.slug = newSlug as NoteSlug
	}
	const newContent = `---
${yaml.dump({
	...metadata,
	path: metadata.path.join("/"),
})}
---
${note.content}`

	const writable = await handle.createWritable()
	await writable.write(newContent)
	await writable.close()

	if (prevHandle) {
		await notebook.handle.removeEntry(prevHandle.name)
	}

	return {
		...note,
		handle,
		metadata,
	}
}

async function saveFilesInNotebook(
	notebook: Notebook,
	files: File[],
): Promise<(SaveFileResult | ApplicationError)[]> {
	const fileDir = await notebook.handle.getDirectoryHandle(
		NOTEBOOK_RESERVED_NAME.files,
		{ create: true },
	)

	return Promise.allSettled(
		files.map((file) => saveFileInDir(fileDir, file)),
	).then((results) =>
		results.map((result) =>
			result.status === "fulfilled"
				? result.value
				: asInternalError(result.reason),
		),
	)
}

async function saveFileInDir(
	dir: FileSystemDirectoryHandle,
	file: File,
): Promise<SaveFileResult> {
	const handle = await dir.getFileHandle(file.name, { create: true })
	const writable = await handle.createWritable()
	await file.stream().pipeTo(writable)
	return { fileName: file.name }
}

async function loadFileInNotebook(
	notebook: Notebook,
	fileName: string,
): CheckedPromise<Blob | null, ApplicationError> {
	try {
		const fileDir = await notebook.handle.getDirectoryHandle(
			NOTEBOOK_RESERVED_NAME.files,
		)
		const handle = await fileDir.getFileHandle(fileName)
		return await handle.getFile()
	} catch (error) {
		if (error instanceof DOMException && error.name === "NotFoundError") {
			return null
		}
		throw asInternalError(error)
	}
}

async function readNotebookMetadata(
	handle: NotebookHandle,
): Promise<NotebookMetadata> {
	const jsonStr = await handle
		.getFileHandle(NOTEBOOK_RESERVED_NAME.metadata)
		.then((it) => it.getFile())
		.then((f) => f.text())
	return JSON.parse(jsonStr)
}

async function readNotebookIndex(
	handle: NotebookHandle,
): CheckedPromise<NotebookIndex, ApplicationError> {
	try {
		const json = await handle
			.getFileHandle(NOTEBOOK_RESERVED_NAME.index)
			.then((it) => it.getFile())
			.then((f) => f.text())
			.then((it) => JSON.parse(it))
		const index: NotebookIndex = { ...json, entries: {} }
		for (const [slug, value] of Object.entries(json.entries)) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const entry: any = value
			index.entries[slug as NoteSlug] = entry
			entry.path = normalizeNotePath(entry.path)
		}
		return index
	} catch (error) {
		throw asInternalError(error)
	}
}

async function saveNotebookIndex(
	notebook: Notebook,
): CheckedPromise<void, ApplicationError> {
	const writable = await promiseOrThrow(
		notebook.handle
			.getFileHandle(NOTEBOOK_RESERVED_NAME.index)
			.then((h) => h.createWritable()),
		asInternalError,
	)
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const json: any = { ...notebook.index, entries: {} }
	for (const [key, value] of Object.entries(notebook.index.entries)) {
		json.entries[key] = {
			...value,
			path: value.path.join("/"),
		}
	}
	await writable.write(JSON.stringify(json))
	await writable.close()
}

function findNotebookSectionByPath(
	index: NotebookIndex,
	path: string[],
): NotebookSection | null {
	let current = index.root
	for (const component of path) {
		if (!current) {
			return null
		}
		current = current.children[component]
	}
	return current || null
}

function parseNoteFrontmatter(content: string): NoteMetadata {
	const parsed = FRONTMATTER_CONTENT_REGEX.exec(content)
	if (!parsed || parsed.length <= 0) {
		throw applicationError({ error: ERROR_TYPE.internal })
	}

	const data = tryOr(
		() => yaml.load(parsed[0]),
		() => null,
	)
	if (!(typeof data === "object" && data !== null)) {
		throw applicationError({ error: ERROR_TYPE.internal })
	}

	// @ts-ignore
	data.path = normalizeNotePath(data.path)

	return data as NoteMetadata
}

function isValidNotebookName(name: string) {
	return !/[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(name)
}

export {
	FRONTMATTER_FENCE_REGEX,
	FRONTMATTER_CONTENT_REGEX,
	findNotebook,
	readNotebookIndex,
	saveNotebookIndex,
	findNotebookSectionByPath,
	findAllNotebooks,
	createNotebook,
	isValidNotebookName,
	createNote,
	findNote,
	saveNote,
	saveFilesInNotebook,
	loadFileInNotebook,
}
export type {
	NotebookMetadata,
	NotebookHandle,
	NoteSlug,
	Notebook,
	NotebookIndex,
	NotebookSection,
	Note,
	NoteHandle,
	NotebookEntry,
	SaveNoteResult,
	SaveFileResult,
}
