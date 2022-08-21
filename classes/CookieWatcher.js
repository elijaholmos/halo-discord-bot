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
import { Firebase, Halo } from '.';
// Watch for Cookie updates in Firebase and manually refresh Halo tokens when necessary
export class CookieWatcher {
	static REFRESH_INTERVAL = 1000 * 60 * 60 * 3; //3 hours
	static timeouts = new Map(); //to track and clear timeouts

	static async init() {
		const { timeouts, REFRESH_INTERVAL } = this;
		//import local cache
		this.cache = JSON.parse(
			await fs.readFile('./' + path.relative(process.cwd(), `cache/cookies.json`), 'utf8').catch(() => '{}')
		);

		//create intervals
		let i = 0;
		for (const [uid, data] of Object.entries(this.cache)) {
			timeouts.set(
				uid,
				setTimeout(() => this.refreshUserCookie(uid, data.cookie), Math.max(data.next_update - Date.now(), 0))
			);
			i++;
		}

		//watch db for changes
		const ref = admin.firestore().collection('cookies');
		ref.onSnapshot(async (snapshot) => {
			for (const {type, doc} of snapshot.docChanges()) {
				switch (type) {
					case 'modified': {
						const uid = doc.id;
						const cookie = doc.data();
						const next_update = Date.now() + REFRESH_INTERVAL;
						console.log(`${uid}'s cookie has been changed`);
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
						await fs.writeFile(
							'./' + path.relative(process.cwd(), `cache/cookies.json`),
							JSON.stringify(this.cache)
						);
						break;
					}
					//cookie was deleted, check to see it if was an uninstall
					case 'removed': {
						const uid = doc.id;
						if (!(await Firebase.getFirebaseUserSnapshot(uid))?.uninstalled) return;

						console.log(`${uid}'s cookie has been removed`);
						clearTimeout(timeouts.get(uid)); //clear timeout if it already exists for this user
						this.deleteUserCookie(uid); //remove their cookie from cache
						break;
					}
				}
			}
		});

		return i;
	}

	static async deleteUserCookie(uid) {
		delete this.cache[uid];
		//update local cache
		await fs.writeFile('./' + path.relative(process.cwd(), `cache/cookies.json`), JSON.stringify(this.cache));
		return;
	}

	static async refreshUserCookie(uid, cookie) {
		console.log(`Refreshing ${uid}'s cookie...`);
		try {
			const res = await Halo.refreshToken({ cookie });
			return await Firebase.updateUserCookie(uid, res);
		} catch (e) {
			console.error(`Error refreshing ${uid}'s cookie`);
			console.error(e);
			await this.deleteUserCookie(uid);
		}
	}
}
