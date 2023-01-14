# Preface

There are a _lot_ of moving parts that go into the Halo Notification Service tool suite and this repository especially. The codebase has **not** been optimized for third-party contributors, so there will be a degree of difficulty when setting up the initial project. Those unfamiliar with programming in Node.js environments will find navigating the codebase to be exceptionally difficult.

# Setting Up

This repository is, at its core, a Discord bot running in a [Node.js](https://nodejs.org/) environment. To begin setting up the project, clone the repository and navigate to the local directory. At the time of writing, the latest version of Node 16 is being used.

[pnpm](https://pnpm.io/) is the package manager for this project. Check out the [official installation guide](https://pnpm.io/) if you do not have that set up.

In the project directory, install the npm packages by running

```cmd
pnpm i --frozen-lockfile
```

Next, let's set up the environment variables.

# Environment Variables

`./env.sample` contains a template env var file with sample variables to fill in. Copy this file and rename the copy to `.env`. We'll go in order of the env variables:

## `BOT_TOKEN`

This is the Discord bot client secret that can be used to programmatically interact with the Discord API and autonomously control a bot user. [Discord.js](https://discord.js.org/#/) has published a brief [guide](https://discordjs.guide/preparations/setting-up-a-bot-application.html#creating-your-bot) that explains how to create a bot account and obtain its token.

## `GOOGLE_APPLICATION_CREDENTIALS`

[Google Firebase](https://firebase.google.com/) is the cloud database provider for this project. Unfortunately, due to the size of this project, there is no official mock database seed that can be loaded into development environments. However, for testing purposes, a Firebase instance can still be created and the credentials downloaded locally. This [guide](https://cloud.google.com/firestore/docs/client/get-firebase) explains how to create a new Firebase project.

## `RSA_PUBLIC_KEY` & `RSA_PRIVATE_KEY`

For [FERPA](https://studentprivacy.ed.gov/ferpa#0.1_se34.1.99_11)-compliancy, all student education records are encrypted with a hybrid AES/RSA encryption algorithm. The RSA public/private keys are uniquely generated per environment, and should not be shared or reused after their initial generation. A simple Node.js script can generate these keys, base-64 encode them, and write them to the local filesystem:

```js
import { generateKeyPairSync } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 });
await writeFile('public.pem', Buffer.from(publicKey.export({ type: 'spki', format: 'pem' })).toString('base64'));
await writeFile('private.pem', Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64'));
```

The content of these files can be directly used as values for the `RSA_PUBLIC_KEY` and `RSA_PRIVATE_KEY` environment variables.

# Local Development

For propriety, a (skeleton) mock API exists to test interactions between the Node.js app and the Halo API in an isolated environment. Unfortunately, the mock data for this mock API cannot be provided to contributors for security reasons. Examination of the `api/` directory will reveal a simple [Express.js](https://expressjs.com/) app. Close inspection of the `GatewayController` should reveal the different types of data that need to be included in the mock API, as well as where to store them. The bot will compile and initialize indepently of the mock API.

To start the Discord bot in a development environment, run the command:

```cmd
pnpm start
```

The entry point of the app is `index.js`.

# Conclusion

Apologies for the hastily-assembled contributing guide. I am a strong supporter of OSS, but I am also a student, and my time can only be split between so many things. Because the number of people that would benefit from the features of this project vastly outnumbers the number of people that would benefit from the documentation of it, I have accordingly prioritized feature-driven development.
