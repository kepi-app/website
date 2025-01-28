import { Link, Outlet, useMatches, useNavigate, useParams } from "react-router"
import { Anchor } from "~/components/anchor"
import { Logo } from "~/components/logo"
import { SmallButton } from "~/components/small-button"
import { KeyStoreProvider } from "~/keystore"

export default function BlogLayout() {
	const params = useParams()
	const navigate = useNavigate()
	const matches = useMatches()

	return (
		<KeyStoreProvider>
			<div className="w-full flex justify-center">
				<div className="w-full max-w-prose mt-12">
					<Anchor to="/blogs" prefetch="intent" aria-label="Dashboard">
						<div
							className="w-8 h-8 opacity-80 transition-all hover:-rotate-90 active:-translate-y-24"
							title="Dashboard"
						>
							<Logo title="Dashboard" />
						</div>
					</Anchor>
					<div className="flex flex-row justify-between items-center mb-4 mt-8">
						<h1 className="text-2xl opacity-80">
							<Link
								className="hover:underline"
								to={`/blogs/${params.blogSlug}`}
							>
								{params.blogSlug}
							</Link>
						</h1>
						{matches.find(
							// @ts-ignore
							(match) => match.handle?.hidePublishButton ?? false,
						) ? null : (
							<SmallButton
								className="h-min"
								onClick={() => {
									navigate(`/blogs/${params.blogSlug}/publish`)
								}}
							>
								Publish…
							</SmallButton>
						)}
					</div>
					<nav className="flex flex-row space-x-4 mb-8 opacity-80">
						<Anchor prefetch="render" to={`/blogs/${params.blogSlug}`}>
							home
						</Anchor>
						<Anchor prefetch="render" to={`/blogs/${params.blogSlug}/posts`}>
							posts
						</Anchor>
						<Anchor to="">about</Anchor>
					</nav>
					<Outlet />
				</div>
			</div>
		</KeyStoreProvider>
	)
}
