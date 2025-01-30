import type { PropsWithChildren } from "react"
import { type LoaderFunctionArgs, redirect } from "react-router"
import { useLoaderData } from "react-router"
import { authenticate, redirectToLoginPage } from "~/auth"
import type { Blog } from "~/blog/blog"
import { Anchor } from "~/components/anchor"
import { ERROR_TYPE, applicationHttpError, isApplicationError } from "~/errors"
import { fetchApi } from "~/fetch-api"
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
		if (isApplicationError(error, ERROR_TYPE.unauthorized)) {
			redirectToLoginPage()
		} else {
			throw applicationHttpError({ error: ERROR_TYPE.internal })
		}
	}
}

const AllBlogsPage = ({ children }: PropsWithChildren) => {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="w-full flex justify-center">
			<main className="w-full max-w-prose mt-20">
				<h1 className="text-4xl mb-4">your blogs</h1>
				{children ?? (
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
	)
}
export default AllBlogsPage

export function ErrorBoundary() {
	return (
		<AllBlogsPage>
			<p>We are having trouble loading your blogs.</p>
		</AllBlogsPage>
	)
}
