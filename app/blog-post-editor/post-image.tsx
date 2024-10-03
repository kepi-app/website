import { useFetcher, useParams } from "@remix-run/react"
import {
	useEffect,
	type DetailedHTMLProps,
	type ImgHTMLAttributes,
} from "react"
import {
	AUTH_TAG_BYTE_LENGTH,
	IV_BYTE_LENGTH,
	decrypt,
	decryptRaw,
	rawCipherFromArrayBuffer,
	rawCipherFromBase64,
} from "~/crypt"
import { useKeyStore } from "~/keystore"

function PostImage(
	props: DetailedHTMLProps<
		ImgHTMLAttributes<HTMLImageElement>,
		HTMLImageElement
	>,
) {
	const keyStore = useKeyStore()
	const params = useParams()

	useEffect(() => {
		async function decryptImage() {
			const key = await keyStore.getKey()
			if (key.isErr()) {
				return
			}

			try {
				const res = await fetch(`${params.postSlug}/${props.src}`)
				if (res.status !== 200) {
					throw new Error("failed to fetch file")
				}

				const mimeTypeBase64 = res.headers.get("X-MimeType")
				if (!mimeTypeBase64) {
					return
				}

				console.log(mimeTypeBase64)

				const buf = await res.arrayBuffer()
				const fileCipher = rawCipherFromArrayBuffer(buf)
				const mimeTypeCipher = await rawCipherFromBase64(mimeTypeBase64)

				const mimeTypeBytes = (
					await decryptRaw(mimeTypeCipher, key.value)
				).unwrap()
				const mimeType = new TextDecoder().decode(mimeTypeBytes)
				const fileBytes = (await decryptRaw(fileCipher, key.value)).unwrap()

				const url = URL.createObjectURL(
					new Blob([fileBytes.buffer], { type: mimeType }),
				)
				console.log(url)
			} catch (err) {
				console.error(err)
			}
		}
		decryptImage()
	}, [keyStore.getKey, props.src, params.postSlug])

	return null
}

export { PostImage }
