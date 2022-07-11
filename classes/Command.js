export class Command {
    constructor(bot, {
        name = null,
        description = '',   //cannot be empty for chat commands
        options = [],
        category,
        deferResponse = false,  //for commands that take longer to run
        type = 'CHAT_INPUT',
        ...other
    }) {
        this.bot = bot;
        this.name = name;
        this.description = description;
        this.options = options;
        this.category = category;
        this.defaultPermission = (this.category !== 'admin' && this.category !== 'moderator');   //lock admin cmds
        this.deferResponse = deferResponse;
        this.type = type;
        Object.assign(this, other);
    }

    async run({intr, opts}) {
        throw new Error(`Command ${this.constructor.name} doesn't provide a run method.`);
    }

    /**
     * Adds all the properties of a registered `ApplicationCommand` to this `Command`
     * @param {ApplicationCommand} appcmd A registered `ApplicationCommand`
     * @returns {Command} This command itself
     */
    setApplicationCommand(appcmd) {
        return Object.assign(this, appcmd);
    }
}
