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
	type SaveNoteResult,
	createNote,
	loadFileInNotebook,
	saveNote,
	saveNotebookIndex,
} from "~/vault/notebook"

interface NotebookState {
	notebook: Notebook

	createNewNote(): Promise<NotebookEntry>
	saveNotebookIndex(): Promise<void>
	saveUpdatedNote(note: Note): Promise<SaveNoteResult>
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

				async createNewNote() {
					const notebook = get().notebook
					const note = await createNote(notebook.handle, {
						title: "",
						path: "/",
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
					const saveResult = await saveNote(note, notebook)

					if (saveResult.newSlug) {
						const newSlug = saveResult.newSlug
						set((state) => {
							const newEntry: NotebookEntry = {
								internalId: note.internalId,
								path: note.metadata.category ?? "/",
								title: note.metadata.title,
								slug: newSlug,
							}
							delete state.notebook.index.entries[note.metadata.slug]
							state.notebook.index.idMap[note.internalId] = newSlug
							state.notebook.index.entries[newSlug] = newEntry
						})
					}

					return saveResult
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
