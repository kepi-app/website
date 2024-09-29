import clsx from "clsx"
import {
	useRef,
	type ButtonHTMLAttributes,
	type DetailedHTMLProps,
} from "react"

interface ButtonProps
	extends Omit<
		DetailedHTMLProps<
			ButtonHTMLAttributes<HTMLButtonElement>,
			HTMLButtonElement
		>,
		"className"
	> {
	containerClassName?: string
	buttonClassName?: string
}

function Button({
	containerClassName,
	buttonClassName,
	...props
}: ButtonProps) {
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
		<div
			className={clsx(
				"h-10 rounded-full p-1 shadow-[inset_0_0_4px_rgba(0,0,0,24%)] dark:shadow-[inset_0_0_4px_rgba(255,255,255,50%)]",
				containerClassName,
			)}
		>
			<button
				ref={btnRef}
				className={clsx(
					"h-full w-full rounded-full text-sm px-4 flex items-center justify-center border-t border-t-white bg-neutral-100 bg-opacity-70 backdrop-blur-lg shadow-lg  dark:bg-neutral-100 dark:bg-opacity-20 dark:border-opacity-20",
					{ "opacity-20": props.disabled },
					buttonClassName,
				)}
				onMouseLeave={() => {
					if (btnRef.current) {
						btnRef.current.style.backgroundImage = ""
					}
				}}
				onMouseMove={showHoverHighlight}
				{...props}
			/>
		</div>
	)
}

export { Button }
