import clsx from "clsx"
import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { AutoResizingTextArea } from "~/components/auto-resizing-textarea"
import { useEditorStore } from "./store"
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

interface MainEditorRef {
	contentInput: HTMLTextAreaElement | null
}

const MainEditor = forwardRef<MainEditorRef>((_, ref) => {
	const isFocused = useEditorStore((state) => state.isFocused)
	const contentInputRef = useRef<HTMLTextAreaElement | null>(null)
	useImperativeHandle(ref, () => ({
		contentInput: contentInputRef.current,
	}))

	return (
		<>
			<div className={clsx("transition-all", { "opacity-0": isFocused })}>
				<TitleInput />
				<DescriptionInput />
			</div>
			<ContentArea ref={contentInputRef} />
		</>
	)
})

function TitleInput() {
	const postTitle = useEditorStore((state) => state.title)
	const setPostTitle = useEditorStore((state) => state.setTitle)

	return (
		<AutoResizingTextArea
			name="postTitle"
			className="bg-transparent text-6xl w-full focus:outline-none"
			placeholder="Blog title"
			value={postTitle}
			onChange={(event) => {
				setPostTitle(event.currentTarget.value)
			}}
		/>
	)
}

function DescriptionInput() {
	const postDescription = useEditorStore((state) => state.description)
	const setPostDescription = useEditorStore((state) => state.setDescription)
	return (
		<AutoResizingTextArea
			name="postDescription"
			className="bg-transparent opacity-50 text-xl w-full focus:outline-none"
			placeholder="Blog description"
			value={postDescription}
			onChange={(event) => {
				setPostDescription(event.currentTarget.value)
			}}
		/>
	)
}

const ContentArea = forwardRef<HTMLTextAreaElement | null>((_, ref) => {
	const postContent = useEditorStore((state) => state.content)
	const isPreviewing = useEditorStore((state) => state.isPreviewing)

	if (isPreviewing) {
		return (
			<article className="prose dark:prose-invert mt-16 mb-40">
				<Markdown
					remarkPlugins={[remarkMath, remarkGfm]}
					rehypePlugins={[rehypeKatex, rehypeHighlight]}
					components={{
						pre: (props) => <pre {...props} className="hljs" />,
					}}
				>
					{postContent}
				</Markdown>
			</article>
		)
	}

	return <ContentEditor ref={ref} />
})

const ContentEditor = forwardRef((_, ref) => {
	const postContent = useEditorStore((state) => state.content)
	const setPostContent = useEditorStore((state) => state.setContent)
	const setIsFocused = useEditorStore((state) => state.setIsFocused)
	const setCanUnfocus = useEditorStore((state) => state.setCanUnfocus)
	const unfocusTimeout = useRef<ReturnType<typeof setTimeout>>()

	useEffect(() => {
		return () => {
			if (unfocusTimeout.current) {
				clearTimeout(unfocusTimeout.current)
			}
		}
	}, [])

	function onBlogContentInput() {
		if (unfocusTimeout.current) {
			clearTimeout(unfocusTimeout.current)
		}

		setIsFocused(true)
		setCanUnfocus(false)
		unfocusTimeout.current = setTimeout(() => {
			setCanUnfocus(true)
		}, 500)
	}

	function onChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
		setPostContent(event.currentTarget.value)
	}

	return (
		<AutoResizingTextArea
			ref={ref}
			stickToBottom
			className="font-mono bg-transparent w-full mt-16 pb-24 focus:outline-none"
			placeholder="Content goes here..."
			name="postContent"
			onInput={onBlogContentInput}
			value={postContent}
			onChange={onChange}
		/>
	)
})

export { MainEditor }
export type { MainEditorRef }
