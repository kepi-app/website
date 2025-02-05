import clsx from "clsx"
import { atom, getDefaultStore, useAtom } from "jotai"
import type React from "react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { memo } from "react"
import type { PropsWithChildren } from "react"
import toast from "react-hot-toast"
import { Form, useLoaderData } from "react-router"
import { Anchor } from "~/components/anchor"
import { Button } from "~/components/button"
import { Logo } from "~/components/logo"
import { SmallButton } from "~/components/small-button"
import {
	ERROR_TYPE,
	displayInternalErrorToast,
	isApplicationError,
} from "~/errors"
import {
	type NotebookMetadata,
	createNotebook,
	findAllNotebooks,
} from "~/vault/notebook"
import type { Route } from "./+types/notebooks._index"

const currentHoverIndex = atom(-1)
const isNewNotebookFormOpenAtom = atom(false)

export async function clientLoader(_: Route.ClientLoaderArgs) {
	return findAllNotebooks()
}

const Page = memo(({ children }: PropsWithChildren) => {
	return (
		<PageContainer>
			<LogoHeader />
			<div className="w-full max-w-prose mb-12 flex flex-row items-start justify-between">
				<PageTitle />
				<NewNotebookButton />
			</div>
			{children}
		</PageContainer>
	)
})

export default function AllNotebooksPage() {
	return (
		<Page>
			<NewNotebookForm />
			<NotebookList />
		</Page>
	)
}

export function HydrateCallback() {
	return (
		<Page>
			<p className="animate-pulse">Loading your notebooks</p>
		</Page>
	)
}

function PageContainer({ children }: PropsWithChildren) {
	const [isNewNotebookFormOpen] = useAtom(isNewNotebookFormOpenAtom)
	return (
		<div className="w-full flex items-center justify-center">
			<main
				className={clsx("w-full mt-28 flex flex-col items-center", {
					"overflow-hidden": isNewNotebookFormOpen,
				})}
			>
				{children}
			</main>
		</div>
	)
}

function LogoHeader() {
	const [isNewNotebookFormOpen] = useAtom(isNewNotebookFormOpenAtom)
	return (
		<div
			className={clsx("w-full max-w-prose transition-all", {
				"blur-sm": isNewNotebookFormOpen,
			})}
		>
			<div className="max-w-prose h-8 w-8 mb-8">
				<Logo />
			</div>
		</div>
	)
}

function PageTitle() {
	const [isNewNotebookFormOpen] = useAtom(isNewNotebookFormOpenAtom)
	return (
		<h1
			className={clsx("text-xl font-semibold", {
				"blur-sm": isNewNotebookFormOpen,
			})}
		>
			Your notebooks
		</h1>
	)
}

function NewNotebookButton() {
	const [isNewNotebookFormOpen, setIsNewNotebookFormOpen] = useAtom(
		isNewNotebookFormOpenAtom,
	)
	return (
		<SmallButton
			onClick={() => {
				setIsNewNotebookFormOpen((open) => !open)
			}}
			className="h-min"
		>
			{isNewNotebookFormOpen ? "Cancel" : "New notebook"}
		</SmallButton>
	)
}

function NotebookList() {
	const notebooks = useLoaderData<typeof clientLoader>()
	const [isNewNotebookFormOpen] = useAtom(isNewNotebookFormOpenAtom)

	return notebooks.length > 0 ? (
		<ul
			className={clsx("w-full max-w-prose", {
				"blur-sm": isNewNotebookFormOpen,
			})}
		>
			{notebooks.map((notebook, i) => (
				<NotebookItem key={notebook.slug} notebook={notebook} index={i} />
			))}
		</ul>
	) : (
		<p className="w-full max-w-prose opacity-80">No notebook found.</p>
	)
}

