import clsx from "clsx"
import { ArrowLeft } from "lucide-react"
import { type Ref, memo, useEffect, useRef } from "react"
import toast from "react-hot-toast"
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	replace,
	useFetcher,
	useLoaderData,
	useParams,
	useRouteError,
} from "react-router"
import { authenticate, redirectToLoginPage } from "~/auth"
import { MainEditor } from "~/blog-post-editor/main-editor"
import {
	PostEditorStoreProvider,
	usePostEditorStore,
	usePostEditorStoreContext,
} from "~/blog-post-editor/store"
import { type BlogPost, parseBlogPostFrontmatter } from "~/blog/post"
import type { UploadResult } from "~/blog/upload"
import { Anchor } from "~/components/anchor"
import {
	MarkdownEditor,
	type MarkdownEditorRef,
	MarkdownEditorStatus,
} from "~/components/markdown-editor/markdown-editor"
import type { Base64EncodedCipher } from "~/crypt"
import {
	ERROR_TYPE,
	applicationHttpError,
	displayInternalErrorToast,
	isApplicationError,
} from "~/errors"
import { fetchApi } from "~/fetch-api"
import { KeyStoreProvider, useKeyStore } from "~/keystore"
import { getSession } from "~/sessions"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)
	try {
		return await fetchApi<BlogPost>(
			`/blogs/${params.blogSlug}/posts/${params.postSlug}`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		)
	} catch (error) {
		if (isApplicationError(error, ERROR_TYPE.unauthorized)) {
			redirectToLoginPage()
		} else {
			throw applicationHttpError({ error: ERROR_TYPE.internal })
		}
	}
}

export function shouldRevalidate() {
	return false
}

const Page = memo(() => {
	const postData = useLoaderData<typeof loader>()
	if ("error" in postData) {
		return <ErrorPage />
	}
	return (
		<KeyStoreProvider>
			<PostEditorStoreProvider post={postData}>
				<WaitForDecryption />
			</PostEditorStoreProvider>
		</KeyStoreProvider>
	)
})
export default Page

function ErrorPage() {
	return (
		<div className="w-full px-16 flex justify-center bg-zinc-200 dark:bg-zinc-900">
			<main className="w-full mt-40 max-w-prose">
				<p>an error occurred on our end when opening this post.</p>
			</main>
		</div>
	)
}

function WaitForDecryption() {
	const isDecrypting = usePostEditorStore(
		(state) => state.status === MarkdownEditorStatus.Decrypting,
	)
	if (isDecrypting) {
		return (
			<main className="w-full h-screen flex items-center justify-center">
				<p className="animate-pulse">Decrypting post</p>
			</main>
		)
	}
	return <EditBlogPostPage />
}

