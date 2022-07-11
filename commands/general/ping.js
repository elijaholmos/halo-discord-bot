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

import { Command, EmbedBase } from '../../classes';

class ping extends Command {
    constructor(bot) {
        super(bot, {
            name: 'ping',
            description: 'Get the latentcy of the bot and its connected APIs',
            category: 'general',
        });
    }

    async run({intr}) {
        const { bot } = this;
        const response = await bot.intrReply({intr, embed: new EmbedBase(bot, {
            description: 'Pinging...',
        }), fetchReply: true,});

		const latency = { //store latency variables
            self: response.createdTimestamp - intr.createdTimestamp, 
            discord: bot.ws.ping, 
        };

        bot.intrReply({intr, embed: new EmbedBase(bot, {
            fields: [{
                name: `It took ${latency.self}ms to respond`,
                value: `Discord API Latency is ${latency.discord}ms`,
            }],
        })});
    }
}

export default ping;
