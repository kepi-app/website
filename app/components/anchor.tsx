import clsx from "clsx"
import type { AnchorHTMLAttributes, DetailedHTMLProps } from "react"

function Anchor(
	props: DetailedHTMLProps<
		AnchorHTMLAttributes<HTMLAnchorElement>,
		HTMLAnchorElement
	>,
) {
	return <a {...props} className={clsx("underline", props.className)} />
}

export { Anchor }
