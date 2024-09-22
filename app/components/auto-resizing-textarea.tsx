import { forwardRef, useImperativeHandle } from "react"
import clsx from "clsx"
import { useEffect, useRef, useState, type TextareaHTMLAttributes } from "react"
import { useScrollInfo } from "~/scroll-context"

interface AutoResizingTextAreaProps
	extends React.DetailedHTMLProps<
		TextareaHTMLAttributes<HTMLTextAreaElement>,
		HTMLTextAreaElement
	> {
	stickToBottom?: boolean
}

const AutoResizingTextArea = forwardRef(
	({ stickToBottom = false, ...props }: AutoResizingTextAreaProps, ref) => {
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
		const [shouldHide, setShouldHide] = useState(true)
		const scrollInfo = useScrollInfo()

		useImperativeHandle(ref, () => textAreaRef.current)

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

			if (scrollInfo.isAtBottom && stickToBottom) {
				document.documentElement.scrollTo(
					scrollInfo.left,
					textAreaRef.current.scrollHeight,
				)
			} else if (!scrollInfo.isAtBottom) {
				document.documentElement.scrollTo(scrollInfo.left, scrollInfo.top)
			}
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
	},
)

export { AutoResizingTextArea }
