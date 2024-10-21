import { useNavigate } from "@remix-run/react"
import React, { useContext, useEffect } from "react"
import { useRef } from "react"
import { useStore } from "zustand"
import type { BlogPost } from "~/blog/post"
import {
	MarkdownEditorStoreContext,
	extendMarkdownEditorStore,
	type MarkdownEditorState,
} from "~/components/markdown-editor/markdown-editor"
import type { SymmetricKey } from "~/crypt"
import { useKeyStore } from "~/keystore"

interface PostEditorSlice {
	title: string
	description: string
	statusMessage: string
	isFocused: boolean
	canUnfocus: boolean

	decryptPost(post: BlogPost, key: SymmetricKey): Promise<void>
	setTitle(title: string): void
	setDescription(description: string): void
	setIsFocused(isFocused: boolean): void
	setCanUnfocus(canUnfocus: boolean): void
	setStatusMessage(statusMessage: string): void
}

type PostEditorState = PostEditorSlice & MarkdownEditorState
type PostEditorStore = ReturnType<typeof createPostEditorStore>

function createPostEditorStore() {
	return extendMarkdownEditorStore<PostEditorSlice>((set, get) => ({
		title: "",
		description: "",
		statusMessage: "",
		isFocused: false,
		canUnfocus: true,

		decryptPost: async (post, key): Promise<void> => {
			await get().decryptContent(post.content ?? null, key)
			set((state) => ({
				...state,
				title: post.title,
				description: post.description,
			}))
		},
		setTitle: (title) => set((state) => ({ ...state, title })),
		setDescription: (description) =>
			set((state) => ({ ...state, description })),
		setIsFocused: (isFocused) => set((state) => ({ ...state, isFocused })),
		setCanUnfocus: (canUnfocus) => set((state) => ({ ...state, canUnfocus })),
		setStatusMessage: (statusMessage) =>
			set((state) => ({ ...state, statusMessage })),
	}))
}

function PostEditorStoreProvider({
	children,
	post,
}: React.PropsWithChildren<{ post: BlogPost }>) {
	const storeRef = useRef<PostEditorStore>()
	const keyStore = useKeyStore()
	const navigate = useNavigate()

	if (!storeRef.current) {
		storeRef.current = createPostEditorStore()
	}

	useEffect(() => {
		async function decryptPost() {
			try {
				const key = await keyStore.getKey()
				// biome-ignore lint/style/noNonNullAssertion: <explanation>
				storeRef.current!.getState().decryptPost(post, key)
			} catch (e) {
				console.error(e)
				navigate("/login", { replace: true })
			}
		}
		decryptPost()
	}, [navigate, keyStore.getKey, post])

	return (
		<MarkdownEditorStoreContext.Provider value={storeRef.current}>
			{children}
		</MarkdownEditorStoreContext.Provider>
	)
}

function usePostEditorStoreContext(): PostEditorStore {
	const store = useContext(MarkdownEditorStoreContext)
	if (!store) throw new Error("Missing EditorStoreContext")
	// @ts-ignore
	return store
}

function usePostEditorStore<T>(selector: (state: PostEditorState) => T): T {
	const store = useContext(MarkdownEditorStoreContext)
	if (!store) throw new Error("Missing EditorStoreContext")
	// @ts-ignore
	return useStore(store, selector)
}

export {
	PostEditorStoreProvider,
	usePostEditorStore,
	usePostEditorStoreContext,
}
export type { PostEditorState }
