import dayjs from "dayjs"
import type React from "react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import {
	type ActionFunctionArgs,
	type ClientActionFunctionArgs,
	type LoaderFunctionArgs,
	data,
	isRouteErrorResponse,
	redirect,
	useFetcher,
	useLoaderData,
	useParams,
} from "react-router"
import { create } from "zustand/react"
import { authenticate, redirectToLoginPage } from "~/auth"
import {
	type BlogPost,
	generateBlogPostSlug,
	newBlogPostContent,
} from "~/blog/post"
import { Anchor } from "~/components/anchor"
import { SmallButton } from "~/components/small-button"
import { encryptToRaw } from "~/crypt"
import { ApiError } from "~/error"
import {
	ERROR_TYPE,
	applicationHttpError,
	displayInternalErrorToast,
	isApplicationError,
} from "~/errors"
import { fetchApi } from "~/fetch-api"
import { useKeyStore } from "~/keystore"
import { getSession } from "~/sessions"

enum BlogPostDashboardMode {
	Display = "DISPLAY",
	Create = "CREATE",
	Manage = "MANAGE",
}

interface BlogPostDashboardStore {
	mode: BlogPostDashboardMode
	selectedBlogPosts: Set<BlogPost["slug"]>
	isDeleting: boolean
	setIsDeleting: (isDeleting: boolean) => void
	setMode: (mode: BlogPostDashboardMode) => void
	selectBlogPost: (post: BlogPost) => void
	deselectBlogPost: (post: BlogPost) => void
	clearSelections: () => void
}

const useStore = create<BlogPostDashboardStore>()((set) => ({
	mode: BlogPostDashboardMode.Display,
	selectedBlogPosts: new Set(),
	isDeleting: false,

	setIsDeleting: (isDeleting: boolean) => set({ isDeleting }),
	setMode: (mode: BlogPostDashboardMode) => set({ mode }),
	selectBlogPost: (post: BlogPost) =>
		set((state) => {
			const selected = state.selectedBlogPosts
			selected.add(post.slug)
			return { selectedBlogPosts: selected }
		}),
	deselectBlogPost: (post: BlogPost) =>
		set((state) => {
			const selected = state.selectedBlogPosts
			selected.delete(post.slug)
			return { selectedBlogPosts: selected }
		}),
	clearSelections: () => set({ selectedBlogPosts: new Set() }),
}))

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)

	try {
		const posts = await fetchApi<BlogPost[]>(
			`/blogs/${params.blogSlug}/posts`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			},
		)
		posts.sort(
			(a, b) =>
				new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime(),
		)
		return posts
	} catch (error) {
		if (isApplicationError(error, ERROR_TYPE.unauthorized)) {
			redirectToLoginPage()
		} else {
			throw applicationHttpError({ error: ERROR_TYPE.internal })
		}
	}
}

export default function BlogPostDashboard() {
	const posts = useLoaderData<typeof loader>()
	return (
		<>
			<div className="flex flex-row justify-start items-center mb-6 space-x-2">
				<NewPostButton />
				<ManagePostsButton />
				<DeletePostsButton />
			</div>
			<BlogPostList posts={posts} />
		</>
	)
}

function NewPostButton() {
	const isDisabled = useStore(
		(state) => state.mode === BlogPostDashboardMode.Manage,
	)
	const setMode = useStore((state) => state.setMode)
	return (
		<SmallButton
			disabled={isDisabled}
			onClick={() => {
				setMode(BlogPostDashboardMode.Create)
			}}
		>
			New post
		</SmallButton>
	)
}

function ManagePostsButton() {
	const isInManageMode = useStore(
		(state) => state.mode === BlogPostDashboardMode.Manage,
	)
	const isDisabled = useStore((state) => state.isDeleting)
	const setMode = useStore((state) => state.setMode)
	const clearSelections = useStore((state) => state.clearSelections)
	return (
		<SmallButton
			disabled={isDisabled}
			onClick={() => {
				if (isInManageMode) {
					clearSelections()
				}
				setMode(
					isInManageMode
						? BlogPostDashboardMode.Display
						: BlogPostDashboardMode.Manage,
				)
			}}
		>
			{isInManageMode ? "Done" : "Manage"}
		</SmallButton>
	)
}

function BlogPostList({ posts }: { posts: BlogPost[] }) {
	const params = useParams()

	if (posts.length <= 0) {
		return <NoPostMessage />
	}

	return (
		<div>
			<NewPostInput />
			<ul className="space-y-2">
				{posts.map((post) => (
					<BlogPostListItem
						key={post.slug}
						post={post}
						blogSlug={params.blogSlug as string}
					/>
				))}
			</ul>
		</div>
	)
}

