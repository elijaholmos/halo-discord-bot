import request from 'superagent';

export const refreshToken = async function ({cookie}) {
    const res = await request.post('https://halo.gcu.edu/api/refresh-token')
        .set({
            Accept: '*/*',
            authorization: `Bearer ${cookie.TE1TX0FVVEg}`,
            //'content-length': 474,
            'content-type': 'application/json',
            contexttoken: `Bearer ${cookie.TE1TX0NPTlRFWFQ}`,
            cookie: new URLSearchParams(Object.entries(cookie)).toString().replaceAll('&', '; '),
        });
    if(!res.body?.TE1TX0FVVEg) throw new Error(`Error fetching token, `, res);
    return {
        TE1TX0FVVEg: res.body['TE1TX0FVVEg'],
        TE1TX0NPTlRFWFQ: res.body['TE1TX0NPTlRFWFQ']
    };
};

/**
 * @param {Object} args Desctructured arguments
 * @param {Object} args.cookie The cookie object retrieved from Firebase
 * @param {string} args.class_id unique class ID
 * @param {Object} [args.metadata] Optional metadata to be injected into the announcement object
 * @returns {Promise<Array>} Array of announcements published within the past 10 seconds
 */
export const getNewAnnouncements = async function ({cookie, class_id, metadata={}} = {}) {
    const res = await request.post('https://gateway.halo.gcu.edu')
        .set({
            accept: '*/*',
            'content-type': 'application/json',
            authorization: `Bearer ${cookie.TE1TX0FVVEg}`,
            contexttoken: `Bearer ${cookie.TE1TX0NPTlRFWFQ}`,
        })
        .send({ //Specific GraphQL query syntax, reverse-engineered
            operationName: 'GetAnnouncementsStudent',
            variables: {
                courseClassId: class_id,
            },
            query: 'query GetAnnouncementsStudent($courseClassId: String!) {\n  announcements(courseClassId: $courseClassId) {\n    contextId\n    countUnreadPosts\n    courseClassId\n    dueDate\n    forumId\n    forumType\n    lastPost {\n      isReplied\n      __typename\n    }\n    startDate\n    endDate\n    title\n    posts {\n      content\n      expiryDate\n      forumId\n      forumTitle\n      id\n      isRead\n      modifiedDate\n      originalPostId\n      parentPostId\n      postStatus\n      publishDate\n      startDate\n      tenantId\n      title\n      postReadReceipts {\n        readTime\n        __typename\n      }\n      postTags {\n        tag\n        __typename\n      }\n      createdBy {\n        id\n        user {\n          firstName\n          lastName\n          __typename\n        }\n        __typename\n      }\n      resources {\n        kind\n        name\n        id\n        description\n        type\n        active\n        context\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n',
        });
    //Error handling and data validation could be improved
    if(!!res.error) throw new Error(res.error);
    //Filter posts that were published in last 10 seconds
    //Inject the class ID so we can use it to get the name later
    return [res.body.data.announcements.posts
        //.filter(post => new Date(post.publishDate).getTime() > new Date().getTime() - 10000)
        .map(post => ({...post, courseClassId: class_id, metadata}))
        .pop()];    
};

export const getUserOverview = async function ({cookie, uid}) {
    const res = await request.post('https://gateway.halo.gcu.edu')
		.set({
			accept: '*/*',
			'content-type': 'application/json',
			authorization: `Bearer ${cookie.TE1TX0FVVEg}`,
			contexttoken: `Bearer ${cookie.TE1TX0NPTlRFWFQ}`,
		})
		.send({
			//Specific GraphQL query syntax, reverse-engineered
			operationName: 'HeaderFields',
			variables: {
				userId: uid,
				skipClasses: false,
				skipInboxCount: true,
			},
			query: 'query HeaderFields($userId: String!, $skipClasses: Boolean!, $skipInboxCount: Boolean!) {\n  userInfo: getUserById(id: $userId) {\n    id\n    firstName\n    lastName\n    userImgUrl\n    sourceId\n    __typename\n  }\n  inboxPostCounts: getUnansweredOrUnreadPostsCount @skip(if: $skipInboxCount)\n  classes: getCourseClassesForUser @skip(if: $skipClasses) {\n    id\n    classCode\n    slugId\n    startDate\n    endDate\n    name\n    description\n    stage\n    modality\n    version\n    courseCode\n    units {\n      id\n      current\n      title\n      sequence\n      __typename\n    }\n    instructors {\n      ...headerUserFields\n      __typename\n    }\n    students {\n      ...headerUserFields\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment headerUserFields on CourseClassUser {\n  id\n  courseClassId\n  roleName\n  baseRoleName\n  status\n  userId\n  user {\n    ...headerUser\n    __typename\n  }\n  __typename\n}\n\nfragment headerUser on User {\n  id\n  userStatus\n  firstName\n  lastName\n  userImgUrl\n  __typename\n}\n',
		});
    //Error handling and data validation could be improved
    if(res.error) return console.error(res.error);
    return res.body.data;    
};

export const getUserId = async function ({cookie}) {
    const res = await request.post('https://halo.gcu.edu/api/token-validate/')
		.set({
			accept: '*/*',
			'content-type': 'application/json',
			authorization: `Bearer ${cookie.TE1TX0FVVEg}`,
			contexttoken: `Bearer ${cookie.TE1TX0NPTlRFWFQ}`,
		})
		.send({
            userToken: cookie.TE1TX0FVVEg,
            contextToken: cookie.TE1TX0NPTlRFWFQ,
        });
    //Error handling and data validation could be improved
    if(res.error) return console.error(res.error);
    return res.body.payload.userid;
};
