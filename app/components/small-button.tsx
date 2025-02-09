import clsx from "clsx"
import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react"

function SmallButton({
	className,
	...props
}: DetailedHTMLProps<
	ButtonHTMLAttributes<HTMLButtonElement>,
	HTMLButtonElement
>) {
	return (
		<button
			className={clsx(
				"text-sm rounded bg-zinc-300 border border-zinc-400 dark:bg-zinc-700 dark:border dark:border-zinc-600 px-2",
				{ "opacity-20": props.disabled },
				className,
			)}
			{...props}
		/>
	)
}

export { SmallButton }
