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

import { EmbedBase, Firebase } from '..';

export class InboxMessageService {
	/**
	 * Designed for currying
	 * @param {DiscordHaloBot} bot The bot instance
	 * @returns {Function} An anonymous function that handles the inbox message publication
	 */
	static processInboxMessage(bot) {
		return (inbox_message) =>
			this.#publishInboxMessage({
				bot,
				inbox_message,
				message: this.#parseInboxMessageData({ bot, inbox_message }),
			});
	}

	/**
	 * @param {Object} args Desctructured arguments
	 * @param {DiscordHaloBot} args.bot The bot instance
	 * @param {Object} args.inbox_message A raw Halo inbox_message object
	 * @param {Object} args.message A parsed message object to be sent straight to Discord
	 * @returns {Promise<void>}
	 */
	static async #publishInboxMessage({ bot, inbox_message, message }) {
		try {
			const discord_uid =
				Firebase.getDiscordUid(inbox_message?.metadata?.uid) ??
				(await Firebase.getDiscordUidFromHaloUid(inbox_message.user.id));
			const discord_user = await bot.users.fetch(discord_uid);
			discord_user
				.send(message)
				.catch((e) =>
					bot.logger.error(
						`Error sending inbox_message notification to ${discord_user.tag} (${discord_uid}): ${e}`
					)
				);
			bot.logger.log(`Inbox Message DM sent to ${discord_user.tag} (${discord_uid})`);
			bot.logDiscord({
				embed: new EmbedBase(bot, {
					title: 'Inbox Message Sent',
					description: `Sent to ${bot.formatUser(discord_user)})`,
				}),
			});
		} catch (e) {
			bot.logger.warn(`Error pubishing inbox_message: ${e}`);
		}
	}

	/**
	 * @param {Object} args Desctructured arguments
	 * @param {DiscordHaloBot} args.bot The bot instance
	 * @param {Object} args.inbox_message A raw Halo `Post` object
	 * @returns {Object} A message object to be sent straight to Discord
	 */
	static #parseInboxMessageData({ bot, inbox_message }) {
		const { firstName, lastName } = inbox_message.createdBy.user;
		return {
			content: `New message received from **${firstName} ${lastName}**:`,
			embeds: [
				new EmbedBase(bot, {
					description: inbox_message.content
						.replaceAll('<br>', '\n')
						.replaceAll('</p><p>', '\n') //this is kinda hacky ngl
						.replace(/<\/?[^>]+(>|$)/g, ''),
					fields: [
						...(!!inbox_message.resources.filter(({ kind }) => kind !== 'URL').length
							? [
									{
										name: `Attachments (${
											inbox_message.resources.filter(({ kind }) => kind !== 'URL').length
										})`,
										value: inbox_message.resources
											.filter(({ kind }) => kind !== 'URL')
											.map((rs) => `[\`${rs.name}\`](https://halo.gcu.edu/resource/${rs.id})`)
											.join(', '),
									},
							  ]
							: []),
					],
					timestamp: inbox_message.publishDate,
				}),
			],
		};
	}
}