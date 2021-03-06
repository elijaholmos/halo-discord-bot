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
import path from 'path';
const ACTIVE_STAGES = [
    'PRE_START',
    'CURRENT',
];

export const getActiveClasses = async function () {
    return (
		await Promise.all(
			ACTIVE_STAGES.map((STAGE) =>
				admin
					.database()
					.ref('classes')
					.orderByChild('stage')
					.equalTo(STAGE)
					.get()
			)
		)
	).reduce((acc, cur) => Object.assign(acc, cur.val()), {});
};

export const getActiveUsersInClass = async function (class_id) {
    return process.env.NODE_ENV === 'production'
        ? (await admin
            .database()
            .ref(`classes/${class_id}/users`)
            .orderByChild('status')
            .equalTo('ACTIVE')
            .get()).val()
        : {
            'ollog10': {
                discord_uid: '139120967208271872',
            },
        };
};


export const getAllUserClasses = async function (uid) {
    return Object.keys((await admin
        .database()
        .ref(`users_classes_map`)
        .child(uid)
        .get()).toJSON());
};

/**
 * Get the Halo cookie object for a user
 * @param {string} uid Discord-Halo UID
 * @param {boolean} check_cache Whether the local cache should be checked first
 */
export const getUserCookie = async function (uid, check_cache = true) {
    try {
        if(!check_cache) throw 'Skipping cache check';
        const cache = await fs.readFile('./' + path.relative(
            process.cwd(), 
            `cache/cookies.json`
        ), 'utf8');
        if(uid in cache) return cache[uid].cookie;
        throw 'User not found in cache';
    } catch (e) {
        return (await admin.database().ref('cookies').child(uid).get()).val();
    }
};

export const updateUserCookie = async function (uid, cookie) {
    return await admin.database().ref('cookies').child(uid).update(cookie);
};

/**
 * Get a user's Discord UID from a Halo UID
 * @param {string} uid halo user id
 */
export const getDiscordUid = async function (uid) {
	return process.env.NODE_ENV === 'production' 
        ? Object.values(
            (await admin 
                .database()
                .ref(`users`)
                .orderByChild('halo_id')
                .equalTo(uid)
                .get()).val()
            )[0].discord_uid
        : '139120967208271872';
};

export const getFirebaseUserSnapshot = async function (uid) {
    return (await admin.database().ref('users').child(uid).once('value')).val();
};
