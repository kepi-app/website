import clsx from "clsx"
import { Link, type LinkProps } from "react-router"

function Anchor(props: LinkProps & React.RefAttributes<HTMLAnchorElement>) {
	return <Link {...props} className={clsx(props.className, "underline")} />
}

export { Anchor }
