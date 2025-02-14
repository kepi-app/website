import * as crypto from "node:crypto"
import { useRef } from "react"
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	data,
} from "react-router"
import { useFetcher, useLoaderData } from "react-router"
import { authenticate, redirectToLoginPage } from "~/auth"
import type { Blog } from "~/blog/blog"
import type { NonEmptyBlogPost } from "~/blog/post"
import { Button } from "~/components/button"
import {
	type SymmetricKey,
	decryptRaw,
	rawCipherFromBase64String,
} from "~/crypt"
import {
	type CheckedPromise,
	ERROR_TYPE,
	type InternalError,
	applicationHttpError,
	isApplicationError,
} from "~/errors"
import { fetchApi } from "~/fetch-api"
import { useKeyStore } from "~/keystore"
import { markdownProcessor } from "~/markdown/unified.server"
import { decryptBlogFiles } from "~/publishing/decrypt-blog-files"
import { getSession } from "~/sessions"

interface PublishRequestSignatureContent {
	timestamp: number
	nonce: string
	contentHash: string
}

interface PublishBlogResponse {
	url: string
}

export const handle = { hidePublishButton: true }

export async function loader({ params, request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const accessToken = await authenticate(request, session)

	const headers = { Authorization: `Bearer ${accessToken}` }

	try {
		const [blog, nonEmptyBlogPosts] = await Promise.all([
			fetchApi<Blog>(`/blogs/${params.blogSlug}`, { headers }),
			fetchApi<NonEmptyBlogPost[]>(
				`/blogs/${params.blogSlug}/posts?filter-empty=true`,
				{
					headers,
				},
			),
		])
		return {
			blog,
			posts: nonEmptyBlogPosts,
		}
	} catch (error) {
		if (isApplicationError(error, ERROR_TYPE.unauthorized)) {
			redirectToLoginPage()
		} else {
			throw applicationHttpError({ error: ERROR_TYPE.internal })
		}
	}
}

export default function PublishOverviewPage() {
	const data = useLoaderData<typeof loader>()
	const keystore = useKeyStore()
	const submitFetcher = useFetcher()
	const isPublishing = useRef(false)

	if ("error" in data) {
		return (
			<main>
				<p className="text-rose-500 dark:text-rose-200">
					An error occurred when loading the blog. Try to refresh to page.
				</p>
			</main>
		)
	}

	async function decryptBlogPost(
		post: NonEmptyBlogPost,
		key: SymmetricKey,
		decoder: TextDecoder,
	): CheckedPromise<{ slug: string; content: string }, InternalError> {
		return decryptRaw(await rawCipherFromBase64String(post.content), key).then(
			(decrypted) => ({
				slug: post.slug,
				content: decoder.decode(decrypted),
			}),
		)
	}

	async function publishBlog() {
		if ("error" in data) return
		const key = await keystore.getKey()
		const decoder = new TextDecoder()
		const { blog, posts: blogPosts } = data

		try {
			const [homeContent, decryptedPosts, decryptedFiles] = await Promise.all([
				decryptRaw(await rawCipherFromBase64String(blog.homeContent), key).then(
					(decrypted) => decoder.decode(decrypted),
				),
				Promise.all(
					blogPosts.map((post) => decryptBlogPost(post, key, decoder)),
				),
				decryptBlogFiles(data.blog, key),
			])

			const form = new FormData()
			form.set("homeContentMarkdown", homeContent)
			for (const post of decryptedPosts) {
				form.append("postMarkdowns", post.content)
				form.append("postSlugs", post.slug)
			}
			for (const file of decryptedFiles) {
				form.append("files", file)
			}

			submitFetcher.submit(form, {
				method: "POST",
				encType: "multipart/form-data",
			})
		} catch (e) {
			console.error(e)
		} finally {
			isPublishing.current = false
		}
	}

	return (
		<main>
			<p className="leading-relaxed">
				you are publishing{" "}
				<strong>{data.posts.length === 0 ? "no" : data.posts.length}</strong>{" "}
				{data.posts.length > 1 ? "posts" : "post"} under{" "}
				<strong>{data.blog.slug}.kepi.blog</strong>.
			</p>
			<br />
			<p className="leading-relaxed">
				all files, pages, blog posts, and other encrypted content will be{" "}
				<strong>decrypted</strong> before being published.
			</p>
			<br />
			<p className="leading-relaxed">
				once published, your blog will be publicly accessible at{" "}
				<strong>{data.blog.slug}.kepi.blog</strong>.
			</p>
			<br />
			<Button
				onClick={() => {
					publishBlog()
				}}
			>
				Got it, publish blog
			</Button>
		</main>
	)
}

export async function action({ params, request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const headers = new Headers()
	const accessToken = await authenticate(request, session, headers)

	const form = await request.formData()
	const homeMd = form.get("homeContentMarkdown")
	if (typeof homeMd !== "string") {
		return data({ error: "invalid home markdown received" }, { status: 401 })
	}

	const contentHasher = crypto.createHash("SHA256")

	await markdownProcessor.process(homeMd).then((result) => {
		const html = String(result).trim()
		const bytes = Buffer.from(html, "utf8")
		form.set(
			"homeContent",
			new Blob([bytes], { type: "application/octet-stream" }),
		)
		form.delete("homeContentMarkdown")
		contentHasher.update(bytes)
	})

	for (const md of form.getAll("postMarkdowns")) {
		if (typeof md !== "string") {
			return data({ error: "invalid post content received" }, { status: 401 })
		}
		const processed = await markdownProcessor.process(md)
		const html = String(processed).trim()
		const bytes = Buffer.from(html, "utf8")
		form.append(
			"posts",
			new Blob([bytes], { type: "application/octet-stream" }),
		)
		contentHasher.update(bytes)
		console.log("updating with", html)
	}

	form.delete("postMarkdowns")

	const signatureContent: PublishRequestSignatureContent = {
		timestamp: Date.now(),
		nonce: crypto.randomUUID(),
		contentHash: contentHasher.digest("base64"),
	}

	const signer = crypto.createSign("SHA256")
	signer.update(JSON.stringify(signatureContent))
	signer.end()
	const signature = signer.sign(process.env.PUBLISHING_PRIVATE_KEY, "base64")

	form.set("contentHash", signatureContent.contentHash)
	form.set("nonce", signatureContent.nonce)
	form.set("timestamp", signatureContent.timestamp.toString())
	form.set("signature", signature)

	try {
		return await fetchApi<PublishBlogResponse>(
			`/blogs/${params.blogSlug}/publish`,
			{
				method: "POST",
				body: form,
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
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
