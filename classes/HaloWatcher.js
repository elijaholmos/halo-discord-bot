import { EventEmitter } from 'node:events';
import { setIntervalAsync } from 'set-interval-async/fixed';
import { Halo, Firebase } from '../api';
import fs from 'node:fs/promises';
import path from 'path';

export class HaloWatcher extends EventEmitter {
    constructor() {
        super();
        

        //create intervals
        setIntervalAsync(async () => await this.#watchForAnnouncements(), 10000);
        setIntervalAsync(async () => await this.#watchForGrades(), 10000);
    }

    async #watchForAnnouncements() {
        //retrieve all courses that need information fetched
        const COURSES = await Firebase.getActiveClasses();

        //fetch new announcements
        for(const [id, course] of Object.entries(COURSES)) {
            if(!course.users) continue;
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

    async #watchForGrades() {
        //retrieve all courses that need information fetched
        const COURSES = await Firebase.getActiveClasses();

        //fetch new announcements
        for(const [id, course] of Object.entries(COURSES)) {
            for(const [uid, user] of Object.entries(course?.users || {})) {
                try {
                    if(user?.grade_notifications === false) return;   //grade notifications are off for this course
                    console.log(`Getting ${uid}'s grades for ${course.courseCode}...`);

                    //import cached grade notifications
                    //create file first, if it does not exist
                    await fs.mkdir('./' + path.relative(process.cwd(), 'cache/grade_notifications'), { recursive: true });
                    const cache = JSON.parse(
                        await fs.readFile('./' + path.relative(
                            process.cwd(), 
                            `cache/grade_notifications/${uid}.json`
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

                            //TODO: if the user has already viewed the grade, don't send a notification
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
                    await fs.writeFile('./' + path.relative(process.cwd(), `cache/grade_notifications/${uid}.json`), JSON.stringify(cache));
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
