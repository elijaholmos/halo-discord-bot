import { initializeApp, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import creds from './credentials.js';

export default async function util() {
	try {
		const credentials = await creds();
		console.log(credentials);
		// Initialize Firebase
		const app = initializeApp(credentials.firebase);
		console.log(app);
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
