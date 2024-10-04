import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { json, useFetcher, useLoaderData, useNavigate } from "@remix-run/react"
import dayjs from "dayjs"
import { useEffect, useRef } from "react"
import { MainEditor, type MainEditorRef } from "~/blog-post-editor/main-editor"
import {
	EditorStoreProvider,
	useEditorStore,
	useEditorStoreContext,
} from "~/blog-post-editor/store"
import type { BlogPost } from "~/blog/post"

import "katex/dist/katex.min.css"
import "highlightjs/styles/atom-one-dark.css"
import { BottomArea } from "~/blog-post-editor/bottom-area"
import type { UploadResult } from "~/blog/upload"
import { getSession } from "~/sessions"
import { authenticate } from "~/auth"
import { fetchApi } from "~/fetch-api"
import { ApiError } from "~/error"
import {
	encryptFile,
	encryptToRaw,
	type Base64EncodedCipher,
} from "~/crypt"
import { useKeyStore } from "~/keystore"

interface PostUpdate {
	title?: string
	description?: string
	content?: string
	contentCipher?: Base64EncodedCipher
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)
	const result = await fetchApi<BlogPost>(
		`/blogs/${params.blogSlug}/posts/${params.postSlug}`,
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	)
	if (result.isErr()) {
		return json({ error: ApiError.Internal }, { status: 500 })
	}
	return json(result.value)
}

export function shouldRevalidate() {
	return false
}

export default function Page() {
	const postData = useLoaderData<typeof loader>()
	if ("error" in postData) {
		return <ErrorPage />
	}
	return (
		<EditorStoreProvider post={postData}>
			<WaitForDecryption />
		</EditorStoreProvider>
	)
}

function ErrorPage() {
	return (
		<div className="w-full px-16 flex justify-center bg-zinc-200 dark:bg-zinc-900">
			<main className="w-full mt-40 max-w-prose">
				<p>an error occurred on our end when opening this post.</p>
			</main>
		</div>
	)
}

function WaitForDecryption() {
	const isDecrypting = useEditorStore((state) => state.isDecrypting)
	if (isDecrypting) {
		return (
			<main className="w-full h-screen flex items-center justify-center">
				<p className="animate-pulse">Decrypting post</p>
			</main>
		)
	}
	return <EditBlogPostPage />
}

