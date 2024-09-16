import { Outlet } from "@remix-run/react";

export default function BlogDashboardLayout() {
	return (
		<div className="w-full flex justify-center">
			<Outlet />
		</div>
	);
}
