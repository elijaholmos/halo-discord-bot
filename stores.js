import { FirebaseStore } from './classes';

export const DISCORD_USER_MAP = new FirebaseStore({ path: 'discord_user_map' });
export const USER_CLASSES_MAP = new FirebaseStore({ path: 'user_classes_map', bimap: false });
export const CLASS_USERS_MAP = new FirebaseStore({ path: 'class_users_map', bimap: false });
