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
import { round } from 'lodash-es';

export class GradeService {
	/**
	 * Designed for currying
	 * @param {DiscordHaloBot} bot The bot instance
	 * @returns {Function} An anonymous function that handles the grade notification
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
			const discord_uid =
				Firebase.getDiscordUid(grade?.metadata?.uid) ??
				(await Firebase.getDiscordUidFromHaloUid(grade.user.id));
			const discord_user = await bot.users.fetch(discord_uid);
			discord_user
				.send(message)
				.catch((e) =>
					bot.logger.error(`Error sending grade notification to ${discord_user.tag} (${discord_uid}): ${e}`)
				);
			bot.logger.log(`Grade DM sent to ${discord_user.tag} (${discord_uid})`);
			bot.logDiscord({
				embed: new EmbedBase(bot, {
					title: 'Grade Message Sent',
					description: `Sent to ${bot.formatUser(discord_user)})`,
				}),
			});
		} catch (e) {
			bot.logger.warn(`Error pubishing grade: ${e}`);
		}
	}

	/**
	 * @param {Object} args Desctructured arguments
	 * @param {DiscordHaloBot} args.bot The bot instance
	 * @param {Object} args.grade A full Halo UserCourseClassAssessmentGrade object
	 * @returns {Object} A message object to be sent straight to Discord
	 */
	static #parseGradeData({ bot, grade }) {
		const parsePercent = function () {
			return grade.assessment.points < 1
				? ''
				: `(${round((grade.finalPoints / grade.assessment.points) * 100, 2)}%)`;
		};

		return {
			content: `New Grade published for **${grade.metadata.courseCode}**:`,
			embeds: [
				new EmbedBase(bot, {
					title: grade.assessment.title,
					//description: `Worth ${Math.round(grade.assessment.points / )}% of your total grade`,
					fields: [
						{
							name: 'Score:',
							value: `**${grade.finalPoints} / ${grade.assessment.points}** ${parsePercent()}`,
						},
						{
							name: `Feedback:`,
							value: !!grade.finalComment?.comment
								? grade.finalComment.comment
										.replaceAll('<br>', '\n')
										.replaceAll('</p><p>', '\n') //this is kinda hacky ngl
										.replace(/<\/?[^>]+(>|$)/g, '')
								: 'None',
						},
					],
					timestamp: Date.now(),
				}),
			],
		};
	}
}
