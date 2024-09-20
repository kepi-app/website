import { PhotoIcon } from "@heroicons/react/24/outline"
import { useRef, type ChangeEvent } from "react"
import { Button } from "~/components/button"
import { useEditorStore } from "./store"
import { useStore } from "zustand"

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
			<PreviewButton />
			<Button className="px-3 py-1">Publish</Button>
		</div>
	)
}

function PreviewButton() {
	const isPreviewing = useEditorStore((state) => state.isPreviewing)
	const togglePreview = useEditorStore((state) => state.togglePreview)
	return (
		<Button className="px-3 py-1" onClick={togglePreview}>
			{isPreviewing ? "Edit" : "Preview"}
		</Button>
	)
}

export { ActionButtons }
