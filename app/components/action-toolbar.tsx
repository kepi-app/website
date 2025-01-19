import type React from "react"
import type { DetailedHTMLProps, HTMLAttributes } from "react"
import clsx from "clsx"

function ActionToolbar({ children }: React.PropsWithChildren) {
	return (
		<div className="w-full max-w-prose h-10 my-4 flex justify-center items-center space-x-1 rounded-full">
			<div className="h-10 rounded-full p-1 shadow-[inset_0_0_4px_rgba(0,0,0,24%)] dark:shadow-[inset_0_0_4px_rgba(255,255,255,50%)]">
				<div className="h-full bg-white shadow-lg bg-opacity-40 dark:bg-opacity-30 flex flex-row rounded-full p-0.5">
					{children}
				</div>
			</div>
		</div>
	)
}

function ActionToolbarIconButton({
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

export { ActionToolbar, ActionToolbarIconButton }
