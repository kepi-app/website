import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "@remix-run/react"
import { useEffect, useRef } from "react"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

import "./tailwind.css"
import { ScrollInfoContext, type ScrollInfo } from "./scroll-context"

dayjs.extend(relativeTime)

export function Layout({ children }: { children: React.ReactNode }) {
	const scrollInfo = useRef<ScrollInfo>({ left: 0, top: 0, isAtBottom: false })

	useEffect(() => {
		scrollInfo.current.left = document.documentElement.scrollLeft
		scrollInfo.current.top = document.documentElement.scrollTop
		scrollInfo.current.isAtBottom =
			document.documentElement.scrollHeight -
				document.documentElement.scrollTop -
				document.documentElement.clientHeight <
			1
	}, [])

	useEffect(() => {
		function setScrollInfo() {
			scrollInfo.current.left = document.documentElement.scrollLeft
			scrollInfo.current.top = document.documentElement.scrollTop
			scrollInfo.current.isAtBottom =
				document.documentElement.scrollHeight -
					document.documentElement.scrollTop -
					document.documentElement.clientHeight <
				1
		}
		document.addEventListener("scroll", setScrollInfo)
		return () => {
			document.removeEventListener("scroll", setScrollInfo)
		}
	}, [])

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />

				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin=""
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap"
					rel="stylesheet"
				/>

				<Meta />
				<Links />
			</head>
			<body>
				<ScrollInfoContext.Provider value={scrollInfo.current}>
					{children}
				</ScrollInfoContext.Provider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export default function App() {
	return <Outlet />
}
