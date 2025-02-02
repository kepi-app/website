import { reactRouter } from "@react-router/dev/vite"
import basicSsl from "@vitejs/plugin-basic-ssl"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
	// TODO: remove this when bug is fixed
	// this is specified to fix the "Headers.set: ":method" is an invalid header name" error when loading in https
	// source of the temp fix found here: https://stackoverflow.com/questions/77669586/typeerror-headers-append-method-is-an-invalid-header-name-sveltekit-https
	server: {
		proxy: {},
	},
	plugins: [reactRouter(), tsconfigPaths(), basicSsl()],
})
