import _sodium, { type CryptoBox } from "libsodium-wrappers-sumo"
import argon2 from "argon2-browser/dist/argon2-bundled.min.js"
import type { Argon2BrowserHashResult } from "argon2-browser"
import { err, ok, tryp, trys, type Result } from "trycat"
import { useNavigate, type Link } from "@remix-run/react"
import { useEffect, useRef } from "react"

const MASTER_KEY_BYTE_LENGTH = 32
const STRETCHED_MASTER_KEY_BYTE_LENGTH = 64
const IV_BYTE_LENGTH = 24
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

	static fromBase64(base64: string) {
		const bytes = _sodium.from_base64(base64, _sodium.base64_variants.ORIGINAL)
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

async function deriveInitialKeys(
	email: string,
	password: string,
): Promise<CryptInfo> {
	await _sodium.ready
	const sodium = _sodium

	const textEncoder = new TextEncoder()

	const masterKeySalt = textEncoder.encode(email)
	const masterPasswordHashSalt = textEncoder.encode(password)

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

	console.log("stretched master key", stretchedMasterKey.toString())

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
}

async function hashMasterPassword(
	email: string,
	password: string,
): Promise<Result<HashResult, unknown>> {
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

		return ok({ masterKey, masterPasswordHash })
	} catch (e) {
		return err(e)
	}
}

async function deriveMasterKey(
	email: string,
	password: string,
): Promise<Result<Argon2BrowserHashResult, unknown>> {
	const textEncoder = new TextEncoder()
	const masterKeySalt = textEncoder.encode(email)
	return tryp(
		argon2.hash({
			pass: password,
			salt: masterKeySalt,
			type: argon2.ArgonType.Argon2id,
			time: ARGON2_ITER_COUNT,
			mem: ARGON2_MEM_COST_KB,
			hashLen: MASTER_KEY_BYTE_LENGTH,
		}),
	)
}

async function deriveStretchedMasterKey(
	masterKeyBytes: Uint8Array,
): Promise<Result<SymmetricKey, unknown>> {
	const ikm = await tryp(
		crypto.subtle.importKey("raw", masterKeyBytes, { name: "HKDF" }, false, [
			"deriveBits",
		]),
	)
	if (ikm.isErr()) {
		return ikm
	}
	const stretchedMasterKey = (
		await tryp(
			crypto.subtle.deriveBits(
				{
					name: "HKDF",
					hash: "SHA-256",
					salt: new ArrayBuffer(0),
					info: new ArrayBuffer(0),
				},
				ikm.value,
				STRETCHED_MASTER_KEY_BYTE_LENGTH * 8,
			),
		)
	).map((key) => new SymmetricKey(new Uint8Array(key)))
	if (stretchedMasterKey.isErr()) {
		return stretchedMasterKey
	}
	return ok(stretchedMasterKey.value)
}

async function encrypt(
	content: string,
	symmetricKey: SymmetricKey,
): Promise<Result<Base64EncodedCipher, unknown>> {
	await _sodium.ready
	const sodium = _sodium

	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH))

	const encResult = await tryp<CryptoBox>(
		new Promise((resolve, reject) => {
			try {
				resolve(
					sodium.crypto_aead_xchacha20poly1305_ietf_encrypt_detached(
						content,
						null,
						null,
						iv,
						symmetricKey.encryptionKey,
						"uint8array",
					),
				)
			} catch (e) {
				reject(e)
			}
		}),
	)

	if (encResult.isErr()) {
		return encResult
	}

	return ok({
		text: sodium.to_base64(
			encResult.value.ciphertext,
			sodium.base64_variants.ORIGINAL,
		),
		iv: sodium.to_base64(iv, sodium.base64_variants.ORIGINAL),
		authTag: sodium.to_base64(
			encResult.value.mac,
			sodium.base64_variants.ORIGINAL,
		),
	})
}

async function decrypt(
	cipher: Base64EncodedCipher,
	key: SymmetricKey,
): Promise<Result<Uint8Array, unknown>> {
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

	return trys(() =>
		sodium.crypto_aead_xchacha20poly1305_ietf_decrypt_detached(
			null,
			cipherBytes,
			authTagBytes,
			"",
			ivBytes,
			key.encryptionKey,
			"uint8array",
		),
	)
}

function saveSymmetricKeyInSessionStorage(symmetricKey: SymmetricKey) {
	sessionStorage.setItem("symmetricKey", symmetricKey.toString())
}

export {
	SymmetricKey,
	deriveInitialKeys,
	deriveMasterKey,
	saveSymmetricKeyInSessionStorage,
	hashMasterPassword,
	deriveStretchedMasterKey,
	encrypt,
	decrypt,
}
export type { CryptInfo, Base64EncodedCipher }
