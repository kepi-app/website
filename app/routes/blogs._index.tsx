import { type LoaderFunctionArgs, data, redirect } from "react-router"
import { useLoaderData } from "react-router"
import { authenticate, redirectToLoginPage } from "~/auth"
import type { Blog } from "~/blog/blog"
import { Anchor } from "~/components/anchor"
import { ApiError } from "~/error"
import { fetchApi } from "~/fetch-api"
import { KeyStoreProvider } from "~/keystore"
import { getSession } from "~/sessions"

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)

	try {
		const blogs = await fetchApi<Blog[]>("/blogs", {
			headers: { Authorization: `Bearer ${accessToken}` },
		})
		if (blogs.length <= 0) {
			return redirect("/blogs/new")
		}
		return blogs
	} catch (error) {
		if (error === ApiError.Unauthorized) {
			redirectToLoginPage()
		} else {
			throw data({ error: ApiError.Internal }, { status: 500 })
		}
	}
}

export default function AllBlogsPage() {
	const data = useLoaderData<typeof loader>()

	return (
		<KeyStoreProvider>
			<div className="w-full flex justify-center">
				<main className="w-full max-w-prose mt-20">
					<h1 className="text-4xl mb-4">your blogs</h1>
					{"error" in data ? (
						<p>We are having trouble loading your blogs.</p>
					) : (
						<ul>
							{data.map((blog) => (
								<li key={blog.slug}>
									<Anchor to={`/blogs/${blog.slug}`}>{blog.name}</Anchor>
								</li>
							))}
						</ul>
					)}
				</main>
			</div>
		</KeyStoreProvider>
	)
}
