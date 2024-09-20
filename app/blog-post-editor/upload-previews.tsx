import { useEditorStore } from "./store"

function UploadPreviews() {
	const pendingFiles = useEditorStore((state) => state.pendingFiles)

	return (
		<div className="w-full pt-4 flex justify-center">
			<div className="w-full h-10 lg:max-w-prose flex space-x-2">
				{pendingFiles.map((file) => (
					<div
						key={file.name}
						className="h-10 w-10 rounded shadow bg-zinc-300 dark:bg-zinc-600 border border-zinc-400 dark:border-zinc-500 flex items-center justify-center p-0.5"
					>
						<img src={URL.createObjectURL(file)} />
					</div>
				))}
			</div>
		</div>
	)
}

export { UploadPreviews }
