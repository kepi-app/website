import React, { memo, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { Form, redirect, useLoaderData } from "react-router"
import { Button } from "~/components/button"
import { Logo } from "~/components/logo"
import {
	ERROR_TYPE,
	displayInternalErrorToast,
	isApplicationError,
} from "~/errors"
import { isLocalFileSystemAvailable } from "~/file-system"
import { createNotebook, isValidNotebookName } from "~/vault"
import type { Route } from "./+types/notebooks.new"

export async function clientLoader(_: Route.ClientLoaderArgs) {
	return isLocalFileSystemAvailable()
}

export function HydrateFallback() {
	return (
		<div className="w-full h-screen flex justify-center">
			<main className="w-full h-full max-w-prose flex flex-col justify-center items-start">
				<div className="h-8 w-8 mb-8">
					<Logo />
				</div>
				<p className="animate-pulse">Checking browser environment</p>
			</main>
		</div>
	)
}

const NewNotebookPage = memo(() => (
	<div className="w-full h-screen flex justify-center">
		<main className="w-full h-full max-w-prose flex flex-col justify-center items-start">
			<div className="h-8 w-8 mb-8">
				<Logo />
			</div>
			<Form
				method="POST"
				className="w-full relative flex flex-col justify-center"
			>
				<h1 className="text-xl opacity-80">Name your notebook</h1>
				<LocalFilesystemUnsupportedMessage />
				<NotebookNameInput />
				<Button type="submit">Next</Button>
			</Form>
		</main>
	</div>
))
export default NewNotebookPage

function LocalFilesystemUnsupportedMessage() {
	const isLocalFileSystemAvailable = useLoaderData<typeof clientLoader>()
	return isLocalFileSystemAvailable ? null : (
		<p className="text-sm text-amber-200 opacity-80">
			Your browser does not support local file storage. Your notebooks will only
			be available online.
		</p>
	)
}

function NotebookNameInput() {
	const [inputValue, setInputValue] = useState("")
	const inputRef = useRef<HTMLInputElement | null>(null)

	useEffect(() => {
		if (inputRef.current) {
			inputRef.current.focus()
		}
	}, [])

	return (
		<input
			ref={inputRef}
			name="notebookName"
			className="bg-zinc-100 dark:bg-zinc-900 focus:outline-none text-3xl mb-12 mt-8"
			type="text"
			value={inputValue}
			onChange={(event) => {
				setInputValue(event.currentTarget.value)
			}}
		/>
	)
}

export async function clientAction({ request }: Route.ClientLoaderArgs) {
	const form = await request.formData()
	const notebookName = form.get("notebookName")
	if (!notebookName || typeof notebookName !== "string") {
		toast.error("Please provide a name for the new notebook!")
		return
	}

	if (!isValidNotebookName(notebookName)) {
		toast.error("Notebook name must not contain punctuations except -")
		return
	}

	try {
		await createNotebook({
			name: notebookName,
			description: null,
		})
		return redirect("/notebooks")
	} catch (error) {
		if (isApplicationError(error, ERROR_TYPE.conflict)) {
			toast.error(
				`The name ${error.conflictingValue} is already used by another notebook.`,
			)
		} else {
			displayInternalErrorToast(error)
		}
	}
}
