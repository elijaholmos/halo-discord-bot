/*
 * Copyright (C) 2022 Elijah Olmos
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import klaw from 'klaw';
import path from 'node:path';
import { setIntervalAsync } from 'set-interval-async/fixed';
import { Firebase, Halo } from '.';
import { get, set } from 'lodash-es';

export class HaloWatcher extends EventEmitter {
    paths = {
        class_announcements: 'cache/class_announcements',
        user_grades: 'cache/user_grades',
    };
    cache = {
        class_announcements: new Map(),
        user_grades: {},
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
        //console.log(cache.class_announcements.size);

        //create dir first, if it does not exist
        await fs.mkdir('./' + path.relative(process.cwd(), paths.user_grades), { recursive: true });
        for await (const item of klaw('./' + path.relative(process.cwd(), paths.user_grades))) {
            const file_path = path.parse(item.path);
            if (!file_path.ext || file_path.ext !== '.json') continue;  //ignore directories and non-json files
            
            set(cache.user_grades, [file_path.dir.split(path.sep).pop(), file_path.name],  
				JSON.parse(await fs.readFile(item.path, 'utf8').catch(() => '[]')));
        }
        //console.log(cache.user_grades);
    }

    /**
     * returns an array of objects that are present in a1 but not a2
     * adapted from https://stackoverflow.com/a/40538072
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
            //console.log(`Getting announcements for ${course.courseCode}...`);
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
            //console.log(old_announcements.length);
            //console.log(new_announcements.length);
            const diff_announcements = [];
            
            cache.set(id, new_announcements);
            if(!old_announcements?.length) {
                //skip if there are no old announcements (after setting old_announcements for next iteration)
                await writeCacheFile({filename: id, data: new_announcements});
                continue;
            } 

            //new annoucnements were detected
            // !== rather than > because teachers can remove announcements
            if(new_announcements.length !== old_announcements.length) {
                console.log(`new_announcements: ${new_announcements.length}, old_announcements: ${old_announcements.length}`);
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
        const cache = this.cache.user_grades;

        const writeCacheFile = async ({filepath, data}) => {
            //create dir first, if it does not exist
            await fs.mkdir('./' + path.relative(process.cwd(), path.parse(`${this.paths.user_grades}/${filepath}`).dir), { recursive: true });
            return fs.writeFile('./' + path.relative(process.cwd(), `${this.paths.user_grades}/${filepath}`), JSON.stringify(data));
        };
        
        //retrieve all courses that need information fetched
        const COURSES = await Firebase.getActiveClasses();

        //fetch new announcements
        for(const [id, course] of Object.entries(COURSES)) {
            for(const [uid, user] of Object.entries(course?.users || {})) {
                try {
                    if(user?.grade_notifications === false) return;   //grade notifications are off for this course
                    //console.log(`Getting ${uid} grades for ${course.courseCode}...`);
                    const cookie = await Firebase.getUserCookie(uid); //store user cookie for multiple uses
                    const old_grades = get(cache, [id, uid], []);
                    //console.log(old_grades);
                    const new_grades = (await Halo.getAllGrades({
                        class_slug_id: course.slugId,
                        //use the cookie of a user from the course
                        cookie,
                        //inject the readable course code into the response objects
                        metadata: {
                            courseCode: course.courseCode,
                        },
                    })).filter(grade => grade.status === "PUBLISHED");
                    //console.log(old_grades.length);
                    //console.log(new_grades.length);
                    const diff_grades = [];

                    set(cache, [id, uid], new_grades);  //update local cache
                    if(!old_grades?.length) {
                        //skip if there are no old grades (after setting old_grades for next iteration)
                        await writeCacheFile({filepath: `${id}/${uid}.json`, data: new_grades});
                        continue;
                    } 

                    //new grades were detected
                    // !== rather than > because teachers can remove grades
                    if(new_grades.length !== old_grades.length) {
                        console.log(`new_grades: ${new_grades.length}, old_grades: ${old_grades.length}`);
                        //add to a diff array
                        diff_grades.push(...this.#locateDifferenceInArrays(new_grades, old_grades));
                        //locally write cache to file, only if changes were detected
                        await writeCacheFile({filepath: `${id}/${uid}.json`, data: new_grades});
                    }

                    for(const grade of diff_grades) {
                        //if the user has already viewed the grade, don't send a notification
                        if(!!grade.userLastSeenDate) continue;
                        //fetch the full grade feedback
                        this.emit('grade', await Halo.getGradeFeedback({
                            cookie,
                            assessment_id: grade.assessment.id,
                            //TODO: shift to Firebase.getHaloUid() from a Firebase UID
                            uid: await Halo.getUserId({cookie}),    //uid in scope of loop is Firebase uid
                            metadata: {
                                courseCode: course.courseCode,
                            },
                        }));
                    }
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
