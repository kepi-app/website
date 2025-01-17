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

export type { BlogPost, NonEmptyBlogPost }
