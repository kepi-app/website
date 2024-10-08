import type { LoaderFunctionArgs } from "@remix-run/node"
import { json, useLoaderData, useParams } from "@remix-run/react"
import { authenticate } from "~/auth"
import { Anchor } from "~/components/anchor"
import { AutoResizingTextArea } from "~/components/auto-resizing-textarea"
import { getSession } from "~/sessions"
import clsx from "clsx"
import { ProgressiveBlurBackground } from "~/components/progressive-blur-background"
import { UploadPreviews } from "~/blog-post-editor/upload-previews"
import { ActionButtons } from "~/blog-post-editor/action-buttons"
import {
	ActionToolbar,
	ActionToolbarIconButton,
} from "~/components/action-toolbar"
import { PaperClipIcon, PhotoIcon } from "@heroicons/react/24/outline"
import { type ChangeEvent, useRef, useState } from "react"
import { fetchApi } from "~/fetch-api"
import { Blog } from "~/blog/blog"
import { ApiError } from "~/error"

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

export default function HomePageEditor() {
	const params = useParams()

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
				<AutoResizingTextArea
					className="font-mono w-full bg-transparent focus:outline-none"
					placeholder="welcome to my blog!"
				/>
			</div>
			<BottomArea />
		</div>
	)
}

function ContentEditor() {
	const data = useLoaderData<typeof loader>()
	const [isDecrypting, setIsDecrypting] = useState(false)
	const [content, setContent] = useState<string | null>(null)

	if ("error" in data) {
		return (
			<p className="text-rose-500 dark:text-rose-200">
				Failed to load content!
			</p>
		)
	}

	if (isDecrypting) {
		return <p className="animate-pulse">Decrypting content...</p>
	}
}

function BottomArea() {
	const imageFileInputRef = useRef<HTMLInputElement | null>(null)

	function openImagePicker() {
		imageFileInputRef.current?.click()
	}

	function onImageChange(event: ChangeEvent<HTMLInputElement>) {
		console.log(event.currentTarget.files)
	}

	return (
		<div className="fixed z-10 px-16 bottom-0 left-0 right-0 w-full flex flex-col items-center">
			<ProgressiveBlurBackground />

			<div className="z-10 flex flex-col items-center w-full lg:max-w-prose">
				<ActionToolbar>
					<input
						ref={imageFileInputRef}
						type="file"
						multiple
						className="hidden"
						onChange={onImageChange}
						accept="image/apng,image/avif,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
					/>
					<ActionToolbarIconButton
						Icon={PhotoIcon}
						onClick={openImagePicker}
						aria-label="Insert image"
					/>
					<ActionToolbarIconButton
						Icon={PaperClipIcon}
						aria-label="Insert file"
					/>
				</ActionToolbar>
			</div>
		</div>
	)
}
