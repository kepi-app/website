declare global {
	namespace NodeJS {
		interface ProcessEnv {
			API_URL: string
			PUBLISHING_PRIVATE_KEY: string
		}
	}

	interface Window {
		ENV: {
			API_URL: string
		}
	}
}

export {}
