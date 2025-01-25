import rehypeMinifyAttributeWhitespace from "rehype-minify-attribute-whitespace"
import rehypeMinifyWhitespace from "rehype-minify-whitespace"
import rehypeStringify from "rehype-stringify"
import remarkFrontmatter from "remark-frontmatter"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import {
	REHYPE_PLUGINS,
	REMARK_PLUGINS,
	addClassNames,
} from "~/markdown/plugins"

const markdownProcessor = unified()
	.use(remarkParse)
	.use(REMARK_PLUGINS)
	.use(remarkFrontmatter, {
		type: "yaml",
		marker: "-",
	})
	.use(remarkRehype)
	.use(REHYPE_PLUGINS)
	.use(rehypeMinifyWhitespace)
	.use(rehypeMinifyAttributeWhitespace)
	.use(rehypeStringify)
	.use(addClassNames, {
		pre: "hljs",
	})

export { markdownProcessor }
