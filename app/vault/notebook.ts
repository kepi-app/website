import yaml from "js-yaml"
import { ulid } from "ulid"
import {
	type Base64EncodedCipher,
	type RawCipher,
	SymmetricKey,
	base64StringFromBytes,
	bytesFromBase64,
	rawCipherFromBase64Cipher,
} from "~/crypt"
import {
	type ApplicationError,
	type CheckedPromise,
	ERROR_TYPE,
	applicationError,
	asInternalError,
	isApplicationError,
	promiseOr,
	rethrowAsInternalError,
	tryOr,
} from "~/errors"
import {
	decryptFileName,
	fileExists,
	readFile,
	readJsonFile,
	readTextFile,
	removeFile,
	writeFile,
} from "~/file-system/file-system.client"
import { slugify } from "~/slugify"
import type { Tagged } from "~/tagged"
import { VAULT_RESERVED_NAME } from "~/vault/vault"

type NotebookHandle = Tagged<FileSystemDirectoryHandle, "NotebookHandle">
type NotebookFileName = Tagged<string, "NotebookFileName">
type NoteHandle = Tagged<FileSystemFileHandle, "Note">
type NoteSlug = Tagged<string, "NoteSlug">
type InternalNoteId = Tagged<string, "NoteId">
type EncryptedFileMap = Record<string, string>

const ENCRYPTION_STATUS = {
	none: "NONE",
	encrypted: "ENCRYPTED",
	decrypted: "DECRYPTED",
} as const

interface Notebook {
	encryptionStatus:
		| (typeof ENCRYPTION_STATUS)["none"]
		| (typeof ENCRYPTION_STATUS)["decrypted"]
	metadata: NotebookMetadata
	index: NotebookIndex
	handle: NotebookHandle
	handlePath: string
	key: SymmetricKey | null
	encryptedFileMap: EncryptedFileMap | null
	protectedSymmetricKey: RawCipher | null
	masterKeySalt: Uint8Array | null
}

interface EncryptedNotebook {
	encryptionStatus: (typeof ENCRYPTION_STATUS)["encrypted"]
	handle: NotebookHandle
	handlePath: string
	protectedSymmetricKey: RawCipher
	masterKeySalt: Uint8Array
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
	fileName: string
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

interface SaveFileResult {
	fileName: string
}

interface KeyFile {
	notebookName: string
	protectedSymmetricKey: Base64EncodedCipher
	masterKeySalt: string
}

interface CreateNotebookOptions {
	name: string
	description: string | null
	key: SymmetricKey | null
	protectedSymmetricKey: Base64EncodedCipher | null
	masterKeySalt: Uint8Array | null
}

interface NotebookFile {
	notebookFileName: NotebookFileName
	actualFileName: string
}

const FRONTMATTER_FENCE_REGEX = /^---[\s\S]*\n---\n*/g
const FRONTMATTER_CONTENT_REGEX = /(?<=^---\n)[\s\S]*(?=\n---)/

/**
 * Reserved file/directory names in a notebook directory.
 */
const NOTEBOOK_RESERVED_NAME = {
	metadata: "metadata.json",
	index: "index.json",
	key: "key.json",
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
		if (handle instanceof FileSystemDirectoryHandle) {
			if (await fileExists(handle, NOTEBOOK_RESERVED_NAME.key)) {
				ps.push(
					readJsonFile<KeyFile>(handle, NOTEBOOK_RESERVED_NAME.key, {
						key: null,
					}).then((keyFile) => ({
						name: keyFile.notebookName,
						description: "Notebook locked",
						slug: handle.name,
					})),
				)
			} else {
				ps.push(
					readJsonFile(handle, NOTEBOOK_RESERVED_NAME.metadata, { key: null }),
				)
			}
		}
	}

	return Promise.all(ps).catch(rethrowAsInternalError)
}

