import { Form } from "@remix-run/react";
import { useId } from "react";
import { Button } from "~/components/button";
import { Logo } from "~/components/logo";

export default function LoginPage() {
	const emailInputId = useId();
	const passwordInputId = useId();

	return (
		<div className="w-full h-screen flex justify-center items-center">
			<main className="w-full lg:max-w-prose flex flex-col justify-center items-center">
				<div className="flex flex-col items-center mb-20">
					<div className="w-14 h-14 mb-4">
						<Logo />
					</div>
					<h1 className="text-xl">welcome to kepi</h1>
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
						Sign up
					</Button>
				</Form>
			</main>
		</div>
	);
}
