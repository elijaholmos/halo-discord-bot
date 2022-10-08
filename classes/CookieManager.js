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
import { readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { Firebase, Halo, Logger } from '.';

// Watch for Cookie updates in Firebase and manually refresh Halo tokens when necessary
export class CookieManager {
	static REFRESH_INTERVAL = 1000 * 60 * 60 * 1.9; //1.9 hours
	static timeouts = new Map(); //to track and clear timeouts

	static async init() {
		const { timeouts, REFRESH_INTERVAL } = this;
		//import local cache
		this.cache = JSON.parse(
			await readFile('./' + relative(process.cwd(), `cache/cookies.json`), 'utf8').catch(() => '{}')
		);

		//create intervals
		let i = 0; //counter to track & return total number of intervals created
		for (const [uid, { cookie, next_update }] of Object.entries(this.cache)) {
			timeouts.set(
				uid,
				setTimeout(() => this.refreshUserCookie(uid, cookie), Math.max(next_update - Date.now(), 0))
			);
			i++;
		}

		const updateHandler = (type) => async (snapshot) => {
			const uid = snapshot.key;
			const cookie = snapshot.val();
			const next_update = Date.now() + REFRESH_INTERVAL;
			console.log(`in updateHandler - ${type}`);
			Logger.cookie(`${uid}'s cookie has been changed`);
			clearTimeout(timeouts.get(uid)); //clear timeout if it already exists for this user
			timeouts.set(
				uid,
				setTimeout(() => this.refreshUserCookie(uid, cookie), REFRESH_INTERVAL)
			);

			this.cache[uid] = {
				cookie,
				next_update,
			};

			//update local cache
			await writeFile('./' + relative(process.cwd(), `cache/cookies.json`), JSON.stringify(this.cache));
		};

		//watch db for changes
		const ref = admin.database().ref('cookies');
		ref.on('child_changed', updateHandler('child_changed'));
		//cookie was deleted, check to see it if was an uninstall
		ref.on('child_removed', async (snapshot) => {
			const uid = snapshot.key;
			if (!(await Firebase.getFirebaseUserSnapshot(uid))?.uninstalled) return;

			Logger.cookie(`${uid}'s cookie has been removed`);
			clearTimeout(timeouts.get(uid)); //clear timeout if it already exists for this user
			this.deleteUserCookie(uid); //remove their cookie from cache
		});

		return i;
	}

	static async deleteUserCookie(uid) {
		delete this.cache[uid];
		//update local cache
		await writeFile('./' + relative(process.cwd(), `cache/cookies.json`), JSON.stringify(this.cache));
		return;
	}

	static async refreshUserCookie(uid, cookie) {
		Logger.cookie(`Refreshing ${uid}'s cookie...`);
		try {
			const res = await Halo.refreshToken({ cookie });
			return await Firebase.updateUserCookie(uid, { ...res, test: Date.now().toLocaleString() });
		} catch (e) {
			Logger.cookie(`Error refreshing ${uid}'s cookie`);
			Logger.cookie(e);
			await this.deleteUserCookie(uid);
		}
	}
}
