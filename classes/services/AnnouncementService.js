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

import { EmbedBase, Firebase } from "..";

export class AnnouncementService {
	/**
	 * Designed for currying
	 * @param {DiscordHaloBot} bot The bot instance
	 * @returns {Function} An anonymous function that handles the announcement publication
	 */
	static processAnnouncement(bot) {
		return (announcement) =>
			this.#publishAnnouncement({
				bot,
				announcement,
				message: this.#parseAnnouncementData({ bot, announcement }),
			});
	}

    /**
	 * @param {Object} args Desctructured arguments
	 * @param {DiscordHaloBot} args.bot The bot instance
	 * @param {Object} args.announcement A raw Halo announcement object
     * @param {Object} args.message A parsed message object to be sent straight to Discord
	 * @returns {Promise<void>}
	 */
	static async #publishAnnouncement({ bot, announcement, message }) {
		try {
			//get all active users in the class and send the message to them
			for (const { discord_uid } of Object.values(
				await Firebase.getActiveUsersInClass(announcement.courseClassId)
			)) {
				const discord_user = await bot.users.fetch(discord_uid);
                discord_user
                    .send(message)
                    .catch(e => bot.logger.error(`Error sending announcement to ${discord_user.tag} (${discord_uid}): ${e}`));
			    bot.logger.log(`Announcement DM sent to ${discord_user.tag} (${discord_uid})`);
				bot.logDiscord({
					embed: new EmbedBase(bot, {
						title: 'Announcement Message Sent',
						description: `Sent to ${bot.formatUser(discord_user)}`,
					}),
				});
            }
		} catch (e) {
			bot.logger.warn(`Error pubishing announcement: ${e}`);
		}
        return;
	}

	/**
	 * @param {Object} args Desctructured arguments
	 * @param {DiscordHaloBot} args.bot The bot instance
	 * @param {Object} args.announcement A raw Halo announcement object
	 * @returns {Object} A message object to be sent straight to Discord
	 */
	static #parseAnnouncementData({ bot, announcement }) {
		//console.log(announcement);
		return {
			content: `New Announcement posted for **${announcement.metadata.courseCode}**:`,
			embeds: [
				new EmbedBase(bot, {
					title: announcement.title,
					description: `by ${announcement.createdBy.user.firstName} ${announcement.createdBy.user.lastName}`,
					fields: [
						{
							name: 'Message',
							value: announcement.content
								.replaceAll('<br>', '\n')
								.replace(/<\/?[^>]+(>|$)/g, ''),
						},
						...(!!announcement.resources.length
							? [
									{
										name: `Attachments (${announcement.resources.length})`,
										value: announcement.resources
											.map(
												(rs) =>
													`[\`${rs.name}\`](https://halo.gcu.edu/resource/${rs.id})`
											)
											.join(', '),
									},
							  ]
							: []),
					],
					timestamp: announcement.publishDate,
				}),
			],
		};
	}
};
