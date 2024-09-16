function Button({
	className,
	...props
}: React.DetailedHTMLProps<
	React.ButtonHTMLAttributes<HTMLButtonElement>,
	HTMLButtonElement
>) {
	return (
		<button
			className={`py-1 bg-zinc-600 rounded border border-neutral-500 text-zinc-200 ${className}`}
			{...props}
		/>
	);
}

export { Button };
