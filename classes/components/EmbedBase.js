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

import { MessageEmbed } from 'discord.js';
import bot from '../../bot';

//base Embed object, customized for this project
export class EmbedBase extends MessageEmbed {
	constructor({
		color = 0x2ea2e0,
		title,
		url,
		author = {},
		description,
		thumbnail = {},
		fields = [],
		image = {},
		timestamp = new Date(),
		footer = '',
		...other
	} = {}) {
		super({
			color,
			title,
			url,
			author,
			description,
			thumbnail,
			fields,
			image,
			timestamp,
			footer: {
				text: `${(footer &&= footer + '  •  ')}Halo Notification Service ${bot.CURRENT_VERSION}`,
				icon_url: bot.user.avatarURL(),
			},
			...other,
		});
	}

	// --------- Presets ---------
	Error() {
		this.color = 0xf5223c;
		return this;
	}

	ErrorDesc(msg) {
		this.description = `❌ **${msg}**`;
		return this.Error();
	}

	Warn() {
		this.color = 0xf5a122; //0xf59a22 for slightly less bright
		return this;
	}

	Success() {
		this.color = 0x31d64d;
		return this;
	}

	Sentence() {
		this.color = 0xe3da32;
		return this;
	}
}
