import admin from 'firebase-admin';
import { EmbedBase, FirebaseEvent } from '../../classes';
import { Halo } from '../../api';
import fs from 'node:fs/promises';
import path from 'path';

class UserCreate extends FirebaseEvent {
    constructor(bot) {
        super(bot, {
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
		const { bot } = this;
		const { discord_uid } = snapshot.val();
		console.log('New user created: ', snapshot.val());
        const db = admin.database();
        //set custom claim
		await admin.auth().setCustomUserClaims(snapshot.key, {
			discordUID: discord_uid,
		});
        //update mapping table
        await db.ref('discord_users_map').child(discord_uid).set(snapshot.key);
		//retrieve and set their halo id (at this point, user should have halo cookie in db)
		const cookie = (await db.ref(`cookies/${snapshot.key}`).get()).val();
		const halo_id = await Halo.getUserId({cookie});
		await db.ref(`users/${snapshot.key}`).child('halo_id').set(halo_id);

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
		const halo_overview = await Halo.getUserOverview({cookie, uid: halo_id});
		for(const class_obj of halo_overview.classes) {
			await db.ref('classes').child(class_obj.id).update({
				name: class_obj.name,
				slugId: class_obj.slugId,
				classCode: class_obj.classCode,
				courseCode: class_obj.courseCode,
				stage: class_obj.stage,
			});
			await db.ref('classes').child(class_obj.id).child('users').child(snapshot.key).update({
				discord_uid,	//storing this may not be necessary if our bot holds a local cache
				status: class_obj.students.find(student => student.userId === halo_id)?.status,
			});
			
			//retrieve all published grades and store in cache
			grade_nofitication_cache.push(...(await Halo.getAllGrades({
				cookie,
				class_slug_id: class_obj.slugId,
			})).filter(grade => grade.status === "PUBLISHED")
				.map(grade => grade.assessment.id));
		}
			
		//write grade_notifications cache file
		await fs.writeFile('./' + path.relative(process.cwd(), `cache/grade_notifications/${snapshot.key}.json`), JSON.stringify(grade_nofitication_cache));

		//update user information for good measure
		await db.ref('users').child(snapshot.key).update({
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

    onRemove(doc) {
        console.log('Doc Deleted', doc.val());
    }
}

export default UserCreate;
