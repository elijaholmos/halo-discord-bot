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

'use strict';
if (process.version.slice(1).split('.')[0] < 16) throw new Error('Node 16.6.0 or higher is required.');

import { config as dotenv_config } from 'dotenv';
import admin from 'firebase-admin';
import klaw from 'klaw';
import path from 'node:path';
import {
	AnnouncementService,
	CookieWatcher,
	EmbedBase,
	GradeService,
	HaloWatcher,
	InboxMessageService,
	Logger,
} from './classes';
import bot from './bot';
import * as caches from './caches';
import * as stores from './stores';
dotenv_config();

// Initialization process
const init = async function () {
	//initialize firebase
	admin.initializeApp({
		databaseURL:
			process.env.NODE_ENV === 'production'
				? 'https://discord-halo-default-rtdb.firebaseio.com'
				: 'https://halo-discord-dev-default-rtdb.firebaseio.com',
	});
	if (admin.apps.length === 0) Logger.error('Error initializing firebase app');
	else Logger.log('Firebase succesfully initialized');
	//await CloudConfig.init();   //import cloud configuration settings
	//Logger.log('CloudConfig initialized');

	//import commands
	for await (const item of klaw('./commands')) {
		const cmdFile = path.parse(item.path);
		if (!cmdFile.ext || cmdFile.ext !== '.js') continue;
		const cmdName = cmdFile.name.split('.')[0];
		try {
			const cmd = new (
				await import(
					'./' + path.relative(process.cwd(), `${cmdFile.dir}${path.sep}${cmdFile.name}${cmdFile.ext}`)
				)
			).default();
			process.env.NODE_ENV === 'development'
				? bot.commands.set(cmdName, cmd)
				: cmd.category !== 'development' && bot.commands.set(cmdName, cmd);

			//delete require.cache[require.resolve(`${cmdFile.dir}${path.sep}${cmdFile.name}${cmdFile.ext}`)];
		} catch (error) {
			Logger.error(`Error loading command file ${cmdFile.name}: ${error}`);
		}
	}
	Logger.log(`Loaded ${bot.commands.size} command files`);

	//import discord events
	for await (const item of klaw('./events/discord')) {
		const eventFile = path.parse(item.path);
		if (!eventFile.ext || eventFile.ext !== '.js') continue;
		const eventName = eventFile.name.split('.')[0];
		try {
			const event = new (
				await import(
					'./' + path.relative(process.cwd(), `${eventFile.dir}${path.sep}${eventFile.name}${eventFile.ext}`)
				)
			).default();
			bot.events.set(eventName, event);
			bot.on(event.event_type, (...args) => event.run(...args));

			//delete require.cache[require.resolve(`${eventFile.dir}${path.sep}${eventFile.name}${eventFile.ext}`)];
		} catch (error) {
			Logger.error(`Error loading Discord event ${eventFile.name}: ${error}`);
		}
	}
	Logger.log(`Loaded ${bot.events.size} Discord events`);

	//import firebase events
	for await (const item of klaw('./events/firebase')) {
		const eventFile = path.parse(item.path);
		if (!eventFile.ext || eventFile.ext !== '.js') continue;
		try {
			const firebase_event = new (
				await import(
					'./' + path.relative(process.cwd(), `${eventFile.dir}${path.sep}${eventFile.name}${eventFile.ext}`)
				)
			).default();
			if (!firebase_event.create_on_init) continue;
			const query = admin.database().ref(firebase_event.ref);
			query
				.orderByChild('created_on')
				.startAfter(Date.now())
				.on('child_added', (snapshot) => {
					if (!bot.readyAt) return; //ensure bot is initialized before event is fired
					if (snapshot.empty) return;
					firebase_event.onAdd(snapshot);
				});
			query.on('child_changed', (snapshot) => {
				if (!bot.readyAt) return; //ensure bot is initialized before event is fired
				if (snapshot.empty) return;
				firebase_event.onModify(snapshot);
			});
			query.on('child_removed', (snapshot) => {
				if (!bot.readyAt) return; //ensure bot is initialized before event is fired
				if (snapshot.empty) return;
				firebase_event.onRemove(snapshot);
			});
			bot.firebase_events.set(firebase_event.name, firebase_event);

			//delete require.cache[require.resolve(`${eventFile.dir}${path.sep}${eventFile.name}${eventFile.ext}`)];
		} catch (error) {
			Logger.error(`Error loading Firebase event ${eventFile.name}: ${error}`);
		}
	}
	Logger.log(`Loaded ${bot.firebase_events.size} Firebase events`);

	//import stores
	const imported_stores = await Promise.all(Object.values(stores).map((store) => store.awaitReady()));
	Logger.log(`Loaded ${imported_stores.length} stores`);

	//import caches
	const imported_caches = await Promise.all(Object.values(caches).map((cache) => cache.loadCacheFiles()));
	Logger.log(`Loaded ${imported_caches.length} local caches`);

	// Instantiate the HaloWatcher
	new HaloWatcher()
		.on('announcement', AnnouncementService.processAnnouncement)
		.on('grade', GradeService.processGrade)
		.on('inbox_message', InboxMessageService.processInboxMessage);
	Logger.log('HaloWatcher initialized');

	// Instantiate the CookieWatcher
	Logger.log(`CookieWatcher initialized with ${await CookieWatcher.init()} intervals`);

	Logger.log('Connecting to Discord...');
	bot.login(process.env.BOT_TOKEN).then(() => {
		Logger.log(
			`Bot succesfully initialized. Environment: ${process.env.NODE_ENV}. Version: ${bot.CURRENT_VERSION}`
		);
		process.env.NODE_ENV !== 'development' && //send message in log channel when staging/prod bot is online
			bot.logDiscord({
				embed: new EmbedBase({
					description: `\`${process.env.NODE_ENV}\` environment online, running version ${bot.CURRENT_VERSION}`,
				}).Success(),
			});
		Logger.log('Beginning post-initializtion sequence...');
		postInit();
	});
};

