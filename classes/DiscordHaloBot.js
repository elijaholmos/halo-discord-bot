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

import { Client, Collection, Emoji } from 'discord.js';
import config from '../config.js';
import { ConfirmInteraction, EmbedBase, Logger } from '.';

// Custom bot class, based off the discord.js Client (bot)
export class DiscordHaloBot extends Client {
    //getter for all Config methods that call Config.get()
    //get connection_tutorial() { return CloudConfig.get('connection_tutorial'); }
    //get xp_doc() { return CloudConfig.get('xp_doc'); }

    constructor(options) {
        super(options);

        // Custom properties for our bot
        this.CURRENT_VERSION    = process.env.npm_package_version || '0.0.0-unknown';
        this.logger             = Logger;
        this.config             = config[process.env.NODE_ENV || 'development'];
        this.commands           = new Collection();
        this.events             = new Collection();
        this.firebase_events    = new Collection();

        // Setup events to log unexpected errors
        this.on("disconnect", () => this.logger.warn("Bot is disconnecting..."))
            .on("reconnect", () => this.logger.log("Bot reconnecting..."))
            .on("error", this.logger.error)
            .on("warn", this.logger.warn);
    }

    get main_guild() {
        return this.guilds.resolve(this.config.main_guild_id);
    }

    // ----- Message Methods -----
    /**
     * Send a single embed in the `channel` of the `msg` argument
     * @param {Object} args
     * @param {Message} args.msg Discord.js `Message` object, target channel is taken from this
     * @param {EmbedBase} args.embed Singular embed object to be sent in channel
     * @returns {Promise<Message>}
     */
    sendEmbed({msg, embed, ...options}) {
        if(!msg.channel) throw new Error(`No channel property found on the msg object: ${msg}`);
        return msg.channel.send({msg, 
            embeds: [embed],
            ...options,
        });
    }

    /**
     * Send an inline reply to the `msg` that mentions the author
     * @param {Object} args
     * @param {Message} args.msg Discord.js `Message` object, target author is taken from this
     * @param {EmbedBase} args.embed Singular embed object to be sent as response
     * @returns {Promise<Message>}
     */
    sendReply({msg, embed, ...options}) {
        return msg.reply({
            embeds: [embed],
            failIfNotExists: false,
            ...options,
        });
    }

    /**
     * Send a direct message to the target user, catches error if user has closed DMs
     * @param {Object} args
     * @param {User} args.user Discord.js `User` object; recipient of msg
     * @param {EmbedBase} args.embed Singular embed object to be sent as response
     * @param {boolean} [args.send_disabled_msg] Whether or not to send a public message prompting the user to enable messages from server members
     * @returns {Promise<Message>}
     */
    sendDM({user, embed, send_disabled_msg=true, ...options} = {}) {
        return user.send({
            embeds: [embed],
            ...options,
        }).catch(() => send_disabled_msg && this.sendDisabledDmMessage(user));
    }

    /**
     * Sends a discord message on the bot's behalf to a private log channel
     * @param {Object} args
     * @param {EmbedBase} args.embed Singular embed object to be sent in message 
     * @returns {Promise<Message>} Promise which resolves to the sent message
     */
    async logDiscord({embed, ...options}) {
        return (await this.channels.fetch(this.config.channels.private_log)).send({
            embeds: [embed],
            ...options,
        });
    }

    /**
     * Sends a discord message on the bot's behalf to the connection log channel
     * @param {Object} args
     * @param {EmbedBase} args.embed Singular embed object to be sent in message 
     * @returns {Promise<Message>} Promise which resolves to the sent message
     */
     async logConnection({embed, ...options}) {
        return (await this.channels.fetch(this.config.channels.connection_log)).send({
            embeds: [embed],
            ...options,
        });
    }

    /**
     * Sends a discord message on the bot's behalf to a public log channel
     * @param {Object} args
     * @param {EmbedBase} args.embed Singular embed object to be sent in message
     * @returns {Promise<Message>} Promise which resolves to the sent message
     */
    async msgBotChannel({embed, ...options}) {
        return (await this.channels.fetch(this.config.channels.public_log)).send({
            embeds: [embed],
            ...options,
        });
    }

