import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	data,
} from "react-router"
import { Form, redirect } from "react-router"
import { useEffect, useRef, useState } from "react"
import { authenticate, redirectToLoginPage } from "~/auth"
import type { Blog } from "~/blog/blog"
import { Button } from "~/components/button"
import { ApiError } from "~/error"
import { fetchApi } from "~/fetch-api"
import { getSession } from "~/sessions"

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	await authenticate(request, session)
	return {}
}

export default function NewBlogPage() {
	return (
		<div className="w-full h-screen flex justify-center">
			<main className="w-full h-full max-w-prose flex items-center justify-center">
				<Form
					method="POST"
					className="w-full h-full relative flex flex-col justify-center"
				>
					<h1 className="text-xl mb-8">name your first blog</h1>
					<div className="flex items-start mb-16">
						<BlogSlugInput />
						<span className="text-3xl opacity-50">.kepi.blog</span>
					</div>
					<Button
						type="submit"
						containerClassName="absolute bottom-0 right-0 w-20 mb-10 self-end"
					>
						Next
					</Button>
				</Form>
			</main>
		</div>
	)
}

function BlogSlugInput() {
	const [inputValue, setInputValue] = useState("")
	const inputRef = useRef<HTMLInputElement | null>(null)

	useEffect(() => {
		if (inputRef.current) {
			inputRef.current.focus()
		}
	}, [])

	return (
		<div className="relative min-w-[1em] w-min">
			{inputValue ? (
				<span className="invisible whitespace-pre text-3xl">{inputValue}</span>
			) : null}
			<input
				ref={inputRef}
				name="blogSlug"
				className="absolute left-0 w-full bg-zinc-200 dark:bg-zinc-900 focus:outline-none text-3xl"
				type="text"
				value={inputValue}
				onChange={(event) => {
					setInputValue(event.currentTarget.value)
				}}
			/>
		</div>
	)
}

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const headers = new Headers()
	const accessToken = await authenticate(request, session, headers)

	const formData = await request.formData()
	const newBlogSlug = formData.get("blogSlug")

	try {
		const createdBlog = await fetchApi<Blog>(`/blogs/${newBlogSlug}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
		return redirect(`/blogs/${createdBlog.slug}`, { headers })
	} catch (error) {
		if (error === ApiError.Unauthorized) {
			redirectToLoginPage()
		} else {
			throw data({ error: ApiError.Internal }, { status: 500 })
		}
	}
}
