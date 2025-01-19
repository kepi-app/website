import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	data,
} from "react-router"
import { useFetcher, useLoaderData } from "react-router"
import { type ChangeEvent, useEffect, useRef } from "react"
import { authenticate, redirectToLoginPage } from "~/auth"
import type { Blog } from "~/blog/blog"
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

	try {
		const res = await fetchApi<Blog>(`/blogs/${params.blogSlug}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
		return res
	} catch (error) {
		if (error === ApiError.Unauthorized) {
			redirectToLoginPage()
		} else {
			throw data({ error: ApiError.Internal }, { status: 500 })
		}
	}
}

export function shouldRevalidate() {
	return false
}

export default function HomePageEditor() {
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

		try {
			const key = await keyStore.getKey()
			const { authTag, iv, text } = await encryptToRaw(homeContent, key)

			form.set(
				"homeContent",
				new Blob([authTag, iv, text], { type: "application/octet-stream" }),
			)

			fetcher.submit(form, {
				method: "PATCH",
				encType: "multipart/form-data",
			})
			autoSaveTimeout.current = null
		} catch (e) {}
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
		<MarkdownEditorStoreProvider content={data.homeContent}>
			<MarkdownEditor onChange={onEditorChange} />
			<MarkdownEditor.Toolbar containerClassName="fixed z-10 px-16 bottom-0 left-0 right-0 ">
				<MarkdownEditor.Toolbar.AttachImageButton />
				<MarkdownEditor.Toolbar.PreviewButton />
			</MarkdownEditor.Toolbar>
		</MarkdownEditorStoreProvider>
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

	try {
		const res = await fetchApi<Blog>(`/blogs/${params.blogSlug}`, {
			body: form,
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
		return data(res)
	} catch (error) {
		if (error === ApiError.Unauthorized) {
			redirectToLoginPage()
		} else {
			return data({ error: ApiError.Internal }, { status: 500 })
		}
	}
}
