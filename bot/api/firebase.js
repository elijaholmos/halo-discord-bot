import admin from 'firebase-admin';
const ACTIVE_STAGES = [
    'PRE_START',
    'CURRENT',
];

export const getActiveClasses = async function () {
    return (await Promise.all(
        ACTIVE_STAGES.map(STAGE => {
            return admin.database().ref('classes').orderByChild('stage').equalTo(STAGE).get();
        })
    )).reduce((acc, cur) => Object.assign(acc, cur.val()), {});
};

export const getUserCookie = async function (uid) {
    return (await admin.database().ref('cookies').child(uid).get()).val();
};
