import type { Argon2BrowserHashResult } from "argon2-browser"
import argon2 from "argon2-browser/dist/argon2-bundled.min.js"
import _sodium from "libsodium-wrappers-sumo"
import {
	type CheckedPromise,
	type InternalError,
	asInternalError,
	promiseOrThrow,
	tryOrThrow,
} from "~/errors"

const MASTER_KEY_BYTE_LENGTH = 32
const STRETCHED_MASTER_KEY_BYTE_LENGTH = 64
const IV_BYTE_LENGTH = 24
const AUTH_TAG_BYTE_LENGTH = 16
const ARGON2_ITER_COUNT = 3
const ARGON2_MEM_COST_KB = 65535

type EncryptedFileMap = Record<string, string>

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

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
		const bytes = await bytesFromBase64(base64)
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
		return _sodium.to_base64(this.fullKey, _sodium.base64_variants.URLSAFE)
	}
}

interface CryptInfo {
	masterKeySalt: Uint8Array
	masterPasswordHash: Uint8Array
	symmetricKey: SymmetricKey
	protectedSymmetricKey: RawCipher
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

function base64EncodedCipherFromJson(json: string): Base64EncodedCipher | null {
	const cipher: unknown = JSON.parse(json)
	if (
		typeof cipher === "object" &&
		cipher &&
		"text" in cipher &&
		"authTag" in cipher &&
		"iv" in cipher &&
		typeof cipher.text === "string" &&
		typeof cipher.authTag === "string" &&
		typeof cipher.iv === "string"
	) {
		return cipher as Base64EncodedCipher
	}
	return null
}

async function deriveInitialKeys(
	salt: string | null,
	password: string,
): CheckedPromise<CryptInfo, InternalError> {
	await _sodium.ready
	const sodium = _sodium

	const textEncoder = new TextEncoder()

	const masterKeySalt = salt
		? textEncoder.encode(salt)
		: crypto.getRandomValues(
				new Uint8Array(sodium.crypto_pwhash_argon2id_SALTBYTES),
			)
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

		const { ciphertext, mac: authTag } =
			sodium.crypto_aead_xchacha20poly1305_ietf_encrypt_detached(
				symmetricKey.fullKey,
				"",
				null,
				iv,
				stretchedMasterKey.encryptionKey,
				"uint8array",
			)

		return {
			masterKeySalt,
			masterPasswordHash: masterPasswordHash.hash,
			symmetricKey,
			protectedSymmetricKey: {
				authTag,
				iv,
				text: ciphertext,
			},
		}
	} catch (e) {
		throw asInternalError(e)
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
		throw asInternalError(e)
	}
}

async function deriveMasterKey(
	salt: string | Uint8Array,
	password: string,
): CheckedPromise<Argon2BrowserHashResult, InternalError> {
	const masterKeySalt =
		typeof salt === "string" ? new TextEncoder().encode(salt) : salt
	return promiseOrThrow(
		argon2.hash({
			pass: password,
			salt: masterKeySalt,
			type: argon2.ArgonType.Argon2id,
			time: ARGON2_ITER_COUNT,
			mem: ARGON2_MEM_COST_KB,
			hashLen: MASTER_KEY_BYTE_LENGTH,
		}),
		asInternalError,
	)
}

async function deriveStretchedMasterKey(
	masterKeyBytes: Uint8Array,
): CheckedPromise<SymmetricKey, InternalError> {
	const ikm = await promiseOrThrow(
		crypto.subtle.importKey("raw", masterKeyBytes, { name: "HKDF" }, false, [
			"deriveBits",
		]),
		asInternalError,
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
		asInternalError,
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
					reject(
						new Error(
							`FileReader returned an unexpected result: ${fileReader.result}`,
						),
					)
				}
			}
			fileReader.readAsArrayBuffer(file)
		}),
		asInternalError,
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
		asInternalError,
	)

	return { text: box.ciphertext, authTag: box.mac, iv }
}

async function encryptToBase64String(
	content: string | Uint8Array,
	symmetricKey: SymmetricKey,
): CheckedPromise<string, InternalError> {
	await _sodium.ready
	const sodium = _sodium
	const rawCipher = await encryptToRaw(content, symmetricKey)
	const bytes = uint8ArrayFromRawCipher(rawCipher)
	return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL)
}

