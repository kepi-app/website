import clsx from "clsx"
import { atom, getDefaultStore, useAtom } from "jotai"
import type React from "react"
import type { DetailedHTMLProps, InputHTMLAttributes } from "react"
import { useId, useState } from "react"
import { memo } from "react"
import type { PropsWithChildren } from "react"
import toast from "react-hot-toast"
import { Form, useLoaderData } from "react-router"
import { Anchor } from "~/components/anchor"
import { Button } from "~/components/button"
import { Logo } from "~/components/logo"
import { SmallButton } from "~/components/small-button"
import { type CryptInfo, base64FromRawCipher, deriveInitialKeys } from "~/crypt"
import {
	ERROR_TYPE,
	displayInternalErrorToast,
	isApplicationError,
} from "~/errors"
import {
	type CreateNotebookOptions,
	type NotebookMetadata,
	createNotebook,
	findAllNotebooks,
} from "~/vault/notebook"
import type { Route } from "./+types/notebooks._index"

const currentHoverIndex = atom(-1)
const isNewNotebookFormOpenAtom = atom(true)

export async function clientLoader(_: Route.ClientLoaderArgs) {
	return await findAllNotebooks()
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
		<p
			className={clsx("w-full max-w-prose opacity-80", {
				"blur-sm": isNewNotebookFormOpen,
			})}
		>
			No notebook found.
		</p>
	)
}

function NewNotebookFormContainer({ children }: PropsWithChildren) {
	const [isNewNotebookFormOpen] = useAtom(isNewNotebookFormOpenAtom)
	return (
		<div
			className={clsx(
				"grid w-full bg-zinc-300 dark:bg-zinc-800 shadow-inner transition-[grid-template-rows] ease-out duration-200 overflow-clip",
				isNewNotebookFormOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
			)}
		>
			<div className="flex flex-col items-center overflow-hidden">
				{children}
			</div>
		</div>
	)
}

function NewNotebookForm() {
	return (
		<NewNotebookFormContainer>
			<div className="w-full max-w-prose m-8">
				<h2 className="text-xl mb-8">New notebook</h2>
				<Form method="POST">
					<NewNotebookFormField
						type="text"
						name="notebookName"
						label="Notebook name:"
						placeholder="New notebook"
					/>
					<NewNotebookFormField
						type="text"
						name="notebookDescription"
						label="Description:"
						placeholder="Notes for my math class"
					/>

					<hr className="border-zinc-400 dark:border-zinc-700 mb-4" />

					<NewNotebookFormEncryptSection />

					<Button type="submit" containerClassName="mt-4">
						Create notebook
					</Button>
				</Form>
			</div>
		</NewNotebookFormContainer>
	)
}

function NewNotebookFormEncryptSection() {
	const [isPasswordInputVisible, setIsPasswordInputVisible] = useState(false)
	const encryptCheckboxId = useId()

	return (
		<>
			<div className="flex flex-row items-center mb-4 space-x-2">
				<input
					id={encryptCheckboxId}
					name="isEncryptionEnabled"
					type="checkbox"
					value="encrypt"
					checked={isPasswordInputVisible}
					onChange={(event) => {
						setIsPasswordInputVisible(event.currentTarget.checked)
					}}
				/>
				<label htmlFor={encryptCheckboxId} className="text-sm opacity-80">
					Encrypt notebook
				</label>
			</div>

			{isPasswordInputVisible && (
				<>
					<NewNotebookFormField
						type="password"
						name="encryptionPassword"
						label="Password"
					/>
					<NewNotebookFormField
						type="password"
						name="repeatedPassword"
						label="Repeat password"
					/>
				</>
			)}
		</>
	)
}

function NewNotebookFormField({
	label,
	...inputProps
}: DetailedHTMLProps<
	InputHTMLAttributes<HTMLInputElement>,
	HTMLInputElement
> & { label: string }) {
	const id = useId()
	return (
		<>
			<label htmlFor={id} className="text-sm opacity-80">
				{label}
			</label>
			<input
				id={id}
				className="w-full bg-zinc-300 dark:bg-zinc-800 mb-4 placeholder:opacity-50"
				{...inputProps}
			/>
		</>
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

	let initialKeys: CryptInfo | null = null
	const isEncryptionEnabled = form.get("isEncryptionEnabled") === "encrypt"
	const password = form.get("encryptionPassword")
	const repeatedPassword = form.get("repeatedPassword")
	if (isEncryptionEnabled) {
		if (
			!password ||
			typeof password !== "string" ||
			!repeatedPassword ||
			typeof repeatedPassword !== "string"
		) {
			toast.error("Please provide a password for the new notebook!")
			return
		}

		const strippedPassword = password.trim()
		if (!strippedPassword) {
			toast.error("Please provide a password for the new notebook!")
			return
		}

		if (password !== repeatedPassword) {
			toast.error("Repeated password does not match.")
			return
		}

		initialKeys = await deriveInitialKeys(null, password)
	}

	let notebookDescription = form.get("notebookDescription")
	if (typeof notebookDescription !== "string") {
		notebookDescription = null
	}
	notebookDescription = notebookDescription || ""

	const createConfig: CreateNotebookOptions = initialKeys
		? {
				name: notebookName,
				description: notebookDescription,
				key: initialKeys.symmetricKey,
				masterKeySalt: initialKeys.masterKeySalt,
				protectedSymmetricKey: await base64FromRawCipher(
					initialKeys.protectedSymmetricKey,
				),
			}
		: {
				name: notebookName,
				description: notebookDescription,
				key: null,
				masterKeySalt: null,
				protectedSymmetricKey: null,
			}

	try {
		await createNotebook(createConfig)
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
