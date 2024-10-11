import clsx from "clsx"
import { forwardRef, useEffect, useRef } from "react"
import { AutoResizingTextArea } from "~/components/auto-resizing-textarea"
import { usePostEditorStore } from "./store"
import {
	MarkdownEditor,
	type MarkdownEditorRef,
} from "~/components/markdown-editor/markdown-editor"

interface MainEditorRef {
	contentInput: HTMLTextAreaElement | null
}

const MainEditor = forwardRef<MarkdownEditorRef>((_, ref) => {
	const isFocused = usePostEditorStore((state) => state.isFocused)
	const setIsFocused = usePostEditorStore((state) => state.setIsFocused)
	const setCanUnfocus = usePostEditorStore((state) => state.setCanUnfocus)
	const unfocusTimeout = useRef<ReturnType<typeof setTimeout>>()

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
export type { MainEditorRef }
