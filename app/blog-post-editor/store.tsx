import dayjs from "dayjs"
import type React from "react"
import { useContext, useEffect } from "react"
import { useRef } from "react"
import { useNavigate } from "react-router"
import { useStore } from "zustand"
import {
	type BlogPost,
	type BlogPostFrontmatter,
	parseBlogPostFrontmatter,
} from "~/blog/post"
import {
	type MarkdownEditorState,
	MarkdownEditorStoreContext,
	extendMarkdownEditorStore,
} from "~/components/markdown-editor/markdown-editor"
import { type SymmetricKey, encryptFile, encryptToRaw } from "~/crypt"
import { useKeyStore } from "~/keystore"

interface PostEditorSlice {
	title: string
	description: string
	statusMessage: string
	isFocused: boolean
	canUnfocus: boolean
	validationIssues: string[]
	changesSinceLastSave: {
		title?: string
		description?: string
		content?: string
	}

	/**
	 * the current frontmatter of the post. null if there is no frontmatter or if it's invalid.
	 */
	frontmatter: BlogPostFrontmatter | null

	setTitle(title: string): void
	setDescription(description: string): void
	setContent(content: string): void
	setIsFocused(isFocused: boolean): void
	setCanUnfocus(canUnfocus: boolean): void
	setStatusMessage(statusMessage: string): void
	setValidationIssues: (issues: string[]) => void
	decryptPost(post: BlogPost, key: SymmetricKey): Promise<void>
	createSavePostForm(key: SymmetricKey): Promise<FormData | null>
	markPostAsSaved(): void

	/**
	 * Encrypts currently pending files and creates an instance of {@link FormData}
	 * that should be submitted to upload currently pending files.
	 *
	 * @param key {SymmetricKey} the key used to encrypt the files
	 * @returns {FormData} a form that can be submitted to upload pending files.
	 */
	createUploadPendingFilesForm(key: SymmetricKey): Promise<FormData | null>
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
		validationIssues: [],
		frontmatter: null,
		changesSinceLastSave: {},

		setTitle: (title) =>
			set((state) => ({
				title,
				changesSinceLastSave: { ...state.changesSinceLastSave, title },
			})),
		setDescription: (description) =>
			set((state) => ({
				description,
				changesSinceLastSave: { ...state.changesSinceLastSave, description },
			})),
		setContent: (content: string) =>
			set((state) => ({
				content,
				changesSinceLastSave: { ...state.changesSinceLastSave, content },
			})),
		setIsFocused: (isFocused) => set({ isFocused }),
		setCanUnfocus: (canUnfocus) => set({ canUnfocus }),
		setStatusMessage: (statusMessage) => set({ statusMessage }),
		setValidationIssues: (issues) => set({ validationIssues: issues }),

		decryptPost: async (post, key): Promise<void> => {
			const content = await get().decryptContent(post.content ?? null, key)
			if (content) {
				const result = parseBlogPostFrontmatter(content)
				if (result.ok) {
					set((state) => ({
						...state,
						frontmatter: result.frontmatter,
						title: post.title,
						description: post.description,
					}))
				} else {
					set((state) => ({
						...state,
						frontmatter: null,
						title: post.title,
						description: post.description,
						validationIssues: result.issues,
					}))
				}
			}
		},

		createSavePostForm: async (key) => {
			const updateForm = new FormData()
			const postUpdate = get().changesSinceLastSave
			const prevFrontmatter = get().frontmatter

			let isDirty = false
			function _setForm(key: string, value: string | Blob) {
				isDirty = true
				updateForm.set(key, value)
			}

			if (postUpdate.content) {
				const result = parseBlogPostFrontmatter(postUpdate.content)
				if (result.ok) {
					const { frontmatter } = result
					if (prevFrontmatter) {
						if (prevFrontmatter.slug !== frontmatter.slug) {
							_setForm("slug", frontmatter.slug)
						}
						if (
							prevFrontmatter["publish date"] !== frontmatter["publish date"]
						) {
							_setForm(
								"publishDate",
								dayjs(frontmatter["publish date"]).toISOString(),
							)
						}
					} else {
						_setForm("slug", frontmatter.slug)
						_setForm("slug", dayjs(frontmatter["publish date"]).toISOString())
					}
					set({ frontmatter, validationIssues: [] })
				} else {
					set({ frontmatter: null, validationIssues: result.issues })
				}

				try {
					const { authTag, iv, text } = await encryptToRaw(
						postUpdate.content,
						key,
					)

					_setForm(
						"content",
						new Blob([authTag, iv, text], { type: "application/octet-stream" }),
					)
				} catch (e) {
					console.error(e)
					// TODO: handle post encryption error
					return null
				}
			}

			if (postUpdate.title) {
				_setForm("title", postUpdate.title)
			}

			if (postUpdate.description) {
				_setForm("description", postUpdate.description)
			}

			return isDirty ? updateForm : null
		},

		markPostAsSaved: () => set({ changesSinceLastSave: {} }),

		createUploadPendingFilesForm: async (key) => {
			const pendingFiles = get().pendingFiles
			if (pendingFiles.length === 0) {
				return null
			}

			const promises: Promise<void>[] = []
			const formData = new FormData()
			for (const file of pendingFiles) {
				promises.push(
					encryptFile(file, key).then(({ fileCipher, mimeTypeCipher }) => {
						formData.append(
							"files",
							new Blob([fileCipher.authTag, fileCipher.iv, fileCipher.text], {
								type: "application/octet-stream",
							}),
						)
						formData.append(
							"mimeTypes",
							new Blob(
								[
									mimeTypeCipher.authTag,
									mimeTypeCipher.iv,
									mimeTypeCipher.text,
								],
								{
									type: "application/octet-stream",
								},
							),
						)
					}),
				)
			}

			await Promise.all(promises)

			return formData
		},
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
