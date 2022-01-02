import { EventEmitter } from 'node:events';
import { setIntervalAsync } from 'set-interval-async/fixed';
import { Halo, Firebase } from '../api';

export class HaloWatcher extends EventEmitter {
    constructor() {
        super();
        setIntervalAsync(async () => await this.#watchForAnnouncements(), 10000);
    }

    async #watchForAnnouncements() {
        //retrieve all courses that need information fetched
        const COURSES = await Firebase.getActiveClasses();

        //fetch new announcements
        for(const [id, course] of Object.entries(COURSES).slice(0, 1)) {
            console.log(`Getting announcements for ${course.courseCode}...`);
            for(const data of (await Halo.getNewAnnouncements({
                class_id: id,
                //use the cookie of a user from the course
                cookie: await Firebase.getUserCookie(Object.keys(course.users)[0]),
                //inject the readable course code into the response objects
                metadata: {
                    courseCode: course.courseCode,
                },
            })))
                this.emit('announcement', data);
        }

        return;
    }
    
};
