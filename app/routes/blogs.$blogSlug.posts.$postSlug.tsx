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
import type { MultiUploadResult } from "~/blog/upload"
import { getSession } from "~/sessions"
import { authenticate } from "~/auth"
import { fetchApi } from "~/fetch-api"
import { ApiError } from "~/error"
import { encrypt, type Base64EncodedCipher } from "~/crypt"
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
	const isDecrypting = useEditorStore((state) => state.isDecrypting)
	const editorStore = useEditorStoreContext()
	const keyStore = useKeyStore()
	const navigate = useNavigate()

	const fetcher = useFetcher()
	const uploadFetcher = useFetcher<MultiUploadResult>()

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
	}, [uploadFetcher.data])

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
				if (files.length === 0) {
					return
				}
				const form = new FormData()
				for (const file of files) {
					form.append("images", file)
				}
				uploadFetcher.submit(form, {
					encType: "multipart/form-data",
					method: "POST",
					action: "./image",
				})
			},
		)
		return () => {
			unsub()
		}
	}, [uploadFetcher.submit, editorStore.subscribe])

	useEffect(() => {
		return () => {
			if (autoSaveTimeout.current) {
				clearTimeout(autoSaveTimeout.current)
			}
		}
	}, [])

	function autoSaveAfterTimeout() {
		console.log("is decrypting", isDecrypting)
		if (autoSaveTimeout.current) {
			clearTimeout(autoSaveTimeout.current)
		}
		autoSaveTimeout.current = setTimeout(savePost, 2000)
	}

	async function savePost() {
		if (postUpdate.current.content) {
			const key = await keyStore.getKey()
			if (key.isErr()) {
				navigate("/login", { replace: true })
				return
			}

			const encResult = await encrypt(postUpdate.current.content, key.value)
			if (encResult.isErr()) {
				console.error(encResult.error)
				return
			}

			postUpdate.current.contentCipher = encResult.value
			postUpdate.current.content = undefined
		}

		console.log(postUpdate.current)

		// @ts-ignore you are fking retarded
		fetcher.submit(postUpdate.current, {
			method: "PATCH",
			encType: "application/json",
		})
		postUpdate.current = {}
		autoSaveTimeout.current = null
	}

	return (
		<div className="w-full px-16 flex justify-center">
			<main className="w-full mt-40 lg:max-w-prose">
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

	const updateJson = await request.json()
	const updated = await fetchApi<Base64EncodedCipher>(
		`/blogs/${params.blogSlug}/posts/${params.postSlug}`,
		{
			method: "PATCH",
			body: JSON.stringify(updateJson),
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	)
	if (updated.isErr()) {
		return json({ error: ApiError.Internal }, { status: 500 })
	}

	return json(updated.value)
}
