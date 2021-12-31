import admin from 'firebase-admin';

export const getAllClasses = async function () {
    const classes = await admin
        .database()
        .ref('classes')
        .get();
    return classes.val();
};

export const getUserCookie = async function (uid) {
    return (await admin.database().ref('cookies').child(uid).get()).val();
};
