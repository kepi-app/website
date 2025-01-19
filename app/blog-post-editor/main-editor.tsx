import { useParams } from "react-router"
import clsx from "clsx"
import { ArrowLeft } from "lucide-react"
import { forwardRef, useEffect, useRef } from "react"
import { Anchor } from "~/components/anchor"
import { AutoResizingTextArea } from "~/components/auto-resizing-textarea"
import {
	MarkdownEditor,
	type MarkdownEditorRef,
} from "~/components/markdown-editor/markdown-editor"
import { usePostEditorStore } from "./store"

const MainEditor = forwardRef<MarkdownEditorRef>((_, ref) => {
	const isFocused = usePostEditorStore((state) => state.isFocused)
	const setIsFocused = usePostEditorStore((state) => state.setIsFocused)
	const setCanUnfocus = usePostEditorStore((state) => state.setCanUnfocus)
	const unfocusTimeout = useRef<ReturnType<typeof setTimeout>>()
	const params = useParams()

	useEffect(() => {
		return () => {
			if (unfocusTimeout.current) {
				clearTimeout(unfocusTimeout.current)
			}
		}
	}, [])

	function onEditorChange() {
		if (unfocusTimeout.current) {
			clearTimeout(unfocusTimeout.current)
		}

		setIsFocused(true)
		setCanUnfocus(false)
		unfocusTimeout.current = setTimeout(() => {
			setCanUnfocus(true)
		}, 500)
	}

	return (
		<>
			<div className={clsx("transition-all mb-8", { "opacity-0": isFocused })}>
				<Anchor to={`/blogs/${params.blogSlug}/posts`} className="opacity-80">
					<ArrowLeft className="inline align-sub" size={16} /> All posts
				</Anchor>

				<TitleInput />
				<DescriptionInput />
			</div>
			<MarkdownEditor ref={ref} onChange={onEditorChange} />
		</>
	)
})

function TitleInput() {
	const postTitle = usePostEditorStore((state) => state.title)
	const setPostTitle = usePostEditorStore((state) => state.setTitle)

	return (
		<AutoResizingTextArea
			name="postTitle"
			className="bg-transparent text-6xl mt-8 w-full focus:outline-none"
			placeholder="Blog title"
			value={postTitle}
			onChange={(event) => {
				setPostTitle(event.currentTarget.value)
			}}
		/>
	)
}

function DescriptionInput() {
	const postDescription = usePostEditorStore((state) => state.description)
	const setPostDescription = usePostEditorStore((state) => state.setDescription)
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

export { MainEditor }
