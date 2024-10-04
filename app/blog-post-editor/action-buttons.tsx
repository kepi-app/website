import {
	EyeIcon,
	EyeSlashIcon,
	PaperClipIcon,
	PhotoIcon,
} from "@heroicons/react/24/outline"
import { useRef, type ChangeEvent } from "react"
import { useEditorStore } from "./store"
import {
	ActionToolbar,
	ActionToolbarIconButton,
} from "~/components/action-toolbar"

function ActionButtons() {
	const addPendingFiles = useEditorStore((state) => state.addPendingFiles)
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
		<ActionToolbar>
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
			<ActionToolbarIconButton Icon={PaperClipIcon} aria-label="Insert file" />
			<PreviewButton />
		</ActionToolbar>
	)
}

function PreviewButton() {
	const isPreviewing = useEditorStore((state) => state.isPreviewing)
	const togglePreview = useEditorStore((state) => state.togglePreview)
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

export { ActionButtons }
