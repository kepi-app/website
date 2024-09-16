import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, useLoaderData, useParams } from "@remix-run/react";
import type { BlogPost } from "~/blog/post";
import { Anchor } from "~/components/anchor";

type RouteParams = "blogSlug";

export async function loader({ params }: LoaderFunctionArgs) {
	const res = await fetch(
		`${process.env.API_URL}/blog/${params.blogSlug}/posts`,
	);
	const j = await res.json();
	return json<BlogPost[]>(j);
}

export default function BlogPostDashboard() {
	const params = useParams<RouteParams>();
	const posts = useLoaderData<typeof loader>();

	return (
		<div className="w-full flex justify-center">
			<main className="w-full lg:max-w-prose mt-20">
				<h2 className="text-lg opacity-80">{params.blogSlug}</h2>
				<h1 className="text-6xl my-8">your posts</h1>
				<ul className="space-y-2">
					{posts.map((post) => {
						const date = new Date(post.publishDate);
						const formattedDate = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
						return (
							<li key={post.slug} className="flex flex-row justify-between">
								<Anchor href={`/blog/${params.blogSlug}/post/${post.slug}`}>
									{post.title}
								</Anchor>
								<time>{formattedDate}</time>
							</li>
						);
					})}
				</ul>
			</main>
		</div>
	);
}