function EditBlogPostPage() {
	const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
	const mainEditorRef = useRef<MarkdownEditorRef | null>(null)
	const setIsFocused = usePostEditorStore((state) => state.setIsFocused)
	const clearPendingFiles = usePostEditorStore(
		(state) => state.clearPendingFiles,
	)
	const insertUploadedImages = usePostEditorStore(
		(state) => state.insertUploadedImages,
	)
	const createSavePostForm = usePostEditorStore(
		(state) => state.createSavePostForm,
	)
	const createUploadPendingFilesForm = usePostEditorStore(
		(state) => state.createUploadPendingFilesForm,
	)
	const markPostAsSaved = usePostEditorStore((state) => state.markPostAsSaved)
	const validationIssues = useRef<string[]>([])
	const editorStore = usePostEditorStoreContext()
	const keyStore = useKeyStore()
	const validationIssueToastId = useRef<string | null>(null)
	const params = useParams()

	const fetcher = useFetcher<typeof action>()
	const uploadFetcher = useFetcher<UploadResult[]>()

	useEffect(() => {
		if (fetcher.data === null) {
			markPostAsSaved()
		}
	}, [fetcher.data, markPostAsSaved])

	useEffect(
		function unfocusOnMouseMove() {
			function unfocus() {
				if (editorStore.getState().canUnfocus) {
					setIsFocused(false)
				}
			}
			document.addEventListener("mousemove", unfocus)
			return () => {
				document.removeEventListener("mousemove", unfocus)
			}
		},
		[setIsFocused, editorStore.getState],
	)

	useEffect(() => {
		if (uploadFetcher.state === "idle") {
			clearPendingFiles()
		}
	}, [clearPendingFiles, uploadFetcher.state])

	useEffect(() => {
		if (!uploadFetcher.data) {
			return
		}

		if (!mainEditorRef.current) {
			return
		}

		insertUploadedImages(uploadFetcher.data, mainEditorRef.current.selectionEnd)
	}, [uploadFetcher.data, insertUploadedImages])

	useEffect(
		function autoSaveOnContentChange() {
			const unsub0 = editorStore.subscribe(
				(state) => state.content,
				(content) => {
					console.log(content)
					autoSaveAfterTimeout()
				},
			)
			const unsub1 = editorStore.subscribe(
				(state) => state.title,
				() => {
					autoSaveAfterTimeout()
				},
			)
			const unsub2 = editorStore.subscribe(
				(state) => state.description,
				() => {
					autoSaveAfterTimeout()
				},
			)
			return () => {
				unsub0()
				unsub1()
				unsub2()
			}
		},
		[editorStore.subscribe],
	)

	useEffect(
		function listenForPendingFiles() {
			const unsub = editorStore.subscribe(
				(state) => state.pendingFiles,
				() => {
					uploadPendingFiles()
				},
			)
			return () => {
				unsub()
			}
		},
		[editorStore.subscribe],
	)

	useEffect(
		function runInitialValidation() {
			validateFrontmatter(editorStore.getState().content)
		},
		[editorStore.getState],
	)

	useEffect(function cleanup() {
		return () => {
			if (autoSaveTimeout.current) {
				clearTimeout(autoSaveTimeout.current)
			}
			if (validationIssueToastId.current) {
				toast.remove(validationIssueToastId.current)
			}
		}
	}, [])

	useEffect(
		function displayValidationIssues() {
			const unsub = editorStore.subscribe(
				(state) => state.validationIssues,
				(issues) => {
					if (issues.length > 0) {
						validationIssueToastId.current = toast.error(
							() => <ValidationIssuesToast issues={issues} />,
							{
								id: validationIssueToastId.current ?? undefined,
								duration: Number.POSITIVE_INFINITY,
								position: "bottom-right",
							},
						)
					} else if (validationIssueToastId.current) {
						toast.dismiss(validationIssueToastId.current)
						validationIssueToastId.current = null
					}
				},
			)
			return () => {
				unsub()
			}
		},
		[editorStore.subscribe],
	)

	async function uploadPendingFiles() {
		const key = await keyStore.getKey()
		try {
			const formData = await createUploadPendingFilesForm(key)
			if (formData) {
				// @ts-ignore
				uploadFetcher.submit(formData, {
					encType: "multipart/form-data",
					method: "POST",
					action: `/blogs/${params.blogSlug}/files`,
				})
			}
		} catch (error) {
			// TODO: handle file encryption error
			console.error(error)
		}
	}

	function autoSaveAfterTimeout() {
		if (autoSaveTimeout.current) {
			clearTimeout(autoSaveTimeout.current)
		}
		autoSaveTimeout.current = setTimeout(savePost, 2000)
	}

	async function savePost() {
		const key = await keyStore.getKey()
		const updateForm = await createSavePostForm(key)
		if (updateForm) {
			try {
				fetcher.submit(updateForm, {
					method: "PATCH",
					encType: "multipart/form-data",
				})
			} catch (error) {
				console.error("error when submitting", error)
			}
		}
		autoSaveTimeout.current = null
	}

	function validateFrontmatter(content: string) {
		const result = parseBlogPostFrontmatter(content)
		if (result.ok && validationIssueToastId.current) {
			toast.remove(validationIssueToastId.current)
			validationIssues.current = []
			validationIssueToastId.current = null
		} else if (!result.ok) {
			validationIssues.current = result.issues
			validationIssueToastId.current = toast.error(
				() => <ValidationIssuesToast issues={result.issues} />,
				{
					id: validationIssueToastId.current ?? undefined,
					duration: Number.POSITIVE_INFINITY,
					position: "bottom-right",
				},
			)
		}
	}

	return <MemoedPage editorRef={mainEditorRef} />
}

const MemoedPage = memo(
	({ editorRef }: { editorRef: Ref<MarkdownEditorRef> }) => (
		<div className="w-full px-16 flex justify-center">
			<main className="w-full mt-40 max-w-prose">
				<AllPostsLink />
				<MainEditor ref={editorRef} />
				<MarkdownEditor.Toolbar containerClassName="fixed z-10 px-16 bottom-0 left-0 right-0 ">
					<MarkdownEditor.Toolbar.AttachImageButton />
					<MarkdownEditor.Toolbar.PreviewButton />
				</MarkdownEditor.Toolbar>
			</main>
		</div>
	),
)

function AllPostsLink() {
	const params = useParams()
	const isFocused = usePostEditorStore((state) => state.isFocused)
	return (
		<Anchor
			to={`/blogs/${params.blogSlug}/posts`}
			className={clsx("transition-all", isFocused ? "opacity-0" : "opacity-80")}
		>
			<ArrowLeft className="inline align-sub" size={16} /> All posts
		</Anchor>
	)
}

// A toast that displays issues with the current blog post.
function ValidationIssuesToast({ issues }: { issues: string[] }) {
	return (
		<div>
			<p>Issues found:</p>
			<ul className="list-disc list-inside">
				{issues.map((value) => (
					<li key={value}>{value}</li>
				))}
			</ul>
		</div>
	)
}

export function ErrorBoundary() {
	const error = useRouteError()

	useEffect(() => {
		if (isApplicationError(error, ERROR_TYPE.conflict)) {
			toast.error(
				"The slug is already taken by another blog post. Please pick another slug.",
			)
		} else {
			displayInternalErrorToast(error, "BlogPostEditorPage -> ErrorBoundary")
		}
	}, [error])

	return <Page />
}

export async function action({ params, request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const headers = new Headers()
	const accessToken = await authenticate(request, session, headers)

	const updateForm = await request.formData()
	try {
		await fetchApi<Base64EncodedCipher>(
			`/blogs/${params.blogSlug}/posts/${params.postSlug}`,
			{
				method: "PATCH",
				body: updateForm,
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		)
		const newSlug = updateForm.get("slug")
		if (newSlug && newSlug !== params.blogSlug) {
			return replace(`/blogs/${params.blogSlug}/posts/${newSlug}`)
		}
		return null
	} catch (error) {
		if (isApplicationError(error, ERROR_TYPE.unauthorized)) {
			redirectToLoginPage()
		} else if (isApplicationError(error, ERROR_TYPE.conflict)) {
			throw applicationHttpError(error)
		}
		throw applicationHttpError({ error: ERROR_TYPE.internal })
	}
}
