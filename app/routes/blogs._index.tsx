import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { authenticate } from "~/auth"
import type { Blog } from "~/blog/blog"
import { Anchor } from "~/components/anchor"
import { ApiError } from "~/error"
import { fetchApi } from "~/fetch-api"
import { getSession } from "~/sessions"

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)
	const result = await fetchApi<Blog[]>("/blogs", {
		headers: { Authorization: `Bearer ${accessToken}` },
	})
	if (result.isErr()) {
		return json({ error: ApiError.Internal }, { status: 500 })
	}

	const blogs = result.value

	if (blogs.length <= 0) {
		return redirect("/blogs/new")
	}

	return json(result.value)
}

export default function AllBlogsPage() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="w-full flex justify-center">
			<main className="w-full max-w-prose mt-20">
				<h1 className="text-4xl mb-4">your blogs</h1>
				{"error" in data ? (
					<p>We are having trouble loading your blogs.</p>
				) : (
					<ul>
						{data.map((blog) => (
							<li key={blog.slug}>
								<Anchor href={`/blogs/${blog.slug}`}>
									{blog.name}
								</Anchor>
							</li>
						))}
					</ul>
				)}
			</main>
		</div>
	)
}
