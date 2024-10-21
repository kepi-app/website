import {
	type ActionFunctionArgs,
	json, type LoaderFunctionArgs,
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
} from "@remix-run/node"
import { authenticate } from "~/auth"
import type { UploadResult } from "~/blog/upload"
import { ApiError } from "~/error"
import { fetchApi } from "~/fetch-api"
import { getSession } from "~/sessions"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)

	const result = await fetchApi<{ fileId: string }>(`/blogs/${params.blogSlug}/files`, {
		method: "GET",
		headers: { Authorization: `Bearer ${accessToken}` },
	})
	if (result.isErr()) {
		return json({ error: ApiError.Internal }, { status: 500 })
	}

	return json(result)
}

export async function action({ request, params }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const headers = new Headers()
	const accessToken = await authenticate(request, session, headers)

	const uploadHandler = unstable_createMemoryUploadHandler({
		filter: () => true,
		maxPartSize: 10_000_000, // 10 MB
	})

	const formData = await unstable_parseMultipartFormData(request, uploadHandler)

	const result = await fetchApi<UploadResult>(
		`/blogs/${params.blogSlug}/files`,
		{
			method: "POST",
			body: formData,
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	)
	if (result.isErr()) {
		return json({ error: ApiError.Internal }, { status: 500 })
	}

	return json(result.value)
}
