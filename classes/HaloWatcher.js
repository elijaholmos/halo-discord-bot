import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import klaw from 'klaw';
import path from 'path';
import { setIntervalAsync } from 'set-interval-async/fixed';
import { Firebase, Halo } from '../api';

export class HaloWatcher extends EventEmitter {
    paths = {
        class_announcements: 'cache/class_announcements',
        grade_notifications: 'cache/grade_notifications',
    };
    cache = {
        class_announcements: new Map(),
        grade_notifications: new Map(),
    };
    constructor() {
        super();
        return (async () => {
            //import local cache files
            await this.#importCacheFiles();
            
			//create intervals
			setIntervalAsync(async () => await this.#watchForAnnouncements(), 10000);
			setIntervalAsync(async () => await this.#watchForGrades(), 10000);

			return this;
		})();
    }

    async #importCacheFiles() {
        const { cache, paths } = this;

        //create dir first, if it does not exist
        await fs.mkdir('./' + path.relative(process.cwd(), paths.class_announcements), { recursive: true });
        for await (const item of klaw('./' + path.relative(process.cwd(), paths.class_announcements))) {
            const file_path = path.parse(item.path);
            if (!file_path.ext || file_path.ext !== '.json') continue;
            cache.class_announcements.set(file_path.name.split('.')[0], 
				JSON.parse(await fs.readFile(item.path, 'utf8').catch(() => '[]')));
        }
        console.log(cache.class_announcements.size);

        //create dir first, if it does not exist
        await fs.mkdir('./' + path.relative(process.cwd(), paths.grade_notifications), { recursive: true });
        for await (const item of klaw('./' + path.relative(process.cwd(), paths.grade_notifications))) {
            const file_path = path.parse(item.path);
            if (!file_path.ext || file_path.ext !== '.json') continue;
            cache.grade_notifications.set(file_path.name.split('.')[0], 
				JSON.parse(await fs.readFile(item.path, 'utf8').catch(() => '[]')));
        }
        console.log(cache.grade_notifications.size);
        console.log(cache);
    }

    /**
     * returns an array of objects that are present in a1 but not a2
     * taken from https://stackoverflow.com/a/40538072
     * @param {Array} a1 
     * @param {Array} a2 
     */
    #locateDifferenceInArrays(a1, a2) {
        const id_array = a1.map(o => o.id).filter( function(n) { return !this.has(n) }, new Set(a2.map(o => o.id)));
        //^ an array of ids that we need to use to find the actual objects
        const diff_array = [];   //empty array to return later
        for(const id of id_array) {
            const found_obj = a1.find(o => o.id == id);
            !!found_obj && diff_array.push(found_obj);  //if we actually have an obj, push it
        }
        return diff_array;
    };

    async #watchForAnnouncements() {
        const cache = this.cache.class_announcements;

        const writeCacheFile = async ({filename, data}) => {
            return fs.writeFile('./' + path.relative(process.cwd(), `${this.paths.class_announcements}/${filename}.json`), JSON.stringify(data));
        };
        
        //retrieve all courses that need information fetched
        const COURSES = await Firebase.getActiveClasses();

        //fetch new announcements
        for(const [id, course] of Object.entries(COURSES)) {
            if(!course.users) continue;
            console.log(`Getting announcements for ${course.courseCode}...`);
            const old_announcements = cache.get(id) || [];
            const new_announcements = await Halo.getClassAnnouncements({
                class_id: id,
                //use the cookie of a user from the course
                cookie: await Firebase.getUserCookie(Object.keys(course.users)[0]),
                //inject the readable course code into the response objects
                metadata: {
                    courseCode: course.courseCode,
                },
            });
            console.log(old_announcements.length);
            console.log(new_announcements.length);
            const diff_announcements = [];
            
            cache.set(id, new_announcements);
            if(!old_announcements?.length) {
                //skip if there are no old announcements (after setting old_announcements for next iteration)
                await writeCacheFile({filename: id, data: new_announcements});
                continue;
            } 

            //new annoucnements were detected
            if(new_announcements.length > old_announcements.length) {
                console.log('difference in announcements size');
                //add to a diff array
                diff_announcements.push(...this.#locateDifferenceInArrays(new_announcements, old_announcements));
                //locally write cache to file, only if changes were detected
                await writeCacheFile({filename: id, data: new_announcements});
            }

            for(const announcement of diff_announcements)
                this.emit('announcement', announcement);
        }

        return;
    }

    async #watchForGrades() {
        const { paths } = this;
        //retrieve all courses that need information fetched
        const COURSES = await Firebase.getActiveClasses();

        //fetch new announcements
        for(const course of Object.values(COURSES)) {
            for(const [uid, user] of Object.entries(course?.users || {})) {
                try {
                    if(user?.grade_notifications === false) return;   //grade notifications are off for this course
                    //console.log(`Getting ${uid}'s grades for ${course.courseCode}...`);

                    //import cached grade notifications
                    //create file first, if it does not exist
                    await fs.mkdir('./' + path.relative(process.cwd(), paths.grade_notifications), { recursive: true });
                    const cache = JSON.parse(
                        await fs.readFile('./' + path.relative(
                            process.cwd(), 
                            `${paths.grade_notifications}/${uid}.json`
                        ), 'utf8'
                    ).catch(() => '[]'));

                    //console.log('cache is ', cache)

                    //get user cookie
                    const cookie = await Firebase.getUserCookie(uid);

                    //fetch current grades
                    const res = (await Halo.getAllGrades({
                        cookie,
                        class_slug_id: course.slugId,
                        metadata: {
                            courseCode: course.courseCode,
                        },
                    })).filter(grade => grade.status === "PUBLISHED");

                    //for each published grade that does not appear in the notification cache, emit an event
                    for(const grade of res) {
                        if(!cache.includes(grade.assessment.id)) {
                            cache.push(grade.assessment.id);  //store the grade in the notification cache

                            //if the user has already viewed the grade, don't send a notification
                            if(!!grade.userLastSeenDate) continue;
                            
                            //fetch the full feedback
                            this.emit('grade', await Halo.getGradeFeedback({
                                cookie,
                                assessment_id: grade.assessment.id,
                                uid: await Halo.getUserId({cookie}),
                                metadata: {
                                    courseCode: course.courseCode,
                                },
                            }));
                        }
                    }

                    //write the notification cache to disk
                    await fs.writeFile('./' + path.relative(process.cwd(), `${paths.grade_notifications}/${uid}.json`), JSON.stringify(cache));
                } catch(e) {
                    if(e.code === 401) {
                        console.log('401 received');
                        await Firebase.updateUserCookie(uid, await Halo.refreshToken({cookie: e.cookie}));
                    }
                }
            }
        }

        return;
    }
    
};
