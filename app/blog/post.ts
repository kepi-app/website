import dayjs from "dayjs"
import yaml from "js-yaml"
import { tryOr } from "~/errors"

interface BlogPost {
	title: string
	description: string
	slug: string
	creationDate: string
	publishDate: string
	content?: string
}

interface NonEmptyBlogPost extends BlogPost {
	content: string
}

interface BlogPostFrontmatter {
	slug: string
	"publish date": string
	"hero image"?: string
}

const FRONTMATTER_REGEX = /(?<=^---\n)[\s\S]*(?=\n---)/

function parseBlogPostFrontmatter(
	blogPostContent: string,
):
	| { ok: true; frontmatter: BlogPostFrontmatter }
	| { ok: false; issues: string[] } {
	const parsed = FRONTMATTER_REGEX.exec(blogPostContent)
	if (!parsed || parsed.length <= 0) {
		return { ok: false, issues: ["Post meta missing!"] }
	}

	const data = tryOr(
		() => yaml.load(parsed[0]),
		() => null,
	)
	if (!(typeof data === "object" && data !== null)) {
		return { ok: false, issues: ["Invalid post metadata!"] }
	}

	const issues = []

	if (!("slug" in data && typeof data.slug === "string")) {
		issues.push("Slug for this post is not specified.")
	}
	if ("publish date" in data) {
		if (
			typeof data["publish date"] !== "string" ||
			!dayjs(data["publish date"]).isValid()
		) {
			issues.push("Invalid publish date!")
		}
	} else {
		issues.push("Missing publish date for this post.")
	}
	if ("hero image" in data && typeof data["hero image"] === "string") {
		issues.push("Invalid hero image specified.")
	}

	if (issues.length > 0) {
		return { ok: false, issues }
	}

	return { ok: true, frontmatter: data as BlogPostFrontmatter }
}

export { parseBlogPostFrontmatter }
export type { BlogPost, NonEmptyBlogPost, BlogPostFrontmatter }
