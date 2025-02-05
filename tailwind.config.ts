import typography from "@tailwindcss/typography"
import type { Config } from "tailwindcss"

export default {
	content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				sans: [
					'"Inter"',
					"ui-sans-serif",
					"system-ui",
					"sans-serif",
					'"Apple Color Emoji"',
					'"Segoe UI Emoji"',
					'"Segoe UI Symbol"',
					'"Noto Color Emoji"',
				],
			},
			keyframes: {
				loading: {
					"0%, 100%": {
						transform: "none",
						animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
					},
					"50%": {
						transform: "translateY(-25%)",
						animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)",
					},
				},
			},
			animation: {
				loading: "loading 1s infinite",
			},
		},
	},
	plugins: [typography],
} satisfies Config
