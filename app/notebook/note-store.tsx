import { type PropsWithChildren, useContext, useRef } from "react"
import { useStore } from "zustand"
import {
	type MarkdownEditorState,
	MarkdownEditorStoreContext,
	extendMarkdownEditorStore,
} from "~/components/markdown-editor/store"
import type { ApplicationError } from "~/errors"
import {
	type Note,
	type NoteHandle,
	type NoteSlug,
	type Notebook,
	type SaveFileResult,
	saveFilesInNotebook,
} from "~/vault/notebook"

interface NoteEditorSlice {
	note: Note
	title: string
	isFocused: boolean
	canUnfocus: boolean
	setTitle: (title: string) => void
	setContent: (content: string) => void

	setIsFocused(isFocused: boolean): void
	setCanUnfocus(canUnfocus: boolean): void
	changeNoteHandle(newHandle: NoteHandle): void
	changeNoteSlug(newSlug: NoteSlug): void
	changeNotePath: (path: string[]) => void
	addFiles(
		files: File[],
		notebook: Notebook,
	): Promise<(SaveFileResult | ApplicationError)[]>
}

type NoteEditorState = NoteEditorSlice & MarkdownEditorState
type NoteEditorStore = ReturnType<typeof createNoteEditorStore>

function createNoteEditorStore(note: Note) {
	return extendMarkdownEditorStore<NoteEditorSlice>((set) => ({
		note,
		title: note.metadata.title,
		content: note.content,
		isFocused: false,
		canUnfocus: true,

		setTitle: (title) =>
			set((state) => ({
				title,
				note: {
					...state.note,
					metadata: { ...state.note.metadata, title },
				},
			})),

		setContent: (content) =>
			set((state) => ({
				content,
				note: {
					...state.note,
					content,
				},
			})),

		setIsFocused: (isFocused) => set({ isFocused }),
		setCanUnfocus: (canUnfocus) => set({ canUnfocus }),

		changeNoteHandle: (newHandle) =>
			set((state) => ({
				...state,
				note: {
					...state.note,
					handle: newHandle,
				},
			})),

		changeNoteSlug: (newSlug: NoteSlug) =>
			set((state) => ({
				...state,
				note: {
					...state.note,
					metadata: {
						...state.note.metadata,
						slug: newSlug,
					},
				},
			})),

		changeNotePath: (path: string[]) =>
			set((state) => ({
				...state,
				note: {
					...state.note,
					metadata: {
						...state.note.metadata,
						path,
					},
				},
			})),

		addFiles: async (files, notebook) => {
			return await saveFilesInNotebook(notebook, files)
		},
	}))
}

function NoteEditorStoreProvider({
	note,
	children,
}: PropsWithChildren<{ note: Note }>) {
	const store = useRef<NoteEditorStore>()
	if (!store.current) {
		store.current = createNoteEditorStore(note)
	}
	return (
		<MarkdownEditorStoreContext.Provider value={store.current}>
			{children}
		</MarkdownEditorStoreContext.Provider>
	)
}

function useNoteEditorStoreContext() {
	const store = useContext(MarkdownEditorStoreContext)
	if (!store) throw new Error("Missing NoteEditorStoreContext")
	return store as NoteEditorStore
}

function useNoteEditorStore<T>(selector: (state: NoteEditorState) => T): T {
	const store = useContext(MarkdownEditorStoreContext)
	if (!store) throw new Error("Missing NoteEditorStoreContext")
	// @ts-ignore
	return useStore(store, selector)
}

export {
	NoteEditorStoreProvider,
	useNoteEditorStore,
	useNoteEditorStoreContext,
	createNoteEditorStore,
}
