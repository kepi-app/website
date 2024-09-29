import type { Base64EncodedCipher } from "./crypt"

function saveEmail(email: string) {
	localStorage.setItem("email", email)
}

function saveProtectedSymmetricKey(protectedSymmetricKey: Base64EncodedCipher) {
	localStorage.setItem(
		"protectedSymmetricKey",
		JSON.stringify(protectedSymmetricKey),
	)
}

export { saveEmail, saveProtectedSymmetricKey }
