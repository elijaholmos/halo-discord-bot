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

import bot from '../../bot';
import { TOS_AGREEMENTS } from '../../caches';
import { Command, EmbedBase, Firebase, Logger } from '../../classes';

export default class extends Command {
	constructor() {
		super({
			name: 'distributetos',
			description: 'ToS notification',
			category: 'admin',
		});
	}

	async run({ intr }) {
		const users = (await Firebase.getAllActiveUsers()).map(Firebase.getDiscordUid);

		console.log(users);

		const msg = await bot.intrReply({
			intr,
			content: '⚠ **Action Required** ⚠',
			embed: new EmbedBase({
				title: 'Terms of Service Update',
				description: `
                    The new [Terms of Service](https://elijaho.notion.site/Terms-of-Service-e341190b0998499ea7f31cee2d49f786 'https://elijaho.notion.site/Terms-of-Service-e341190b0998499ea7f31cee2d49f786') are now in effect. In order to continue using Halo Notification Service, you must confirm the following:
                    \t\u2022 You have read and agree to the new Terms of Service.
                    \t\u2022 You authorize Halo Notification Service to view your education records.

                    For more information, please see [this announcement](https://discord.com/channels/270408632863031298/928033236398014504/1029404493219115028).
                `,
			}).Warn(),
			components: [
				{
					components: [
						{
							type: 2,
							style: 3,
							custom_id: 'tos-agree-btn',
							disabled: false,
							label: 'Agree',
							emoji: {
								name: '✅',
							},
						},
						{
							type: 2,
							style: 5,
							label: 'Questions',
							url: 'https://discord.com/channels/270408632863031298/928032710218383411',
							emoji: {
								name: '❔',
							},
						},
					],
					type: 1,
				},
			],
		});

		msg.createMessageComponentCollector({
			filter: (i) => i.customId === 'tos-agree-btn',
		})
			.on('collect', async (intr) => {
				const {
					user: { id: uid },
					message,
				} = intr;
				//await intr.deferReply({ ephemeral: true });
				console.log(`claim from ${uid}`);

				const data = { agreed: true, timestamp: Date.now() };
				TOS_AGREEMENTS.set(Firebase.getHNSUid(uid), data);
				TOS_AGREEMENTS.writeCacheFile({ filepath: Firebase.getHNSUid(uid), data });

				message.resolveComponent('tos-agree-btn').setDisabled();
				message.edit({ components: message.components });

				return bot.intrReply({
					intr,
					embed: new EmbedBase({
						description: `✅ **Your response has been recorded**`,
					}).Success(),
				});
			})
			.once('end', () => console.log('collector ended'));
	}
}
