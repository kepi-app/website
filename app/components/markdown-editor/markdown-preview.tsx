import Markdown from "react-markdown"
import { PostImage } from "~/components/markdown-editor/post-image"
import { REHYPE_PLUGINS, REMARK_PLUGINS } from "~/markdown/plugins"
import { useMarkdownEditorStore } from "./store"

import "katex/dist/katex.min.css"
import "highlightjs/styles/atom-one-dark.css"

function MarkdownPreview() {
	const content = useMarkdownEditorStore((state) => state.content)

	return (
		<article className="prose dark:prose-invert mt-16 mb-40">
			<Markdown
				remarkPlugins={REMARK_PLUGINS}
				rehypePlugins={REHYPE_PLUGINS}
				remarkRehypeOptions={{}}
				components={{
					pre: (props) => <pre {...props} className="hljs" />,
					img: PostImage,
				}}
			>
				{content}
			</Markdown>
		</article>
	)
}

export { MarkdownPreview }
