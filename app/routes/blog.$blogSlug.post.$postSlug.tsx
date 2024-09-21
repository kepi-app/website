import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { json, useFetcher, useLoaderData } from "@remix-run/react"
import dayjs from "dayjs"
import { useEffect, useRef } from "react"
import { MainEditor } from "~/blog-post-editor/main-editor"
import { useEditorStore } from "~/blog-post-editor/store"
import type { BlogPost } from "~/blog/post"

import "katex/dist/katex.min.css"
import "highlightjs/styles/atom-one-dark.css"
import { BottomArea } from "~/blog-post-editor/bottom-area"
import { useStoreWithEqualityFn } from "zustand/traditional"

interface PostUpdate {
	title?: string
	description?: string
	content?: string
}

export async function loader({ params }: LoaderFunctionArgs) {
	const res = await fetch(
		`${process.env.API_URL}/blog/${params.blogSlug}/post/${params.postSlug}`,
	)
	return json<BlogPost>(await res.json())
}

export default function EditBlogPostPage() {
	const postData = useLoaderData<typeof loader>()
	const fetcher = useFetcher()
	const uploadFetcher = useFetcher()

	const postUpdate = useRef<PostUpdate>({})
	const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
	const setStatusMessage = useEditorStore((state) => state.setStatusMessage)
	const setIsFocused = useEditorStore((state) => state.setIsFocused)
	const loadPostIntoStore = useEditorStore((state) => state.loadPostIntoStore)
	const clearPendingFiles = useEditorStore((state) => state.clearPendingFiles)

	useEffect(() => {
		loadPostIntoStore(postData)
	}, [loadPostIntoStore, postData])

	useEffect(
		function unfocusOnMouseMove() {
			function unfocus() {
				if (useEditorStore.getState().canUnfocus) {
					setIsFocused(false)
				}
			}
			document.addEventListener("mousemove", unfocus)
			return () => {
				document.removeEventListener("mousemove", unfocus)
			}
		},
		[setIsFocused],
	)

	useEffect(
		function updateStatusMessage() {
			switch (fetcher.state) {
				case "idle":
					if (useEditorStore.getState().statusMessage) {
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
		[setStatusMessage, fetcher.state],
	)

	useEffect(() => {
		if (uploadFetcher.state === "idle") {
			clearPendingFiles()
		}
	}, [clearPendingFiles, uploadFetcher.state])

	useEffect(function autoSaveOnContentChange() {
		const unsub0 = useEditorStore.subscribe(
			(state) => state.content,
			(content) => {
				postUpdate.current.content = content
				autoSaveAfterTimeout()
			},
		)
		const unsub1 = useEditorStore.subscribe(
			(state) => state.title,
			(title) => {
				postUpdate.current.title = title
				autoSaveAfterTimeout()
			},
		)
		const unsub2 = useEditorStore.subscribe(
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
	}, [])

	useEffect(() => {
		const unsub = useEditorStore.subscribe(
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
	}, [uploadFetcher.submit])

	useEffect(() => {
		return () => {
			if (autoSaveTimeout.current) {
				clearTimeout(autoSaveTimeout.current)
			}
		}
	}, [])

	function autoSaveAfterTimeout() {
		if (autoSaveTimeout.current) {
			clearTimeout(autoSaveTimeout.current)
		}
		autoSaveTimeout.current = setTimeout(savePost, 2000)
	}

	function savePost() {
		fetcher.submit(postUpdate.current as Record<string, string>, {
			method: "PATCH",
			encType: "application/json",
		})
		postUpdate.current = {}
		autoSaveTimeout.current = null
	}

	return (
		<div className="w-full px-16 flex justify-center">
			<main className="w-full mt-40 lg:max-w-prose">
				<MainEditor />
				<BottomArea />
			</main>
		</div>
	)
}

export async function action({ params, request }: ActionFunctionArgs) {
	const updateJson = await request.json()
	await fetch(
		`${process.env.API_URL}/blog/${params.blogSlug}/post/${params.postSlug}`,
		{
			method: "PATCH",
			body: JSON.stringify(updateJson),
		},
	)
	return json({})
}
