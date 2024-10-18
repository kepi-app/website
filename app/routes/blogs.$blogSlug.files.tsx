import {
	type ActionFunctionArgs,
	json,
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
} from "@remix-run/node"
import { authenticate } from "~/auth"
import type { UploadResult } from "~/blog/upload"
import { ApiError } from "~/error"
import { fetchApi } from "~/fetch-api"
import { getSession } from "~/sessions"

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
