import bot from '../../bot';
/**
 * Custom class for implementing scheduled cron events that will perform a particular task.
 * `run()` will be called every time the event is triggered.
 */
export class CronEvent {
	/**
	 *
	 * @param {Object} args Destructured arguments
	 * @param {string} args.name Name of the event (for logging purposes)
	 * @param {string} args.schedule Cron schedule expression
	 */
	constructor({ name = null, schedule = null }) {
		this.name = name;
		this.schedule = schedule;
		//import event config from bot config
		Object.assign(this, bot.config.events[this.name]);
	}

	run() {
		throw new Error(`CronEvent ${this.name} doesn't provide a run method.`);
	}
}
