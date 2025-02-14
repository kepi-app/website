import {
	type PropsWithChildren,
	createContext,
	useContext,
	useRef,
} from "react"
import { createStore, useStore } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { type ApplicationError, isApplicationError } from "~/errors"
import {
	NOTEBOOK_RESERVED_NAME,
	type Note,
	type Notebook,
	type NotebookEntry,
	type NotebookFile,
	type NotebookFileName,
	type NotebookSection,
	addFilesToNotebook,
	createNote,
	findNotebookSectionByPath,
	loadFileInNotebook,
	saveNote,
	saveNotebookIndex,
} from "~/vault/notebook"

interface NotebookState {
	notebook: Notebook

	addSection(path: string[]): void
	createNewNote(): Promise<NotebookEntry>
	saveNotebookIndex(): Promise<void>
	saveUpdatedNote(note: Note): Promise<Note>
	loadFile(fileName: NotebookFileName): Promise<Blob | null>
	addFiles(files: File[]): Promise<(NotebookFile | ApplicationError)[]>
}
type NotebookStore = ReturnType<typeof createNotebookStore>

const NotebookStoreContext = createContext<NotebookStore>(
	null as unknown as NotebookStore,
)

function createNotebookStore(notebook: Notebook) {
	return createStore<NotebookState>()(
		subscribeWithSelector(
			immer((set, get) => ({
				notebook,

				addSection(path: string[]) {
					set((state) => {
						let current = state.notebook.index.root
						for (const component of path) {
							let section: NotebookSection
							if (!(component in current.children)) {
								section = {
									title: component,
									notes: [],
									children: {},
								}
								current.children[component] = section
							} else {
								section = current.children[component]
							}
							current = section
						}
					})
				},

				async createNewNote() {
					const notebook = get().notebook
					const note = await createNote(notebook, {
						title: "",
						path: [],
						key: notebook.key,
					})
					set((state) => {
						if (state.notebook.encryptedFileMap) {
							state.notebook.encryptedFileMap[note.slug] = note.fileName
						}
						state.notebook.index.entries[note.slug] = note
						state.notebook.index.idMap[note.internalId] = note.slug
						state.notebook.index.root.notes.push(note.internalId)
					})
					return note
				},

				async saveNotebookIndex() {
					const notebook = get().notebook
					const { fileName } = await saveNotebookIndex(notebook, {
						key: notebook.key,
					})
					set((state) => {
						if (state.notebook.encryptedFileMap) {
							state.notebook.encryptedFileMap[NOTEBOOK_RESERVED_NAME.index] =
								fileName
						}
					})
				},

				async saveUpdatedNote(note: Note) {
					const notebook = get().notebook
					const savedNote = await saveNote(note, notebook, {
						key: notebook.key,
					})

					const currentEntry = notebook.index.entries[note.metadata.slug]

					const handleUpdated = !(await savedNote.handle.isSameEntry(
						note.handle,
					))
					const pathUpdated = currentEntry
						? savedNote.metadata.path.length !== currentEntry.path.length ||
							savedNote.metadata.path.some(
								(component, i) => component !== currentEntry.path[i],
							)
						: true

					if (handleUpdated || pathUpdated) {
						set((state) => {
							const newEntry: NotebookEntry = {
								internalId: savedNote.internalId,
								path: savedNote.metadata.path,
								title: savedNote.metadata.title,
								slug: savedNote.metadata.slug,
								fileName: savedNote.handle.name,
							}

							delete state.notebook.index.entries[note.metadata.slug]
							state.notebook.index.idMap[note.internalId] = newEntry.slug
							state.notebook.index.entries[newEntry.slug] = newEntry
							if (state.notebook.encryptedFileMap) {
								state.notebook.encryptedFileMap[newEntry.slug as string] =
									savedNote.handle.name
							}

							if (pathUpdated) {
								// if path is updated, remove note from its previous section first
								// then insert note to new section, creating new sections if necessary

								if (currentEntry) {
									const currentSection = findNotebookSectionByPath(
										state.notebook.index,
										currentEntry.path,
									)
									if (currentSection) {
										const i = currentSection.notes.indexOf(savedNote.internalId)
										currentSection.notes.splice(i, 1)
									}
								}

								let current = state.notebook.index.root
								for (const component of savedNote.metadata.path) {
									let section: NotebookSection
									if (component in current.children) {
										section = current.children[component]
									} else {
										section = {
											title: component,
											notes: [],
											children: {},
										}
										current.children[component] = section
									}
									current = section
								}

								current.notes.push(savedNote.internalId)
							}
						})
					}

					return savedNote
				},

				async loadFile(fileName: NotebookFileName): Promise<Blob | null> {
					const notebook = get().notebook
					return loadFileInNotebook(notebook, fileName, {
						key: notebook.key,
					})
				},

				async addFiles(
					files: File[],
				): Promise<(NotebookFile | ApplicationError)[]> {
					const notebook = get().notebook
					const results = await addFilesToNotebook(notebook, files)

					set((state) => {
						if (state.notebook.encryptedFileMap) {
							for (let i = 0; i < results.length; ++i) {
								const result = results[i]
								if (!isApplicationError(result)) {
									state.notebook.encryptedFileMap[result.notebookFileName] =
										result.actualFileName
								}
							}
						}
					})

					return results
				},
			})),
		),
	)
}

function useNotebookStoreContext() {
	return useContext(NotebookStoreContext)
}

function useNotebookStore<T>(selector: (state: NotebookState) => T): T {
	const store = useContext(NotebookStoreContext)
	return useStore(store, selector)
}

function NotebookStoreProvider({
	notebook,
	children,
}: PropsWithChildren<{
	notebook: Notebook
}>) {
	const store = useRef<NotebookStore | null>(null)
	if (!store.current) {
		store.current = createNotebookStore(notebook)
	}
	return (
		<NotebookStoreContext.Provider value={store.current}>
			{children}
		</NotebookStoreContext.Provider>
	)
}

export { NotebookStoreProvider, useNotebookStoreContext, useNotebookStore }
