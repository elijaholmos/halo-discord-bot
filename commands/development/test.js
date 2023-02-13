/*
 * Copyright (C) 2023 Elijah Olmos
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
import { Collection } from 'discord.js';
import { writeFile } from 'node:fs/promises';
import { Command, Firebase, Halo } from '../../classes';

class test extends Command {
	constructor() {
		super({
			name: 'test',
			description: 'Test command',
			category: 'development',
		});
	}

	async run({ intr }) {
		try {
			let payload = new Collection();
			const channel = await bot.channels.fetch(bot.config.channels.private_log);
			const getMessages = async ({ before = null } = {}) => {
				if (new Date().getSeconds() === 1) console.log('Fetching messages...');
				const messages = await channel.messages.fetch({ limit: 100, before }, { force: true });
				payload = payload.concat(messages);
				if (messages.size === 100) return getMessages({ before: messages.lastKey() });
			};
			await getMessages();
			console.log(payload.size);
			await writeFile('./tmp/payload.json', JSON.stringify(payload.toJSON()));
		} catch (err) {
			console.log(err);
		}
	}
}

export default test;
