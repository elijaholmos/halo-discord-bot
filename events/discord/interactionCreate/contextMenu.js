import { DiscordEvent, EmbedBase } from "../../../classes";

export default class extends DiscordEvent {
    constructor(bot) {
        super(bot, {
            name: 'contextMenu',
            description: 'Receive, parse, and execute context menu commands',
            event_type: 'interactionCreate',
        });
    }
    
    async run(intr) {
        const { bot } = this;

        if(!intr.isContextMenu()) return;
        // Ignore commands sent by other bots or sent in DM
        if(intr.user.bot || !intr.inGuild()) return;

        const command = bot.commands.get(intr.commandName.replaceAll(' ', ''));

        //defer reply because some commands take > 3 secs to run
        command.deferResponse &&
            await intr.deferReply({fetchReply: true}); 

        try {
            bot.logger.cmd(`${intr.user.tag} (${intr.user.id}) ran context menu option ${intr.commandName}`);
            await command.run({intr, user: intr.options.getMember('user'), msg: intr.options.getMessage('message')});
        } catch (err) {
            bot.logger.error(`Error with ctx menu cmd ${intr.commandName}: ${err}`);
            bot.intrReply({intr, embed: new EmbedBase(bot, {
                description: `❌ **I ran into an error while trying to run that command**`,
            }).Error()});
        }
    }
};
