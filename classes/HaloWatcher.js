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
import { setIntervalAsync } from 'set-interval-async/fixed';
import { Firebase, Halo } from '.';
import { CLASS_ANNOUNCEMENTS, USER_GRADES, USER_INBOX } from '../caches';

export class HaloWatcher extends EventEmitter {
    constructor() {
        super();
        return (async () => {
			//create intervals
			setIntervalAsync(async () => await this.#watchForAnnouncements(), 20000);
			setIntervalAsync(async () => await this.#watchForGrades(), 20000);
            setIntervalAsync(async () => await this.#watchForInboxMessages(), 20000);

			return this;
		})();
    }

    /**
     * returns an array of objects that are present in a1 but not a2
     * 
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
        const { get, set, writeCacheFile } = CLASS_ANNOUNCEMENTS;

        //retrieve all courses that need information fetched
        const COURSES = await Firebase.getActiveClasses();
        //fetch new announcements
        for(const [class_id, course] of Object.entries(COURSES)) {
            try {
                const active_users = Firebase.getActiveUsersInClass(class_id);
                if(!active_users?.length) continue;
                //console.log(`Getting announcements for ${course.courseCode}...`);
                const old_announcements = get(class_id) || null;
                const new_announcements = await Halo.getClassAnnouncements({
                    class_id,
                    //use the cookie of a user from the course
                    cookie: await Firebase.getUserCookie(active_users[0]),
                    //inject the readable course code into the response objects
                    metadata: {
                        courseCode: course.courseCode,
                    },
                });
                // console.log(old_announcements?.length);
                // console.log(new_announcements.length);
                set(class_id, new_announcements);

                //if no old announcements, user just installed
                if(old_announcements === null) {
                    await writeCacheFile({filepath: class_id, data: new_announcements});
                    continue;
                }
                
                // === rather than > because teachers can remove announcements
                if(new_announcements.length === old_announcements.length) continue;
                
                //at this point, new announcements were detected
                console.log(`new_announcements: ${new_announcements.length}, old_announcements: ${old_announcements.length}`);
                //write local cache to file, since changes were detected
                await writeCacheFile({filepath: class_id, data: new_announcements});
                
                for(const announcement of this.#locateDifferenceInArrays(new_announcements, old_announcements))
                    this.emit('announcement', announcement);
            } catch(e) {
                console.error(`Error while fetching announcements for ${course.courseCode}: ${e}`);
            }
        }
    }

    async #watchForGrades() {
        const { get, set, writeCacheFile } = USER_GRADES;

        //retrieve all courses that need information fetched
        const COURSES = await Firebase.getActiveClasses();

        //fetch new grades
        for(const [course_id, course] of Object.entries(COURSES)) {
            for(const uid of Firebase.getActiveUsersInClass(course_id)) {
                try {
                    //console.log(`Getting ${uid} grades for ${course.courseCode}...`);
                    const cookie = await Firebase.getUserCookie(uid); //store user cookie for multiple uses
                    const old_grades = get([course_id, uid], null);
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
                    // console.log(old_grades?.length);
                    // console.log(new_grades.length);
                    set([course_id, uid], new_grades);  //update local cache

                    //if no old grades, user just installed
                    if(old_grades === null) {
                        writeCacheFile({filepath: `${course_id}/${uid}.json`, data: new_grades});
                        continue;
                    }

                    // === rather than > because teachers can remove grades
                    if(new_grades.length === old_grades.length) continue;

                    //at this point, new grades were detected
                    // console.log(`new_grades: ${new_grades.length}, old_grades: ${old_grades.length}`);
                    //write local cache to file, since changes were detected
                    await writeCacheFile({filepath: `${course_id}/${uid}.json`, data: new_grades});

                    for(const grade of this.#locateDifferenceInArrays(new_grades, old_grades)) {
                        //if the user has already viewed the grade, don't send a notification
                        if(!!grade.userLastSeenDate) continue;
                        if(!Firebase.getUserSettingValue({ uid, setting_id: 1 })) continue;    //check setting inside diff loop to ensure cache was updated

                        //fetch the full grade feedback
                        this.emit('grade', await Halo.getGradeFeedback({
                            cookie,
                            assessment_id: grade.assessment.id,
                            //TODO: shift to Firebase.getHaloUid() from a Firebase UID
                            uid: await Halo.getUserId({cookie}),    //uid in scope of loop is Firebase uid
                            metadata: {
                                courseCode: course.courseCode,
                                uid,
                            },
                        }));
                    }
                } catch(e) {
                    if(e.code === 401) {
                        console.error(`Received 401 while fetching ${uid} grades for course ${course.courseCode}`);
                    }
                }
            }
        }
    }

    async #watchForInboxMessages() {
        const { get, set, writeCacheFile } = USER_INBOX;

        const getUnreadMessagesCount = function getUnreadInboxMessagesCountFromCache ({uid, forumId}) {
            return get([uid, forumId], []).filter(({isRead}) => !isRead).length;
        };
        
        //retrieve all active users
        const ACTIVE_USERS = await Firebase.getAllActiveUsers();

        //retrieve all inbox forums that need information fetched
        for(const uid of ACTIVE_USERS) {
            try {
                const cookie = await Firebase.getUserCookie(uid); //store user cookie as var for multiple references
                for(const {forumId, unreadCount} of await Halo.getUserInbox({cookie})) {
                    //console.log(`Getting ${uid} inbox posts for forum ${forumId}...`);

                    //goal is to minimize halo API calls placed
                    const old_inbox_posts = get([uid, forumId], null);
                    //if no old inbox posts, user just installed
                    //if no unread posts or unread count is same as unread cache count (user has been notified but they have not acknowledged)
                    if (
                        old_inbox_posts !== null &&
                        (!unreadCount || unreadCount === getUnreadMessagesCount({uid, forumId}))
                    ) continue;
                    
                    const new_inbox_posts = await Halo.getPostsForInboxForum({cookie, forumId});
                    // console.log(old_inbox_posts?.length);
                    // console.log(new_inbox_posts.length);
                    set([uid, forumId], new_inbox_posts);  //update local cache

                    //if no old posts, user just installed
                    if(old_inbox_posts === null) {
                        writeCacheFile({filepath: `${uid}/${forumId}.json`, data: new_inbox_posts});
                        continue;
                    }

                    // === rather than > because teachers can delete messages ??? unconfirmed
                    if(new_inbox_posts.length === old_inbox_posts.length) continue;

                    //at this point, new inbox posts were detected
                    console.log(`new_inbox_posts: ${new_inbox_posts.length}, old_inbox_posts: ${old_inbox_posts.length}`);
                    //write local cache to file, since changes were detected
                    await writeCacheFile({filepath: `${uid}/${forumId}.json`, data: new_inbox_posts});
                    
                    for(const post of this.#locateDifferenceInArrays(new_inbox_posts, old_inbox_posts)) {
                        //if !post.iRead && post.id is not in cache, then dispatch event
                        if(!!post.isRead) continue;
                        if(!Firebase.getUserSettingValue({ uid, setting_id: 2 })) continue;    //check setting inside diff loop to ensure cache was updated
                        this.emit('inbox_message', {...post, metadata: { uid }});
                    }
                }
            } catch(e) {
                if(e.code === 401) {
                    console.error(`Received 401 while fetching ${uid} inbox notifications`);
                }
            }
        }
    }
};
