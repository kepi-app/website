import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { json, useFetcher, useLoaderData, useParams } from "@remix-run/react"
import { type ChangeEvent, useEffect, useRef } from "react"
import { authenticate } from "~/auth"
import type { Blog } from "~/blog/blog"
import { Anchor } from "~/components/anchor"
import { MarkdownEditor } from "~/components/markdown-editor/markdown-editor"
import { MarkdownEditorStoreProvider } from "~/components/markdown-editor/store"
import { encryptToRaw } from "~/crypt"
import { ApiError } from "~/error"
import { fetchApi } from "~/fetch-api"
import { useKeyStore } from "~/keystore"
import { getSession } from "~/sessions"

export async function loader({ params, request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)

	const result = await fetchApi<Blog>(`/blogs/${params.blogSlug}`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	})
	if (result.isErr()) {
		return json({ error: ApiError.Internal }, { status: 500 })
	}
	return json(result.value)
}

export function shouldRevalidate() {
	return false
}

export default function HomePageEditor() {
	const params = useParams()
	const data = useLoaderData<typeof loader>()
	const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>()
	const fetcher = useFetcher()
	const keyStore = useKeyStore()

	useEffect(() => {
		return () => {
			if (autoSaveTimeout.current) {
				clearTimeout(autoSaveTimeout.current)
			}
		}
	}, [])

	if ("error" in data) {
		return <ErrorPage />
	}

	async function saveHomePage(homeContent: string) {
		const form = new FormData()

		const keyResult = await keyStore.getKey()
		if (keyResult.isErr()) {
			console.error(keyResult.error)
			return
		}

		const key = keyResult.value
		const encResult = await encryptToRaw(homeContent, key)
		if (encResult.isErr()) {
			console.error(encResult.error)
			return
		}

		const { authTag, iv, text } = encResult.value

		form.set(
			"homeContent",
			new Blob([authTag, iv, text], { type: "application/octet-stream" }),
		)

		fetcher.submit(form, {
			method: "PATCH",
			encType: "multipart/form-data",
		})
		autoSaveTimeout.current = null
	}

	function onEditorChange(event: ChangeEvent<HTMLTextAreaElement>) {
		if (autoSaveTimeout.current) {
			clearTimeout(autoSaveTimeout.current)
		}
		const content = event.currentTarget.value
		autoSaveTimeout.current = setTimeout(() => {
			saveHomePage(content)
		}, 2000)
	}

	return (
		<div className="w-full flex justify-center">
			<div className="w-full max-w-prose mt-20">
				<h1 className="text-2xl opacity-80 mb-4">
					<a
						className="hover:underline"
						href={`/blogs/${params.blogSlug}/dashboard`}
					>
						{params.blogSlug}
					</a>
				</h1>
				<nav className="flex flex-row space-x-4 mb-8 opacity-80">
					<Anchor>home</Anchor>
					<Anchor>posts</Anchor>
					<Anchor>about</Anchor>
				</nav>
				<MarkdownEditorStoreProvider content={data.homeContent}>
					<MarkdownEditor onChange={onEditorChange} />
					<MarkdownEditor.Toolbar containerClassName="fixed z-10 px-16 bottom-0 left-0 right-0 ">
						<MarkdownEditor.Toolbar.AttachImageButton />
						<MarkdownEditor.Toolbar.PreviewButton />
					</MarkdownEditor.Toolbar>
				</MarkdownEditorStoreProvider>
			</div>
		</div>
	)
}

function ErrorPage() {
	return (
		<div className="w-full px-16 flex justify-center bg-zinc-200 dark:bg-zinc-900">
			<main className="w-full mt-40 max-w-prose">
				<p>An error occurred when loading your home page.</p>
			</main>
		</div>
	)
}

export async function action({ params, request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const headers = new Headers()
	const accessToken = await authenticate(request, session, headers)

	const form = await request.formData()

	const updateResult = await fetchApi<Blog>(`/blogs/${params.blogSlug}`, {
		body: form,
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	})
	if (updateResult.isErr()) {
		return json({ error: ApiError.Internal }, { status: 500 })
	}

	return json(updateResult.value)
}
