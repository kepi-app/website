import { type LoaderFunctionArgs, data } from "@remix-run/node"
import { authenticate } from "~/auth"
import { ApiError } from "~/error"
import { fetchApiRaw } from "~/fetch-api"
import { getSession } from "~/sessions"

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)

	const result = await fetchApiRaw(
		`/blogs/${params.blogSlug}/files/${params.fileId}`,
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	)
	if (result.isErr()) {
		throw data({ error: ApiError.Internal }, { status: 500 })
	}

	const res = result.value

	return new Response(await res.blob(), {
		status: 200,
		headers: {
			"Content-Type-Cipher": res.headers.get("Content-Type-Cipher") || "",
		},
	})
}
