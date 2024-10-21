import type { Argon2BrowserHashResult } from "argon2-browser"
import argon2 from "argon2-browser/dist/argon2-bundled.min.js"
import _sodium from "libsodium-wrappers-sumo"
import {
	type CheckedPromise,
	InternalError,
	promiseOrThrow,
	tryOrThrow,
} from "~/errors"

const MASTER_KEY_BYTE_LENGTH = 32
const STRETCHED_MASTER_KEY_BYTE_LENGTH = 64
const IV_BYTE_LENGTH = 24
const AUTH_TAG_BYTE_LENGTH = 16
const ARGON2_ITER_COUNT = 3
const ARGON2_MEM_COST_KB = 65535

class SymmetricKey {
	static BYTE_LENGTH = 64

	public readonly fullKey: Uint8Array
	public readonly encryptionKey: Uint8Array
	public readonly macKey: Uint8Array

	static generate(): SymmetricKey {
		const bytes = window.crypto.getRandomValues(
			new Uint8Array(SymmetricKey.BYTE_LENGTH),
		)
		return new SymmetricKey(bytes)
	}

	static async fromBase64(base64: string) {
		await _sodium.ready
		const sodium = _sodium
		const bytes = sodium.from_base64(base64, _sodium.base64_variants.ORIGINAL)
		return new SymmetricKey(bytes)
	}

	constructor(key: Uint8Array) {
		if (key.length !== 64) {
			throw new Error(
				`SymmetricKey requires a 512-bit key but the provided key only has ${key.length} bytes.`,
			)
		}
		this.fullKey = key
		this.encryptionKey = key.subarray(0, 32)
		this.macKey = key.subarray(32)
	}

	toString() {
		return _sodium.to_base64(this.fullKey, _sodium.base64_variants.ORIGINAL)
	}
}

interface CryptInfo {
	masterPasswordHash: Uint8Array
	symmetricKey: SymmetricKey
	protectedSymmetricKey: Uint8Array
	iv: Uint8Array
	authTag: Uint8Array
}

interface HashResult {
	masterKey: Argon2BrowserHashResult
	masterPasswordHash: Argon2BrowserHashResult
}

interface Base64EncodedCipher {
	text: string
	authTag: string
	iv: string
}

interface RawCipher {
	text: Uint8Array
	authTag: Uint8Array
	iv: Uint8Array
}

async function deriveInitialKeys(
	email: string,
	password: string,
): CheckedPromise<CryptInfo, InternalError> {
	await _sodium.ready
	const sodium = _sodium

	const textEncoder = new TextEncoder()

	const masterKeySalt = textEncoder.encode(email)
	const masterPasswordHashSalt = textEncoder.encode(password)

	try {
		const masterKey = await argon2.hash({
			pass: password,
			salt: masterKeySalt,
			type: argon2.ArgonType.Argon2id,
			time: ARGON2_ITER_COUNT,
			mem: ARGON2_MEM_COST_KB,
			hashLen: MASTER_KEY_BYTE_LENGTH,
		})
		const masterPasswordHash = await argon2.hash({
			pass: masterKey.hash,
			salt: masterPasswordHashSalt,
			type: argon2.ArgonType.Argon2id,
			time: ARGON2_ITER_COUNT,
			mem: ARGON2_MEM_COST_KB,
			hashLen: MASTER_KEY_BYTE_LENGTH,
		})

		const ikm = await crypto.subtle.importKey(
			"raw",
			masterKey.hash,
			{ name: "HKDF" },
			false,
			["deriveBits"],
		)
		const stretchedMasterKey = await crypto.subtle
			.deriveBits(
				{
					name: "HKDF",
					hash: "SHA-256",
					salt: new ArrayBuffer(0),
					info: new ArrayBuffer(0),
				},
				ikm,
				STRETCHED_MASTER_KEY_BYTE_LENGTH * 8,
			)
			.then((key) => new SymmetricKey(new Uint8Array(key)))

		const symmetricKey = SymmetricKey.generate()
		const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH))

		const { ciphertext: protectedSymmetricKey, mac: authTag } =
			sodium.crypto_aead_xchacha20poly1305_ietf_encrypt_detached(
				symmetricKey.fullKey,
				"",
				null,
				iv,
				stretchedMasterKey.encryptionKey,
				"uint8array",
			)

		return {
			masterPasswordHash: masterPasswordHash.hash,
			symmetricKey,
			protectedSymmetricKey,
			iv,
			authTag,
		}
	} catch (e) {
		throw new InternalError(e)
	}
}

async function hashMasterPassword(
	email: string,
	password: string,
): CheckedPromise<HashResult, InternalError> {
	const textEncoder = new TextEncoder()
	const masterKeySalt = textEncoder.encode(email)
	const masterPasswordHashSalt = textEncoder.encode(password)

	try {
		const masterKey = await argon2.hash({
			pass: password,
			salt: masterKeySalt,
			type: argon2.ArgonType.Argon2id,
			time: ARGON2_ITER_COUNT,
			mem: ARGON2_MEM_COST_KB,
			hashLen: MASTER_KEY_BYTE_LENGTH,
		})
		const masterPasswordHash = await argon2.hash({
			pass: masterKey.hash,
			salt: masterPasswordHashSalt,
			type: argon2.ArgonType.Argon2id,
			time: ARGON2_ITER_COUNT,
			mem: ARGON2_MEM_COST_KB,
			hashLen: MASTER_KEY_BYTE_LENGTH,
		})

		return { masterKey, masterPasswordHash }
	} catch (e) {
		throw new InternalError(e)
	}
}

