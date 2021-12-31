import { EmbedBase } from "..";
import { Firebase } from "../../api";

export class AnnouncementService {
    /**
     * Designed for currying
     * @param {DiscordHaloBot} bot The bot instance
     * @returns 
     */
    static processAnnouncement(bot) {
        return (announcement) => 
            this.#publishAnnouncement({
                bot,
                announcement: this.#parseAnnouncementData({bot, announcement}),
            });
    }

    static async #publishAnnouncement({bot, announcement}) {
        const ch = await bot.channels.fetch('270745162089496586');
        ch.send(announcement);
    }

    /**
     * @param {Object} args Desctructured arguments
     * @param {DiscordHaloBot} args.bot The bot instance
     * @param {Object} args.announcement A raw Halo announcement object
     * @returns {Object} A message object to be sent straight to Discord
     */
    static #parseAnnouncementData({bot, announcement}) {
        return {
            content: `New Announcement posted for **${announcement.metadata.courseCode}**`,
            embeds: [new EmbedBase(bot, {
                title: announcement.title,
                description: `by ${announcement.createdBy.user.firstName} ${announcement.createdBy.user.lastName}`,
                fields: [
                    {
                        name: 'Message',
                        value: announcement.content.replaceAll('<br>', '\n').replace(/<\/?[^>]+(>|$)/g, ""),
                    },
                    ...(!!announcement.resources.length ? [{
                        name: `Attachments (${announcement.resources.length})`,
                        value: announcement.resources
                            .map(rs => `[\`${rs.name}\`](https://halo.gcu.edu/resource/${rs.id})`)
                            .join(', '),
                    }] : []),
                ],
                timestamp: announcement.publishDate,
            })],
        };
    }
};
