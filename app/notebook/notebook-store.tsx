import {
	type PropsWithChildren,
	createContext,
	useContext,
	useRef,
} from "react"
import { createStore, useStore } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import {
	type Note,
	type Notebook,
	type NotebookEntry,
	type NotebookSection,
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
	loadFile(fileName: string): Promise<Blob | null>
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
					const note = await createNote(notebook.handle, {
						title: "",
						path: [],
					})
					set((state) => {
						state.notebook.index.entries[note.slug] = note
						state.notebook.index.idMap[note.internalId] = note.slug
						state.notebook.index.root.notes.push(note.internalId)
					})
					return note
				},

				async saveNotebookIndex() {
					const notebook = get().notebook
					await saveNotebookIndex(notebook)
				},

				async saveUpdatedNote(note: Note) {
					const notebook = get().notebook
					const savedNote = await saveNote(note, notebook)

					const currentEntry = notebook.index.entries[note.metadata.slug]

					const slugUpdated = savedNote.metadata.slug !== note.metadata.slug
					const pathUpdated = currentEntry
						? savedNote.metadata.path.length !== currentEntry.path.length ||
							savedNote.metadata.path.some(
								(component, i) => component !== currentEntry.path[i],
							)
						: true

					if (slugUpdated || pathUpdated) {
						set((state) => {
							const newEntry: NotebookEntry = {
								internalId: savedNote.internalId,
								path: savedNote.metadata.path,
								title: savedNote.metadata.title,
								slug: savedNote.metadata.slug,
							}

							delete state.notebook.index.entries[note.metadata.slug]
							state.notebook.index.idMap[note.internalId] = newEntry.slug
							state.notebook.index.entries[newEntry.slug] = newEntry

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

				async loadFile(fileName: string): Promise<Blob | null> {
					const notebook = get().notebook
					return loadFileInNotebook(notebook, fileName)
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