function BlogPostListItem({
	post,
	blogSlug,
}: { post: BlogPost; blogSlug: string }) {
	return (
		<li className="flex flex-row justify-between">
			<div className="flex items-center space-x-2">
				<BlogPostListItemCheckbox post={post} />
				<Anchor prefetch="intent" to={`/blogs/${blogSlug}/posts/${post.slug}`}>
					{post.title}
				</Anchor>
			</div>
			<PostTime date={new Date(post.creationDate)} />
		</li>
	)
}

function BlogPostListItemCheckbox({ post }: { post: BlogPost }) {
	const isSelectable = useStore(
		(state) => state.mode === BlogPostDashboardMode.Manage,
	)
	const isDisabled = useStore((state) => state.isDeleting)
	const isSelected = useStore((state) => state.selectedBlogPosts.has(post.slug))
	const selectBlogPost = useStore((state) => state.selectBlogPost)
	const deselectBlogPost = useStore((state) => state.deselectBlogPost)

	if (!isSelectable) return null

	return (
		<input
			disabled={isDisabled}
			type="checkbox"
			checked={isSelected}
			onChange={(event) => {
				if (event.currentTarget.checked) {
					selectBlogPost(post)
				} else {
					deselectBlogPost(post)
				}
			}}
		/>
	)
}

function DeletePostsButton() {
	const isVisible = useStore(
		(state) => state.mode === BlogPostDashboardMode.Manage,
	)
	const selectedPostCount = useStore((state) => state.selectedBlogPosts.size)
	const setIsDeleting = useStore((state) => state.setIsDeleting)
	const fetcher = useFetcher()
	const isDeleting =
		fetcher.state === "submitting" || fetcher.state === "loading"

	useEffect(() => {
		setIsDeleting(isDeleting)
	}, [isDeleting, setIsDeleting])

	if (!isVisible) return null

	let label: string
	if (isDeleting) {
		label = "Deleting…"
	} else {
		switch (selectedPostCount) {
			case 0:
				label = "Delete"
				break
			case 1:
				label = "Delete 1 post"
				break
			default:
				label = `Delete ${selectedPostCount} posts`
				break
		}
	}

	async function deletePosts() {
		if (
			!confirm(
				`Are you sure you want to delete ${selectedPostCount} ${selectedPostCount > 1 ? "posts" : "post"}? Once deleted, they cannot be recovered.`,
			)
		) {
			return
		}

		const selectedPostSlugs = useStore.getState().selectedBlogPosts
		const deleteForm = new FormData()
		for (const slug of selectedPostSlugs) {
			deleteForm.append("slugs", slug)
		}

		fetcher.submit(deleteForm, { method: "DELETE" })
	}

	return (
		<SmallButton
			disabled={isDeleting || selectedPostCount === 0}
			className="text-rose-500 dark:text-rose-200"
			onClick={deletePosts}
		>
			{label}
		</SmallButton>
	)
}

function NoPostMessage() {
	const shouldShowNewPostInput = useStore(
		(state) => state.mode === BlogPostDashboardMode.Create,
	)
	if (shouldShowNewPostInput) {
		return <NewPostInput />
	}
	return <p className="mb-4 opacity-80">No post yet.</p>
}

function PostTime({ date }: { date: Date }) {
	const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
	return <time>{formattedDate}</time>
}

