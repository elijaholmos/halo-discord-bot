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

import { CookieManager, Logger } from '..';
import { COOKIES, USER_401s } from '../../caches';

export const handle401 = async function ({ uid, msg }) {
	Logger.unauth(msg);

	//update cache file for tracking 401s
	const data = { timestamp: Date.now() };
	USER_401s.set(uid, data);
	await USER_401s.writeCacheFile({ filepath: uid, data });

	if (COOKIES.has(uid)) {
		Logger.debug(`[handle401] Cookie object for ${uid} detected in COOKIES cache; deleting...`);
		CookieManager.deleteUserCookie(uid);
	}

	//Firebase.removeUserCookie(uid);
};

export const remove401 = async function (uid) {
	if (!USER_401s.has(uid)) return;
	Logger.debug(`[remove401] Removing ${uid} from USER_401s cache...`);
	USER_401s.delete(uid);
	await USER_401s.deleteCacheFile({ filepath: uid });
};
