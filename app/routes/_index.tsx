import type { MetaFunction } from "react-router"
import { Logo } from "app/components/logo"

export const meta: MetaFunction = () => {
	return [
		{ title: "New Remix App" },
		{ name: "description", content: "Welcome to Remix!" },
	]
}

export default function Index() {
	return (
		<div className="w-full flex justify-center">
			<main className="w-full my-20 max-w-prose">
				<div className="w-16 h-16 text-zinc-200">
					<Logo />
				</div>
				<h1 className="text-6xl mt-20">
					kepi
					<span className="mx-2 text-sm align-baseline dark:text-zinc-400">
						/kɛpiː/
					</span>
				</h1>
				<h2 className="text-2xl mt-4 dark:text-zinc-400">
					effortless blogging.
				</h2>
				<p className="mt-20 text-xl">
					kepi is an open-source, self-hostable blogging platform. here, only
					your thoughts matter, and nothing else.
				</p>
				<br />
				<p className="mb-20 text-xl">
					write down your thoughts. share them. or just keep it to yourself. let
					kepi handle the rest.
				</p>
				<div className="flex flex-row space-x-4">
					<a href="/login" className="font-bold underline">
						Login
					</a>
					<a href="/sign-up" className="font-bold underline">
						Sign up
					</a>
				</div>
			</main>
		</div>
	)
}
