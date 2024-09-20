import {
	unstable_composeUploadHandlers,
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
	type ActionFunctionArgs,
	type UploadHandler,
} from "@remix-run/node"

export async function action({ request, params }: ActionFunctionArgs) {
	const uploadHandler = unstable_createMemoryUploadHandler({
		filter: (args) =>
			/^image\/(apng|avif|gif|jpeg|png|svg\+xml|webp)$/g.test(args.contentType),
		maxPartSize: 10_000_000, // 10 MB
	})

	const formData = await unstable_parseMultipartFormData(request, uploadHandler)

	await fetch(
		`${process.env.API_URL}/blog/${params.blogSlug}/post/${params.postSlug}/image`,
		{
			method: "POST",
			body: formData,
			headers: {
				"Content-Type": "multipart/form-data",
			},
		},
	)
}
