import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { Logger } from './classes/Logger';
import { config as dotenv_config } from 'dotenv';
dotenv_config();

const app = initializeApp({
	databaseURL:
		process.env.NODE_ENV === 'production'
			? 'https://discord-halo-default-rtdb.firebaseio.com'
			: 'https://halo-discord-dev-default-rtdb.firebaseio.com',
});
if (!app || getApps().length === 0) Logger.error('Error initializing firebase app');
else Logger.log('Firebase succesfully initialized');

export const apps = getApps();
export const auth = getAuth(app);
export const db = getDatabase(app);
