// Bot configuration settings
export default {
    get production() {
        return {
            // Which users/roles get access to all commands
            command_perms: {
				categories: {
					moderator: [
						{
							// Moderator
							id: '904095889558212660',
							type: 'ROLE',
							permission: true,
						},
					],
					admin: [
						{
							// Moderator
							id: '904095889558212660',
							type: 'ROLE',
							permission: true,
						},
						{
							// staff
							id: '858144532318519326',
							type: 'ROLE',
							permission: true,
						},
					],
				},
                names: {
                    awardnft: [
                        {
                            // *drops
                            id: '914642168939962378',
                            type: 'ROLE',
                            permission: true,
                        },
                    ],
                },
			},
            main_guild_id: '270408632863031298',
            channels: {
                private_log: '928415523652374621',
                public_log: '928032754824802344',
                connection_log: '932058303779983470',
            },
            events: {
                goodActs: {
                    target_channel: '840679701118189579',
                },
                kindWords: {
                    target_channel: '830163592803254352',
                },
                addAlphaTesterRole: {
                    alpha_role: '751919744528941126',
                },
            },
            emoji: {},
            // bot.checkMod() returns true if user has any of these roles
            mod_roles: [
                '784875278593818694',   //Admin
                '752363863441145866',   //Mod
            ],
            // Can be self-assigned using a command
            self_roles: [
                '853414453206188063',   //do good alerts
                '874704370103615559',   //Bot Updates
            ],
            muted_role: '896538689734324224',
        };
    },
    get development() {
        return {
            // Which users/roles get access to all commands
            command_perms: {
				categories: {
					moderator: [
						{
							// Moderator
							id: '904095889558212660',
							type: 'ROLE',
							permission: true,
						},
					],
					admin: [
						{
							// Moderator
							id: '904095889558212660',
							type: 'ROLE',
							permission: true,
						},
						{
							// staff
							id: '858144532318519326',
							type: 'ROLE',
							permission: true,
						},
					],
				},
                names: {
                    awardnft: [
                        {
                            // *drops
                            id: '914642168939962378',
                            type: 'ROLE',
                            permission: true,
                        },
                    ],
                },
			},
            main_guild_id: '270408632863031298',
            channels: {
                private_log: '858141871788392448',
                public_log: '858141914841481246',
                connection_log: '932058303779983470',
            },
            events: {
                goodActs: {
                    target_channel: '877229121086840912',
                },
                kindWords: {
                    target_channel: '877229143786422323',
                },
                addAlphaTesterRole: {
                    alpha_role: '879817566799925298',
                },
            },
            emoji: {},
            mod_roles: [
                '858144532318519326',   //Staff
            ],
            self_roles: [
                '873234204706631720',
                '865629785015320608',
            ],
            muted_role: '894741083186139156',
        };
    },
    get staging() {
        return {
            ...this.development,
        };
    },
};