import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, set, push, child, update, } from 'firebase/database';
// https://firebase.google.com/docs/web/setup#available-libraries
import util from './util/util.js';

//IIFE to get top-level await
(async () => { 
    const { 
        credentials,
        auth,
        db,
    } = await util();

    //watch for cookie updates
    //store cookies locally to compare changes
    chrome.cookies.onChanged.addListener(async ({cookie}) => {
        //what about when cookie.value === null/undefined?
        if(cookie.domain !== 'halo.gcu.edu') return;
        if((await chrome.storage.sync.get(cookie.name))[cookie.name] === cookie.value) return console.log(`found dup cookie: ${cookie.name}`);
        await sweepHaloCookies();
    });

    const sweepHaloCookies = async function () {
        try {
            console.log('sweeping cookies');
            const cookies = await chrome.cookies.getAll({
                url: 'https://halo.gcu.edu',
            });
            for(const cookie of cookies) {
                await chrome.storage.sync.set({[cookie.name]: cookie.value});
                await set(child(ref(db, `cookies/${auth.currentUser.uid}`), cookie.name), cookie.value);
            }
        } catch(e) {
            console.log(e);
        }
        return;
    };

    (async function() {
        const { discord_uid, discord_access } = await chrome.storage.sync.get(['discord_uid', 'discord_access']);
        if(!discord_uid || !discord_access) return triggerDiscordAuthFlow();
        const { user } = await signInWithEmailAndPassword(auth, `${discord_uid}@discordhalo.app`, discord_access);
        //console.log(auth.currentUser);
        //await triggerDiscordAuthFlow();
        //const { claims } = await user.getIdTokenResult();
        //console.log(claims);
        //console.log(credentials);
    })();

    const refreshDiscordToken = async function (refresh_token) {
        try {
            //get an access token using the refresh token
            const res = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    ...credentials.discord,
                    grant_type: 'refresh_token',
                    refresh_token,
                }),
            });

            //get json response
            const res_json = await res.json();
            
            //store token locally
            chrome.storage.sync.set({discord: res_json});
            //store tokens in DB
            update(ref(db, `discord_tokens/${auth.currentUser.uid}`), res_json);

            console.log(`Refreshed access token: ${res_json.access_token}`);

            //lastly, return the access token
            return res_json.access_token;
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const fetchDiscordUser = async function (token) {
        const res = await fetch(`https://discord.com/api/users/@me`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        return await res.json();
    };

    const convertDiscordAuthCodeToToken = async function (auth_code) {
        const res = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                ...credentials.discord,
                grant_type: 'authorization_code',
                code: auth_code,
                redirect_uri: chrome.identity.getRedirectURL(),
            }).toString(),
        });

        return await res.json();    
    };

    const triggerDiscordAuthFlow = function () {
        chrome.identity.launchWebAuthFlow({
            url: `https://discord.com/api/oauth2/authorize?response_type=code&client_id=${credentials.discord.client_id}&redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL())}&scope=identify`,
            interactive: true,
        }, async (redirect_url) => {
            console.log(`https://discord.com/api/oauth2/authorize?response_type=code&client_id=${credentials.discord.client_id}&redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL())}&scope=identify`)
            console.log(redirect_url);
            if(!redirect_url) return;
            const discord_tokens = await convertDiscordAuthCodeToToken(new URL(redirect_url).searchParams.get('code'));
            //console.log(discord_tokens);
            //store tokens locally
            chrome.storage.sync.set({discord_access: discord_tokens.access_token});
            chrome.storage.sync.set({discord: discord_tokens});

            //fetch user info
            const discord_user = await fetchDiscordUser(discord_tokens.access_token);
            //store discord id locally
            chrome.storage.sync.set({discord_uid: discord_user.id});

            //create Firebase user
            const { user } = await createUserWithEmailAndPassword(auth, `${discord_user.id}@discordhalo.app`, discord_tokens.access_token);
            //console.log(user);

            //collect halo cookies and store in db BEFORE setting user info in firebase but AFTER authenticating user
            await sweepHaloCookies();

            //set user info in Firebase
            await set(ref(db, `users/${user.uid}`), {
                discord_uid: discord_user.id,
                created_on: Date.now(),
            });
            //store discord tokens in DB
            await update(ref(db, `discord_tokens/${auth.currentUser.uid}`), discord_tokens);
        });
    };
})();