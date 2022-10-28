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

import { Encrypt, Firebase, Halo, Logger, remove401 } from '.';
import { COOKIES } from '../caches';
import { db } from '../firebase';
import { AUTHORIZATION_KEY, CONTEXT_KEY } from './services/HaloService';

/**
 * @returns {boolean}
 */
export const isValidCookieObject = function (obj) {
	return obj?.hasOwnProperty(AUTHORIZATION_KEY) && obj?.hasOwnProperty(CONTEXT_KEY);
};

export const decryptCookie = function (cookie) {
	try {
		const { [AUTHORIZATION_KEY]: auth, [CONTEXT_KEY]: context } = cookie;
		if (!auth || !context) throw new Error('[encryptCookie] Unable to destruct cookie object');

		const decrypted_auth = Encrypt.decrypt(auth);
		const decrypted_context = Encrypt.decrypt(context);

		if (!decrypted_auth || !decrypted_context) throw new Error('[encryptCookie] Unable to decrypt cookie object');

		return { ...cookie, [AUTHORIZATION_KEY]: decrypted_auth, [CONTEXT_KEY]: decrypted_context };
	} catch (e) {
		Logger.error(e);
		return null;
	}
};

export const encryptCookie = function (cookie) {
	try {
		const { [AUTHORIZATION_KEY]: auth, [CONTEXT_KEY]: context } = cookie;
		if (!auth || !context) throw new Error('[encryptCookie] Unable to destructure cookie object');

		const encrypted_auth = Encrypt.encrypt(auth);
		const encrypted_context = Encrypt.encrypt(context);

		if (!encrypted_auth || !encrypted_context) throw new Error('[encryptCookie] Unable to encrypt cookie object');

		return { ...cookie, [AUTHORIZATION_KEY]: encrypted_auth, [CONTEXT_KEY]: encrypted_context };
	} catch (e) {
		Logger.error(e);
		return null;
	}
};

// Watch for Cookie updates in Firebase and manually refresh Halo tokens when necessary
export class CookieManager {
	static REFRESH_INTERVAL = 1000 * 60 * 60 * 1.9; //1.9 hours
	static timeouts = new Map(); //to track and clear timeouts

	static async init() {
		const { timeouts, REFRESH_INTERVAL } = this;

		//create intervals
		let i = 0; //counter to track & return total number of intervals created
		for (const [uid, { cookie, next_update }] of COOKIES.entires) {
			timeouts.set(
				uid,
				setTimeout(() => this.refreshUserCookie(uid, cookie), Math.max(next_update - Date.now(), 0))
			);
			i++;
		}

		const updateHandler = async (snapshot) => {
			const uid = snapshot.key;
			const encrypted_cookie = snapshot.val();
			const next_update = Date.now() + REFRESH_INTERVAL;
			Logger.cookie(`${uid}'s cookie has been changed`);
			if (!isValidCookieObject(encrypted_cookie))
				return Logger.cookie(`Invalid cookie object detected for ${uid}: ${JSON.stringify(cookie)}`);

			const cookie = decryptCookie(encrypted_cookie);
			if (!isValidCookieObject(cookie)) return Logger.cookie(`Unable to decrypt cookie for ${uid}`);

			clearTimeout(timeouts.get(uid)); //clear timeout if it already exists for this user
			timeouts.set(
				uid,
				setTimeout(() => this.refreshUserCookie(uid, cookie), REFRESH_INTERVAL)
			);

			//update local cache
			COOKIES.set(uid, { cookie, next_update });
			await COOKIES.writeCacheFile({ filepath: uid, data: { cookie, next_update } });
			await remove401(uid);
		};

		//watch db for changes
		const ref = db.ref('cookies');
		ref.orderByChild('timestamp').startAt(Date.now()).on('child_added', updateHandler);
		ref.on('child_changed', updateHandler);
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
		//update local cache
		COOKIES.delete(uid);
		COOKIES.deleteCacheFile({ filepath: uid });
		return;
	}

	static async refreshUserCookie(uid, cookie) {
		Logger.cookie(`Refreshing ${uid}'s cookie...`);
		try {
			const res = await Halo.refreshToken({ cookie });
			return await Firebase.updateUserCookie(uid, res);
		} catch (e) {
			Logger.cookie(`Error refreshing ${uid}'s cookie`);
			Logger.cookie(e);
			await this.deleteUserCookie(uid);
		}
	}
}
