import admin from 'firebase-admin';
import { FirebaseEvent } from '../../classes';
import { Halo } from '../../api';

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
		console.log('New user created: ', snapshot.val());
        const db = admin.database();
        //set custom claim
		await admin.auth().setCustomUserClaims(snapshot.key, {
			discordUID: snapshot.val().discord_uid,
		});
        //update mapping table
        await db.ref('discord_users_map').child(snapshot.val().discord_uid).set(snapshot.key);
		//retrieve and set their halo id (at this point, user should have halo cookie in db)
		const cookie = (await db.ref(`cookies/${snapshot.key}`).get()).val();
		const halo_id = await Halo.getUserId({cookie});
		await db.ref(`users/${snapshot.key}`).child('halo_id').set(halo_id);

		//retrieve and set halo classes
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
				discord_uid: snapshot.val().discord_uid,	//storing this may not be necessary if our bot holds a local cache
				status: class_obj.students.find(student => student.userId === halo_id)?.status,
			});
			
			//retrieve all published grades and store in cache
			const grades = (await Halo.getAllGrades({
				cookie,
				class_slug_id: class_obj.slugId,
			})).filter(grade => grade.status === "PUBLISHED");
			//create dir if it doesn't exist
			await fs.mkdir('./' + path.relative(process.cwd(), 'cache/grade_notifications'), { recursive: true });
			//write file
			await fs.writeFile('./' + path.relative(process.cwd(), `cache/grade_notifications/${uid}.json`), JSON.stringify(grades));
		}

		//update user information for good measure
		await db.ref('users').child(snapshot.key).update({
			firstName: halo_overview.userInfo.firstName,
			lastName: halo_overview.userInfo.lastName,
			sourceId: halo_overview.userInfo.sourceId,
		});
    }

    onRemove(doc) {
        console.log('Doc Deleted', doc.val());
    }
}

export default UserCreate;
