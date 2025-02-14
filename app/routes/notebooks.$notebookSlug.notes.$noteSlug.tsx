import React, { memo, useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Anchor } from "~/components/anchor"
import { Logo } from "~/components/logo"
import {
	MarkdownEditor,
	type MarkdownEditorRef,
} from "~/components/markdown-editor/markdown-editor"
import {
	type ApplicationError,
	ERROR_TYPE,
	applicationError,
	displayInternalErrorToast,
	isApplicationError,
} from "~/errors"
import { useDebounce } from "~/hooks/use-debounce"
import { NoteEditor } from "~/notebook/note-editor"
import {
	NoteEditorStoreProvider,
	useNoteEditorStore,
	useNoteEditorStoreContext,
} from "~/notebook/note-store"
import {
	useNotebookStore,
	useNotebookStoreContext,
} from "~/notebook/notebook-store"
import { type Note, findNote } from "~/vault/notebook"
import type { Route } from "./+types/notebooks.$notebookSlug.notes.$noteSlug"

type RouteParams = {
	notebookSlug: string
	noteSlug: string
}

const Editor = memo(() => {
	const noteEditorStore = useNoteEditorStoreContext()
	const saveUpdatedNote = useNotebookStore((state) => state.saveUpdatedNote)
	const changeNoteHandle = useNoteEditorStore((state) => state.changeNoteHandle)
	const changeNoteSlug = useNoteEditorStore((state) => state.changeNoteSlug)
	const addFilesToNotebook = useNotebookStore((state) => state.addFiles)
	const clearPendingFiles = useNoteEditorStore(
		(state) => state.clearPendingFiles,
	)
	const insertFilesToEditor = useNoteEditorStore((state) => state.insertFiles)
	const editorRef = useRef<MarkdownEditorRef | null>(null)

	const saveNote = useDebounce(
		useCallback(async () => {
			const note = noteEditorStore.getState().note
			const savedNote = await saveUpdatedNote(note)
			if (savedNote.metadata.slug !== note.metadata.slug) {
				changeNoteSlug(savedNote.metadata.slug)
			}
			if (savedNote.handle !== note.handle) {
				changeNoteHandle(savedNote.handle)
			}
		}, [
			noteEditorStore.getState,
			saveUpdatedNote,
			changeNoteHandle,
			changeNoteSlug,
		]),
		1000,
	)

	const savePendingFiles = useCallback(
		async (pendingFiles: File[]) => {
			if (pendingFiles.length > 0 && editorRef.current) {
				const results = await addFilesToNotebook(pendingFiles)

				const uploadedFiles: string[] = []
				const errors: ApplicationError[] = []
				const len = results.length

				for (let i = 0; i < len; ++i) {
					const result = results[i]
					if (isApplicationError(result)) {
						errors.push(result)
					} else {
						uploadedFiles.push(result.notebookFileName)
					}
				}

				insertFilesToEditor(uploadedFiles, editorRef.current.selectionEnd)
				if (errors.length > 0) {
					displayInternalErrorToast(
						new AggregateError(errors),
						"Editor -> savePendingFiles",
					)
				}

				clearPendingFiles()
			}
		},
		[addFilesToNotebook, insertFilesToEditor, clearPendingFiles],
	)

	useEffect(() => {
		const unsub0 = noteEditorStore.subscribe((state) => state.title, saveNote)
		const unsub1 = noteEditorStore.subscribe((state) => state.content, saveNote)
		const unsub2 = noteEditorStore.subscribe(
			(state) => state.note.metadata.path,
			saveNote,
		)
		return () => {
			unsub0()
			unsub1()
			unsub2()
		}
	}, [noteEditorStore.subscribe, saveNote])

	useEffect(() => {
		const unsub = noteEditorStore.subscribe(
			(state) => state.pendingFiles,
			savePendingFiles,
		)
		return () => {
			unsub()
		}
	}, [noteEditorStore.subscribe, savePendingFiles])

	return (
		<div className="w-full px-16 flex justify-center">
			<main className="w-full mt-24 max-w-prose">
				<NoteEditor ref={editorRef} />
				<MarkdownEditor.Toolbar containerClassName="fixed z-10 px-16 bottom-0 left-0 right-0 ">
					<MarkdownEditor.Toolbar.AttachImageButton />
					<MarkdownEditor.Toolbar.PreviewButton />
				</MarkdownEditor.Toolbar>
			</main>
		</div>
	)
})
Editor.displayName = "Editor"

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	return { noteSlug: params.noteSlug }
}