async function findNotebook(
	slug: string,
): CheckedPromise<Notebook | EncryptedNotebook | null, ApplicationError> {
	const handle = (await promiseOr(
		notebooksDirectory().then((dir) => dir.getDirectoryHandle(slug)),
		(error) => {
			if (error instanceof DOMException && error.name === "NotFoundError") {
				return null
			}
			throw asInternalError(error)
		},
	)) as NotebookHandle | null
	if (!handle) {
		return null
	}

	const handlePath = `${VAULT_RESERVED_NAME.notebooks}/${slug}/`

	const keyFile = await readJsonFile<KeyFile>(
		handle,
		NOTEBOOK_RESERVED_NAME.key,
		{ key: null },
	).catch((error) => {
		if (isApplicationError(error, ERROR_TYPE.notFound)) {
			return null
		}
		throw error
	})

	if (keyFile) {
		return {
			handle,
			handlePath,
			encryptionStatus: ENCRYPTION_STATUS.encrypted,
			protectedSymmetricKey: await rawCipherFromBase64Cipher(
				keyFile.protectedSymmetricKey,
			),
			masterKeySalt: await bytesFromBase64(keyFile.masterKeySalt),
		}
	}

	const [metadata, index] = await Promise.all([
		readJsonFile<NotebookMetadata>(handle, NOTEBOOK_RESERVED_NAME.metadata, {
			key: null,
		}),
		readNotebookIndex(handle, NOTEBOOK_RESERVED_NAME.index, { key: null }),
	])

	return {
		encryptionStatus: ENCRYPTION_STATUS.none,
		metadata,
		index,
		handle,
		handlePath,
		encryptedFileMap: null,
		protectedSymmetricKey: null,
		masterKeySalt: null,
		key: null,
	}
}

async function decryptNotebook(
	notebook: EncryptedNotebook,
	key: SymmetricKey,
): CheckedPromise<Notebook, ApplicationError> {
	const fileMap: EncryptedFileMap = {}
	notebook.handle.keys()

	const ps: Promise<void>[] = []
	const textDecoder = new TextDecoder()

	for await (const encryptedFileName of notebook.handle.keys()) {
		if (
			encryptedFileName === NOTEBOOK_RESERVED_NAME.key ||
			encryptedFileName === NOTEBOOK_RESERVED_NAME.files
		) {
			continue
		}
		ps.push(
			decryptFileName(notebook.handle, encryptedFileName, key)
				.then((decrypted) => textDecoder.decode(decrypted))
				.then((fileName) => {
					fileMap[fileName] = encryptedFileName
				}),
		)
	}

	await Promise.all(ps)

	const [metadata, index] = await Promise.all([
		readJsonFile<NotebookMetadata>(
			notebook.handle,
			fileMap[NOTEBOOK_RESERVED_NAME.metadata],
			{ key },
		),
		readNotebookIndex(notebook.handle, fileMap[NOTEBOOK_RESERVED_NAME.index], {
			key,
		}),
	])

	return {
		...notebook,
		encryptionStatus: ENCRYPTION_STATUS.decrypted,
		encryptedFileMap: fileMap,
		key,
		metadata,
		index,
	}
}

