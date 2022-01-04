import { ref, update } from 'firebase/database';
import util from '../util/util.js';

(async function popup() {
    if(document.readyState !== 'complete')
        return setTimeout(popup, 500);

    // -------- Global Variables --------
    const {
        credentials,
        auth,
        db,
    } = await util();
    const { discord, discord_uid } = await chrome.storage.sync.get(['discord', 'discord_uid']);

    // -------- Methods --------
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

    const fetchDiscordUser = async function ({access_token, refresh_token} = {}) {
        try {
            const res = await fetch(`https://discord.com/api/users/@me`, {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            });
    
            if(res.status === 401 || res.status === 403) {
                await refreshDiscordToken(refresh_token);
                return fetchDiscordUser({access_token, refresh_token});
            }
    
            return await res.json();
        } catch(err) {
            console.log('Caught error: ', err);
        }
    };


    // -------- Main logic --------
    const { id, username, discriminator, avatar } = await fetchDiscordUser(discord);

    if(!!id) {
        document.querySelector('#discord-profile').setAttribute('src', !!avatar
            ? `https://cdn.discordapp.com/avatars/${discord_uid || id}/${avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${discriminator % 5}.png`);
        document.querySelector('#discord-username').textContent = `${username}#${discriminator}`;
    } else {
        document.querySelector('#discord-username').textContent = 'Unconnected';
    }
})();