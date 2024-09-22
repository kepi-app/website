import React, { useContext } from "react"

interface ScrollInfo {
	left: number
	top: number
	isAtBottom: boolean
}

const ScrollInfoContext = React.createContext<ScrollInfo>({
	left: 0,
	top: 0,
	isAtBottom: false,
})

function useScrollInfo() {
	const scrollInfo = useContext(ScrollInfoContext)
	return scrollInfo
}

export { ScrollInfoContext, useScrollInfo }
export type { ScrollInfo }
