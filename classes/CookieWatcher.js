import admin from 'firebase-admin';
import fs from 'node:fs/promises';
import path from 'path';
import { Firebase, Halo } from '../api';
// Watch for Cookie updates in Firebase and manually refresh Halo tokens when necessary
export class CookieWatcher {
    static REFRESH_INTERVAL = 1000 * 60 * 60 * 6; //6 hours

    static async init() {
        //import local cache
        const cache = JSON.parse(
            await fs.readFile('./' + path.relative(
                process.cwd(), 
                `cache/cookies.json`
            ), 'utf8'
        ).catch(() => '{}'));

        //create intervals
        let i = 0;
        for (const [uid, data] of Object.entries(cache)) {
            setTimeout(
                () => this.refreshUserCookie(uid, data.cookie),
                Math.max(data.next_update - Date.now(), 0)
            );
            i++;
        }

        //watch db for changes
        admin.database()
            .ref('cookies')
            .on('child_changed', async (snapshot) => {
                const uid = snapshot.key;
                const cookie = snapshot.val();
                const next_update = Date.now() + this.REFRESH_INTERVAL;
                console.log(`${uid}'s cookie has been changed`);
                setTimeout(() => this.refreshUserCookie(uid, cookie), this.REFRESH_INTERVAL);
                
                cache[uid] = {
                    cookie,
                    next_update,
                };
                
                //update local cache
                await fs.writeFile('./' + path.relative(process.cwd(), `cache/cookies.json`), JSON.stringify(cache));
            });
        return i;
    }

    static async refreshUserCookie(uid, cookie) {
        console.log(`Refreshing ${uid}'s cookie...`);
        try {
            const res = await Halo.refreshToken({cookie});
            return await Firebase.updateUserCookie(uid, res);
        } catch (e) {
            console.error(`Error refreshing ${uid}'s cookie`);
            console.error(e);
        }
    }
};