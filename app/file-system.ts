function isLocalFileSystemAvailable() {
	return (
		navigator.storage?.getDirectory !== undefined &&
		navigator.storage?.getDirectory !== null
	)
}

export { isLocalFileSystemAvailable }
