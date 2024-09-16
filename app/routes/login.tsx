import { Form, useNavigation } from "@remix-run/react"
import clsx from "clsx"
import { useId } from "react"
import { Button } from "~/components/button"
import { Logo } from "~/components/logo"

export default function LoginPage() {
	const emailInputId = useId()
	const passwordInputId = useId()
	const navigation = useNavigation()

	return (
		<div className="w-full h-screen flex justify-center items-center">
			<main className="w-full lg:max-w-prose flex flex-col justify-center items-center">
				<div
					className={clsx("w-14 h-14 mb-20", {
						"animate-bounce": navigation.state === "submitting",
					})}
				>
					<Logo />
				</div>

				<Form className="flex flex-col items-center">
					<div className="grid grid-cols-3 grid-rows-2 gap-4">
						<label htmlFor={emailInputId}>email</label>
						<input
							type="email"
							placeholder="sakurajima@mai.com"
							id={emailInputId}
							className="col-span-2 bg-transparent placeholder:opacity-20"
						/>
						<label htmlFor={passwordInputId}>password</label>
						<input
							type="password"
							id={passwordInputId}
							className="col-span-2 bg-transparent placeholder:opacity-20"
							placeholder="enter your password here"
						/>
					</div>

					<Button type="submit" className="mt-20 w-full">
						Login
					</Button>
				</Form>
			</main>
		</div>
	)
}
