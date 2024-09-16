import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, useFetcher, useLoaderData } from "@remix-run/react";
import clsx from "clsx";
import dayjs from "dayjs";
import { useState, useRef, useEffect } from "react";
import { BlogPost } from "~/blog/post";
import { AutoResizingTextArea } from "~/components/auto-resizing-textarea";
import { Button } from "~/components/button";

interface PostUpdate {
	title?: string;
	description?: string;
	content?: string;
}

export async function loader({ params }: LoaderFunctionArgs) {
	const res = await fetch(
		`${process.env.API_URL}/blog/${params.blogSlug}/post/${params.postSlug}`,
	);
	return json<BlogPost>(await res.json());
}

export default function EditBlogPostPage() {
	const postData = useLoaderData<typeof loader>();
	const fetcher = useFetcher();

	const [postTitle, setPostTitle] = useState(postData.title);
	const [postDescription, setPostDescription] = useState(postData.description);
	const [postContent, setPostContent] = useState(postData.content);
	const postUpdate = useRef<PostUpdate>({});
	const [statusMessage, setStatusMessage] = useState("");

	const [isFocused, setIsFocused] = useState(false);
	const canUnfocus = useRef(false);
	const formRef = useRef<HTMLFormElement | null>(null);
	const unfocusTimeout = useRef<ReturnType<typeof setTimeout>>();
	const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(function unfocusOnMouseMove() {
		function unfocus() {
			if (canUnfocus.current) {
				setIsFocused(false);
			}
		}
		document.addEventListener("mousemove", unfocus);
		return () => {
			document.removeEventListener("mousemove", unfocus);
		};
	}, []);

	useEffect(
		function updateStatusMessage() {
			switch (fetcher.state) {
				case "idle":
					if (statusMessage) {
						setStatusMessage(`Last saved ${dayjs().fromNow()}`);
					}

				case "loading":
					break;

				case "submitting":
					setStatusMessage("Saving…");
					break;
			}
		},
		[fetcher.state],
	);

	useEffect(() => {
		postUpdate.current.title = postTitle;
		autoSaveAfterTimeout();
	}, [postTitle]);

	useEffect(() => {
		postUpdate.current.description = postDescription;
		autoSaveAfterTimeout();
	}, [postDescription]);

	useEffect(() => {
		postUpdate.current.content = postContent;
		autoSaveAfterTimeout();
	}, [postContent]);

	function autoSaveAfterTimeout() {
		if (autoSaveTimeout.current) {
			clearTimeout(autoSaveTimeout.current);
		}
		autoSaveTimeout.current = setTimeout(savePost, 2000);
	}

	function savePost() {
		fetcher.submit(postUpdate.current as Record<string, string>, {
			method: "PATCH",
			encType: "application/json",
		});
		postUpdate.current = {};
		autoSaveTimeout.current = null;
	}

	function onBlogContentInput() {
		if (unfocusTimeout.current) {
			clearTimeout(unfocusTimeout.current);
		}

		setIsFocused(true);
		canUnfocus.current = false;
		unfocusTimeout.current = setTimeout(() => {
			canUnfocus.current = true;
		}, 500);
	}

	return (
		<div className="w-full flex justify-center">
			<main className="w-full mt-40 lg:max-w-prose">
				<div className={clsx("transition-all", { "opacity-0": isFocused })}>
					<AutoResizingTextArea
						name="postTitle"
						className="bg-transparent text-6xl w-full focus:outline-none"
						placeholder="Blog title"
						value={postTitle}
						onChange={(event) => {
							setPostTitle(event.currentTarget.value);
						}}
					/>
					<AutoResizingTextArea
						name="postDescription"
						className="bg-transparent opacity-50 text-xl w-full focus:outline-none"
						placeholder="Blog description"
						value={postDescription}
						onChange={(event) => {
							setPostDescription(event.currentTarget.value);
						}}
					/>
				</div>

				<AutoResizingTextArea
					className="font-mono bg-transparent w-full mt-16 focus:outline-none"
					placeholder="Content goes here..."
					name="postContent"
					onInput={onBlogContentInput}
					value={postContent}
					onChange={(event) => {
						setPostContent(event.currentTarget.value);
					}}
				/>

				<div
					className={clsx(
						"absolute bottom-0 left-0 right-0 border-t border-t-zinc-300 dark:border-t-zinc-800 w-full flex items-center justify-center",
						{ "opacity-0": isFocused },
					)}
				>
					<div className="w-full lg:max-w-prose flex justify-end items-center py-2 space-x-4">
						{statusMessage ? <p className="flex-1">{statusMessage}</p> : null}
						<Button className="px-3 py-1">Save as draft</Button>
						<Button className="px-3 py-1">Publish</Button>
					</div>
				</div>
			</main>
		</div>
	);
}

export async function action({ params, request }: ActionFunctionArgs) {
	const updateJson = await request.json();
	await fetch(
		`${process.env.API_URL}/blog/${params.blogSlug}/post/${params.postSlug}`,
		{
			method: "PATCH",
			body: JSON.stringify(updateJson),
		},
	);
	return json({});
}
