import clsx from "clsx"
import { forwardRef, memo, useCallback, useEffect, useRef } from "react"
import { AutoResizingTextArea } from "~/components/auto-resizing-textarea"
import {
	MarkdownEditor,
	type MarkdownEditorRef,
} from "~/components/markdown-editor/markdown-editor"
import {
	useNoteEditorStore,
	useNoteEditorStoreContext,
} from "~/notebook/note-store"
import { useNotebookStore } from "~/notebook/notebook-store"

const TitleInputContainer = memo(() => {
	const isFocused = useNoteEditorStore((state) => state.isFocused)
	return (
		<div className={clsx("transition-all mb-8", { "opacity-0": isFocused })}>
			<TitleInput />
		</div>
	)
})

const NoteEditor = forwardRef<MarkdownEditorRef>((_, ref) => {
	const noteEditorStore = useNoteEditorStoreContext()
	const setIsFocused = useNoteEditorStore((state) => state.setIsFocused)
	const setCanUnfocus = useNoteEditorStore((state) => state.setCanUnfocus)
	const loadFile = useNotebookStore((state) => state.loadFile)
	const unfocusTimeout = useRef<ReturnType<typeof setTimeout>>()

	useEffect(() => {
		return () => {
			if (unfocusTimeout.current) {
				clearTimeout(unfocusTimeout.current)
			}
		}
	}, [])

	useEffect(
		function unfocusOnMouseMove() {
			function unfocus() {
				if (noteEditorStore.getState().canUnfocus) {
					setIsFocused(false)
				}
			}
			document.addEventListener("mousemove", unfocus)
			return () => {
				document.removeEventListener("mousemove", unfocus)
			}
		},
		[setIsFocused, noteEditorStore.getState],
	)

	const onEditorChange = useCallback(() => {
		if (unfocusTimeout.current) {
			clearTimeout(unfocusTimeout.current)
		}

		setIsFocused(true)
		setCanUnfocus(false)
		unfocusTimeout.current = setTimeout(() => {
			setCanUnfocus(true)
		}, 500)
	}, [setCanUnfocus, setIsFocused])

	const fileLoader = useCallback(
		async (src: string): Promise<Blob | null> => {
			const components = src.split("/")
			if (
				components.length !== 3 ||
				components[0] !== "." ||
				components[1] !== "files"
			) {
				return null
			}
			return await loadFile(components[2])
		},
		[loadFile],
	)

	return (
		<>
			<TitleInputContainer />
			<MarkdownEditor
				ref={ref}
				onChange={onEditorChange}
				fileLoader={fileLoader}
			/>
		</>
	)
})

function TitleInput() {
	const postTitle = useNoteEditorStore((state) => state.title)
	const setPostTitle = useNoteEditorStore((state) => state.setTitle)
	return (
		<AutoResizingTextArea
			className="bg-transparent text-6xl mt-8 w-full focus:outline-none"
			placeholder="Untitled Note"
			value={postTitle}
			onChange={(event) => {
				setPostTitle(event.currentTarget.value)
			}}
		/>
	)
}

export { NoteEditor }
