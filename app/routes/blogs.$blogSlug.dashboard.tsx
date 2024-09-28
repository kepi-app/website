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
			<h2 className="text-lg opacity-80">{params.blogSlug}</h2>
			<h1 className="text-4xl mb-4 mt-8">edit</h1>
			<ul className="space-y-2">
				<li>
					<Anchor>home page</Anchor>
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
