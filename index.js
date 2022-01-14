'use strict';
if (process.version.slice(1).split(".")[0] < 16)
    throw new Error("Node 16.6.0 or higher is required.");

import { Intents } from 'discord.js';
import admin from 'firebase-admin';
import klaw from 'klaw';
import path from 'path';
import { AnnouncementService, DiscordHaloBot, HaloWatcher, EmbedBase, GradeService, CookieWatcher } from './classes';
import { config as dotenv_config } from 'dotenv';
dotenv_config();


// Globally instantiate our bot; prepare to login later
const bot = new DiscordHaloBot({ 
    restTimeOffset: 0, /*allegedly this helps with API delays*/
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.DIRECT_MESSAGES,
    ],
    allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: true,
    },
});

// Initialization process
const init = async function () {
    //initialize firebase
    admin.initializeApp({
        databaseURL: process.env.NODE_ENV === 'production' 
            ? 'https://discord-halo-default-rtdb.firebaseio.com' 
            : 'https://halo-discord-dev-default-rtdb.firebaseio.com',
    });
    if(admin.apps.length === 0) bot.logger.error('Error initializing firebase app');
    else bot.logger.log('Firebase succesfully initialized');
    //await CloudConfig.init();   //import cloud configuration settings
    //bot.logger.log('CloudConfig initialized');

    //import commands
    for await (const item of klaw('./commands')) {
        const cmdFile = path.parse(item.path);
        if (!cmdFile.ext || cmdFile.ext !== '.js') continue;
        const cmdName = cmdFile.name.split('.')[0];
        try {
            const cmd = new (await import('./' + path.relative(process.cwd(), `${cmdFile.dir}${path.sep}${cmdFile.name}${cmdFile.ext}`))).default(bot);
            process.env.NODE_ENV === 'development' 
                ? bot.commands.set(cmdName, cmd) 
                : cmd.category !== 'development' &&
                    bot.commands.set(cmdName, cmd);
            
            //delete require.cache[require.resolve(`${cmdFile.dir}${path.sep}${cmdFile.name}${cmdFile.ext}`)];
        } catch(error) {
            bot.logger.error(`Error loading command file ${cmdFile.name}: ${error}`);
        }
    }
    bot.logger.log(`Loaded ${bot.commands.size} command files`);

    
    //import discord events
    for await (const item of klaw('./events/discord')) {
        const eventFile = path.parse(item.path);
        if (!eventFile.ext || eventFile.ext !== '.js') continue;
        const eventName = eventFile.name.split('.')[0];
        try {
            const event = new (await import('./' + path.relative(process.cwd(), `${eventFile.dir}${path.sep}${eventFile.name}${eventFile.ext}`))).default(bot);
            bot.events.set(eventName, event);
            bot.on(event.event_type, (...args) => event.run(...args));
            
            //delete require.cache[require.resolve(`${eventFile.dir}${path.sep}${eventFile.name}${eventFile.ext}`)];
        } catch(error) {
            bot.logger.error(`Error loading Discord event ${eventFile.name}: ${error}`);
        }
    }
    bot.logger.log(`Loaded ${bot.events.size} Discord events`)

    //import firebase events
    for await (const item of klaw('./events/firebase')){
        const eventFile = path.parse(item.path);
        if (!eventFile.ext || eventFile.ext !== '.js') continue;
        try {
            const firebase_event = new (await import('./' + path.relative(process.cwd(), `${eventFile.dir}${path.sep}${eventFile.name}${eventFile.ext}`))).default(bot);
            const query = admin.database()
                .ref(firebase_event.ref)
                .orderByChild('created_on')
                .startAfter(Date.now());
            query.on('child_added', (snapshot) => {
                console.log('snapshot received');
                if(!bot.readyAt) return;    //ensure bot is initialized before event is fired
                if(snapshot.empty) return;
                firebase_event.onAdd(snapshot);
            });
            query.on('child_changed', (snapshot) => {
                if(!bot.readyAt) return;    //ensure bot is initialized before event is fired
                if(snapshot.empty) return;
                firebase_event.onModify(snapshot);
            });
            query.on('child_removed', (snapshot) => {
                if(!bot.readyAt) return;    //ensure bot is initialized before event is fired
                if(snapshot.empty) return;
                firebase_event.onRemove(snapshot);
            });
            bot.firebase_events.set(firebase_event.name, firebase_event);

            //delete require.cache[require.resolve(`${eventFile.dir}${path.sep}${eventFile.name}${eventFile.ext}`)];
        } catch(error) {
            bot.logger.error(`Error loading Firebase event ${eventFile.name}: ${error}`);
        }
    }
    bot.logger.log(`Loaded ${bot.firebase_events.size} Firebase events`);
    
    // Instantiate the HaloWatcher
    new HaloWatcher()
        .on('announcement', AnnouncementService.processAnnouncement(bot))
        .on('grade', GradeService.processGrade(bot));
    bot.logger.log('HaloWatcher initialized');

    // Instantiate the CookieWatcher
    bot.logger.log(`CookieWatcher initialized with ${await CookieWatcher.init()} intervals`);

    bot.logger.log('Connecting to Discord...');
    bot.login(process.env.BOT_TOKEN).then(() => {
        bot.logger.debug(`Bot succesfully initialized. Environment: ${process.env.NODE_ENV}. Version: ${bot.CURRENT_VERSION}`);
        process.env.NODE_ENV !== 'development' &&   //send message in log channel when staging/prod bot is online
            bot.logDiscord({embed: new EmbedBase(bot, {
                description: `\`${process.env.NODE_ENV}\` environment online, running version ${bot.CURRENT_VERSION}`,
            }).Success()});
        bot.logger.log('Beginning post-initializtion sequence...');
        postInit();
    });
};

// post-initialization, when bot is logged in and Discord API is accessible
const postInit = async function () {
    //register commands with Discord
    await (async function registerCommands() {
        const cmds = await bot.main_guild.commands.set(bot.commands.map(({ run, ...data }) => data))
            .catch(err => bot.logger.error(`registerCommands err: ${err}`));

        //turn each Command into an ApplicationCommand
        cmds.forEach(cmd => bot.commands.get(cmd.name.replaceAll(' ', '')).setApplicationCommand(cmd));

        //Register command permissions
        await bot.main_guild.commands.permissions.set({ 
            fullPermissions: bot.commands
                .filter(c => Object.keys(bot.config.command_perms.categories).includes(c.category))
                .map(({id, name, category}) => ({ 
                    id,
                    permissions: [
                        //...bot.config.command_perms.categories[category],
                        //...bot.config.command_perms?.names?.[name] || [],
                    ],
                })),
        }).catch(err => bot.logger.error(`registerCommands err: ${err}`));
        bot.logger.log(`Registered ${cmds.size} out of ${bot.commands.size} commands to Discord`);
    })();

    bot.logger.debug('Post-initialization complete');
};

init();

// Prevent the bot from crashing on unhandled rejections
process.on("unhandledRejection", function (err, promise) {
    bot.logger.error(`Unhandled rejection: ${err.name}`);
    console.error(err);
});
