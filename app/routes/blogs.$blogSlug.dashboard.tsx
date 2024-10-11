import type { LoaderFunctionArgs } from "@remix-run/node"
import { useParams } from "@remix-run/react"
import { authenticate } from "~/auth"
import { Anchor } from "~/components/anchor"
import { getSession } from "~/sessions"

type RouteParams = "blogSlug"

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	await authenticate(request, session)
	return null
}

export default function BlogDashboard() {
	const params = useParams<RouteParams>()

	return (
		<main className="w-full max-w-prose mt-20">
			<h2 className="text-2xl opacity-80 mb-4">{params.blogSlug}</h2>
			<ul className="space-y-2">
				<li>
					<Anchor href={`/blogs/${params.blogSlug}/home`}>home page</Anchor>
				</li>
				<li>
					<Anchor href={`/blogs/${params.blogSlug}/posts`}>posts</Anchor>
				</li>
				<li>
					<Anchor>about page</Anchor>
				</li>
				<li>
					<Anchor>add new page</Anchor>
				</li>
			</ul>
		</main>
	)
}
