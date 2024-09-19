import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { json, useFetcher, useLoaderData } from "@remix-run/react"
import clsx from "clsx"
import dayjs from "dayjs"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import Markdown from "react-markdown"
import type { BlogPost } from "~/blog/post"
import { AutoResizingTextArea } from "~/components/auto-resizing-textarea"
import { Button } from "~/components/button"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import rehypeHighlight from "rehype-highlight"
import "highlightjs/styles/atom-one-dark.css"
import { PhotoIcon } from "@heroicons/react/24/outline"

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

	const [postTitle, setPostTitle] = useState(postData.title)
	const [postDescription, setPostDescription] = useState(postData.description)
	const [postContent, setPostContent] = useState(postData.content)
	const postUpdate = useRef<PostUpdate>({})
	const [statusMessage, setStatusMessage] = useState("")
	const [isPreviewing, setIsPreviewing] = useState(false)
	const [isFocused, setIsFocused] = useState(false)
	const canUnfocus = useRef(false)
	const unfocusTimeout = useRef<ReturnType<typeof setTimeout>>()
	const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
	const imageFileInputRef = useRef<HTMLInputElement | null>(null)

	useEffect(function unfocusOnMouseMove() {
		function unfocus() {
			if (canUnfocus.current) {
				setIsFocused(false)
			}
		}
		document.addEventListener("mousemove", unfocus)
		return () => {
			document.removeEventListener("mousemove", unfocus)
		}
	}, [])

	useEffect(
		function updateStatusMessage() {
			switch (fetcher.state) {
				case "idle":
					if (statusMessage) {
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
		[statusMessage, fetcher.state],
	)

	useEffect(() => {
		postUpdate.current.title = postTitle
		autoSaveAfterTimeout()
	}, [postTitle])

	useEffect(() => {
		postUpdate.current.description = postDescription
		autoSaveAfterTimeout()
	}, [postDescription])

	useEffect(() => {
		postUpdate.current.content = postContent
		autoSaveAfterTimeout()
	}, [postContent])

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

	function onBlogContentInput() {
		if (unfocusTimeout.current) {
			clearTimeout(unfocusTimeout.current)
		}

		setIsFocused(true)
		canUnfocus.current = false
		unfocusTimeout.current = setTimeout(() => {
			canUnfocus.current = true
		}, 500)
	}

	function togglePreview() {
		setIsPreviewing((previewing) => !previewing)
	}

	function openImagePicker() {
		imageFileInputRef.current?.click()
	}

	function onImageChange(event: ChangeEvent<HTMLInputElement>) {
		console.log(event.currentTarget.files)
	}

	return (
		<div className="w-full flex justify-center">
			<main className="w-full mt-40 lg:max-w-prose">
				<div className={clsx("transition-all", { "opacity-0": isFocused })}>
					<AutoResizingTextArea
						name="postTitle"
						className="bg-transparent text-6xl w-full focus:outline-none"
						placeholder="Blog title"
						value={postTitle}
						onChange={(event) => {
							setPostTitle(event.currentTarget.value)
						}}
					/>
					<AutoResizingTextArea
						name="postDescription"
						className="bg-transparent opacity-50 text-xl w-full focus:outline-none"
						placeholder="Blog description"
						value={postDescription}
						onChange={(event) => {
							setPostDescription(event.currentTarget.value)
						}}
					/>
				</div>

				{isPreviewing ? (
					<div className="my-16 prose dark:prose-invert">
						<Markdown
							remarkPlugins={[remarkMath, remarkGfm]}
							rehypePlugins={[rehypeKatex, rehypeHighlight]}
							components={{
								pre: (props) => <pre {...props} className="hljs" />,
							}}
						>
							{postContent}
						</Markdown>
					</div>
				) : (
					<AutoResizingTextArea
						className="font-mono bg-transparent w-full my-16 focus:outline-none"
						placeholder="Content goes here..."
						name="postContent"
						onInput={onBlogContentInput}
						value={postContent}
						onChange={(event) => {
							setPostContent(event.currentTarget.value)
						}}
					/>
				)}

				<div
					className={clsx(
						"fixed z-10 bottom-0 left-0 right-0 w-full flex flex-col items-center",
						{
							"opacity-0": isFocused,
						},
					)}
				>
					<ProgressiveBlurBackground />

					<div className="z-10 flex flex-col items-start w-full lg:max-w-prose">
						<div className="w-full flex justify-center">
							<div className="w-full h-10 lg:max-w-prose"></div>
						</div>

						<div className="w-full lg:max-w-prose flex justify-end items-center py-2 space-x-4">
							{/*statusMessage ? <p className="flex-1">{statusMessage}</p> : null*/}
							<div className="flex flex-row flex-1">
								<input
									ref={imageFileInputRef}
									type="file"
									multiple
									className="hidden"
									onChange={onImageChange}
								/>
								<button type="button" onClick={openImagePicker}>
									<PhotoIcon className="w-6 h-6" />
								</button>
							</div>
							<Button className="px-3 py-1" onClick={togglePreview}>
								{isPreviewing ? "Edit" : "Preview"}
							</Button>
							<Button className="px-3 py-1">Publish</Button>
						</div>
					</div>
				</div>
			</main>
		</div>
	)
}

function ProgressiveBlurBackground() {
	return (
		<div className="absolute top-0 bottom-0 left-0 right-0 w-full">
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(1px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 10%, rgba(0, 0, 0, 1) 30%, rgba(0, 0, 0, 0) 40%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(2px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 10%, rgba(0, 0, 0, 1) 20%, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0) 50%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(4px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 15%, rgba(0, 0, 0, 1) 30%, rgba(0, 0, 0, 1) 50%, rgba(0, 0, 0, 0) 60%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(8px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 20%, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0) 70%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(16px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 1) 80%, rgba(0, 0, 0, 0) 90%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(32px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 1) 80%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(64px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 70%, rgba(0, 0, 0, 1) 100%)",
				}}
			/>
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
