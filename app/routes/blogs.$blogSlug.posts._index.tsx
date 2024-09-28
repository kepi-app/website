import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import {
	Form,
	json,
	redirect,
	useLoaderData,
	useParams,
} from "@remix-run/react"
import { useState } from "react"
import { authenticate } from "~/auth"
import type { BlogPost } from "~/blog/post"
import { Anchor } from "~/components/anchor"
import { SmallButton } from "~/components/small-button"
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

	return json<BlogPost[]>(result.value)
}

export default function BlogPostDashboard() {
	const params = useParams<RouteParams>()
	const posts = useLoaderData<typeof loader>()
	const [shouldShowNewPostInput, setShouldShowNewPostInput] = useState(false)

	function content() {
		if (posts.length <= 0) {
			if (shouldShowNewPostInput) {
				return <NewPostInput onCancel={hideNewPostInput} />
			}
			return <p className="mb-4 opacity-80">No post yet.</p>
		}
		return (
			<div>
				<ul className="space-y-2">
					{posts.map((post) => (
						<li key={post.slug} className="flex flex-row justify-between">
							<Anchor href={`/blogs/${params.blogSlug}/posts/${post.slug}`}>
								{post.title}
							</Anchor>
							<PostTime date={new Date(post.publishDate)} />
						</li>
					))}
				</ul>
				{shouldShowNewPostInput ? (
					<NewPostInput onCancel={hideNewPostInput} />
				) : null}
			</div>
		)
	}

	function hideNewPostInput() {
		setShouldShowNewPostInput(false)
	}

	return (
		<div className="w-full flex justify-center">
			<main className="w-full max-w-prose mt-20">
				<h2 className="text-lg opacity-80">{params.blogSlug}</h2>
				<div className="flex flex-row justify-between items-center">
					<h1 className="text-4xl my-8">your posts</h1>
					<SmallButton
						onClick={() => {
							setShouldShowNewPostInput(true)
						}}
					>
						Add new post
					</SmallButton>
				</div>
				{content()}
			</main>
		</div>
	)
}

export function PostTime({ date }: { date: Date }) {
	const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
	return <time>{formattedDate}</time>
}

export function NewPostInput({ onCancel }: { onCancel: () => void }) {
	return (
		<Form
			method="POST"
			className="dark:bg-zinc-800 rounded -mx-2 mt-2 px-2 py-1"
		>
			<div className="flex flex-row items-center justify-between mb-2">
				<input
					// biome-ignore lint/a11y/noAutofocus: it makes sense to autofocus to the title input when screenreader users click on add new post
					autoFocus
					type="text"
					name="postTitle"
					aria-label="New post title"
					className="bg-transparent flex-1 focus:outline-none pr-2"
				/>
				<PostTime date={new Date()} />
			</div>
			<div className="flex flex-row w-full justify-end space-x-2">
				<SmallButton
					className="text-rose-200"
					onClick={() => {
						onCancel()
					}}
				>
					Cancel
				</SmallButton>
				<SmallButton type="submit">Create</SmallButton>
			</div>
		</Form>
	)
}

export async function action({ request, params }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const headers = new Headers()
	const accessToken = await authenticate(request, session, headers)

	const form = await request.formData()
	const postTitle = form.get("postTitle")
	console.log(postTitle)
	if (!postTitle || typeof postTitle !== "string") {
		return json({ error: ApiError.BadRequest }, { status: 400 })
	}

	const postSlug = postTitle.replace(/ /g, "-")
	const postForm = new FormData()
	postForm.set("title", postTitle)

	const createdPostResult = await fetchApi<BlogPost>(
		`/blogs/${params.blogSlug}/posts/${postSlug}`,
		{
			method: "POST",
			headers: { Authorization: `Bearer ${accessToken}` },
			body: postForm,
		},
	)
	if (createdPostResult.isErr()) {
		switch (createdPostResult.error) {
			case ApiError.Unauthorized:
				return redirect("/login")
			case ApiError.Conflict:
				return json({ error: ApiError.Conflict }, { status: 409 })
			default:
				return json({ error: ApiError.Internal }, { status: 500 })
		}
	}

	const createdPost = createdPostResult.value

	return redirect(`/blogs/${params.blogSlug}/posts/${createdPost.slug}`)
}
