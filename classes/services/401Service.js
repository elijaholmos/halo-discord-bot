import { Firebase, Logger, CookieManager } from '..';
import { COOKIES, USER_401s } from '../../caches';

export const handle401 = async ({ uid, msg }) => {
	Logger.unauth(msg);

	//update cache file for tracking 401s
	const data = { timestamp: Date.now() };
	USER_401s.set(uid, data);
	USER_401s.writeCacheFile({ filepath: uid, data });

	if (COOKIES.has(uid)) {
		Logger.debug(`Cookie object for ${uid} detected in cache; deleting...`);
		CookieManager.deleteUserCookie(uid);
	}

	Firebase.removeUserCookie(uid);
};

export const remove401 = async (uid) => {
	USER_401s.delete(uid);
	USER_401s.deleteCacheFile({ filepath: uid });
};
