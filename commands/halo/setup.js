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
