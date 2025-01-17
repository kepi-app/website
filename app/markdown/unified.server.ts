import { unified } from "unified"
import {addClassNames, REHYPE_PLUGINS, REMARK_PLUGINS} from "~/markdown/plugins"
import remarkRehype from "remark-rehype"
import remarkParse from "remark-parse";
import rehypeStringify from "rehype-stringify";
import rehypeMinifyWhitespace from "rehype-minify-whitespace";
import rehypeMinifyAttributeWhitespace from "rehype-minify-attribute-whitespace";

const markdownProcessor = unified()
	.use(remarkParse)
	.use(REMARK_PLUGINS)
	.use(remarkRehype)
	.use(REHYPE_PLUGINS)
	.use(rehypeMinifyWhitespace)
	.use(rehypeMinifyAttributeWhitespace)
	.use(rehypeStringify)
	.use(addClassNames, {
		pre: "hljs"
	})

export { markdownProcessor }
