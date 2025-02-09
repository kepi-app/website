import clsx from "clsx"
import { atom, useAtom } from "jotai"
import { Check, X } from "lucide-react"
import React, {
	type KeyboardEvent,
	memo,
	type PropsWithChildren,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react"
import { useShallow } from "zustand/react/shallow"
import { useClickOutsideDetector } from "~/hooks/use-click-outside-detector"
import { useNoteEditorStore } from "~/notebook/note-store"
import { useNotebookStore } from "~/notebook/notebook-store"
import type { NotebookSection } from "~/vault/notebook"

const selectedPathComponentAtom = atom(0)
const isExpandedAtom = atom(false)
const hideSectionBrowserAtom = atom(null, (_, set) => {
	set(isExpandedAtom, false)
})

function NotePathSelector() {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const [, hideSectionBrowser] = useAtom(hideSectionBrowserAtom)

	useClickOutsideDetector(containerRef, () => {
		hideSectionBrowser()
	})

	return (
		<div
			ref={containerRef}
			className="flex flex-col rounded-lg -mx-6 transition-all"
		>
			<Path />
			<SectionBrowserContainer>
				<SectionBrowser />
			</SectionBrowserContainer>
		</div>
	)
}

function Path() {
	const path = useNoteEditorStore(
		useShallow((state) => state.note.metadata.path),
	)
	return (
		<ul
			// biome-ignore lint/a11y/useSemanticElements: please shut the fuck up
			role="tablist"
			className="flex flex-row items-center space-x-0.5 transition-all px-4 pt-2 rounded-lg text-xs"
		>
			{path.length > 0 ? (
				path.map((component, i) => (
					<li key={component} className="after:content-['/']">
						<PathComponentButton index={i} component={component} />
					</li>
				))
			) : (
				<span>/</span>
			)}
			<PathComponentButton index={path.length} component="Add section" />
		</ul>
	)
}

function PathComponentButton({
	index,
	component,
}: { index: number; component: string }) {
	const [selectedComponentIndex, setSelectedComponentIndex] = useAtom(
		selectedPathComponentAtom,
	)
	const [isExpanded, setIsExpanded] = useAtom(isExpandedAtom)
	const isSelected = isExpanded && selectedComponentIndex === index

	return (
		<button
			role="tab"
			aria-selected={isSelected}
			aria-controls="section-browser"
			type="button"
			className={clsx(
				"px-2 py-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-all ",
				{
					"rounded-t bg-zinc-300 dark:bg-zinc-800": isSelected,
					"rounded opacity-80": !isSelected,
				},
			)}
			onClick={() => {
				if (isSelected) {
					setIsExpanded(false)
				} else {
					setSelectedComponentIndex(index)
					setIsExpanded(true)
				}
			}}
		>
			{component}
		</button>
	)
}

function SectionBrowserContainer({ children }: PropsWithChildren) {
	const [isExpanded] = useAtom(isExpandedAtom)
	return (
		<div
			className={clsx(
				"grid transition-[grid-template-rows]",
				isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
			)}
		>
			<div className="overflow-hidden">{children}</div>
		</div>
	)
}

function SectionBrowser() {
	const [selectedComponentIndex, setSelectedComponentIndex] = useAtom(
		selectedPathComponentAtom,
	)
	const changeNotePath = useNoteEditorStore((state) => state.changeNotePath)
	const addSection = useNotebookStore((state) => state.addSection)
	const path = useNoteEditorStore(
		useShallow((state) => state.note.metadata.path),
	)
	const notebookIndex = useNotebookStore((state) => state.notebook.index)

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

	function changePath(selectedSection: string) {
		const newPath = path.slice(0, selectedComponentIndex)
		newPath.push(selectedSection)
		changeNotePath(newPath)
		setSelectedComponentIndex(selectedComponentIndex + 1)
	}

	function addNewSection(newSectionName: string) {
		const newPath = path.slice(0, selectedComponentIndex)
		newPath.push(newSectionName)
		addSection(newPath)
	}

	function deselectSection() {
		changeNotePath(path.slice(0, selectedComponentIndex))
	}

	return (
		<div
			id="section-browser"
			className="px-2 py-2 bg-zinc-300 dark:bg-zinc-800 rounded"
		>
			<SectionList
				sections={availableSections[selectedComponentIndex]}
				selectedSection={
					selectedComponentIndex >= path.length
						? null
						: path[selectedComponentIndex]
				}
				onSelectSection={changePath}
				onDeselectSection={deselectSection}
				onNewSection={addNewSection}
			/>
		</div>
	)
}

function SectionList({
	sections,
	selectedSection,
	onSelectSection,
	onDeselectSection,
	onNewSection,
}: {
	sections: string[]
	selectedSection: string | null
	onSelectSection: (section: string) => void
	onDeselectSection: () => void
	onNewSection: (newSectionName: string) => void
}) {
	return (
		<div className="flex flex-col text-sm">
			<ul>
				{sections.map((section) => {
					const isSelected = section === selectedSection
					return (
						<li key={section}>
							<button
								type="button"
								className={clsx("w-full text-start px-2 py-0.5 rounded ", {
									"bg-zinc-700 dark:bg-zinc-200 text-zinc-200 dark:text-zinc-700 hover:bg-zinc-600 hover:dark:bg-zinc-300":
										isSelected,
									"hover:bg-zinc-400 hover:bg-opacity-30 dark:hover:bg-opacity-100 dark:hover:bg-zinc-700":
										!isSelected,
								})}
								onClick={() => {
									if (isSelected) onDeselectSection()
									else onSelectSection(section)
								}}
							>
								{section}
							</button>
						</li>
					)
				})}
			</ul>
			<NewSectionButton onNewSection={onNewSection} />
		</div>
	)
}

const NewSectionInput = memo(
	({
		onOk,
		onCancel,
	}: { onOk: (newSectionName: string) => void; onCancel: () => void }) => {
		const inputRef = useRef<HTMLInputElement | null>(null)

		function submit() {
			if (inputRef.current) {
				onOk(inputRef.current.value)
			}
		}

		function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
			if (event.key === "Enter") {
				submit()
			}
		}

		return (
			<div className="flex flex-row items-center w-full bg-zinc-700 rounded">
				<input
					ref={inputRef}
					// biome-ignore lint/a11y/noAutofocus: <explanation>
					autoFocus
					aria-label="New section name"
					type="text"
					className="bg-transparent px-2 py-0.5 flex-1"
					onKeyDown={onInputKeyDown}
				/>
				<div className="flex flex-row px-2 space-x-2 items-center">
					<button
						type="button"
						aria-label="Create section"
						className="w-4 h-4 rounded-full bg-transparent"
						onClick={submit}
					>
						<Check className="w-4 h-4" />
					</button>
					<button
						type="button"
						aria-label="Cancel creating section"
						className="w-4 h-4 rounded-full bg-transparent"
						onClick={onCancel}
					>
						<X className="w-4 h-4" />
					</button>
				</div>
			</div>
		)
	},
)

function NewSectionButton({
	onNewSection,
}: { onNewSection: (newSectionName: string) => void }) {
	const [isInputVisible, setIsInputVisible] = useState(false)

	const cancelInput = useCallback(() => {
		setIsInputVisible(false)
	}, [])

	const addSection = useCallback(
		(newSectionName: string) => {
			onNewSection(newSectionName)
			setIsInputVisible(false)
		},
		[onNewSection],
	)

	if (isInputVisible) {
		return <NewSectionInput onOk={addSection} onCancel={cancelInput} />
	}

	return (
		<button
			type="button"
			className="w-full text-start px-2 py-0.5 rounded hover:bg-zinc-400 dark:hover:bg-zinc-700 opacity-50"
			onClick={() => {
				setIsInputVisible(true)
			}}
		>
			New section
		</button>
	)
}

export { NotePathSelector }
