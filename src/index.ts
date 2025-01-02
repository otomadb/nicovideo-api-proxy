import { Hono } from "hono";
import * as v from "valibot";
import { validator } from "hono/validator";
import ky from "ky";

export function buildUrl(sourceId: string) {
	const url = new URL(
		`/api/watch/v3_guest/${sourceId}`,
		"https://www.nicovideo.jp",
	);
	url.searchParams.set("_frontendId", "6");
	url.searchParams.set("_frontendVersion", "0");
	url.searchParams.set("skips", "harmful");
	url.searchParams.set(
		"actionTrackId",
		`${Math.random().toString(36).substring(2)}_${Date.now()}`,
	);
	console.log(url.toString());
	return url.toString();
}

const app = new Hono();

app.get(
	"/video/:id",
	validator("param", (v, c) => {
		if (!/^(sm|nm)\d+$/.test(v.id)) return c.text("Invalid ID", 400);
		return v;
	}),
	async (c) => {
		const { id } = c.req.param();
		return ky
			.get(buildUrl(id), {
				retry: 3,
				headers: {
					"user-agent": "Mozilla/5.0", // TODO: fix
				},
			})
			.then((r) => r.json())
			.then((r) =>
				v.parse(
					v.object({
						meta: v.object({
							status: v.number(),
						}),
						data: v.object({
							owner: v.object({
								id: v.number(),
								nickname: v.string(),
								iconUrl: v.string(),
							}),
							tag: v.object({
								items: v.array(
									v.object({
										name: v.string(),
									}),
								),
							}),
							video: v.object({
								id: v.string(),
								title: v.string(),
								description: v.string(),
								count: v.object({
									view: v.number(),
									comment: v.number(),
									mylist: v.number(),
									like: v.number(),
								}),
								duration: v.number(),
								thumbnail: v.object({
									url: v.string(),
									middleUrl: v.nullable(v.string()),
									largeUrl: v.nullable(v.string()),
									player: v.nullable(v.string()),
									ogp: v.string(),
								}),
								registeredAt: v.string(),
							}),
						}),
					}),
					r,
				),
			)
			.then(
				({
					data: {
						owner: { id: ownerId, nickname: ownerName, iconUrl: ownerIconUrl },
						tag,
						video: {
							id,
							title,
							count: { view, comment, like, mylist },
							description,
							duration,
							registeredAt,
							thumbnail: { ogp: thumbnailUrl },
						},
					},
				}) =>
					c.json({
						id,
						title: title,
						ownerId: ownerId,
						view,
						comment,
						like,
						mylist,
						tags: tag.items.map((t) => t.name),
						description,
						duration,
						registeredAt,
						thumbnailUrl: thumbnailUrl,
					}),
			)
			.catch((e) => {
				console.log(e);
				return c.text("Bad request", 400);
			});
	},
);

export default app;