async function deriveMasterKey(
	email: string,
	password: string,
): CheckedPromise<Argon2BrowserHashResult, InternalError> {
	const textEncoder = new TextEncoder()
	const masterKeySalt = textEncoder.encode(email)
	return promiseOrThrow(
		argon2.hash({
			pass: password,
			salt: masterKeySalt,
			type: argon2.ArgonType.Argon2id,
			time: ARGON2_ITER_COUNT,
			mem: ARGON2_MEM_COST_KB,
			hashLen: MASTER_KEY_BYTE_LENGTH,
		}),
		(e) => new InternalError(e),
	)
}

async function deriveStretchedMasterKey(
	masterKeyBytes: Uint8Array,
): CheckedPromise<SymmetricKey, InternalError> {
	const ikm = await promiseOrThrow(
		crypto.subtle.importKey("raw", masterKeyBytes, { name: "HKDF" }, false, [
			"deriveBits",
		]),
		(e) => new InternalError(e),
	)
	const stretchedMasterKey = await promiseOrThrow(
		crypto.subtle.deriveBits(
			{
				name: "HKDF",
				hash: "SHA-256",
				salt: new ArrayBuffer(0),
				info: new ArrayBuffer(0),
			},
			ikm,
			STRETCHED_MASTER_KEY_BYTE_LENGTH * 8,
		),
		(e) => new InternalError(e),
	)
	return new SymmetricKey(new Uint8Array(stretchedMasterKey))
}

async function encryptFile(
	file: File,
	key: SymmetricKey,
): CheckedPromise<
	{ fileCipher: RawCipher; mimeTypeCipher: RawCipher },
	InternalError
> {
	const contentBytes = await promiseOrThrow(
		new Promise<Uint8Array>((resolve, reject) => {
			const fileReader = new FileReader()
			fileReader.onloadend = () => {
				if (fileReader.result && typeof fileReader.result !== "string") {
					resolve(new Uint8Array(fileReader.result))
				} else {
					reject(new InternalError())
				}
			}
			fileReader.readAsArrayBuffer(file)
		}),
		(e) => e,
	)

	const [mimeTypeCipher, fileCipher] = await promiseOrThrow(
		Promise.all([
			encryptToRaw(file.type, key),
			encryptToRaw(contentBytes, key),
		]),
	)

	return { fileCipher, mimeTypeCipher }
}

async function encryptToRaw(
	content: string | Uint8Array,
	symmetricKey: SymmetricKey,
): CheckedPromise<RawCipher, InternalError> {
	await _sodium.ready
	const sodium = _sodium

	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH))

	const box = tryOrThrow(
		() =>
			sodium.crypto_aead_xchacha20poly1305_ietf_encrypt_detached(
				content,
				null,
				null,
				iv,
				symmetricKey.encryptionKey,
				"uint8array",
			),
		(e) => new InternalError(e),
	)

	return { text: box.ciphertext, authTag: box.mac, iv }
}

async function decrypt(
	cipher: Base64EncodedCipher,
	key: SymmetricKey,
): CheckedPromise<Uint8Array, InternalError> {
	await _sodium.ready
	const sodium = _sodium

	const authTagBytes = sodium.from_base64(
		cipher.authTag,
		sodium.base64_variants.ORIGINAL,
	)
	const ivBytes = sodium.from_base64(cipher.iv, sodium.base64_variants.ORIGINAL)
	const cipherBytes = sodium.from_base64(
		cipher.text,
		sodium.base64_variants.ORIGINAL,
	)

	return tryOrThrow(
		() =>
			sodium.crypto_aead_xchacha20poly1305_ietf_decrypt_detached(
				null,
				cipherBytes,
				authTagBytes,
				"",
				ivBytes,
				key.encryptionKey,
				"uint8array",
			),
		(e) => new InternalError(e),
	)
}

async function decryptRaw(
	cipher: RawCipher,
	key: SymmetricKey,
): CheckedPromise<Uint8Array, InternalError> {
	await _sodium.ready
	const sodium = _sodium
	return tryOrThrow(
		() =>
			sodium.crypto_aead_xchacha20poly1305_ietf_decrypt_detached(
				null,
				cipher.text,
				cipher.authTag,
				"",
				cipher.iv,
				key.encryptionKey,
				"uint8array",
			),
		(e) => new InternalError(e),
	)
}

function saveSymmetricKeyInSessionStorage(symmetricKey: SymmetricKey) {
	sessionStorage.setItem("symmetricKey", symmetricKey.toString())
}

function rawCipherFromArrayBuffer(buf: ArrayBuffer): RawCipher {
	return {
		authTag: new Uint8Array(buf.slice(0, AUTH_TAG_BYTE_LENGTH)),
		iv: new Uint8Array(
			buf.slice(AUTH_TAG_BYTE_LENGTH, AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH),
		),
		text: new Uint8Array(buf.slice(AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH)),
	}
}

async function rawCipherFromBase64(base64: string): Promise<RawCipher> {
	await _sodium.ready
	const sodium = _sodium
	const bytes = sodium.from_base64(base64, sodium.base64_variants.ORIGINAL)
	return {
		authTag: bytes.subarray(0, AUTH_TAG_BYTE_LENGTH),
		iv: bytes.subarray(
			AUTH_TAG_BYTE_LENGTH,
			AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH,
		),
		text: bytes.subarray(AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH),
	}
}

export {
	IV_BYTE_LENGTH,
	AUTH_TAG_BYTE_LENGTH,
	SymmetricKey,
	deriveInitialKeys,
	deriveMasterKey,
	saveSymmetricKeyInSessionStorage,
	hashMasterPassword,
	deriveStretchedMasterKey,
	encryptToRaw,
	encryptFile,
	decrypt,
	decryptRaw,
	rawCipherFromArrayBuffer,
	rawCipherFromBase64,
}
export type { CryptInfo, Base64EncodedCipher }
