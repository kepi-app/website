import type { Nodes } from "hast"
import { selectAll } from "hast-util-select"
import rehypeHighlight from "rehype-highlight"
import rehypeKatex from "rehype-katex"
import rehypeSanitize from "rehype-sanitize"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

const REMARK_PLUGINS = [remarkMath, remarkGfm, remarkFrontmatter]
const REHYPE_PLUGINS = [rehypeSanitize, rehypeHighlight, rehypeKatex]

function addClassNames(additions: Record<string, string>) {
	return (node: Nodes) => {
		for (const [selector, className] of Object.entries(additions)) {
			for (const n of selectAll(selector, node)) {
				if (!n.properties.className) {
					n.properties.className = className
				} else {
					n.properties.className += ` ${className}`
				}
			}
		}
	}
}

export { REMARK_PLUGINS, REHYPE_PLUGINS, addClassNames }
