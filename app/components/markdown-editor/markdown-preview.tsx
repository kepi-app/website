import Markdown from "react-markdown"
import { MarkdownImagePreview } from "~/components/markdown-editor/markdown-image-preview"
import { REHYPE_PLUGINS, REMARK_PLUGINS } from "~/markdown/plugins"
import { useMarkdownEditorStore } from "./store"

import "katex/dist/katex.min.css"
import "highlightjs/styles/atom-one-dark.css"

interface MarkdownPreviewProps {
	fileLoader: (src: string) => Promise<Blob | null>
}

function MarkdownPreview({ fileLoader }: MarkdownPreviewProps) {
	const content = useMarkdownEditorStore((state) => state.content)

	return (
		<article className="prose dark:prose-invert mt-16 mb-40">
			<Markdown
				remarkPlugins={REMARK_PLUGINS}
				rehypePlugins={REHYPE_PLUGINS}
				remarkRehypeOptions={{}}
				components={{
					pre: (props) => <pre {...props} className="hljs" />,
					img: (props) => (
						<MarkdownImagePreview {...props} fileLoader={fileLoader} />
					),
				}}
			>
				{content}
			</Markdown>
		</article>
	)
}

export { MarkdownPreview }
