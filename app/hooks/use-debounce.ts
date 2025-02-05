import { useCallback, useEffect, useRef } from "react"

type Callback<T> = T extends (...args: infer Args) => void
	? (...args: Args) => void
	: never

function useDebounce<T extends CallableFunction>(
	fn: T,
	delay: number,
): (...args: Parameters<Callback<T>>) => void {
	const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(
		() => () => {
			if (timeout.current) {
				clearTimeout(timeout.current)
			}
		},
		[],
	)

	return useCallback(
		(...args: Parameters<Callback<T>>) => {
			if (timeout.current) {
				clearTimeout(timeout.current)
			}
			timeout.current = setTimeout(() => {
				fn(...args)
			}, delay)
		},
		[fn, delay],
	)
}

export { useDebounce }
