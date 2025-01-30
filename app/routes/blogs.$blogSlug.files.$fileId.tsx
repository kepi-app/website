import type { LoaderFunctionArgs } from "react-router"
import { authenticate, redirectToLoginPage } from "~/auth"
import { ERROR_TYPE, applicationHttpError, isApplicationError } from "~/errors"
import { fetchApiRaw } from "~/fetch-api"
import { getSession } from "~/sessions"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)

	try {
		const res = await fetchApiRaw(
			`/blogs/${params.blogSlug}/files/${params.fileId}`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		)

		return new Response(await res.blob(), {
			status: 200,
			headers: {
				"Content-Type-Cipher": res.headers.get("Content-Type-Cipher") || "",
			},
		})
	} catch (error) {
		if (isApplicationError(error, ERROR_TYPE.unauthorized)) {
			redirectToLoginPage()
		} else {
			throw applicationHttpError({ error: ERROR_TYPE.internal })
		}
	}
}
