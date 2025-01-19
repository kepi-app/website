import { useParams } from "react-router"
import {
	type DetailedHTMLProps,
	type ImgHTMLAttributes,
	useEffect,
	useState,
} from "react"
import {
	decryptRaw,
	rawCipherFromArrayBuffer,
	rawCipherFromBase64,
} from "~/crypt"
import { InternalError } from "~/errors"
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
				const res = await fetch(`/blogs/${params.blogSlug}/${props.src}`)
				if (res.status !== 200) {
					if (res.status === 404) {
						return
					}
					throw new InternalError(
						`failed to retrieve post image ${props.src} because server returned ${res.status}`,
					)
				}

				const mimeTypeBase64 = res.headers.get("Content-Type-Cipher")
				if (!mimeTypeBase64) {
					throw new InternalError(
						`failed to retrieve post image ${props.src} because server did not return a mime type`,
					)
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
