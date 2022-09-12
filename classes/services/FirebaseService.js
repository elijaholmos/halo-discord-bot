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

import admin from 'firebase-admin';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CLASS_USERS_MAP, DEFAULT_SETTINGS_STORE, DISCORD_USER_MAP, USER_SETTINGS_STORE } from '../../stores';
const ACTIVE_STAGES = ['PRE_START', 'CURRENT'];

export const getActiveClasses = async function () {
	return (
		await Promise.all(
			ACTIVE_STAGES.map((STAGE) => admin.database().ref('classes').orderByChild('stage').equalTo(STAGE).get())
		)
	).reduce((acc, cur) => Object.assign(acc, cur.val()), {});
};

/**
 * @returns {string[]} array of discord uids
 */
export const getActiveDiscordUsersInClass = function (class_id) {
	return process.env.NODE_ENV === 'production'
		? Object.keys(CLASS_USERS_MAP.get(class_id) ?? {}).map(DISCORD_USER_MAP.get)
		: ['139120967208271872'];
};

/**
 * @returns {Promise<string[]>} array of halo-discord IDs
 */
export const getActiveUsersInClassAsync = async function (class_id) {
	return Object.keys((await admin.database().ref('class_users_map').child(class_id).get()) ?? {});
};

/**
 * @returns {string[]} array of halo-discord IDs
 */
export const getActiveUsersInClass = function (class_id) {
	return Object.keys(CLASS_USERS_MAP.get(class_id) ?? {});
};

export const getAllUserClasses = async function (uid) {
	return Object.keys((await admin.database().ref(`user_classes_map`).child(uid).get()).toJSON());
};

/**
 * Get the Halo cookie object for a user
 * @param {string} uid halo-discord UID
 * @param {boolean} check_cache Whether the local cache should be checked first
 */
export const getUserCookie = async function (uid, check_cache = true) {
	try {
		if (!check_cache) throw 'Skipping cache check';
		const cache = await fs.readFile('./' + path.relative(process.cwd(), `cache/cookies.json`), 'utf8');
		if (uid in cache) return cache[uid].cookie;
		throw 'User not found in cache';
	} catch (e) {
		return (await admin.database().ref('cookies').child(uid).get()).val();
	}
};

export const updateUserCookie = async function (uid, cookie) {
	return await admin.database().ref('cookies').child(uid).update(cookie);
};

/**
 * Convert a Halo UID to a Discord UID
 * @param {string} uid halo user id
 * @returns {Promise<string | null>} discord user id
 */
export const getDiscordUidFromHaloUid = async function (uid) {
	return process.env.NODE_ENV === 'production'
		? Object.values((await admin.database().ref(`users`).orderByChild('halo_id').equalTo(uid).get()).val())?.[0]
				?.discord_uid
		: '139120967208271872';
};

/**
 * Convert a halo-discord UID to a Discord UID
 * @param {string} uid
 * @returns {string | null} discord uid, if exists in map
 */
export const getDiscordUid = function (uid) {
	return process.env.NODE_ENV === 'production' ? DISCORD_USER_MAP.get(uid) : '139120967208271872';
};

export const getFirebaseUserSnapshot = async function (uid) {
	return (await admin.database().ref('users').child(uid).once('value')).val();
};

/**
 * Get all users currently using the service
 * @returns {Promise<string[]>} array of halo-discord uids
 */
export const getAllActiveUsers = async function () {
	return Object.keys(
		(await admin.database().ref('users').orderByChild('uninstalled').equalTo(null).get()).val() ?? {}
	);
};

/**
 * Retrieve a user's settings
 * @param {string} uid discord-halo uid
 * @returns {object} user settings
 */
export const getUserSettings = function (uid) {
	return USER_SETTINGS_STORE.get(uid) ?? DEFAULT_SETTINGS_STORE.values().map(({ id, value }) => ({ [id]: value }));
};

/**
 * Get the user-set value associated with the `setting_id`
 * @param {object} args Destructured arguments
 * @param {string} args.uid discord-halo uid
 * @param {string | number} args.setting_id ID of setting to retieve
 * @returns {any} The value of the user's setting if set, otherwise the default setting value
 */
export const getUserSettingValue = function ({ uid, setting_id }) {
	console.log(`Getting user setting value for ${uid} with setting_id ${setting_id}`);
	console.log(getUserSettings(uid)?.[setting_id]);
	return getUserSettings(uid)?.[setting_id];
};
