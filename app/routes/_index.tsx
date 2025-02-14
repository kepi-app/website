import { Logo } from "app/components/logo"
import type { MetaFunction } from "react-router"

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
				<h1 className="text-6xl mt-16">
					Kepi
					<span className="mx-2 text-sm align-baseline dark:text-zinc-400">
						/kɛpiː/
					</span>
				</h1>
				<h2 className="text-2xl mt-4 dark:text-zinc-400">
					effortless note-taking.
				</h2>
				<p className="mt-20 text-xl">
					Kepi is a self-hostable, local-first notebook app. here, only your
					thoughts matter, and nothing else.
				</p>
				<br />
				<p className="mb-20 text-xl">
					Write down your thoughts. share them. or just keep it to yourself. let
					kepi handle the rest.
				</p>
				<div className="flex flex-row space-x-4">
					<a href="/notebooks/new" className="font-bold underline">
						Create notebook
					</a>
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