function NewNotebookFormContainer({ children }: PropsWithChildren) {
	const [isNewNotebookFormOpen] = useAtom(isNewNotebookFormOpenAtom)
	const [shouldRender, setShouldRender] = useState(isNewNotebookFormOpen)
	const containerRef = useRef<HTMLDivElement | null>(null)
	const [targetHeight, setTargetHeight] = useState(0)

	useLayoutEffect(() => {
		if (containerRef.current && !targetHeight && shouldRender) {
			setTargetHeight(containerRef.current.clientHeight)
		}
	}, [shouldRender, targetHeight])

	useEffect(() => {
		let id: ReturnType<typeof setTimeout> | null = null
		if (containerRef.current) {
			const container = containerRef.current
			container.style.height = "0px"
			id = setTimeout(() => {
				container.style.height = `${targetHeight}px`
			}, 100)
		}
		return () => {
			if (id) {
				clearTimeout(id)
			}
		}
	}, [targetHeight])

	useEffect(() => {
		let id: ReturnType<typeof setTimeout> | null = null
		if (!isNewNotebookFormOpen) {
			if (containerRef.current) {
				containerRef.current.style.height = "0px"
			}
			id = setTimeout(() => {
				setShouldRender(false)
				setTargetHeight(0)
			}, 200)
		} else {
			setShouldRender(isNewNotebookFormOpen)
		}

		return () => {
			if (id) {
				clearTimeout(id)
			}
		}
	}, [isNewNotebookFormOpen])

	if (!shouldRender) {
		return null
	}

	return (
		<div
			ref={containerRef}
			className={clsx(
				"flex flex-col items-center w-full bg-zinc-200 dark:bg-zinc-800 shadow-inner transition-all ease-out duration-200 overflow-clip",
				{ absolute: targetHeight <= 0 },
			)}
		>
			{children}
		</div>
	)
}

function NewNotebookForm() {
	const nameInputId = useId()
	const descriptionInputId = useId()
	return (
		<NewNotebookFormContainer>
			<div className="w-full max-w-prose m-8">
				<h2 className="text-xl mb-8">New notebook</h2>
				<Form method="POST">
					<label
						htmlFor={nameInputId}
						className="text-sm opacity-80 dark:opacity-50"
					>
						Notebook name:
					</label>
					<input
						required
						id={nameInputId}
						placeholder="New notebook"
						name="notebookName"
						type="text"
						className="w-full bg-zinc-200 dark:bg-zinc-800 mb-4"
					/>

					<label
						htmlFor={descriptionInputId}
						className="text-sm opacity-80 dark:opacity-50"
					>
						Description:
					</label>
					<input
						id={descriptionInputId}
						name="notebookDescription"
						type="text"
						placeholder="Notes for my math class"
						className="w-full bg-zinc-200 dark:bg-zinc-800 mb-8"
					/>

					<Button type="submit">Create notebook</Button>
				</Form>
			</div>
		</NewNotebookFormContainer>
	)
}

const blurLevels: React.CSSProperties[] = [
	{ filter: "blur(1px)" },
	{ filter: "blur(2px)" },
	{ filter: "blur(3px)" },
] as const

function NotebookItem({
	index,
	notebook,
}: PropsWithChildren<{ index: number; notebook: NotebookMetadata }>) {
	const [hoverIndex, setHoverIndex] = useAtom(currentHoverIndex)

	return (
		<li
			className="w-full py-1 cursor-pointer transition-all duration-75"
			onMouseEnter={() => {
				setHoverIndex(index)
			}}
			onMouseLeave={() => {
				setHoverIndex(-1)
			}}
			style={
				index === hoverIndex || hoverIndex === -1
					? undefined
					: blurLevels[Math.min(Math.abs(index - hoverIndex), 3) - 1]
			}
		>
			<NotebookItemContent notebook={notebook} />
		</li>
	)
}

const NotebookItemContent = memo(
	({ notebook }: { notebook: NotebookMetadata }) => (
		<>
			<Anchor
				to={`/notebooks/${notebook.slug}`}
				className="no-underline text-lg w-full"
			>
				{notebook.name}
			</Anchor>
			<p
				className={clsx("text-sm opacity-50", {
					italic: !notebook.description,
				})}
			>
				{notebook.description || "No description"}
			</p>
		</>
	),
)

export async function clientAction({ request }: Route.ClientActionArgs) {
	const form = await request.formData()
	const notebookName = form.get("notebookName")
	if (!notebookName || typeof notebookName !== "string") {
		toast.error("Please provide a name for the new notebook!")
		return
	}

	const stripped = notebookName.trim()
	if (!stripped) {
		toast.error("Please provide a name for the new notebook!")
		return
	}

	let notebookDescription = form.get("notebookDescription")
	if (typeof notebookDescription !== "string") {
		notebookDescription = null
	}
	notebookDescription = notebookDescription || ""

	try {
		await createNotebook({
			name: notebookName,
			description: notebookDescription,
		})
		getDefaultStore().set(isNewNotebookFormOpenAtom, () => false)
		toast.success("Notebook created!")
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
