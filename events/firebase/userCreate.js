/*
 * Copyright (C) 2023 Elijah Olmos
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

import bot from '../../bot';
import { CRON_USER_CLASS_STATUSES } from '../../caches';
import { EmbedBase, Firebase, FirebaseEvent, Halo, Logger, remove401 } from '../../classes';
import { auth, db } from '../../firebase';

class UserCreate extends FirebaseEvent {
	constructor() {
		super({
			name: 'UserCreate',
			description: 'Perform several operations when a user connects their Discord acct',
			ref: 'users',
		});
	}

	/**
	 *
	 * @param {DataSnapshot} snapshot
	 */
	async onAdd(snapshot) {
		const uid = snapshot.key;
		Logger.debug(`New user created: ${uid}: ${JSON.stringify(snapshot.val())}`);
		//retrieve and set their halo id (at this point, user should have halo cookie in db)
		const cookie = await Firebase.getUserCookie(uid, false);
		//await CookieManager.refreshUserCookie(uid, cookie); //immediately refresh cookie to trigger cache intervals
		const halo_id = await Halo.getUserId({ cookie });
		await db.ref(`users/${uid}`).child('halo_id').set(halo_id);

		//(attempt to) send connection message to user
		const user = await bot.users.fetch(uid);
		await bot.sendDM({
			user,
			send_disabled_msg: false,
			embed: new EmbedBase({
				title: 'Accounts Connected Successfully',
				description: 'You will now receive direct messages when certain things happen in Halo!',
			}).Success(),
		});
		//TODO implement send_disabled_msg

		//retrieve and set halo classes & grades
		//create grade_notifications dir if it doesn't exist
		//await mkdir('./' + relative(process.cwd(), 'cache/grade_notifications'), { recursive: true });
		//const grade_nofitication_cache = [];
		const { classes, userInfo } = await Halo.getUserOverview({ cookie, uid: halo_id });
		for (const { id, name, slugId, classCode, courseCode, stage, students } of classes.courseClasses) {
			await db.ref('classes').child(id).update({
				name,
				slugId,
				classCode,
				courseCode,
				stage,
			});
			await db
				.ref('user_classes_map')
				.child(uid)
				.child(id)
				.update({
					status: students.find(({ userId }) => userId === halo_id)?.status ?? 'UNKNOWN',
				});
			await db.ref('class_users_map').child(id).child(uid).set(true);

			//retrieve all published grades and store in cache
			// grade_nofitication_cache.push(
			// 	...(
			// 		await Halo.getAllGrades({
			// 			cookie,
			// 			class_slug_id: slugId,
			// 		})
			// 	)
			// 		.filter(({ status }) => status === 'PUBLISHED')
			// 		.map(({ assessment }) => assessment.id)
			// );
		}

		//write grade_notifications cache file
		// await writeFile(
		// 	'./' + relative(process.cwd(), `cache/grade_notifications/${uid}.json`),
		// 	JSON.stringify(grade_nofitication_cache)
		// );

		//send message to bot channel
		bot.logConnection({
			embed: new EmbedBase({
				title: 'New User Connected',
				fields: [
					{
						name: 'Discord User',
						value: bot.formatUser(user),
					},
					{
						name: 'Halo User',
						value: `${userInfo.firstName} ${userInfo.lastName} (\`${halo_id}\`)`,
					},
				],
			}),
		});
	}

	/**
	 *
	 * @param {DataSnapshot} snapshot
	 */
	async onModify(snapshot) {
		Logger.debug(`doc ${snapshot.key} modified`);
		Logger.debug(snapshot.val());

		//extension uninstall process
		const uninstall_date = snapshot.val()?.uninstalled ?? 0;
		//if uninstall did not occur within the last 5 minutes, ignore
		//this is to allow other modifications to the doc to occur without triggering the uninstall process
		if (Date.now() - uninstall_date <= 5000) {
			const { halo_id, ext_devices } = snapshot.val();
			const uid = snapshot.key;

			Logger.uninstall(uid);

			//retrieve user info for uninstall message
			let { userInfo } =
				(await Halo.getUserOverview({
					cookie: await Firebase.getUserCookie(uid, false),
					uid: halo_id,
				}).catch(() => null)) ?? {};
			userInfo ??= {};

			//send message to bot channel
			bot.logConnection({
				embed: new EmbedBase({
					title: 'User Uninstalled',
					fields: [
						{
							name: 'Discord User',
							value: bot.formatUser(await bot.users.fetch(uid)),
							inline: true,
						},
						{
							name: 'Device Count',
							value: ext_devices.toString(),
							inline: true,
						},
						{
							name: 'Halo User',
							value: !Object.keys(userInfo).length
								? 'Unable to retrieve user info'
								: `${userInfo.firstName} ${userInfo.lastName} (\`${halo_id}\`)`,
						},
					],
				}).Error(),
			}).catch(() => {}); //noop

			if (ext_devices > 0) return; //don't delete user data if they have the ext installed on other devices

			//remove their discord tokens
			await db.ref(`discord_tokens/${uid}`).remove();

			//remove all classes they were in
			for (const id of await Firebase.getAllUserClasses(uid)) {
				await db.ref('user_classes_map').child(uid).child(id).remove();
				//await db.ref('classes').child(id).child('users').child(uid).remove();
				await db.ref('class_users_map').child(id).child(uid).remove();
			}

			//remove their cookies
			await Firebase.removeUserCookie(uid);
			//handle further cookie removal in CookieWatcher

			//delete their user acct in case they reinstall, to retrigger the auth process
			await auth.deleteUser(uid);

			//remove user from cron job
			CRON_USER_CLASS_STATUSES.delete(uid);

			//remove user from 401 cache
			remove401(uid);
		}
	}

	onRemove(snapshot) {
		Logger.debug(`Doc Deleted: ${JSON.stringify(snapshot.val())}`);
	}
}

export default UserCreate;
