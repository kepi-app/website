import {
	json,
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
	type ActionFunctionArgs,
} from "@remix-run/node"

export async function action({ request, params }: ActionFunctionArgs) {
	const uploadHandler = unstable_createMemoryUploadHandler({
		filter: (args) =>
			/^image\/(apng|avif|gif|jpeg|png|svg\+xml|webp)$/g.test(args.contentType),
		maxPartSize: 10_000_000, // 10 MB
	})

	const formData = await unstable_parseMultipartFormData(request, uploadHandler)

	const res = await fetch(
		`${process.env.API_URL}/blog/${params.blogSlug}/post/${params.postSlug}/image`,
		{
			method: "POST",
			body: formData,
		},
	)
	return json(await res.json())
}
