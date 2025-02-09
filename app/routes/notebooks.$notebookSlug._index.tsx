import clsx from "clsx"
import { atom, useAtom } from "jotai"
import { ChevronRight } from "lucide-react"
import React from "react"
import toast from "react-hot-toast"
import { useNavigate } from "react-router"
import { Anchor } from "~/components/anchor"
import { Logo } from "~/components/logo"
import { SmallButton } from "~/components/small-button"
import {
	ERROR_TYPE,
	displayInternalErrorToast,
	isApplicationError,
} from "~/errors"
import { useNotebookStore } from "~/notebook/notebook-store"
import type { NotebookSection } from "~/vault/notebook"

const isAddingNoteAtom = atom(false)

export default function NotebookIndexPage() {
	const root = useNotebookStore((state) => state.notebook.index.root)
	const hasNotes =
		root.notes.length > 0 || Object.keys(root.children).length > 0
	return (
		<div className="w-full flex items-center justify-center">
			<main className="w-full max-w-prose mt-28">
				<LogoHeader />
				<PageHeader />
				<input
					className="bg-zinc-300 dark:bg-zinc-800 rounded border border-zinc-400 dark:border-zinc-700 px-2 py-0.5 w-full mb-4"
					placeholder="Search..."
				/>
				{hasNotes ? (
					<NoteList section={root} indentation={0} />
				) : (
					<p className="opacity-50">
						This notebook is empty. Start adding notes!
					</p>
				)}
			</main>
		</div>
	)
}

function LogoHeader() {
	const [isAddingNote] = useAtom(isAddingNoteAtom)
	return (
		<div
			className={clsx("h-8 w-8 mb-8 transition-all", {
				"animate-loading": isAddingNote,
			})}
		>
			<Logo />
		</div>
	)
}

function PageHeader() {
	const notebookName = useNotebookStore((state) => state.notebook.metadata.name)
	return (
		<div className="flex flex-row justify-between items-start mb-8">
			<h1 className="text-xl font-semibold">{notebookName}</h1>
			<NewNoteButton />
		</div>
	)
}

function NewNoteButton() {
	const [isAddingNote, setIsAddingNote] = useAtom(isAddingNoteAtom)
	const createNewNote = useNotebookStore((state) => state.createNewNote)
	const navigate = useNavigate()

	async function onNewNote() {
		setIsAddingNote(true)
		try {
			const note = await createNewNote()
			navigate(`./notes/${note.slug}`)
		} catch (error) {
			if (isApplicationError(error, ERROR_TYPE.conflict)) {
				toast.error(
					`The title '${error.conflictingValue}' is already used by another note!`,
				)
			} else {
				displayInternalErrorToast(
					error,
					"notebooks.$notebookSlug._index -> PageHeader",
				)
			}
		} finally {
			setIsAddingNote(false)
		}
	}

	return (
		<SmallButton disabled={isAddingNote} className="h-min" onClick={onNewNote}>
			{isAddingNote ? "Creating..." : "New note"}
		</SmallButton>
	)
}

function NoteList({
	section,
	indentation,
}: { section: NotebookSection; indentation: number }) {
	const index = useNotebookStore((state) => state.notebook.index)
	return (
		<ul className={indentation === 0 ? "" : "ml-4"}>
			{Object.values(section.children).map((childSection) => (
				<li key={childSection.title}>
					<details className="rounded [&>summary>svg]:open:rotate-90">
						<summary className="px-2 py-1 rounded cursor-default hover:bg-zinc-300 dark:hover:bg-zinc-800">
							<ChevronRight className="inline w-4 h-4 -translate-x-[4px]" />{" "}
							{childSection.title}
						</summary>
						<NoteList section={childSection} indentation={indentation + 1} />
					</details>
				</li>
			))}
			{section.notes.map((id) => {
				const note = index.entries[index.idMap[id]]
				return (
					<li
						key={id}
						className="px-2 py-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-800 group"
					>
						<Anchor
							to={`./notes/${note.slug}`}
							className="block w-full no-underline group-hover:underline"
						>
							{note.title || <em>Untitled note</em>}
						</Anchor>
					</li>
				)
			})}
		</ul>
	)
}