// post-initialization, when bot is logged in and Discord API is accessible
const postInit = async function () {
	//register commands with Discord
	await (async function registerCommands() {
		//register cmds in main guild
		const cmds = await bot.main_guild.commands
			.set(bot.commands.map(({ run, ...data }) => data))
			.catch((err) => Logger.error(`registerCommands err: ${err}`));

		//turn each Command into an ApplicationCommand
		cmds.forEach((cmd) => bot.commands.get(cmd.name.replaceAll(' ', '')).setApplicationCommand(cmd));

		//Register command permissions
		await bot.main_guild.commands.permissions
			.set({
				fullPermissions: bot.commands
					.filter((c) => Object.keys(bot.config.command_perms.categories).includes(c.category))
					.map(({ id, name, category }) => ({
						id,
						permissions: [
							//...bot.config.command_perms.categories[category],
							//...bot.config.command_perms?.names?.[name] || [],
						],
					})),
			})
			.catch((err) => Logger.error(`registerCommands err: ${err}`));

		//register cmds in all guilds
		const global_cmds = await bot.application.commands
			.set(
				bot.commands
					//remove commands with categorical permissions
					.filter(({ category }) => !bot.config.command_perms.categories.hasOwnProperty(category))
					.map(({ run, ...data }) => data)
			)
			.catch((err) => Logger.error(`registerCommands global err: ${err}`));
		Logger.log(
			`Registered ${cmds.size} out of ${bot.commands.size} commands to Discord (${global_cmds.size} global)`
		);
	})();

	Logger.log('Post-initialization complete');
};

init();

// Prevent the bot from crashing on unhandled rejections
process.on('unhandledRejection', function (err, promise) {
	Logger.error(JSON.stringify(err));
	console.error(err);
});
