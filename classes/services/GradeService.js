import { EmbedBase } from '..';
import { Firebase } from '../../api';
import { round } from 'lodash-es';

export class GradeService {
	/**
	 * Designed for currying
	 * @param {DiscordHaloBot} bot The bot instance
	 * @returns {Function} An anonymous function that handles the announcement publication
	 */
	static processGrade(bot) {
		return (grade) =>
			this.#publishGrade({
				bot,
				grade,
				message: this.#parseGradeData({ bot, grade }),
			});
	}

    /**
	 * @param {Object} args Desctructured arguments
	 * @param {DiscordHaloBot} args.bot The bot instance
	 * @param {Object} args.grade A full Halo UserCourseClassAssessmentGrade object
     * @param {Object} args.message A parsed message object to be sent straight to Discord
	 * @returns {Promise<void>}
	 */
	static async #publishGrade({ bot, grade, message }) {
		try {
            const discord_user = await bot.users.fetch(
                await Firebase.getDiscordUid(grade.user.id)
            );
            discord_user
                .send(message)
                .catch(e => bot.logger.error(`Error sending grade notification to ${discord_user.tag} (${discord_uid}): ${e}`));
            bot.logger.log(`Grade DM sent to ${discord_user.tag} (${discord_uid})`);
            
		} catch (e) {
			bot.logger.warn(`Error pubishing grade: ${e}`);
		}
        return;
	}

	/**
	 * @param {Object} args Desctructured arguments
	 * @param {DiscordHaloBot} args.bot The bot instance
	 * @param {Object} args.grade A full Halo UserCourseClassAssessmentGrade object
	 * @returns {Object} A message object to be sent straight to Discord
	 */
	static #parseGradeData({ bot, grade }) {
		console.log(grade);
		return {
			content: `New Grade published for **${grade.metadata.courseCode}**:`,
			embeds: [
				new EmbedBase(bot, {
					title: grade.assessment.title,
					//description: `Worth ${Math.round(grade.assessment.points / )}% of your total grade`,
					fields: [
						{
							name: 'Score',
                            value: `**${grade.finalPoints} / ${grade.assessment.points}** \
                                (${round((grade.finalPoints / grade.assessment.points) * 100, 2)}%)`,
							value: grade.content
								.replaceAll('<br>', '\n')
								.replace(/<\/?[^>]+(>|$)/g, ''),
						},
                        {
                            name: `Feedback`,
                            value: !!grade.finalComment
                                ? grade.finalComment.comment
                                    .replaceAll('<br>', '\n')
                                    .replace(/<\/?[^>]+(>|$)/g, '')
                                : 'None',
                        },
					],
					timestamp: Date.now(),
				}),
			],
		};
	}
};
