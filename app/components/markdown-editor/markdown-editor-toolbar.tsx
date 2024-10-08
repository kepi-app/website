import clsx from "clsx"
import { useRef, type ChangeEvent } from "react"
import { MarkdownEditorStatus, useMarkdownEditorStore } from "./store"
import { ProgressiveBlurBackground } from "../progressive-blur-background"
import { ActionToolbar, ActionToolbarIconButton } from "../action-toolbar"
import { EyeIcon, EyeSlashIcon, PhotoIcon } from "@heroicons/react/24/outline"

interface MarkdownEditorToolbarProps {
	containerClassName?: string
}

function MarkdownEditorToolbar({
	containerClassName,
	children,
}: React.PropsWithChildren<MarkdownEditorToolbarProps>) {
	return (
		<div
			className={clsx("w-full flex flex-col items-center", containerClassName)}
		>
			<ProgressiveBlurBackground />
			<div className="z-10 flex flex-col items-center w-full lg:max-w-prose">
				<UploadPreviews />
				<ActionToolbar>{children}</ActionToolbar>
			</div>
		</div>
	)
}

function AttachImageButton() {
	const addPendingFiles = useMarkdownEditorStore(
		(state) => state.addPendingFiles,
	)
	const imageFileInputRef = useRef<HTMLInputElement | null>(null)

	function openImagePicker() {
		imageFileInputRef.current?.click()
	}

	function onImageChange(event: ChangeEvent<HTMLInputElement>) {
		console.log(event.currentTarget.files)
		if (event.currentTarget.files) {
			addPendingFiles(event.currentTarget.files)
		}
	}

	return (
		<>
			<input
				ref={imageFileInputRef}
				type="file"
				multiple
				className="hidden"
				onChange={onImageChange}
				accept="image/apng,image/avif,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
			/>
			<ActionToolbarIconButton
				Icon={PhotoIcon}
				onClick={openImagePicker}
				aria-label="Insert image"
			/>
		</>
	)
}

function PreviewButton() {
	const isPreviewing = useMarkdownEditorStore(
		(state) => state.status === MarkdownEditorStatus.Previewing,
	)
	const togglePreview = useMarkdownEditorStore((state) => state.togglePreview)
	return (
		<ActionToolbarIconButton
			Icon={isPreviewing ? EyeSlashIcon : EyeIcon}
			onClick={togglePreview}
			aria-label={isPreviewing ? "Hide preview" : "Show preview"}
		>
			{isPreviewing ? "Edit" : "Preview"}
		</ActionToolbarIconButton>
	)
}

MarkdownEditorToolbar.AttachImageButton = AttachImageButton
MarkdownEditorToolbar.PreviewButton = PreviewButton

const MAX_PREVIEW_COUNT = 4

function UploadPreviews() {
	const pendingFiles = useMarkdownEditorStore((state) => state.pendingFiles)

	return (
		<div className="w-full pt-4 flex justify-center">
			<div className="w-full h-10 lg:max-w-prose flex space-x-2">
				{pendingFiles.slice(0, MAX_PREVIEW_COUNT).map((file) => (
					<div
						key={file.name}
						className="h-10 w-10 rounded shadow bg-zinc-300 dark:bg-zinc-600 border border-zinc-400 dark:border-zinc-500 flex items-center justify-center p-0.5"
					>
						<img
							className="object-cover w-full h-full"
							alt={`Preview of ${file.name}`}
							src={URL.createObjectURL(file)}
						/>
					</div>
				))}
				{pendingFiles.length > MAX_PREVIEW_COUNT ? (
					<div className="h-10 w-10 rounded shadow bg-zinc-300 dark:bg-zinc-600 border border-zinc-400 dark:border-zinc-500 flex items-center justify-center p-0.5">
						<p>+{pendingFiles.length - MAX_PREVIEW_COUNT}</p>
					</div>
				) : null}
			</div>
		</div>
	)
}

export { MarkdownEditorToolbar }
export type { MarkdownEditorToolbarProps }
