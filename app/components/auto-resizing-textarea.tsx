import clsx from "clsx"
import {
	useEffect,
	useRef,
	type FormEvent,
	type TextareaHTMLAttributes,
} from "react"

function AutoResizingTextArea(
	props: React.DetailedHTMLProps<
		TextareaHTMLAttributes<HTMLTextAreaElement>,
		HTMLTextAreaElement
	>,
) {
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		resizeTextArea()
	}, [props.value])

	useEffect(() => {
		resizeTextArea()
	}, [])

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
			className={clsx(props.className, "resize-none")}
			ref={textAreaRef}
			onInput={(event) => {
				resizeTextArea()
				props.onInput?.(event)
			}}
		/>
	)
}

export { AutoResizingTextArea }
