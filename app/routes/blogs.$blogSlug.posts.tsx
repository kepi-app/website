import type { LoaderFunctionArgs } from "@remix-run/node"
import { json, redirect, useLoaderData, useParams } from "@remix-run/react"
import { authenticate } from "~/auth"
import type { BlogPost } from "~/blog/post"
import { Anchor } from "~/components/anchor"
import { ApiError } from "~/error"
import { fetchApi } from "~/fetch-api"
import { getSession } from "~/sessions"

type RouteParams = "blogSlug"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)

	const result = await fetchApi<BlogPost[]>(`/blogs/${params.blogSlug}/posts`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	})
	if (result.isErr()) {
		switch (result.error) {
			case ApiError.Unauthorized:
				throw redirect("/login")
			default:
				// TODO: create internal error page
				throw redirect("/internal")
		}
	}

	console.log(result)

	return json<BlogPost[]>(result.value)
}

export default function BlogPostDashboard() {
	const params = useParams<RouteParams>()
	const posts = useLoaderData<typeof loader>()

	return (
		<div className="w-full flex justify-center">
			<main className="w-full lg:max-w-prose mt-20">
				<h2 className="text-lg opacity-80">{params.blogSlug}</h2>
				<h1 className="text-4xl my-8">your posts</h1>
				{posts.length > 0 ? (
					<ul className="space-y-2">
						{posts.map((post) => {
							const date = new Date(post.publishDate)
							const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
							return (
								<li key={post.slug} className="flex flex-row justify-between">
									<Anchor href={`/blogs/${params.blogSlug}/posts/${post.slug}`}>
										{post.title}
									</Anchor>
									<time>{formattedDate}</time>
								</li>
							)
						})}
					</ul>
				) : (
					<p className="mb-4 opacity-80">No post yet.</p>
				)}
				<Anchor href={`/blogs/${params.blogSlug}/posts/new`}>
					Add new post
				</Anchor>
			</main>
		</div>
	)
}
