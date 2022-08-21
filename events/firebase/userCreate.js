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

import admin from 'firebase-admin';
import { EmbedBase, FirebaseEvent, Logger, Firebase, Halo } from '../../classes';
import fs from 'node:fs/promises';
import path from 'node:path';

class UserCreate extends FirebaseEvent {
	constructor(bot) {
		super(bot, {
			name: 'UserCreate',
			description: 'Perform several operations when a user connects their Discord acct',
			collection: 'users',
		});
	}

	/**
	 *
	 * @param {FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>} doc
	 */
	async onAdd(doc) {
		const { bot } = this;
		const { discord_uid } = doc.data();
		Logger.debug(`New user created: ${JSON.stringify(doc.data())}`);
		const db = admin.firestore();
		//set custom claim
		await admin.auth().setCustomUserClaims(doc.id, { discord_uid });
		//update mapping table
		// await db.ref('discord_users_map').child(discord_uid).set(doc.id);
		//retrieve and set their halo id (at this point, user should have halo cookie in db)
		const cookie = (await db.doc(`cookies/${doc.id}`).get()).data();
		const halo_id = await Halo.getUserId({ cookie });
		await db.doc(`users/${doc.id}`).update({halo_id});

		//(attempt to) send connection message to user
		const user = await bot.users.fetch(discord_uid);
		await bot.sendDM({
			user,
			send_disabled_msg: false,
			embed: new EmbedBase(bot, {
				title: 'Accounts Connected Successfully',
				description: 'You will now receive direct messages when certain things happen in Halo!',
			}).Success(),
		});
		//TODO implement send_disabled_msg

		//retrieve and set halo classes & grades
		//create grade_notifications dir if it doesn't exist
		await fs.mkdir('./' + path.relative(process.cwd(), 'cache/grade_notifications'), { recursive: true });
		const grade_nofitication_cache = [];
		const halo_overview = await Halo.getUserOverview({ cookie, uid: halo_id });
		for (const class_obj of halo_overview.classes) {
			await db.collection('classes').doc(class_obj.id).set({
				name: class_obj.name,
				slugId: class_obj.slugId,
				classCode: class_obj.classCode,
				courseCode: class_obj.courseCode,
				stage: class_obj.stage,
			}, { merge: true });
			await db
				.collection('classes')
				.doc(class_obj.id)
				.collection('class_users')	// TODO: rename this to class_users
				.doc(doc.id)
				.set({
					discord_uid, //storing this may not be necessary if our bot holds a local cache
					status: class_obj.students.find((student) => student.userId === halo_id)?.status,
				}, { merge: true });
			// await db
			// 	.ref('users_classes_map')
			// 	.child(doc.id)
			// 	.child(class_obj.id)
			// 	.update({
			// 		discord_uid, //storing this may not be necessary if our bot holds a local cache
			// 		status: class_obj.students.find((student) => student.userId === halo_id)?.status,
			// 	});

			//retrieve all published grades and store in cache
			grade_nofitication_cache.push(
				...(
					await Halo.getAllGrades({
						cookie,
						class_slug_id: class_obj.slugId,
					})
				)
					.filter((grade) => grade.status === 'PUBLISHED')
					.map((grade) => grade.assessment.id)
			);
		}

		//write grade_notifications cache file
		await fs.writeFile(
			'./' + path.relative(process.cwd(), `cache/grade_notifications/${doc.id}.json`),
			JSON.stringify(grade_nofitication_cache)
		);

		//update user information for good measure
		await db.collection('users').doc(doc.id).update({
			firstName: halo_overview.userInfo.firstName,
			lastName: halo_overview.userInfo.lastName,
			sourceId: halo_overview.userInfo.sourceId,
		});

		//send message to bot channel
		bot.logConnection({
			embed: new EmbedBase(bot, {
				title: 'New User Connected',
				fields: [
					{
						name: 'Discord User',
						value: bot.formatUser(user),
					},
					{
						name: 'Halo User',
						value: `${halo_overview.userInfo.firstName} ${halo_overview.userInfo.lastName} (\`${halo_id}\`)`,
					},
				],
			}),
		});
	}

	/**
	 *
	 * @param {FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>} doc
	 */
	async onModify(doc) {
		console.log(doc.data());
		//extension uninstall process
		if (!!doc.data()?.uninstalled) {
			const { bot } = this;
			const { discord_uid } = doc.data();
			const db = admin.firestore();

			Logger.uninstall(doc.id);

			//delete user from discord_users_map
			// await db.ref('discord_users_map').child(discord_uid).remove();

			//remove their discord tokens
			await db.doc(`discord_tokens/${doc.id}`).delete();

			//remove all classes they were in
			//extract to FirebaseService method
			(await db.collectionGroup('class_users').where('discord_uid', '==', discord_uid).get())
				.forEach((class_user_doc) => {
					console.log('in class_user_doc forEach');
					console.log(class_user_doc.data())
					class_user_doc.ref.delete();
				});
			// for (const id of await Firebase.getAllUserClasses(doc.id)) {
			// 	//await db.ref('users_classes_map').child(doc.id).child(id).remove();
			// 	await db.collection('classes').doc(id).collection('class_users').doc(doc.id).delete();
			// }

			//remove their cookies
			await db.doc(`cookies/${doc.id}`).delete();
			//handle further cookie removal in CookieWatcher

			//delete their user acct in case they reinstall, to retrigger the auth process
			await admin.auth().deleteUser(doc.id);

			//send message to bot channel
			bot.logConnection({
				embed: new EmbedBase(bot, {
					title: 'User Uninstalled',
					fields: [
						{
							name: 'Discord User',
							value: bot.formatUser(await bot.users.fetch(discord_uid)),
						},
						{
							name: 'Halo User',
							value: `${doc.data().firstName} ${doc.data().lastName} (\`${
								doc.data().halo_id
							}\`)`,
						},
					],
				}).Error(),
			});
		}
	}

	onRemove(doc) {
		Logger.debug(`Doc Deleted: ${JSON.stringify(doc.data())}`);
	}
}

export default UserCreate;
