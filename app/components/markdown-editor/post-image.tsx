import {
	type DetailedHTMLProps,
	type ImgHTMLAttributes,
	useEffect,
	useState,
} from "react"
import { useParams } from "react-router"
import {
	decryptRaw,
	rawCipherFromArrayBuffer,
	rawCipherFromBase64,
} from "~/crypt"
import { ERROR_TYPE, applicationError } from "~/errors"
import { clientFetchRaw } from "~/fetch-api"
import { useKeyStore } from "~/keystore"

function PostImage(
	props: DetailedHTMLProps<
		ImgHTMLAttributes<HTMLImageElement>,
		HTMLImageElement
	>,
) {
	const keyStore = useKeyStore()
	const params = useParams()
	const [url, setUrl] = useState<string | null>(null)

	useEffect(() => {
		async function decryptImage() {
			const key = await keyStore.getKey()
			try {
				const res = await clientFetchRaw(
					`/blogs/${params.blogSlug}/${props.src}`,
				)

				const mimeTypeBase64 = res.headers.get("Content-Type-Cipher")
				if (!mimeTypeBase64) {
					throw applicationError({
						error: ERROR_TYPE.internal,
						cause: new Error("missing Content-Type-Cipher header"),
					})
				}

				const buf = await res.arrayBuffer()
				const fileCipher = rawCipherFromArrayBuffer(buf)
				const mimeTypeCipher = await rawCipherFromBase64(mimeTypeBase64)

				const mimeTypeBytes = await decryptRaw(mimeTypeCipher, key)
				const mimeType = new TextDecoder().decode(mimeTypeBytes)
				const fileBytes = await decryptRaw(fileCipher, key)

				const url = URL.createObjectURL(
					new Blob([fileBytes.buffer], { type: mimeType }),
				)

				setUrl(url)
			} catch (err) {
				console.error(err)
			}
		}
		decryptImage()
	}, [keyStore.getKey, props.src, params.blogSlug])

	if (!url) {
		const { src, ...rest } = props
		// biome-ignore lint/a11y/useAltText: <explanation>
		return <img {...rest} />
	}

	console.log(url)

	// biome-ignore lint/a11y/useAltText: <explanation>
	return <img {...props} src={url} />
}

export { PostImage }