    sendDisabledDmMessage(user) {
        this.msgBotChannel({
            content: user.toString(),
            embed: new EmbedBase(this, {
                fields: [
                    {
                        name: '❌ You need to enable DMs from server members!',
                        value: "I tried to send you a direct message, but you currently have them disabled! Navigate to the server's Privacy Settings, then toggle **Allow Direct Messages From Server Members** to the right."
                    }
                ],
                image: {
                    url: 'https://i.ibb.co/L8j9dCD/discord-dm-tutorial.png'
                },
        }).Warn()});
    }

    // ----- Interaction Methods -----
    /**
     * Replies to an interaction
     * @param {Object} args Destructured arguments
     * @param {Interaction} args.intr Discord.js `Interaction`
     * @param {EmbedBase} [args.embed] Singular embed object to be included in reply. If unspecified, existing embeds are removed
     * @returns {Promise<Message>} The reply that was sent
     */
    intrReply({intr, embed=null, ...options}) {
        const payload = {
            embeds: !!embed ? [embed] : [],
            fetchReply: true,
            ...options,
        };
        return (intr.deferred || intr.replied) ? intr.editReply(payload) : intr.reply(payload);
    }

    intrUpdate({intr, embed=null, ...options}) {
        const payload = {
            embeds: !!embed ? [embed] : [],
            fetchReply: true,
            ...options,
        };
        return intr.replied ? intr.editReply(payload) : intr.update(payload);
    }

    /**
     * Reply to a `CommandInteraction` with a message containing 'Confirm' and 'Cancel' as buttons, among other options passed as parameters
     * Returns a promise which resolves to a boolean indicating the user's selection
     * @param {Object} args Destructured arguments. `options` will be passed to `this.intrReply()` as params
     * @param {CommandInteraction} args.intr Discord.js `CommandInteraction` to reply w/ confirmation prompt 
     * @returns {Promise<boolean>} `true` if user selected 'Confirm', `false` if user selected `Cancel`
     */
    async intrConfirm({intr, ...options}) {
        try {
            const msg = await this[`${intr.isButton() ? 'intrUpdate' : 'intrReply'}`]({intr, ...options, components:[new ConfirmInteraction()]});
            const res = await msg.awaitInteractionFromUser({user: intr.user});
            //remove components
            await res.update({components:[]});
            return res.customId === 'confirm';
        } catch (err) {
            this.logger.error(`intrConfirm err: ${err}`);
            return false;
        }
    }


    // ----- Other Methods -----
    /**
     * Checks if a user has mod permissions on the main server.
     * Current mod roles: `Admin`, `Moderator`
     * @param {String} uid Discord UID of the user to check
     * @returns {boolean} `true` if user has mod perms, `false` otherwise
     */
    checkMod(uid) {
        return this.main_guild.members.cache.get(uid).roles.cache.some(r => this.config.mod_roles.includes(r.id));
    }

    /**
     * Checks if a user has admin permissions on the main server.
     * Current admin permission: Anyone with the ADMINISTRATOR permission
     * @param {String} uid Discord UID of the user to check
     * @returns {boolean} `true` if user has admin perms, `false` otherwise
     */
    checkAdmin(uid) {
        return this.main_guild.members.cache.get(uid).permissions.has('ADMINISTRATOR');
    }

    /**
     * Formats a `User` for logging purposes
     * @param {User} user Discord.js `User` object 
     */
    formatUser(user) {
        return !!user?.id ? 
            `<@!${user.id}> (${user.tag})` :
            'Unknown User';
    }

    /**
     * Format a UNIX timestamp to be sent in a Discord message
     * @param {Number} [timestamp] UNIX timestamp in milliseconds, default is `Date.now()`
     * @param {string} [letter] The suffix to append, resulting in a different display
     * @returns {String}
     */
    formatTimestamp(timestamp=Date.now(), letter='D') {
        return `<t:${timestamp /1000 |0}:${letter}>`;
    }

    /**
     * Construct an Discord.js emoji from destructured parameters (such as Firestore data)
     * @param {Object} args Destructured arguments, see `Emoji` constructor
     * @returns {Emoji} 
     */
    constructEmoji({name, id, animated=false, ...other} = {}) {
        return Object.assign(new Emoji(this, {
            name,
            id,
            animated,
        }), other);
    }
}
