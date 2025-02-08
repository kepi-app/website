import React, { useContext, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { type StateCreator, create, useStore } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import type { UploadResult } from "~/blog/upload"
import { type SymmetricKey, decryptRaw, rawCipherFromBase64 } from "~/crypt"
import { useKeyStore } from "~/keystore"

enum MarkdownEditorStatus {
	Uninitialized = "UNINITIALIZED",
	Editing = "EDITING",
	Previewing = "PREVIEWING",
	Decrypting = "DECRYPTING",
	DecryptionError = "DECRYPTION_ERROR",
}

interface MarkdownEditorState {
	content: string
	status: MarkdownEditorStatus
	pendingFiles: File[]

	decryptContent(
		content: string | null,
		key: SymmetricKey,
	): Promise<string | null>
	setContent(content: string): void
	togglePreview(): void
	addPendingFiles(files: FileList): void
	clearPendingFiles(): void
	insertUploadedImages(images: UploadResult[], offset: number): void
	insertFiles(fileSlugs: string[], offset: number): void
}

type MarkdownEditorStore = ReturnType<typeof createMarkdownEditorStore>

const MarkdownEditorStoreContext =
	React.createContext<MarkdownEditorStore | null>(null)

const _stateCreator: StateCreator<
	MarkdownEditorState,
	[],
	[],
	MarkdownEditorState
> = (set, get) => ({
	content: "",
	status: MarkdownEditorStatus.Editing,
	pendingFiles: [],

	decryptContent: async (content, key) => {
		set((state) => ({ ...state, status: MarkdownEditorStatus.Decrypting }))

		if (!content) {
			set((state) => ({
				...state,
				content: "",
				status: MarkdownEditorStatus.Editing,
			}))
			return ""
		}

		try {
			const contentCipher = await rawCipherFromBase64(content)
			const decrypted = await decryptRaw(contentCipher, key)
			const decoder = new TextDecoder()
			const decryptedContent = decoder.decode(decrypted)
			set((state) => ({
				...state,
				content: decryptedContent,
				status: MarkdownEditorStatus.Editing,
			}))
			return decryptedContent
		} catch (e) {
			console.error(e)
			set((state) => ({
				...state,
				content: "",
				status: MarkdownEditorStatus.DecryptionError,
			}))
			return null
		}
	},

	setContent: (content) => set((state) => ({ ...state, content })),

	togglePreview: () =>
		set((state) => ({
			...state,
			status:
				state.status === MarkdownEditorStatus.Previewing
					? MarkdownEditorStatus.Editing
					: MarkdownEditorStatus.Previewing,
		})),

	addPendingFiles: (files) =>
		set((state) => ({
			...state,
			pendingFiles: [...state.pendingFiles, ...files],
		})),

	clearPendingFiles: () => set((state) => ({ ...state, pendingFiles: [] })),

	insertUploadedImages: (images, offset) => {
		const statements = images.map(
			({ fileId }) => `![INSERT CAPTION](./files/${fileId})`,
		)
		const currentContent = get().content
		get().setContent(
			currentContent.substring(0, offset) +
				statements.join("\n") +
				currentContent.substring(offset),
		)
	},

	insertFiles: (fileSlugs, offset) => {
		if (fileSlugs.length > 0) {
			const statements = fileSlugs.map(
				(slug) => `![INSERT CAPTION](./files/${encodeURIComponent(slug)})`,
			)
			const currentContent = get().content
			get().setContent(
				currentContent.substring(0, offset) +
					statements.join("\n") +
					currentContent.substring(offset),
			)
		}
	},
})

function createMarkdownEditorStore() {
	return create<MarkdownEditorState>()(subscribeWithSelector(_stateCreator))
}

function extendMarkdownEditorStore<T>(
	initializer: StateCreator<T & MarkdownEditorState, [], [], T>,
) {
	return create<T & MarkdownEditorState>()(
		subscribeWithSelector((...args) => ({
			..._stateCreator(...args),
			...initializer(...args),
		})),
	)
}

function MarkdownEditorStoreProvider({
	children,
	content,
}: React.PropsWithChildren<{ content: string | null }>) {
	const storeRef = useRef<MarkdownEditorStore>()
	const keyStore = useKeyStore()
	const navigate = useNavigate()

	if (!storeRef.current) {
		storeRef.current = createMarkdownEditorStore()
	}

	useEffect(() => {
		async function decryptPost() {
			try {
				const key = await keyStore.getKey()
				// biome-ignore lint/style/noNonNullAssertion: <explanation>
				storeRef.current!.getState().decryptContent(content, key)
			} catch (e) {
				console.error(e)
				navigate("/login", { replace: true })
			}
		}
		decryptPost()
	}, [navigate, keyStore.getKey, content])

	return (
		<MarkdownEditorStoreContext.Provider value={storeRef.current}>
			{children}
		</MarkdownEditorStoreContext.Provider>
	)
}

function useMarkdownEditorStoreContext() {
	const store = useContext(MarkdownEditorStoreContext)
	if (!store) throw new Error("Missing EditorStoreContext")
	return store
}

function useMarkdownEditorStore<T>(
	selector: (state: MarkdownEditorState) => T,
): T {
	const store = useContext(MarkdownEditorStoreContext)
	if (!store) throw new Error("Missing EditorStoreContext")
	return useStore(store, selector)
}

export {
	MarkdownEditorStoreProvider,
	MarkdownEditorStatus,
	MarkdownEditorStoreContext,
	createMarkdownEditorStore,
	extendMarkdownEditorStore,
	useMarkdownEditorStore,
	useMarkdownEditorStoreContext,
}
export type { MarkdownEditorState, MarkdownEditorStore }
