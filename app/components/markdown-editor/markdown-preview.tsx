import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { PostImage } from "~/blog-post-editor/post-image"
import "katex/dist/katex.min.css"
import "highlightjs/styles/atom-one-dark.css"
import { useMarkdownEditorStore } from "./store"

function MarkdownPreview() {
	const content = useMarkdownEditorStore((state) => state.content)

	return (
		<article className="prose dark:prose-invert mt-16 mb-40">
			<Markdown
				remarkPlugins={[remarkMath, remarkGfm]}
				rehypePlugins={[rehypeKatex, rehypeHighlight]}
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
