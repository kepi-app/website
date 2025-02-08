import clsx from "clsx"
import { Plus } from "lucide-react"
import { Fragment, useMemo, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { useClickOutsideDetector } from "~/hooks/use-click-outside-detector"
import { useNoteEditorStore } from "~/notebook/note-store"
import { useNotebookStore } from "~/notebook/notebook-store"
import type { NotebookSection } from "~/vault/notebook"

function SectionColumn({
	items,
	selectedSection,
	onAddSection,
	onSelect,
}: {
	items: string[]
	selectedSection: string
	onSelect: (section: string) => void
	onAddSection: (section: string) => void
}) {
	const [isAddingSection, setIsAddingSection] = useState(false)
	const inputRef = useRef<HTMLInputElement | null>(null)

	function addNewSection() {
		if (inputRef.current?.value) {
			setIsAddingSection(false)
			onAddSection(inputRef.current.value)
		}
	}

	return (
		<ul className="py-2 px-2 border-r w-36 border-r-zinc-500 dark:border-r-zinc-700">
			{items.map((title) => (
				<li
					key={title}
					className={clsx(
						"text-sm px-2 py-0.5 rounded flex flex-row items-center",
						{
							"bg-zinc-900 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-900":
								selectedSection === title,
							"hover:bg-zinc-600": selectedSection !== title,
						},
					)}
				>
					<button
						type="button"
						className="w-full text-start"
						onClick={() => onSelect(title)}
					>
						{title}
					</button>
				</li>
			))}
			{isAddingSection ? (
				<input
					ref={inputRef}
					className="w-full px-2 py-0.5 bg-transparent text-sm"
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							addNewSection()
						}
					}}
				/>
			) : null}
			<button
				type="button"
				className="opacity-80 text-sm text-nowrap w-full px-2 py-0.5 hover:bg-zinc-600 rounded flex flex-row items-center select-none"
				onClick={() => {
					setIsAddingSection(true)
				}}
			>
				<span>Add section</span>
				<Plus className="ml-2 h-3 w-3" />
			</button>
		</ul>
	)
}

function SectionColumnView() {
	const path = useNoteEditorStore(
		useShallow((state) => state.note.metadata.path),
	)
	const notebookIndex = useNotebookStore((state) => state.notebook.index)
	const changeNotePath = useNoteEditorStore((state) => state.changeNotePath)
	const addSection = useNotebookStore((state) => state.addSection)
	const availableSections = useMemo(() => {
		const pathLength = path.length
		if (pathLength === 0) {
			return [Object.keys(notebookIndex.root.children)]
		}
		let current: NotebookSection = notebookIndex.root
		const sections: string[][] = new Array(pathLength + 1)
		for (let i = 0; i < pathLength; ++i) {
			sections[i] = Object.keys(current.children)
			current = current.children[path[i]]
		}
		sections[pathLength] = Object.keys(current.children)
		return sections
	}, [path, notebookIndex])

	function onAddSection(section: string, index: number) {
		const newPath = path.slice(0, index)
		newPath.push(section)
		addSection(newPath)
	}

	function onSelectSection(section: string, index: number) {
		const newPath = path.slice(0, index)
		newPath.push(section)
		changeNotePath(newPath)
	}

	return (
		<div className="flex flex-row overflow-auto">
			{availableSections.map((items, i) => (
				<SectionColumn
					key={i}
					selectedSection={path[i]}
					items={items}
					onSelect={(section) => {
						onSelectSection(section, i)
					}}
					onAddSection={(section) => {
						onAddSection(section, i)
					}}
				/>
			))}
		</div>
	)
}

function PathButton({
	expanded,
	onClick,
}: { expanded: boolean; onClick: () => void }) {
	const path = useNoteEditorStore(
		useShallow((state) => state.note.metadata.path),
	)
	return (
		<button
			type="button"
			className={clsx(
				"flex flex-row space-x-2 items-center transition-all px-4 py-2 ",
				expanded ? "text-sm" : "text-xs",
			)}
			onClick={() => {
				onClick()
			}}
		>
			{path.length > 0 ? (
				path.map((component) => (
					<Fragment key={component}>
						<span>{component}</span>
						<span>/</span>
					</Fragment>
				))
			) : (
				<span>/</span>
			)}
			{expanded ? null : (
				<span className="opacity-50 text-nowrap">Add section</span>
			)}
		</button>
	)
}

function NotePathSelector() {
	const [isExpanded, setIsExpanded] = useState(false)
	const containerRef = useRef<HTMLDivElement | null>(null)

	useClickOutsideDetector(containerRef, () => {
		setIsExpanded(false)
	})

	return (
		<div
			ref={containerRef}
			className={clsx(
				"flex flex-col rounded-lg -mx-4 transition-all hover:bg-zinc-800",
				{ "bg-zinc-300 dark:bg-zinc-800": isExpanded },
			)}
		>
			<PathButton
				expanded={isExpanded}
				onClick={() => {
					setIsExpanded((expanded) => !expanded)
				}}
			/>
			<div
				className={clsx(
					"grid transition-[grid-template-rows]",
					isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
				)}
			>
				<div className="overflow-hidden">
					<hr className="border-zinc-500 dark:border-zinc-700" />
					<SectionColumnView />
				</div>
			</div>
		</div>
	)
}

export { NotePathSelector }
