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

import { DiscordEvent, EmbedBase } from "../../../classes";

export default class extends DiscordEvent {
    constructor(bot) {
        super(bot, {
            name: 'slashCommand',
            description: 'Receive and execute slash commands',
            event_type: 'interactionCreate',
        });
    }
    
    async run(intr) {
        const { bot } = this;

        if(!intr.isCommand()) return;
        // Ignore commands sent by other bots or sent in DM
        if(intr.user.bot || !intr.inGuild()) return;

        const command = bot.commands.get(intr.commandName);

        //defer reply because some commands take > 3 secs to run
        command.deferResponse &&
            await intr.deferReply({fetchReply: true}); 

        try {
            bot.logger.cmd(`${intr.user.tag} (${intr.user.id}) ran command ${intr.commandName} with ${intr.options.data.length} opts`);
            await command.run({intr, opts: intr.options});
        } catch (err) {
            bot.logger.error(`Error with cmd ${intr.commandName}: ${err}`);
            bot.intrReply({intr, embed: new EmbedBase(bot, {
                description: `❌ **I ran into an error while trying to run that command**`,
            }).Error()});
        }
    }
};
