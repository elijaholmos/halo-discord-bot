/*
 * Copyright (C) [year] [owner]
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>
 */

import { Command } from '../../classes';

class setup extends Command {
    constructor(bot) {
        super(bot, {
            name: 'setup',
            description: 'View a setup guide',
            category: 'halo',
        });
    }

    async run({intr}) {
        const { bot } = this;
        return await bot.intrReply({
            intr,
            content: '<https://gist.github.com/elijaholmos/a3ba9481f684adfddd8733a96e4cdd24>',
        });
    }
}

export default setup;
