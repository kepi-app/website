import { Outlet, Link, useMatches, useNavigate, useParams } from "react-router"
import { Anchor } from "~/components/anchor"
import { SmallButton } from "~/components/small-button"

export default function BlogLayout() {
	const params = useParams()
	const navigate = useNavigate()
	const matches = useMatches()

	return (
		<div className="w-full flex justify-center">
			<div className="w-full max-w-prose mt-20">
				<div className="flex flex-row justify-between items-center mb-4">
					<h1 className="text-2xl opacity-80">
						<Link
							className="hover:underline"
							href={`/blogs/${params.blogSlug}`}
						>
							{params.blogSlug}
						</Link>
					</h1>
					{matches.find(
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
					<Anchor to={`/blogs/${params.blogSlug}`}>home</Anchor>
					<Anchor to={`/blogs/${params.blogSlug}/posts`}>posts</Anchor>
					<Anchor>about</Anchor>
				</nav>
				<Outlet />
			</div>
		</div>
	)
}
