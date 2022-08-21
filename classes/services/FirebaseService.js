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
const ACTIVE_STAGES = ['PRE_START', 'CURRENT'];

export const getActiveClasses = async function () {
	const res = await admin.firestore().collection('classes').where('stage', 'in', ACTIVE_STAGES).get();
	return res.docs.map((doc) => ({ [doc.id]: doc.data() }));
	return res.docs.reduce((acc, doc) => Object.assign(acc, doc.data()), {});
	return (
		await Promise.all(
			ACTIVE_STAGES.map((STAGE) => admin.firestore().collection('classes').where('stage', '==', STAGE).get())
		)
	).reduce((acc, cur) => Object.assign(acc, cur.val()), {});
};

export const getActiveUsersInClass = async function (class_id) {
	return process.env.NODE_ENV === 'production'
		? (
				await admin
					.firestore()
					.collection(`classes/${class_id}/class_users`)
					.where('status', '==', 'ACTIVE')
					.get()
		  ).docs.map((doc) => doc.data())
		: [
				{
					discord_uid: '139120967208271872',
				},
		  ];
	return process.env.NODE_ENV === 'production'
		? (
				await admin.firestore().ref(`classes/${class_id}/users`).orderByChild('status').equalTo('ACTIVE').get()
		  ).val()
		: {
				ollog10: {
					discord_uid: '139120967208271872',
				},
		  };
};

// export const getAllUserClasses = async function (uid) {
// 	(await admin
// 		.firestore()
// 		.collectionGroup('class_users')
// 		.where(FirebaseFirestore.FieldPath.documentId(), '==', uid)
// 		.get()).docs.map((doc) => {d});
// 	return Object.keys((await admin.firestore().ref(`users_classes_map`).child(uid).get()).toJSON());
// };

/**
 * Get the Halo cookie object for a user
 * @param {string} uid Discord-Halo UID
 * @param {boolean} check_cache Whether the local cache should be checked first
 */
export const getUserCookie = async function (uid, check_cache = true) {
	try {
		if (!check_cache) throw 'Skipping cache check';
		const cache = await fs.readFile('./' + path.relative(process.cwd(), `cache/cookies.json`), 'utf8');
		if (uid in cache) return cache[uid].cookie;
		throw 'User not found in cache';
	} catch (e) {
		return (await admin.firestore().collection('cookies').doc(uid).get()).data();
	}
};

export const updateUserCookie = async function (uid, cookie) {
	return await admin.firestore().collection('cookies').doc(uid).update(cookie);
};

/**
 * Get a user's Discord UID from a Halo UID
 * @param {string} uid halo user id
 */
export const getDiscordUid = async function (uid) {
	return process.env.NODE_ENV === 'production'
		? (await admin.firestore().collection(`users`).where('halo_id', '==', uid).get()).data().discord_uid
		: '139120967208271872';
};

export const getFirebaseUserSnapshot = async function (uid) {
	return (await admin.firestore().collection('users').doc(uid).get()).data();
};
