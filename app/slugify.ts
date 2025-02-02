function slugify(name: string): string {
	return name
		.replace(/[`!@#$%^&*()+=\[\]{};':"\\|,.<>\/?~]/g, "")
		.replace(/([- _])+/g, "-")
}

export { slugify }
