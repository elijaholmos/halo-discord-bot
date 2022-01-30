import admin from 'firebase-admin';
import { EmbedBase, FirebaseEvent, Logger } from '../../classes';
import { Firebase, Halo } from '../../api';
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
		Logger.debug(`New user created: ${JSON.stringify(snapshot.val())}`);
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
			await db.ref('users_classes_map').child(snapshot.key).child(class_obj.id).update({
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

	/**
     * 
     * @param {DataSnapshot} snapshot 
     */
	 async onModify(snapshot) {
		console.log(snapshot.val());
		//extension uninstall process
		if(!!snapshot.val()?.uninstalled) {
			const { bot } = this;
			const { discord_uid } = snapshot.val();
			const db = admin.database();

			Logger.uninstall(snapshot.key);
			
			//delete user from discord_users_map
			await db.ref('discord_users_map').child(discord_uid).remove();

			//remove their discord tokens
			await db.ref(`discord_tokens/${snapshot.key}`).remove();

			//remove all classes they were in
			for(const id of await Firebase.getAllUserClasses(snapshot.key)) {
				await db.ref('users_classes_map').child(snapshot.key).child(id).remove();
				await db.ref('classes').child(id).child('users').child(snapshot.key).remove();
			}

			//remove their cookies
			await db.ref(`cookies/${snapshot.key}`).remove();
			//handle further cookie removal in CookieWatcher

			//delete their user acct in case they reinstall, to retrigger the auth process
			await admin.auth().deleteUser(snapshot.key);

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
							value: `${snapshot.val().firstName} ${snapshot.val().lastName} (\`${snapshot.val().halo_id}\`)`,
						},
					],
				}).Error(),
			});
		}
	} 

    onRemove(snapshot) {
        Logger.debug(`Doc Deleted: ${JSON.stringify(snapshot.val())}`);
    }
}

export default UserCreate;