async function decrypt(
	cipher: Base64EncodedCipher,
	key: SymmetricKey,
): CheckedPromise<Uint8Array, InternalError> {
	await _sodium.ready
	const sodium = _sodium

	const authTagBytes = await bytesFromBase64(cipher.authTag)
	const ivBytes = await bytesFromBase64(cipher.iv)
	const cipherBytes = await bytesFromBase64(cipher.text)

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
		asInternalError,
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
		asInternalError,
	)
}

function saveSymmetricKeyInSessionStorage(symmetricKey: SymmetricKey) {
	sessionStorage.setItem("symmetricKey", symmetricKey.toString())
}

function rawCipherFromUint8Array(array: Uint8Array): RawCipher {
	return {
		authTag: array.subarray(0, AUTH_TAG_BYTE_LENGTH),
		iv: array.subarray(
			AUTH_TAG_BYTE_LENGTH,
			AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH,
		),
		text: array.subarray(AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH),
	}
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

function uint8ArrayFromRawCipher(cipher: RawCipher): Uint8Array {
	const array = new Uint8Array(
		cipher.authTag.length + cipher.iv.length + cipher.text.length,
	)
	array.set(cipher.authTag, 0)
	array.set(cipher.iv, AUTH_TAG_BYTE_LENGTH)
	array.set(cipher.text, AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH)
	return array
}

async function rawCipherFromBase64String(base64: string): Promise<RawCipher> {
	const bytes = await bytesFromBase64(base64)
	return {
		authTag: bytes.subarray(0, AUTH_TAG_BYTE_LENGTH),
		iv: bytes.subarray(
			AUTH_TAG_BYTE_LENGTH,
			AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH,
		),
		text: bytes.subarray(AUTH_TAG_BYTE_LENGTH + IV_BYTE_LENGTH),
	}
}

async function rawCipherFromBase64Cipher(
	cipher: Base64EncodedCipher,
): Promise<RawCipher> {
	return {
		text: await bytesFromBase64(cipher.text),
		authTag: await bytesFromBase64(cipher.authTag),
		iv: await bytesFromBase64(cipher.iv),
	}
}

async function base64FromRawCipher(
	cipher: RawCipher,
): Promise<Base64EncodedCipher> {
	return {
		text: await base64StringFromBytes(cipher.text),
		authTag: await base64StringFromBytes(cipher.authTag),
		iv: await base64StringFromBytes(cipher.iv),
	}
}

async function bytesFromBase64(base64: string): Promise<Uint8Array> {
	await _sodium.ready
	const sodium = _sodium
	return sodium.from_base64(base64, sodium.base64_variants.URLSAFE)
}

async function base64StringFromBytes(bytes: Uint8Array) {
	await _sodium.ready
	const sodium = _sodium
	return sodium.to_base64(bytes, sodium.base64_variants.URLSAFE)
}

function bytesFromString(s: string): Uint8Array {
	return textEncoder.encode(s)
}

function stringFromBytes(bytes: Uint8Array): string {
	return textDecoder.decode(bytes)
}

export {
	IV_BYTE_LENGTH,
	AUTH_TAG_BYTE_LENGTH,
	SymmetricKey,
	base64EncodedCipherFromJson,
	deriveInitialKeys,
	deriveMasterKey,
	saveSymmetricKeyInSessionStorage,
	hashMasterPassword,
	deriveStretchedMasterKey,
	encryptToRaw,
	encryptToBase64String,
	encryptFile,
	decrypt,
	decryptRaw,
	rawCipherFromArrayBuffer,
	uint8ArrayFromRawCipher,
	rawCipherFromBase64String,
	rawCipherFromBase64Cipher,
	rawCipherFromUint8Array,
	base64FromRawCipher,
	base64StringFromBytes,
	bytesFromBase64,
	bytesFromString,
	stringFromBytes,
}
export type {
	CryptInfo,
	RawCipher,
	Base64EncodedCipher,
	HashResult,
	EncryptedFileMap,
}
