import type { Base64EncodedCipher } from "~/crypt"

interface BlogPost {
	title: string
	description: string
	slug: string
	publishDate: string
	contentCipher?: Base64EncodedCipher
}

export type { BlogPost }
