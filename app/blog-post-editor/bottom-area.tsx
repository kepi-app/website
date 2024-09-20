import clsx from "clsx"
import { ActionButtons } from "./action-buttons"
import { ProgressiveBlurBackground } from "./progressive-blur-background"
import { useEditorStore } from "./store"
import { UploadPreviews } from "./upload-previews"

function BottomArea() {
	const isFocused = useEditorStore((state) => state.isFocused)

	return (
		<div
			className={clsx(
				"fixed z-10 px-16 bottom-0 left-0 right-0 w-full flex flex-col items-center",
				{
					"opacity-0": isFocused,
				},
			)}
		>
			<ProgressiveBlurBackground />

			<div className="z-10 flex flex-col items-start w-full lg:max-w-prose">
				<UploadPreviews />
				<ActionButtons />
			</div>
		</div>
	)
}

export { BottomArea }
