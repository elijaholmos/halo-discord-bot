import { MessageActionRow } from 'discord.js';

export class ConfirmInteraction extends MessageActionRow {
	constructor({ custom_id_suffix = '' } = {}) {
		custom_id_suffix &&= custom_id_suffix + '-';
		super({
			components: [
				{
					type: 2,
					custom_id: `${custom_id_suffix}confirm`,
					style: 3,
					label: 'Confirm',
				},
				{
					type: 2,
					custom_id: `${custom_id_suffix}cancel`,
					style: 4,
					label: 'Cancel',
				},
			],
			type: 1,
		});
	}
}
