import clsx from "clsx"
import { Link, type LinkProps } from "react-router"

function Anchor(props: LinkProps & React.RefAttributes<HTMLAnchorElement>) {
	return <Link {...props} className={clsx("underline", props.className)} />
}

export { Anchor }
