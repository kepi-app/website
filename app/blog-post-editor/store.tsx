import React, { useContext } from "react"
import { useRef } from "react"
import { create, useStore } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import type { BlogPost } from "~/blog/post"
import type { MultiUploadResult } from "~/blog/upload"

interface EditorState {
	isPostDataLoaded: boolean
	title: string
	description: string
	content: string
	statusMessage: string
	isPreviewing: boolean
	isFocused: boolean
	canUnfocus: boolean
	pendingFiles: File[]
	textSelectionStart: number
	textSelectionEnd: number

	loadPostIntoStore(postData: BlogPost): void
	setTitle(title: string): void
	setDescription(description: string): void
	setContent(content: string): void
	setIsFocused(isFocused: boolean): void
	setCanUnfocus(canUnfocus: boolean): void
	setStatusMessage(statusMessage: string): void
	togglePreview(): void
	addPendingFiles(files: FileList): void
	clearPendingFiles(): void
	setCurrentTextSelection({ start, end }: { start: number; end: number }): void
	insertUploadedImages(images: MultiUploadResult, offset: number): void
}

type EditorStore = ReturnType<typeof createEditorStore>

const EditorStoreContext = React.createContext<EditorStore | null>(null)

function createEditorStore(postData: BlogPost) {
	return create<EditorState>()(
		subscribeWithSelector((set, get) => ({
			isPostDataLoaded: false,
			title: postData.title,
			description: postData.description,
			content: postData.content,
			statusMessage: "",
			isPreviewing: false,
			isFocused: false,
			canUnfocus: true,
			pendingFiles: [],
			textSelectionStart: 0,
			textSelectionEnd: 0,

			loadPostIntoStore: (postData) =>
				set((state) => ({
					...state,
					isPostDataLoaded: true,
					title: postData.title,
					description: postData.description,
					content: postData.content,
				})),
			setTitle: (title) => set((state) => ({ ...state, title })),
			setDescription: (description) =>
				set((state) => ({ ...state, description })),
			setContent: (content) => set((state) => ({ ...state, content })),
			setIsFocused: (isFocused) => set((state) => ({ ...state, isFocused })),
			setCanUnfocus: (canUnfocus) => set((state) => ({ ...state, canUnfocus })),
			setStatusMessage: (statusMessage) =>
				set((state) => ({ ...state, statusMessage })),
			togglePreview: () =>
				set((state) => ({ ...state, isPreviewing: !state.isPreviewing })),
			addPendingFiles: (files) =>
				set((state) => ({
					...state,
					pendingFiles: [...state.pendingFiles, ...files],
				})),
			clearPendingFiles: () => set((state) => ({ ...state, pendingFiles: [] })),
			setCurrentTextSelection: ({ start, end }) =>
				set((state) => ({
					...state,
					textSelectionStart: start,
					textSelectionEnd: end,
				})),
			insertUploadedImages: (images, offset) => {
				const statements = images.results.map(
					({ url }) => `![INSERT CAPTION](${url})`,
				)
				const currentContent = get().content
				return set((state) => ({
					...state,
					content:
						currentContent.substring(0, offset) +
						statements.join("\n") +
						currentContent.substring(offset),
				}))
			},
		})),
	)
}

function EditorStoreProvider({
	children,
	post,
}: React.PropsWithChildren<{ post: BlogPost }>) {
	const storeRef = useRef<EditorStore>()
	if (!storeRef.current) {
		storeRef.current = createEditorStore(post)
	}
	return (
		<EditorStoreContext.Provider value={storeRef.current}>
			{children}
		</EditorStoreContext.Provider>
	)
}

function useEditorStoreContext() {
	const store = useContext(EditorStoreContext)
	if (!store) throw new Error("Missing EditorStoreContext")
	return store
}

function useEditorStore<T>(selector: (state: EditorState) => T): T {
	const store = useContext(EditorStoreContext)
	if (!store) throw new Error("Missing EditorStoreContext")
	return useStore(store, selector)
}

export { EditorStoreProvider, useEditorStore, useEditorStoreContext }
export type { EditorState }
