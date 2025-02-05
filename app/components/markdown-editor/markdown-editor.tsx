import {
	type ForwardRefExoticComponent,
	type MemoExoticComponent,
	type RefAttributes,
	forwardRef,
	memo,
	useImperativeHandle,
	useRef,
} from "react"
import { AutoResizingTextArea } from "../auto-resizing-textarea"
import { MarkdownEditorToolbar } from "./markdown-editor-toolbar"
import { MarkdownPreview } from "./markdown-preview"
import { MarkdownEditorStatus, useMarkdownEditorStore } from "./store"

interface MarkdownEditorProps {
	onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
	fileLoader: (src: string) => Promise<Blob | null>
}

interface MarkdownEditorRef {
	selectionEnd: number
}

type TMarkdownEditor = MemoExoticComponent<
	ForwardRefExoticComponent<
		MarkdownEditorProps & RefAttributes<MarkdownEditorRef>
	>
> & {
	Toolbar: typeof MarkdownEditorToolbar
}

const MarkdownEditor = memo(
	forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
		({ onChange, fileLoader }, ref) => {
			const status = useMarkdownEditorStore((state) => state.status)
			const contentInputRef = useRef<HTMLTextAreaElement | null>(null)

			useImperativeHandle(ref, () => ({
				get selectionEnd() {
					return contentInputRef?.current?.selectionEnd ?? 0
				},
			}))

			switch (status) {
				case MarkdownEditorStatus.Decrypting:
					return <p className="animate-pulse">Decrypting content…</p>

				case MarkdownEditorStatus.Previewing:
					return <MarkdownPreview fileLoader={fileLoader} />

				case MarkdownEditorStatus.DecryptionError:
					return (
						<p className="text-rose-500 dark:text-rose-200">
							Failed to decrypt content! Please try refreshing the page.
						</p>
					)

				case MarkdownEditorStatus.Editing:
					return <ContentInput ref={contentInputRef} onChange={onChange} />
			}
		},
	),
) as TMarkdownEditor

const ContentInput = forwardRef<
	HTMLTextAreaElement,
	{
		onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
	}
>((props, ref) => {
	const content = useMarkdownEditorStore((state) => state.content)
	const setContent = useMarkdownEditorStore((state) => state.setContent)

	function onChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
		setContent(event.currentTarget.value)
		if (props.onChange) {
			props.onChange(event)
		}
	}

	return (
		<AutoResizingTextArea
			ref={ref}
			stickToBottom
			className="font-mono bg-transparent w-full pb-24 focus:outline-none"
			placeholder="Content goes here..."
			name="postContent"
			value={content}
			onChange={onChange}
		/>
	)
})

MarkdownEditor.Toolbar = MarkdownEditorToolbar

export { MarkdownEditor }
export type { MarkdownEditorProps, MarkdownEditorRef }
export * from "./store"
