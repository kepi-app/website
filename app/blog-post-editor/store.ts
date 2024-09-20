import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import type { BlogPost } from "~/blog/post"

interface EditorStore {
	isPostDataLoaded: boolean
	title: string
	description: string
	content: string
	statusMessage: string
	isPreviewing: boolean
	isFocused: boolean
	canUnfocus: boolean
	pendingFiles: File[]

	loadPostIntoStore(postData: BlogPost): void
	setTitle(title: string): void
	setDescription(description: string): void
	setContent(content: string): void
	setIsFocused(isFocused: boolean): void
	setCanUnfocus(canUnfocus: boolean): void
	setStatusMessage(statusMessage: string): void
	togglePreview(): void

	addPendingFiles(files: FileList): void
}

const useEditorStore = create<EditorStore>()(
	subscribeWithSelector((set) => ({
		isPostDataLoaded: false,
		title: "",
		description: "",
		content: "",
		statusMessage: "",
		isPreviewing: false,
		isFocused: false,
		canUnfocus: true,
		pendingFiles: [],

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
	})),
)

export { useEditorStore }
export type { EditorStore }
