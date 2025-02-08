import { type MutableRefObject, useEffect } from "react"

function useClickOutsideDetector(
	ref: MutableRefObject<Node | null>,
	callback: () => void,
) {
	useEffect(() => {
		if (ref.current) {
			function onDismiss(event: MouseEvent) {
				console.log("dismiss")
				if (
					event.target instanceof Element &&
					ref.current &&
					!ref.current.contains(event.target)
				) {
					callback()
				}
			}
			document.addEventListener("mousedown", onDismiss)
			return () => {
				document.removeEventListener("mousedown", onDismiss)
			}
		}
	}, [callback, ref])
}

export { useClickOutsideDetector }
