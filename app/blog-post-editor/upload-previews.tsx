import { usePostEditorStore } from "./store"

const MAX_PREVIEW_COUNT = 4

function UploadPreviews() {
	const pendingFiles = usePostEditorStore((state) => state.pendingFiles)

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

export { UploadPreviews }
