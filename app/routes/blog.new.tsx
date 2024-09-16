import { Form } from "@remix-run/react"
import clsx from "clsx"
import { useEffect, useRef, useState } from "react"
import { AutoResizingTextArea } from "~/components/auto-resizing-textarea"
import { Button } from "~/components/button"

export default function NewBlogPage() {
	const [isFocused, setIsFocused] = useState(false)
	const unfocusTimer = useRef<ReturnType<typeof setTimeout>>()
	const canUnfocus = useRef(false)

	useEffect(function unfocusOnMouseMove() {
		function unfocus() {
			if (canUnfocus.current) {
				setIsFocused(false)
			}
		}
		document.addEventListener("mousemove", unfocus)
		return () => {
			document.removeEventListener("mousemove", unfocus)
		}
	}, [])

	function onBlogContentInput() {
		if (unfocusTimer.current) {
			clearTimeout(unfocusTimer.current)
		}
		setIsFocused(true)
		canUnfocus.current = false
		unfocusTimer.current = setTimeout(() => {
			canUnfocus.current = true
		}, 500)
	}

	return (
		<div className="w-full flex justify-center">
			<main className="w-full mt-40 lg:max-w-prose">
				<Form method="POST">
					<div className={clsx("transition-all", { "opacity-0": isFocused })}>
						<AutoResizingTextArea
							name="blogTitle"
							className="bg-transparent text-6xl w-full focus:outline-none"
							placeholder="Blog title"
						/>
						<AutoResizingTextArea
							name="blogDescription"
							className="bg-transparent opacity-50 text-xl w-full focus:outline-none transition-all"
							placeholder="Blog description"
						/>
					</div>

					<AutoResizingTextArea
						className="font-mono bg-transparent w-full mt-16 focus:outline-none"
						placeholder="Content goes here..."
						name="blogContent"
						onInput={onBlogContentInput}
					/>

					<div
						className={clsx(
							"absolute bottom-0 left-0 right-0 border-t border-t-zinc-300 dark:border-t-zinc-800 w-full flex items-center justify-center",
							{ "opacity-0": isFocused },
						)}
					>
						<div className="w-full lg:max-w-prose flex justify-end py-2 space-x-4">
							<Button className="px-3 py-1">Save as draft</Button>
							<Button className="px-3 py-1">Publish</Button>
						</div>
					</div>
				</Form>
			</main>
		</div>
	)
}
