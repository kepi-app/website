import type { Blog } from "~/blog/blog"
import {
	type SymmetricKey,
	decryptRaw,
	rawCipherFromArrayBuffer,
	rawCipherFromBase64,
} from "~/crypt"
import {
	type ApplicationError,
	type CheckedPromise,
	ERROR_TYPE,
	applicationError,
	asInternalError,
	promiseOrThrow,
} from "~/errors"
import { clientFetchRaw } from "~/fetch-api"

async function decryptBlogFiles(
	blog: Blog,
	key: SymmetricKey,
): CheckedPromise<File[], ApplicationError> {
	const res = await clientFetchRaw(`/blogs/${blog.slug}/files`)
	const fileIds: { fileId: string }[] = await promiseOrThrow(
		res.json(),
		asInternalError,
	)
	return promiseOrThrow(
		Promise.all(
			fileIds.map(({ fileId }) =>
				downloadAndDecryptBlogFile(blog, fileId, key),
			),
		),
		asInternalError,
	)
}

async function downloadAndDecryptBlogFile(
	blog: Blog,
	fileId: string,
	key: SymmetricKey,
): Promise<CheckedPromise<File, ApplicationError>> {
	const res = await clientFetchRaw(`/blogs/${blog.slug}/files/${fileId}`)

	const contentTypeCipher = res.headers.get("Content-Type-Cipher")
	if (!contentTypeCipher) {
		throw applicationError({
			error: ERROR_TYPE.internal,
			cause: new Error(
				`failed to download file ${fileId} in blog ${blog.slug} because server did not return mime type`,
			),
		})
	}

	const content = await promiseOrThrow(res.arrayBuffer(), asInternalError)

	const mimeType = await promiseOrThrow(
		decryptRaw(await rawCipherFromBase64(contentTypeCipher), key),
		(e) => applicationError({ error: ERROR_TYPE.decryptionFailed, cause: e }),
	)

	const decrypted = await promiseOrThrow(
		decryptRaw(rawCipherFromArrayBuffer(content), key),
		(e) => applicationError({ error: ERROR_TYPE.decryptionFailed, cause: e }),
	)

	return new File([decrypted.buffer], fileId, {
		type: new TextDecoder().decode(mimeType),
	})
}

export { decryptBlogFiles }
