import _sodium from "libsodium-wrappers-sumo"
import argon2 from "argon2-browser/dist/argon2-bundled.min.js"
import type { Argon2BrowserHashResult } from "argon2-browser"
import { err, ok, type Result } from "trycat"

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
): Promise<Result<Argon2BrowserHashResult, unknown>> {
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

		return ok(masterPasswordHash)
	} catch (e) {
		return err(e)
	}
}

function saveCryptInfoInSessionStorage(info: CryptInfo) {
	sessionStorage.setItem("symmetricKey", info.symmetricKey.toString())
}

export { deriveInitialKeys, saveCryptInfoInSessionStorage, hashMasterPassword }
export type { CryptInfo }
