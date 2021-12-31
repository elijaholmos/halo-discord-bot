import { Command, EmbedBase } from '../../classes';
import { Firebase } from '../../api';

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
