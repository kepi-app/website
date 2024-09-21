import clsx from "clsx"
import { useEffect, useRef, useState, type TextareaHTMLAttributes } from "react"

function AutoResizingTextArea(
	props: React.DetailedHTMLProps<
		TextareaHTMLAttributes<HTMLTextAreaElement>,
		HTMLTextAreaElement
	>,
) {
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
	const [shouldHide, setShouldHide] = useState(true)

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		resizeTextArea()
		if (shouldHide) {
			setShouldHide(false)
		}
	}, [shouldHide, props.value])

	function resizeTextArea() {
		if (!textAreaRef.current) {
			return
		}
		textAreaRef.current.style.height = "0px"
		textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`
	}

	return (
		<textarea
			{...props}
			className={clsx(props.className, "resize-none", {
				"opacity-0": shouldHide,
			})}
			ref={textAreaRef}
			onInput={(event) => {
				resizeTextArea()
				props.onInput?.(event)
			}}
		/>
	)
}

export { AutoResizingTextArea }
