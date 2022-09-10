import { FirebaseStore } from './classes';

export let DISCORD_USER_MAP;
export let USER_CLASSES_MAP;
export let CLASS_USERS_MAP;

export const initStores = function () {
	DISCORD_USER_MAP = new FirebaseStore({ path: 'discord_user_map' });
	USER_CLASSES_MAP = new FirebaseStore({ path: 'user_classes_map', bimap: false });
	CLASS_USERS_MAP = new FirebaseStore({ path: 'class_users_map', bimap: false });

	return Promise.all([DISCORD_USER_MAP.awaitReady(), USER_CLASSES_MAP.awaitReady(), CLASS_USERS_MAP.awaitReady()]);
};
