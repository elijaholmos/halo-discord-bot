import { initializeApp, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import creds from './credentials.js';

export default async function util() {
	try {
		const credentials = await creds();
		// Initialize Firebase
		const app = initializeApp(credentials.firebase);
		const auth = getAuth(app);
		const db = getDatabase(app);

		return {
			credentials,
			app,
			auth,
			db,
		};
	} catch (e) {
		console.error(e);
	}
}
