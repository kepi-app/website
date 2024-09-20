function ProgressiveBlurBackground() {
	return (
		<div className="absolute top-0 bottom-0 left-0 right-0 w-full">
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(1px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 10%, rgba(0, 0, 0, 1) 30%, rgba(0, 0, 0, 0) 40%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(2px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 10%, rgba(0, 0, 0, 1) 20%, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0) 50%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(4px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 15%, rgba(0, 0, 0, 1) 30%, rgba(0, 0, 0, 1) 50%, rgba(0, 0, 0, 0) 60%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(8px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 20%, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0) 70%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(16px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 1) 80%, rgba(0, 0, 0, 0) 90%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(32px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 1) 80%)",
				}}
			/>
			<div
				className="absolute top-0 bottom-0 left-0 right-0"
				style={{
					backdropFilter: "blur(64px)",
					mask: "linear-gradient(rgba(0, 0, 0, 0) 70%, rgba(0, 0, 0, 1) 100%)",
				}}
			/>
		</div>
	)
}

export { ProgressiveBlurBackground }
