import {
	type DetailedHTMLProps,
	type ImgHTMLAttributes,
	useEffect,
	useState,
} from "react"

interface MarkdownImagePreviewProps
	extends DetailedHTMLProps<
		ImgHTMLAttributes<HTMLImageElement>,
		HTMLImageElement
	> {
	fileLoader: (src: string) => Promise<Blob | null>
}

function MarkdownImagePreview({
	fileLoader,
	...props
}: MarkdownImagePreviewProps) {
	const [url, setUrl] = useState<string | null>(null)

	useEffect(() => {
		async function loadImage() {
			if (props.src) {
				try {
					const blob = await fileLoader(props.src)
					if (blob) {
						setUrl(URL.createObjectURL(blob))
					}
				} catch (error) {
					console.error(
						`MarkdownImagePreview failed to load image ${props.src}`,
						error,
					)
				}
			}

			// const key = await keyStore.getKey()
			// try {
			// 	const res = await clientFetchRaw(
			// 		`/blogs/${params.blogSlug}/${props.src}`,
			// 	)
			//
			// 	const mimeTypeBase64 = res.headers.get("Content-Type-Cipher")
			// 	if (!mimeTypeBase64) {
			// 		throw applicationError({
			// 			error: ERROR_TYPE.internal,
			// 			cause: new Error("missing Content-Type-Cipher header"),
			// 		})
			// 	}
			//
			// 	const buf = await res.arrayBuffer()
			// 	const fileCipher = rawCipherFromArrayBuffer(buf)
			// 	const mimeTypeCipher = await rawCipherFromBase64(mimeTypeBase64)
			//
			// 	const mimeTypeBytes = await decryptRaw(mimeTypeCipher, key)
			// 	const mimeType = new TextDecoder().decode(mimeTypeBytes)
			// 	const fileBytes = await decryptRaw(fileCipher, key)
			//
			// 	const url = URL.createObjectURL(
			// 		new Blob([fileBytes.buffer], { type: mimeType }),
			// 	)
			//
			// 	setUrl(url)
			// } catch (err) {
			// 	console.error(err)
			// }
		}
		loadImage()
	}, [props.src, fileLoader])

	if (!url) {
		const { src, ...rest } = props
		// biome-ignore lint/a11y/useAltText: <explanation>
		return <img {...rest} />
	}

	// biome-ignore lint/a11y/useAltText: <explanation>
	return <img {...props} src={url} />
}

export { MarkdownImagePreview }
