import admin from 'firebase-admin';
import bot from '../../bot';
import { CRON_CLASS_STAGES, CRON_USER_CLASS_STATUSES } from '../../caches';
import { CronEvent, EmbedBase, Firebase, Halo, Logger } from '../../classes';
import { USER_CLASSES_MAP } from '../../stores';

// although this is two operations in one, it's more efficient to iterate over the users and their classes in a single run than to break it up
export default class extends CronEvent {
	constructor() {
		super({
			name: 'updateClassStageAndUserStatus',
			//schedule: '0 0 * * 0',
			schedule: '* * * * *',
		});
	}

	async #constructCaches() {
		if (CRON_CLASS_STAGES.size === 0) {
			Logger.cron(`[${this.name}] empty CRON_CLASS_STAGES detected, fetching data`);
			const classes = await Firebase.getAllClasses();
			for (const class_id in classes) CRON_CLASS_STAGES.set(class_id, classes[class_id]);
			Logger.cron(
				`[${this.name}] fetched ${Object.keys(classes).length} CRON_CLASS_STAGES, cached ${
					CRON_CLASS_STAGES.size
				} CRON_CLASS_STAGES`
			);
		}

		if (CRON_USER_CLASS_STATUSES.size === 0) {
			Logger.cron(`[${this.name}] empty CRON_CLASS_USER_STATUSES detected, fetching data`);
			for (const [uid, classes] of USER_CLASSES_MAP.entires()) CRON_USER_CLASS_STATUSES.set(uid, classes);
			Logger.cron(`[${this.name}] cached ${CRON_USER_CLASS_STATUSES.size} CRON_CLASS_USER_STATUSES`);
		}

		return console.log('at return statement');
	}

	async run() {
		Logger.cron(`[${this.name}] cron job execution started`);
		const changelog = []; //for post-job reporting
		const db = admin.database();

		//we can cache the previous job's results in local file to improve performance & save db costs
		await this.#constructCaches();

		//get all active users
		//for each active user, pull userOverview
		const users = await Firebase.getAllActiveUsersFull();
		console.log(users);
		//TODO: implement try-catch
		for (const uid in users) {
			const { halo_id } = users[uid];

			//user is not in cache, use FirestoreStore to get their classes from db
			if (!CRON_USER_CLASS_STATUSES.get(uid)) {
				changelog.push({
					type: 'new_user',
					id,
					classCode,
					old: 'N/A',
					new: 'N/A',
				});
				const data = USER_CLASSES_MAP.get(uid);
				console.log(`${uid} is not in CRON_CLASS_USER_STATUSES, fetched data:`);
				console.log(data);
				CRON_USER_CLASS_STATUSES.set(id, data);
				CRON_USER_CLASS_STATUSES.writeCacheFile({ filepath: id, data });
			}

			const { classes } = await Halo.getUserOverview({
				cookie: await Firebase.getUserCookie(uid),
				uid: halo_id,
			});

			for (const {
				id: class_id,
				name,
				slugId,
				classCode,
				courseCode,
				stage,
				students,
			} of classes.courseClasses) {
				const init_changelog_length = changelog.length; //to check if changes were made this iteration

				console.log('in nested for loop, class_id', class_id);
				console.log('CRON_CLASS_STAGES', CRON_CLASS_STAGES.get(class_id));

				// new class was added
				if (!CRON_CLASS_STAGES.get(class_id)) {
					changelog.push({
						type: 'new_class',
						id: class_id,
						classCode,
						old: 'N/A',
						new: 'N/A',
					});
					const data = { name, slugId, classCode, courseCode, stage };
					CRON_CLASS_STAGES.set(class_id, data);
					CRON_CLASS_STAGES.writeCacheFile({ filepath: class_id, data });
					//continue;
				}

				//realistically, stage is the only thing that will change at a course level
				if (CRON_CLASS_STAGES.get(class_id)?.stage !== stage) {
					changelog.push({
						type: 'class_stage',
						id: class_id,
						classCode,
						old: CRON_CLASS_STAGES.get(class_id)?.stage,
						new: stage,
					});
					await db.ref('classes').child(class_id).CRON_CLASS_STAGES.update({ stage });
					CRON_CLASS_STAGES.update(class_id, { stage });
				}

				const old_user_classes = CRON_USER_CLASS_STATUSES.get(uid);
				console.log('old_user', old_user_classes);
				const new_user_status = students.find(({ userId }) => userId === halo_id)?.status;

				// user enrolled in a new class
				if (!(class_id in old_user_classes)) {
					Logger.cron(`[${this.name}] ${uid} new class detected: ${class_id}`);
					changelog.push({
						type: 'user_new_class',
						uid,
						id: class_id,
						classCode,
					});
					//update db
					await db.ref('user_classes_map').child(uid).child(class_id).update({ status: new_user_status });
					//update local caches
					const data = { ...old_user_classes, [class_id]: { status: new_user_status } };
					CRON_USER_CLASS_STATUSES.set(uid, data);
					CRON_USER_CLASS_STATUSES.writeCacheFile({ filepath: uid, data });
					//continue;
				}

				//user's status for this specific class has changed
				if (old_user_classes[class_id]?.status !== new_user_status) {
					changelog.push({
						type: 'user_class_status',
						uid,
						id: class_id,
						classCode,
						old: old_user_classes[class_id].status,
						new: new_user_status,
					});
					await db.ref('user_classes_map').child(uid).child(class_id).update({ status: new_user_status });

					const data = { ...old_user_classes, [class_id]: { status: new_user_status } };
					CRON_USER_CLASS_STATUSES.update(uid, data);
					CRON_USER_CLASS_STATUSES.writeCacheFile({ filepath: uid, data });
				}

				if (init_changelog_length !== changelog.length) {
					Logger.cron(`[${this.name}] ${uid} changes detected in class ${class_id}, writingCacheFiles`);
					await CRON_CLASS_STAGES.writeCacheFile({
						filepath: class_id,
						data: CRON_CLASS_STAGES.get(class_id),
					});
					await CRON_USER_CLASS_STATUSES.writeCacheFile({
						filepath: uid,
						data: CRON_USER_CLASS_STATUSES.get(uid),
					});
				}

				// user should(?) be actively enrolled in class if it appears in their overview
				await db.ref('class_users_map').child(class_id).child(uid).set(true);
			}
		}

		bot.logCron({
			embed: new EmbedBase({
				color: 0xcedb39,
				title: `${this.name}`,
				description: 'summary of changes',
				fields: changelog.map(({ type, ...rest }) => ({
					name: `${type.toUpperCase()}`,
					value: Object.entries(rest).reduce((acc, [key, val]) => acc.concat(`\n${key}: 	\`${val}\``), ''),
				})),
			}),
		});

		Logger.cron(`[${this.name}] cron job execution finished`);
	}
}
