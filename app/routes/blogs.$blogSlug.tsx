import { Outlet, useParams } from "@remix-run/react"
import { Anchor } from "~/components/anchor"

export default function BlogLayout() {
	const params = useParams()

	return (
		<div className="w-full flex justify-center">
			<div className="w-full max-w-prose mt-20">
				<h1 className="text-2xl opacity-80 mb-4">
					<a className="hover:underline" href={`/blogs/${params.blogSlug}`}>
						{params.blogSlug}
					</a>
				</h1>
				<nav className="flex flex-row space-x-4 mb-8 opacity-80">
					<Anchor href={`/blogs/${params.blogSlug}`}>home</Anchor>
					<Anchor href={`/blogs/${params.blogSlug}/posts`}>posts</Anchor>
					<Anchor>about</Anchor>
				</nav>
				<Outlet />
			</div>
		</div>
	)
}
