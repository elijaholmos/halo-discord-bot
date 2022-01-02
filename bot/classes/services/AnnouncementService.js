import { EmbedBase } from "..";
import { Firebase } from "../../api";

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
                    .catch(e => bot.logger.error(`Error sending announcement to ${discord_user.tag} (${discord_uid})`, e));
			    bot.logger.log(`Announcement DM sent to ${discord_user.tag} (${discord_uid})`);
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
