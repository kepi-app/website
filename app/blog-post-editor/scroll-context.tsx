import React from "react"

interface EditorScrollContext {
	left: number
	top: number
	isAtBottom: boolean
}

const EditorScrollContext = React.createContext<EditorScrollContext>({
	left: 0,
	top: 0,
	isAtBottom: false,
})

export { EditorScrollContext }