function EditBlogPostPage() {
	const postUpdate = useRef<PostUpdate>({})
	const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
	const mainEditorRef = useRef<MainEditorRef | null>(null)
	const setStatusMessage = useEditorStore((state) => state.setStatusMessage)
	const setIsFocused = useEditorStore((state) => state.setIsFocused)
	const clearPendingFiles = useEditorStore((state) => state.clearPendingFiles)
	const insertUploadedImages = useEditorStore(
		(state) => state.insertUploadedImages,
	)
	const editorStore = useEditorStoreContext()
	const keyStore = useKeyStore()
	const navigate = useNavigate()

	const fetcher = useFetcher()
	const uploadFetcher = useFetcher<UploadResult[]>()

	useEffect(
		function unfocusOnMouseMove() {
			function unfocus() {
				if (editorStore.getState().canUnfocus) {
					setIsFocused(false)
				}
			}
			document.addEventListener("mousemove", unfocus)
			return () => {
				document.removeEventListener("mousemove", unfocus)
			}
		},
		[setIsFocused, editorStore.getState],
	)

	useEffect(
		function updateStatusMessage() {
			switch (fetcher.state) {
				case "idle":
					if (editorStore.getState().statusMessage) {
						setStatusMessage(`Last saved ${dayjs().fromNow()}`)
					}
					break

				case "loading":
					break

				case "submitting":
					setStatusMessage("Saving…")
					break
			}
		},
		[setStatusMessage, fetcher.state, editorStore.getState],
	)

	useEffect(() => {
		if (uploadFetcher.state === "idle") {
			clearPendingFiles()
		}
	}, [clearPendingFiles, uploadFetcher.state])

	useEffect(() => {
		if (!uploadFetcher.data) {
			return
		}

		const contentInput = mainEditorRef?.current?.contentInput
		if (!contentInput) {
			return
		}

		insertUploadedImages(uploadFetcher.data, contentInput.selectionEnd)
	}, [uploadFetcher.data, insertUploadedImages])

	useEffect(
		function autoSaveOnContentChange() {
			const unsub0 = editorStore.subscribe(
				(state) => state.content,
				(content) => {
					postUpdate.current.content = content
					autoSaveAfterTimeout()
				},
			)
			const unsub1 = editorStore.subscribe(
				(state) => state.title,
				(title) => {
					postUpdate.current.title = title
					autoSaveAfterTimeout()
				},
			)
			const unsub2 = editorStore.subscribe(
				(state) => state.description,
				(description) => {
					postUpdate.current.description = description
					autoSaveAfterTimeout()
				},
			)
			return () => {
				unsub0()
				unsub1()
				unsub2()
			}
		},
		[editorStore.subscribe],
	)

	useEffect(() => {
		const unsub = editorStore.subscribe(
			(state) => state.pendingFiles,
			(files) => {
				uploadFiles(files)
			},
		)
		return () => {
			unsub()
		}
	}, [editorStore.subscribe])

	useEffect(() => {
		return () => {
			if (autoSaveTimeout.current) {
				clearTimeout(autoSaveTimeout.current)
			}
		}
	}, [])

	async function uploadFiles(files: File[]) {
		if (files.length === 0) {
			return
		}

		const key = await keyStore.getKey()
		if (key.isErr()) {
			// TODO: handle error
			return
		}

		const promises: Promise<void>[] = []
		const formData = new FormData()
		for (const file of files) {
			promises.push(
				encryptFile(file, key.value).then((encResult) => {
					if (encResult.isErr()) {
						// TODO: handle encryption failure
						return
					}

					const { fileCipher, mimeTypeCipher } = encResult.value

					formData.append(
						"files",
						new Blob([fileCipher.authTag, fileCipher.iv, fileCipher.text], {
							type: "application/octet-stream",
						}),
					)
					formData.append(
						"mimeTypes",
						new Blob(
							[mimeTypeCipher.authTag, mimeTypeCipher.iv, mimeTypeCipher.text],
							{
								type: "application/octet-stream",
							},
						),
					)
				}),
			)
		}

		await Promise.all(promises)

		uploadFetcher.submit(formData, {
			encType: "multipart/form-data",
			method: "POST",
			action: "./files",
		})
	}

	function autoSaveAfterTimeout() {
		if (autoSaveTimeout.current) {
			clearTimeout(autoSaveTimeout.current)
		}
		autoSaveTimeout.current = setTimeout(savePost, 2000)
	}

	async function savePost() {
		const updateForm = new FormData()

		if (postUpdate.current.content) {
			const key = await keyStore.getKey()
			if (key.isErr()) {
				navigate("/login", { replace: true })
				return
			}

			const encResult = await encryptToRaw(
				postUpdate.current.content,
				key.value,
			)
			if (encResult.isErr()) {
				console.error(encResult.error)
				return
			}

			const { authTag, iv, text } = encResult.value

			updateForm.set(
				"content",
				new Blob([authTag, iv, text], { type: "application/octet-stream" }),
			)
		}

		if (postUpdate.current.title) {
			updateForm.set("title", postUpdate.current.title)
		}

		if (postUpdate.current.description) {
			updateForm.set("description", postUpdate.current.description)
		}

		// @ts-ignore
		fetcher.submit(updateForm, {
			method: "PATCH",
			encType: "multipart/form-data",
		})
		postUpdate.current = {}
		autoSaveTimeout.current = null
	}

	return (
		<div className="w-full px-16 flex justify-center">
			<main className="w-full mt-40 max-w-prose">
				<MainEditor ref={mainEditorRef} />
				<BottomArea />
			</main>
		</div>
	)
}

export async function action({ params, request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const headers = new Headers()
	const accessToken = await authenticate(request, session, headers)

	const updateForm = await request.formData()
	const updated = await fetchApi<Base64EncodedCipher>(
		`/blogs/${params.blogSlug}/posts/${params.postSlug}`,
		{
			method: "PATCH",
			body: updateForm,
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	)
	if (updated.isErr()) {
		return json({ error: ApiError.Internal }, { status: 500 })
	}

	return json(updated.value)
}