async function createNotebook({
	name,
	description = null,
	key,
	protectedSymmetricKey,
	masterKeySalt,
}: CreateNotebookOptions): CheckedPromise<NotebookMetadata, ApplicationError> {
	const slug = slugify(name)
	const notebooksDir = await notebooksDirectory()

	try {
		await notebooksDir.getDirectoryHandle(slug)
	} catch (error) {
		if (error instanceof DOMException && error.name === "NotFoundError") {
			const metadata: NotebookMetadata = { name, slug, description }
			const index: NotebookIndex = {
				entries: {},
				idMap: {},
				root: {
					title: "",
					notes: [],
					children: {},
				},
			}

			const basePath = `${VAULT_RESERVED_NAME.notebooks}/${slug}`

			await Promise.all([
				(async function writeMetadataFile() {
					await writeFile(
						`${basePath}/${NOTEBOOK_RESERVED_NAME.metadata}`,
						JSON.stringify(metadata),
						{
							key,
						},
					)
				})(),
				(async function writeIndexFile() {
					await writeFile(
						`${basePath}/${NOTEBOOK_RESERVED_NAME.index}`,
						JSON.stringify(index),
						{
							key,
						},
					)
				})(),
				protectedSymmetricKey && masterKeySalt
					? base64StringFromBytes(masterKeySalt).then((it) =>
							writeFile(
								`${basePath}/${NOTEBOOK_RESERVED_NAME.key}`,
								JSON.stringify({
									notebookName: metadata.name,
									protectedSymmetricKey,
									masterKeySalt: it,
								}),
								{ key: null },
							),
						)
					: Promise.resolve(),
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
	notebook: Notebook,
	{ title, key }: { title: string; path: string[]; key: SymmetricKey | null },
): CheckedPromise<NotebookEntry, ApplicationError> {
	const internalId = ulid() as InternalNoteId
	const slug = title ? slugify(title) : internalId
	const entry: NotebookEntry = {
		title,
		path: [],
		slug: slug as NoteSlug,
		fileName: slug,
		internalId,
	}

	if (
		(await fileExists(notebook.handle, entry.slug)) ||
		(notebook.encryptedFileMap && slug in notebook.encryptedFileMap)
	) {
		throw applicationError({
			error: ERROR_TYPE.conflict,
			conflictingField: "title",
			conflictingValue: title,
		})
	}

	const content = `---
title: ${entry.title || '""'}
slug: ${entry.slug}
---
`

	const { fileName } = await writeFile(
		`${VAULT_RESERVED_NAME.notebooks}/${notebook.metadata.slug}/${entry.slug}`,
		content,
		{
			key,
		},
	).catch(rethrowAsInternalError)
	entry.fileName = fileName

	return entry
}

async function findNote(
	notebook: Notebook,
	slug: string,
	{ key }: { key: SymmetricKey | null },
): CheckedPromise<Note | null, ApplicationError> {
	if (!(slug in notebook.index.entries)) {
		return null
	}

	const entry = notebook.index.entries[slug as NoteSlug]

	const result = await readTextFile(notebook.handle, entry.fileName, {
		key,
	}).catch((error) => {
		if (isApplicationError(error, ERROR_TYPE.notFound)) {
			return null
		}
		throw error
	})
	if (!result) {
		return null
	}

	const metadata = parseNoteFrontmatter(result.content)

	return {
		handle: result.handle as NoteHandle,
		metadata,
		content: result.content.replace(FRONTMATTER_FENCE_REGEX, ""),
		internalId: entry.internalId,
	}
}

async function saveNote(
	note: Note,
	notebook: Notebook,
	{ key }: { key: SymmetricKey | null },
): Promise<Note> {
	const entry = notebook.index.entries[note.metadata.slug]
	if (!entry) {
		throw applicationError({ error: ERROR_TYPE.notFound })
	}

	let noteSlug: NoteSlug
	if (note.metadata.title) {
		noteSlug = slugify(note.metadata.title) as NoteSlug
	} else {
		noteSlug = entry.internalId as string as NoteSlug
	}

	const metadata: NoteMetadata = {
		...note.metadata,
		slug: noteSlug,
	}
	const newContent = `---
${yaml.dump({
	...metadata,
	path: metadata.path.join("/"),
})}
---
${note.content}`

	const { fileName } = await writeFile(
		`${notebook.handlePath}${noteSlug}`,
		newContent,
		{ key },
	)

	let newHandle: NoteHandle | null = null
	if (note.handle.name !== fileName) {
		await notebook.handle.removeEntry(note.handle.name)
		newHandle = (await notebook.handle.getFileHandle(fileName)) as NoteHandle
	}

	return {
		...note,
		handle: newHandle || note.handle,
		metadata,
	}
}

async function addFilesToNotebook(
	notebook: Notebook,
	files: File[],
): Promise<(NotebookFile | ApplicationError)[]> {
	const fileDir = await notebook.handle.getDirectoryHandle(
		NOTEBOOK_RESERVED_NAME.files,
		{ create: true },
	)

	return Promise.allSettled(
		files.map((file) =>
			writeFile(
				`${notebook.handlePath}${fileDir.name}/${file.name}`,
				file.stream(),
				{ key: notebook.key },
			),
		),
	).then((results) =>
		results.map((result, i) =>
			result.status === "fulfilled"
				? ({
						notebookFileName: files[i].name as NotebookFileName,
						actualFileName: result.value.fileName,
					} satisfies NotebookFile)
				: asInternalError(result.reason),
		),
	)
}

async function loadFileInNotebook(
	notebook: Notebook,
	fileName: NotebookFileName,
	{ key }: { key: SymmetricKey | null },
): CheckedPromise<Blob | null, ApplicationError> {
	try {
		const fileDir = await notebook.handle.getDirectoryHandle(
			NOTEBOOK_RESERVED_NAME.files,
		)
		const name = notebook.encryptedFileMap
			? notebook.encryptedFileMap[fileName]
			: fileName
		return await readFile(fileDir, name, { key })
	} catch (error) {
		if (error instanceof DOMException && error.name === "NotFoundError") {
			return null
		}
		throw asInternalError(error)
	}
}

async function readNotebookIndex(
	handle: NotebookHandle,
	indexFileName: string,
	{ key }: { key: SymmetricKey | null },
): CheckedPromise<NotebookIndex, ApplicationError> {
	try {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		const json = await readJsonFile<any>(handle, indexFileName, { key })
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
	{ key }: { key: SymmetricKey | null },
): CheckedPromise<SaveFileResult, ApplicationError> {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const json: any = { ...notebook.index, entries: {} }
	for (const [key, value] of Object.entries(notebook.index.entries)) {
		json.entries[key] = {
			...value,
			path: value.path.join("/"),
		}
	}

	const result = await writeFile(
		`${notebook.handlePath}${NOTEBOOK_RESERVED_NAME.index}`,
		JSON.stringify(json),
		{ key },
	)

	if (notebook.encryptedFileMap) {
		await removeFile(
			notebook.handle,
			notebook.encryptedFileMap[NOTEBOOK_RESERVED_NAME.index],
		)
	}

	return result
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

function cacheNotebookKey(notebook: EncryptedNotebook, key: SymmetricKey) {
	sessionStorage.setItem(`${notebook.handle.name}KeyBase64`, key.toString())
}

async function retrieveCachedNotebookKey(notebook: EncryptedNotebook) {
	const keyBase64 = sessionStorage.getItem(`${notebook.handle.name}KeyBase64`)
	if (keyBase64) {
		return await SymmetricKey.fromBase64(keyBase64)
	}
	return null
}

export {
	FRONTMATTER_FENCE_REGEX,
	FRONTMATTER_CONTENT_REGEX,
	ENCRYPTION_STATUS,
	NOTEBOOK_RESERVED_NAME,
	findNotebook,
	decryptNotebook,
	saveNotebookIndex,
	findNotebookSectionByPath,
	findAllNotebooks,
	createNotebook,
	isValidNotebookName,
	createNote,
	findNote,
	saveNote,
	addFilesToNotebook,
	loadFileInNotebook,
	cacheNotebookKey,
	retrieveCachedNotebookKey,
}
export type {
	NotebookMetadata,
	NotebookFileName,
	NotebookHandle,
	NotebookFile,
	NoteSlug,
	Notebook,
	EncryptedNotebook,
	NotebookIndex,
	NotebookSection,
	Note,
	NoteHandle,
	NotebookEntry,
	SaveFileResult,
	CreateNotebookOptions,
}
