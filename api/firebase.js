import admin from 'firebase-admin';
const ACTIVE_STAGES = [
    'PRE_START',
    'CURRENT',
];

export const getActiveClasses = async function () {
    return (
		await Promise.all(
			ACTIVE_STAGES.map((STAGE) =>
				admin
					.database()
					.ref('classes')
					.orderByChild('stage')
					.equalTo(STAGE)
					.get()
			)
		)
	).reduce((acc, cur) => Object.assign(acc, cur.val()), {});
};

export const getActiveUsersInClass = async function (class_id) {
    return (await admin
        .database()
        .ref(`classes/${class_id}/users`)
        .orderByChild('status')
        .equalTo('ACTIVE')
        .get()).val();
};

/**
 * Get the Halo cookie object for a user
 * @param {string} uid Discord-Halo UID
 */
export const getUserCookie = async function (uid) {
    return (await admin.database().ref('cookies').child(uid).get()).val();
};

/**
 * Get a user's Discord UID from a Halo UID
 * @param {string} uid halo user id
 */
export const getDiscordUid = async function (uid) {
	return (await admin
        .database()
        .ref(`users`)
        .orderByChild('halo_id')
        .equalTo(uid)
        .get()).val()?.discord_uid;
};
