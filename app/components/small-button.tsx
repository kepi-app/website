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
				"text-sm rounded bg-zinc-300 dark:bg-zinc-700 dark:border dark:border-zinc-600 py-0.5 px-2",
				className,
			)}
			{...props}
		/>
	)
}

export { SmallButton }
