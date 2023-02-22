import bot from '../bot';
import { Logger, EmbedBase } from '.';

export class HealthManager {
	static #records = new Map();

	static record(event) {
		this.#records.set(event, Date.now());
		Logger.health(`recorded event: ${event}`);
	}

	static publishLogs() {
		const flags = [];
		// find all records that are older than 2min
		const fields = Array.from(this.#records).map(([event, date]) => {
			if (date < Date.now() - 120000) flags.push(event);
			return {
				name: `\`${event}\``,
				value: bot.formatTimestamp(date, 'R'),
				inline: true,
			};
		});

		const embed = new EmbedBase({
			title: 'Health Report',
			description: `Discord API Latency: ${bot.ws.ping}ms`,
			fields: [
				...(!!flags.length
					? [
							{
								name: 'Flags',
								value: flags.map((flag) => `\`${flag}\``).join('\n'),
							},
					  ]
					: []),
				...fields,
			],
		});
		!!flags.length && embed.Error();
		bot.logHealth({ embed, ...(!!flags.length && { content: '<@!139120967208271872> unhealthy status' }) });
	}
}
