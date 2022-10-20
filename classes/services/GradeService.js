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

import { round } from 'lodash-es';
import { EmbedBase, Firebase, Logger } from '..';
import bot from '../../bot';

export class GradeService {
	/**
	 * @param {Object} grade A full Halo UserCourseClassAssessmentGrade object
	 */
	static processGrade = (grade) => {
		this.#publishGrade({
			grade,
			message: this.#parseGradeData({ grade }),
		});
	};

	/**
	 * @param {Object} args Desctructured arguments
	 * @param {Object} args.grade A full Halo UserCourseClassAssessmentGrade object
	 * @param {Object} args.message A parsed message object to be sent straight to Discord
	 * @returns {Promise<void>}
	 */
	static async #publishGrade({ grade, message }) {
		try {
			const discord_uid =
				Firebase.getDiscordUid(grade?.metadata?.uid) ??
				(await Firebase.getDiscordUidFromHaloUid(grade.user.id));
			const discord_user = await bot.users.fetch(discord_uid);
			discord_user
				.send(message)
				.catch((e) =>
					Logger.error(`Error sending grade notification to ${discord_user.tag} (${discord_uid}): ${e}`)
				);
			Logger.log(`Grade DM sent to ${discord_user.tag} (${discord_uid})`);
			bot.logDiscord({
				embed: new EmbedBase({
					title: 'Grade Message Sent',
					fields: [
						{
							name: 'Receipient',
							value: bot.formatUser(discord_user),
							inline: true,
						},
						{
							name: 'Grade ID',
							value: grade.id,
							inline: false,
						},
					],
				}),
			});
		} catch (e) {
			Logger.warn(`Error pubishing grade ${grade?.id} for user ${grade?.user?.id}: ${e}`);
		}
	}

	/**
	 * @param {Object} args Desctructured arguments
	 * @param {Object} args.grade A full Halo UserCourseClassAssessmentGrade object
	 * @returns {Object} A message object to be sent straight to Discord
	 */
	static #parseGradeData({ grade }) {
		const parsePercent = function (dividend, divisor) {
			return divisor < 1 ? '' : `(${round((dividend / divisor) * 100, 2)}%)`;
		};

		const {
			finalPoints,
			finalComment,
			assessment: { points, title },
			metadata: {
				courseCode,
				finalGrade: { finalPoints: totalFinalPoints, maxPoints },
			},
		} = grade;
		return {
			content: `New grade published for **${courseCode}**:`,
			embeds: [
				new EmbedBase({
					title,
					//description: `Worth ${Math.round(grade.assessment.points / )}% of your total grade`,
					fields: [
						{
							name: 'Score:',
							value: `**${finalPoints} / ${points}** ${parsePercent(finalPoints, points)}`,
							inline: true,
						},
						{
							name: 'Overall Grade:',
							value: `**${totalFinalPoints} / ${maxPoints}** ${parsePercent(
								totalFinalPoints,
								maxPoints
							)}`,
							inline: true,
						},
						{
							name: `Feedback:`,
							value: !!finalComment?.comment
								? finalComment.comment
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
