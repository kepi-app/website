import { PaperClipIcon, PhotoIcon } from "@heroicons/react/24/outline"
import {
	useRef,
	type ChangeEvent,
	type DetailedHTMLProps,
	type HTMLAttributes,
} from "react"
import { useEditorStore } from "./store"
import clsx from "clsx"

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
		<div className="w-full lg:max-w-prose h-10 my-4 flex justify-between items-center space-x-1 rounded-full">
			<BackPlate>
				<div className="h-full bg-white shadow-lg bg-opacity-40 dark:bg-opacity-30 flex flex-row rounded-full p-0.5">
					<input
						ref={imageFileInputRef}
						type="file"
						multiple
						className="hidden"
						onChange={onImageChange}
						accept="image/apng,image/avif,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
					/>
					<ActionIconButton Icon={PhotoIcon} onClick={openImagePicker} />
					<ActionIconButton Icon={PaperClipIcon} />
				</div>
			</BackPlate>

			<BackPlate>
				<div className="flex h-full space-x-1">
					<PreviewButton />
					<ActionButton
						style={{
							borderTopRightRadius: "100px",
							borderBottomRightRadius: "100px",
							borderTopLeftRadius: "25px",
							borderBottomLeftRadius: "25px",
						}}
					>
						Publish
					</ActionButton>
				</div>
			</BackPlate>
		</div>
	)
}

function BackPlate({ children }: React.PropsWithChildren) {
	return (
		<div className="h-10 rounded-full p-1 shadow-[inset_0_0_4px_rgba(0,0,0,24%)] dark:shadow-[inset_0_0_4px_rgba(255,255,255,50%)]">
			{children}
		</div>
	)
}

function ActionButton({
	className,
	...props
}: DetailedHTMLProps<HTMLAttributes<HTMLButtonElement>, HTMLButtonElement>) {
	const btnRef = useRef<HTMLButtonElement | null>(null)

	function showHoverHighlight(
		event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
	) {
		if (!btnRef.current) {
			return
		}
		const rect = event.currentTarget.getBoundingClientRect()
		const x = event.clientX - rect.left
		const y = event.clientY - rect.top
		btnRef.current.style.backgroundImage = `radial-gradient(circle at ${x}px ${y}px, rgba(255, 255, 255, 8%), transparent)`
	}

	return (
		<button
			ref={btnRef}
			className={clsx(
				"h-full rounded-r-full border-t border-t-white text-sm bg-neutral-100 bg-opacity-70 backdrop-blur-lg px-4 shadow-lg flex items-center justify-center hover:bg-[radial-gradient(circle_at_center,rgba(255,255,255,15%),transparent)] dark:bg-neutral-100 dark:bg-opacity-30 dark:border-opacity-20 transition-[background-image]",
				className,
			)}
			onMouseLeave={() => {
				if (btnRef.current) {
					btnRef.current.style.backgroundImage = ""
				}
			}}
			onMouseMove={showHoverHighlight}
			{...props}
		/>
	)
}

function ActionIconButton({
	Icon,
	className,
	...props
}: DetailedHTMLProps<HTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & {
	Icon: React.ForwardRefExoticComponent<
		Omit<React.SVGProps<SVGSVGElement>, "ref"> & {
			title?: string | undefined
			titleId?: string | undefined
		} & React.RefAttributes<SVGSVGElement>
	>
}) {
	return (
		<button
			type="button"
			className={clsx(
				"h-full w-10 transition-all rounded-full border-t border-t-transparent flex items-center justify-center hover:bg-white hover:bg-opacity-50 hover:border-t hover:border-t-white hover:shadow dark:hover:text-zinc-900",
				className,
			)}
			{...props}
		>
			<Icon className="h-5 w-5" />
		</button>
	)
}

function PreviewButton() {
	const isPreviewing = useEditorStore((state) => state.isPreviewing)
	const togglePreview = useEditorStore((state) => state.togglePreview)
	return (
		<ActionButton
			style={{
				borderTopLeftRadius: "100px",
				borderBottomLeftRadius: "100px",
				borderTopRightRadius: "25px",
				borderBottomRightRadius: "25px",
			}}
			onClick={togglePreview}
		>
			{isPreviewing ? "Edit" : "Preview"}
		</ActionButton>
	)
}

export { ActionButtons }
