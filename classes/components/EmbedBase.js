import { MessageEmbed } from 'discord.js';

//base Embed object, customized for this project
export class EmbedBase extends MessageEmbed {
    constructor(bot, {
        color = 0x2EA2E0,
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
                text: `${footer &&= footer + '  •  '}Halo Notification Service ${bot.CURRENT_VERSION}`,
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
        this.color = 0xf5a122;  //0xf59a22 for slightly less bright
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