export function shouldRevalidate() {
	return false
}

const NoteEditorPage = memo(() => {
	const [value, setValue] = useState<ApplicationError | Note | null>(null)
	const notebookStore = useNotebookStoreContext()
	const params = useParams<RouteParams>()

	useEffect(() => {
		if (!value) {
			async function getNote() {
				if (!params.noteSlug) {
					setValue(applicationError({ error: ERROR_TYPE.notFound }))
					return
				}

				const notebook = notebookStore.getState().notebook
				const note = await findNote(notebook, params.noteSlug, {
					key: notebook.key,
				})
				if (note) {
					setValue(note)
				} else {
					setValue(applicationError({ error: ERROR_TYPE.notFound }))
				}
			}

			getNote()
		}
	}, [value, params.noteSlug, notebookStore.getState])

	if (isApplicationError(value)) {
		return <ErrorPage error={value} />
	}

	if (value === null) {
		return (
			<div className="w-full flex items-center justify-center">
				<main className="w-full max-w-prose mt-28">
					<div className="h-8 w-8 mb-8">
						<Logo />
					</div>
					<p className="animate-pulse">Opening note</p>
				</main>
			</div>
		)
	}

	return (
		<NoteEditorStoreProvider note={value}>
			<MainPage />
		</NoteEditorStoreProvider>
	)
})
NoteEditorPage.displayName = "NoteEditorPage"
export default NoteEditorPage

function MainPage() {
	const noteSlug = useNoteEditorStore((state) => state.note.metadata.slug)
	const notebookSlug = useNotebookStore((state) => state.notebook.metadata.slug)
	const navigate = useNavigate()

	useEffect(() => {
		navigate(`/notebooks/${notebookSlug}/notes/${noteSlug}`, { replace: true })
	}, [noteSlug, notebookSlug, navigate])

	return <Editor />
}

function ErrorPage({ error }: { error: unknown }) {
	const params = useParams<RouteParams>()

	if (isApplicationError(error, ERROR_TYPE.notFound)) {
		return (
			<div className="w-full h-screen flex justify-center">
				<main className="w-full h-full max-w-prose flex flex-col justify-center items-start">
					<div className="h-8 w-8 mb-8">
						<Logo />
					</div>
					<h1 className="text-xl mb-12">This note is not in this notebook!</h1>
					<Anchor
						className="text-sm opacity-80 mb-20"
						to={`/notebooks/${params.notebookSlug}`}
					>
						Browse all notes
					</Anchor>
				</main>
			</div>
		)
	}

	return (
		<div className="w-full h-screen flex justify-center">
			<main className="w-full h-full max-w-prose flex flex-col justify-center items-start">
				<div className="h-8 w-8 mb-8">
					<Logo />
				</div>
				<h1 className="text-xl mb-2">An internal error has occurred!</h1>
				<p className="opacity-80 mb-8">
					It is not your fault - please report this issue to me. I will
					investigate the issue as soon as possible.
				</p>
				<p className="text-sm opacity-80 mb-20">
					In the meantime, you can{" "}
					<Anchor
						className="text-sm mb-20"
						to={`/notebooks/${params.notebookSlug}`}
					>
						go back to your notebook
					</Anchor>
					.
				</p>
			</main>
		</div>
	)
}
