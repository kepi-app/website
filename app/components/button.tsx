function Button({
	className,
	...props
}: React.DetailedHTMLProps<
	React.ButtonHTMLAttributes<HTMLButtonElement>,
	HTMLButtonElement
>) {
	return (
		<button
			className={`py-1 border-t border-t-neutral-500 text-zinc-200 bg-opacity-60 bg-neutral-500 backdrop-blur-lg ${className}`}
			style={{ borderRadius: "8px" }}
			{...props}
		/>
	)
}

export { Button }