function NewPostInput() {
	const isVisible = useStore(
		(state) => state.mode === BlogPostDashboardMode.Create,
	)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const setMode = useStore((state) => state.setMode)
	const fetcher = useFetcher()
	const keyStore = useKeyStore()

	if (!isVisible) return null

	function onInvalidTitleInput(event: React.ChangeEvent<HTMLInputElement>) {
		event.currentTarget.setCustomValidity("")
		if (!event.currentTarget.validity.valid) {
			event.currentTarget.setCustomValidity(
				"Please provide a title for the post.",
			)
		}
	}

	async function submitCreatePostForm(event: React.FormEvent<HTMLFormElement>) {
		setIsSubmitting(true)

		const form = new FormData(event.currentTarget)
		const title = form.get("title")
		if (!title || typeof title !== "string") {
			setIsSubmitting(false)
			return
		}
		const key = await keyStore.getKey()

		const postSlug = generateBlogPostSlug(title)
		form.set("slug", postSlug)

		const createPostForm = new FormData()
		createPostForm.set("title", title)
		createPostForm.set("slug", postSlug)

		try {
			const { authTag, iv, text } = await encryptToRaw(
				newBlogPostContent({
					slug: postSlug,
					"publish date": dayjs().format("YYYY/MM/DD"),
				}),
				key,
			)
			createPostForm.set(
				"content",
				new Blob([authTag, iv, text], { type: "application/octet-stream" }),
			)

			await fetcher.submit(createPostForm, {
				method: "POST",
				encType: "multipart/form-data",
			})
		} catch (error) {
			console.error(error)
			// TODO: handle post encryption error
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<fetcher.Form
			className="dark:bg-zinc-800 rounded -mx-2 mb-2 px-2 py-1"
			onSubmit={submitCreatePostForm}
		>
			<div className="flex flex-row items-center justify-between mb-2">
				<input
					required
					// biome-ignore lint/a11y/noAutofocus: it makes sense to autofocus to the title input when screenreader users click on add new post
					autoFocus
					disabled={isSubmitting}
					type="text"
					name="title"
					aria-label="New post title"
					className="bg-transparent flex-1 focus:outline-none pr-2"
					onInvalid={onInvalidTitleInput}
				/>
				<PostTime date={new Date()} />
			</div>
			<div className="flex flex-row w-full justify-end space-x-2">
				<SmallButton
					disabled={isSubmitting}
					className="text-rose-500 dark:text-rose-200"
					onClick={() => {
						setMode(BlogPostDashboardMode.Display)
					}}
				>
					Cancel
				</SmallButton>
				<SmallButton type="submit">Create</SmallButton>
			</div>
		</fetcher.Form>
	)
}

export async function clientAction({
	request,
	serverAction,
}: ClientActionFunctionArgs) {
	try {
		const data = await serverAction<typeof action>()
		switch (request.method) {
			case "DELETE":
				toast.success("Posts deleted successfully!")
				useStore.setState((state) => {
					const selected = state.selectedBlogPosts
					selected.clear()
					return {
						mode: BlogPostDashboardMode.Display,
						selectedBlogPosts: selected,
					}
				})
				break
		}
		return data
	} catch (error) {
		// redirect response is thrown, so need to make sure they are re-thrown
		// to not block the redirect
		if (error instanceof Response) {
			useStore.setState({ mode: BlogPostDashboardMode.Display })
			throw error
		}
		if (isRouteErrorResponse(error) && error.status === 409) {
			toast.error(
				`A blog post titled "${error.data.conflictingValue}" already exists!`,
			)
		} else {
			displayInternalErrorToast(error)
		}
	}
}

export async function action(args: ActionFunctionArgs) {
	const session = await getSession(args.request.headers.get("Cookie"))
	const headers = new Headers()
	const accessToken = await authenticate(args.request, session, headers)

	switch (args.request.method) {
		case "POST":
			return createPost(args, accessToken, headers)
		case "DELETE":
			return deletePosts(args, accessToken)
	}
}

async function createPost(
	{ request, params }: ActionFunctionArgs,
	accessToken: string,
	headers: Headers,
) {
	const form = await request.formData()
	const postSlug = form.get("slug")
	if (!postSlug || typeof postSlug !== "string") {
		throw data({ error: ApiError.BadRequest }, { status: 400 })
	}

	try {
		const createdPost = await fetchApi<BlogPost>(
			`/blogs/${params.blogSlug}/posts/${postSlug}`,
			{
				method: "POST",
				headers: { Authorization: `Bearer ${accessToken}` },
				body: form,
			},
		)
		return redirect(`/blogs/${params.blogSlug}/posts/${createdPost.slug}`, {
			headers,
		})
	} catch (error) {
		if (isApplicationError(error, ERROR_TYPE.unauthorized)) {
			redirectToLoginPage()
		} else if (isApplicationError(error, ERROR_TYPE.conflict)) {
			throw applicationHttpError({
				error: ERROR_TYPE.conflict,
				conflictingField: "slug",
				conflictingValue: postSlug,
			})
		} else {
			throw applicationHttpError({ error: ERROR_TYPE.internal })
		}
	}
}

async function deletePosts(
	{ request, params }: ActionFunctionArgs,
	accessToken: string,
) {
	const form = await request.formData()
	const slugs = form.getAll("slugs")

	if (slugs.length <= 0) {
		throw applicationHttpError({ error: ERROR_TYPE.badRequest })
	}

	try {
		await fetchApi(`/blogs/${params.blogSlug}/posts?slugs=${slugs.join(",")}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${accessToken}` },
		})
		return null
	} catch (error) {
		if (isApplicationError(error, ERROR_TYPE.unauthorized)) {
			redirectToLoginPage()
		} else {
			throw applicationHttpError({ error: ERROR_TYPE.internal })
		}
	}
}
