import type { Blog } from "~/blog/blog"
import {
	type SymmetricKey,
	decryptRaw,
	rawCipherFromArrayBuffer,
	rawCipherFromBase64,
} from "~/crypt"
import { type CheckedPromise, InternalError, promiseOrThrow } from "~/errors"

class BlogNotFoundError extends Error {
	constructor(public readonly blog: Blog) {
		super(`Blog not found: ${blog.slug}`)
	}
}

class BlogFileNotFoundError extends Error {
	constructor(
		public readonly blog: Blog,
		public readonly fileId: string,
	) {
		super(`File ${fileId} not found in blog ${blog.slug}`)
	}
}

class FileDecryptionError extends Error {
	constructor(
		public readonly blog: Blog,
		public readonly fileId: string,
		public readonly cause: unknown,
	) {
		super(`Failed to decrypt file ${fileId} in blog ${blog.slug}`)
	}
}

async function decryptBlogFiles(
	blog: Blog,
	key: SymmetricKey,
): CheckedPromise<File[], BlogNotFoundError | InternalError> {
	const res = await fetch(`/blogs/${blog.slug}/files`)
	if (res.status !== 200) {
		switch (res.status) {
			case 404:
				throw new BlogNotFoundError(blog)
			default:
				throw new InternalError(
					`failed to fetch blog files: server returned ${res.status}`,
				)
		}
	}

	const fileIds: { fileId: string }[] = await promiseOrThrow(
		res.json(),
		(_) =>
			new InternalError(
				"failed to fetch blog files because server returned an unexpected response.",
			),
	)

	return promiseOrThrow(
		Promise.all(
			fileIds.map(({ fileId }) =>
				downloadAndDecryptBlogFile(blog, fileId, key),
			),
		),
	)
}

async function downloadAndDecryptBlogFile(
	blog: Blog,
	fileId: string,
	key: SymmetricKey,
): Promise<CheckedPromise<File, BlogFileNotFoundError | InternalError>> {
	const res = await fetch(`/blogs/${blog.slug}/files/${fileId}`)
	if (res.status !== 200) {
		switch (res.status) {
			case 404:
				throw new BlogFileNotFoundError(blog, fileId)
			default:
				throw new InternalError(
					`failed to download file ${fileId} in blog ${blog.slug} because server returned: ${res.status}`,
				)
		}
	}

	const contentTypeCipher = res.headers.get("Content-Type-Cipher")
	if (!contentTypeCipher) {
		throw new InternalError(
			`failed to download file ${fileId} in blog ${blog.slug} because server did not return mime type`,
		)
	}

	const content = await promiseOrThrow(
		res.arrayBuffer(),
		() =>
			new InternalError(
				`failed to download file ${fileId} in blog ${blog.slug} because server returned an unexpected response`,
			),
	)

	const mimeType = await promiseOrThrow(
		decryptRaw(await rawCipherFromBase64(contentTypeCipher), key),
		(e) => new FileDecryptionError(blog, fileId, e),
	)

	const decrypted = await promiseOrThrow(
		decryptRaw(rawCipherFromArrayBuffer(content), key),
		(e) => new FileDecryptionError(blog, fileId, e),
	)

	return new File([decrypted.buffer], fileId, {
		type: new TextDecoder().decode(mimeType),
	})
}

export {
	FileDecryptionError,
	BlogNotFoundError,
	BlogFileNotFoundError,
	decryptBlogFiles,
}
