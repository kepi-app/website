declare global {
	namespace NodeJS {
		interface ProcessEnv {
			PUBLISHING_PRIVATE_KEY: string
		}
	}
}

export {}
