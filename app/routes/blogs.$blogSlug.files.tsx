import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	data,
} from "react-router"
import { authenticate, redirectToLoginPage } from "~/auth"
import type { UploadResult } from "~/blog/upload"
import { ApiError } from "~/error"
import { fetchApi } from "~/fetch-api"
import { getSession } from "~/sessions"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)

	try {
		return await fetchApi<{ fileId: string }>(
			`/blogs/${params.blogSlug}/files`,
			{
				method: "GET",
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		)
	} catch (error) {
		if (error === ApiError.Unauthorized) {
			redirectToLoginPage()
		} else {
			throw data({ error: ApiError.Internal }, { status: 500 })
		}
	}
}

export async function action({ request, params }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const headers = new Headers()
	const accessToken = await authenticate(request, session, headers)

	const formData = await request.formData()

	try {
		return await fetchApi<UploadResult>(`/blogs/${params.blogSlug}/files`, {
			method: "POST",
			body: formData,
			headers: { Authorization: `Bearer ${accessToken}` },
		})
	} catch (error) {
		if (error === ApiError.Unauthorized) {
			redirectToLoginPage()
		} else {
			throw data({ error: ApiError.Internal }, { status: 500 })
		}
	}
}
