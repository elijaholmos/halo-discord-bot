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

import { Command, EmbedBase, Firebase } from '../../classes';

class test extends Command {
    constructor(bot) {
        super(bot, {
            name: 'test',
            description: 'Test command',
            category: 'development',
        });
    }

    async run({intr}) {
        const { bot } = this;

        const classes = await Firebase.getAllClasses();
        console.log(classes);
        
        await bot.intrReply({intr, embed: new EmbedBase(bot, {
            description: 'Done',
        })});
    }
}

export default test;
