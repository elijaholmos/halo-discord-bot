/*
 * Copyright (C) 2022 Elijah Olmos
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import bot from '../../../bot';
import { DiscordEvent, EmbedBase, Firebase, Halo, Logger } from '../../../classes';

export default class extends DiscordEvent {
	constructor() {
		super({
			name: 'acknowledgeAnnouncement',
			description: 'Mark an announcement as read',
			event_type: 'interactionCreate',
		});
	}

	async run(intr) {
		if (!intr.isButton()) return;
		// Ignore interactions from other bots
		if (intr.user.bot) return;

		// ignore non-post button clicks
		// id should be structured: $post_{postId}
		if (!intr.customId.startsWith('$post_')) return;

		const post_id = intr.customId.split('_')[1];

		try {
			Logger.cmd(`${intr.user.tag} (${intr.user.id})  clicked ${this.name} btn with id of ${intr.customId}`);
			await Halo.acknowledgePost({
				cookie: await Firebase.getUserCookie(Firebase.getHNSUid(intr.user.id)),
				post_id,
			});
			bot.intrReply({
				intr,
				ephemeral: true,
				embed: new EmbedBase({
					description: `✅ **Announcement successfully marked as read**`,
				}).Success(),
			});
		} catch (err) {
			Logger.error(`Error with btn ${this.name} ${intr.customId}: ${err}`);
			bot.intrReply({
				intr,
				ephemeral: true,
				embed: new EmbedBase().ErrorDesc('I ran into an error while trying to perform that action'),
			});
		}
	}
}
