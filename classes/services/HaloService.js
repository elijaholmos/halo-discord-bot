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

import request from 'superagent';

const url = {
	gateway: process.env.NODE_ENV === 'production' ? 'https://gateway.halo.gcu.edu' : 'http://localhost:3000/gateway',
	token:
		process.env.NODE_ENV === 'production'
			? 'https://halo.gcu.edu/api/refresh-token'
			: 'http://localhost:3000/refresh-token',
	validate:
		process.env.NODE_ENV === 'production'
			? 'https://halo.gcu.edu/api/token-validate/'
			: 'http://localhost:3000/token-validate/',
};
const AUTHORIZATION_KEY = 'TE1TX0FVVEg';
const CONTEXT_KEY = 'TE1TX0NPTlRFWFQ';

export const refreshToken = async function ({ cookie }) {
	const res = await request.post(url.token).set({
		Accept: '*/*',
		authorization: `Bearer ${cookie[AUTHORIZATION_KEY]}`,
		//'content-length': 474,
		'content-type': 'application/json',
		contexttoken: `Bearer ${cookie[CONTEXT_KEY]}`,
		cookie: new URLSearchParams(Object.entries(cookie)).toString().replaceAll('&', '; '),
	});
	if (!res.body?.[AUTHORIZATION_KEY] || !res.body?.[CONTEXT_KEY]) throw `Error fetching token: ${res.body.error}`;

	return {
		[AUTHORIZATION_KEY]: res.body[AUTHORIZATION_KEY],
		[CONTEXT_KEY]: res.body[CONTEXT_KEY],
	};
};

/**
 * Get all published announcements for a class
 * @param {Object} args Desctructured arguments
 * @param {Object} args.cookie The cookie object retrieved from Firebase
 * @param {string} args.class_id unique class ID
 * @param {Object} [args.metadata] Optional metadata to be injected into the announcement object
 * @returns {Promise<Array>} Array of announcements published within the past 10 seconds
 */
export const getClassAnnouncements = async function ({ cookie, class_id, metadata = {} } = {}) {
	const res = await request
		.post(url.gateway)
		.set({
			accept: '*/*',
			'content-type': 'application/json',
			authorization: `Bearer ${cookie[AUTHORIZATION_KEY]}`,
			contexttoken: `Bearer ${cookie[CONTEXT_KEY]}`,
		})
		.send({
			//Specific GraphQL query syntax, reverse-engineered
			operationName: 'GetAnnouncementsStudent',
			variables: {
				courseClassId: class_id,
			},
			query: 'query GetAnnouncementsStudent($courseClassId: String!) {\n  announcements(courseClassId: $courseClassId) {\n    contextId\n    countUnreadPosts\n    courseClassId\n    dueDate\n    forumId\n    forumType\n    lastPost {\n      isReplied\n      __typename\n    }\n    startDate\n    endDate\n    title\n    posts {\n      content\n      expiryDate\n      forumId\n      forumTitle\n      id\n      isRead\n      modifiedDate\n      originalPostId\n      parentPostId\n      postStatus\n      publishDate\n      startDate\n      tenantId\n      title\n      postReadReceipts {\n        readTime\n        __typename\n      }\n      postTags {\n        tag\n        __typename\n      }\n      createdBy {\n        id\n        user {\n          firstName\n          lastName\n          __typename\n        }\n        __typename\n      }\n      resources {\n        kind\n        name\n        id\n        description\n        type\n        active\n        context\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n',
		});

	if (res.body?.errors?.[0]?.message?.includes('401')) throw { code: 401, cookie };
	//Error handling and data validation could be improved
	if (!!res.error) throw new Error(res.error);
	//Filter posts that were published in last 10 seconds
	//Inject the class ID so we can use it to get the name later
	return (
		res.body.data.announcements.posts
			.filter((post) => post.postStatus === 'PUBLISHED')
			//.filter(post => new Date(post.publishDate).getTime() > new Date().getTime() - 10000)
			.map((post) => ({ ...post, courseClassId: class_id, metadata }))
	);
};

/**
 * @param {Object} args Desctructured arguments
 * @param {Object} args.cookie The cookie object retrieved from Firebase
 * @param {string} args.class_slug_id unique class slug ID of format COURSE_CODE-SECTION-ID
 * @param {Object} [args.metadata] Optional metadata to be injected into each element of the response array
 * @returns {Promise<Array>} Array of all grades for the user whose `cookie` was provided
 */
export const getAllGrades = async function ({ cookie, class_slug_id, metadata = {} } = {}) {
	const res = await request
		.post(url.gateway)
		.set({
			accept: '*/*',
			'content-type': 'application/json',
			authorization: `Bearer ${cookie[AUTHORIZATION_KEY]}`,
			contexttoken: `Bearer ${cookie[CONTEXT_KEY]}`,
		})
		.send({
			//Specific GraphQL query syntax, reverse-engineered
			operationName: 'GradeOverview',
			variables: {
				courseClassSlugId: class_slug_id,
				courseClassUserIds: '', //auto-retrieved by token, I believe
			},
			query: 'query GradeOverview($courseClassSlugId: String!, $courseClassUserIds: [String]) {\n  gradeOverview: getAllClassGrades(\n    courseClassSlugId: $courseClassSlugId\n    courseClassUserIds: $courseClassUserIds\n  ) {\n    finalGrade {\n      id\n      finalPoints\n      gradeValue\n      isPublished\n      maxPoints\n      __typename\n    }\n    grades {\n      userLastSeenDate\n      assignmentSubmission {\n        id\n        submissionDate\n        __typename\n      }\n      assessment {\n        id\n        __typename\n      }\n      post {\n        id\n        publishDate\n        __typename\n      }\n      dueDate\n      accommodatedDueDate\n      finalComment {\n        comment\n        commentResources {\n          resource {\n            id\n            kind\n            name\n            type\n            active\n            context\n            description\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      finalPoints\n      id\n      status\n      userQuizAssessment {\n        accommodatedDuration\n        dueTime\n        duration\n        startTime\n        submissionDate\n        userQuizId\n        __typename\n      }\n      history {\n        comment\n        dueDate\n        status\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n',
		});

	if (res.body?.errors?.[0]?.message?.includes('401')) throw { code: 401, cookie };
	if (res.error) return console.error(res.error);
	return res.body.data.gradeOverview[0].grades.map((grade) => ({ ...grade, metadata }));
};

/**
 * @param {Object} args Desctructured arguments
 * @param {Object} args.cookie The cookie object retrieved from Firebase
 * @param {string} args.assessment_id the unique assessment ID
 * @param {string} args.uid Halo UID of assessment submission author
 * @param {Object} [args.metadata] Optional metadata to be injected into the response object
 * @returns {Promise<Object>} Array of all grades for the user whose `cookie` was provided
 */
export const getGradeFeedback = async function ({ cookie, assessment_id, uid, metadata = {} } = {}) {
	const res = await request
		.post(url.gateway)
		.set({
			accept: '*/*',
			'content-type': 'application/json',
			authorization: `Bearer ${cookie[AUTHORIZATION_KEY]}`,
			contexttoken: `Bearer ${cookie[CONTEXT_KEY]}`,
		})
		.send({
			//Specific GraphQL query syntax, reverse-engineered
			operationName: 'AssessmentFeedback',
			variables: {
				assessmentId: assessment_id,
				userId: uid,
			},
			query: 'query AssessmentFeedback($assessmentId: String!, $userId: String!) {      assessmentFeedback: getGradeForUserCourseClassAssessment(\n    courseClassAssessmentId: $assessmentId\n    userId: $userId\n  ) {\n    assessment {\n      courseClassId\n      inPerson\n      attachments {\n        id\n        resourceId\n        title\n        __typename\n      }\n      description\n      dueDate\n      exemptAccommodations\n      id\n      points\n      requiresLopesWrite\n      rubric {\n        name\n        id\n        __typename\n      }\n      startDate\n      tags\n      title\n      type\n      __typename\n    }\n    id\n    gradedDate\n    userLastSeenDate\n    dueDate\n    accommodatedDueDate\n    finalPoints\n    finalComment {\n      commentResources {\n        resource {\n          id\n          kind\n          name\n          context\n          description\n          embedReady\n          type\n          __typename\n        }\n        __typename\n      }\n      comment\n      __typename\n    }\n    assignmentSubmission {\n      id\n      dueDate\n      accommodatedDueDate\n      submissionDate\n      resources {\n        id\n        isFinal\n        percentQuotedText\n        similarityReportStatusEnum\n        similarityScore\n        wordCount\n        uploadDate\n        uploadedBy {\n          id\n          firstName\n          lastName\n          userImgUrl\n          __typename\n        }\n        resource {\n          id\n          kind\n          name\n          type\n          context\n          description\n          embedReady\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    rubricScores {\n      comment\n      criteriaId\n      rubricCellId\n      __typename\n    }\n    assessmentGroup {\n      id\n      name\n      groupStatus\n      groupUsers {\n        id\n        status\n        user {\n          id\n          firstName\n          lastName\n          userImgUrl\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    userQuizAssessment {\n      accommodatedDuration\n      dueTime\n      duration\n      startTime\n      userQuizId\n      submissionDate\n      __typename\n    }\n    post {\n      id\n      content\n      expiryDate\n      forumId\n      forumTitle\n      modifiedDate\n      originalPostId\n      parentPostId\n      postStatus\n      postTags {\n        tag\n        __typename\n      }\n      publishDate\n      resources {\n        id\n        kind\n        name\n        type\n        context\n        description\n        embedReady\n        __typename\n      }\n      wordCount\n      isRead\n      tenantId\n      __typename\n    }\n    participationSummary {\n      allPostsCount\n      endDate\n      substantivePostsSummary {\n        date\n        substantivePostsCount\n        totalPostsCount\n        __typename\n      }\n      __typename\n    }\n    user {\n      id\n      firstName\n      lastName\n      userImgUrl\n      sourceId\n      isAccommodated\n      __typename\n    }\n    __typename\n  }\n}\n',
		});

	if (res.body?.errors?.[0]?.message?.includes('401')) throw { code: 401, cookie };
	if (res.error) return console.error(res.error);
	return { ...res.body.data.assessmentFeedback, metadata };
};

export const getUserOverview = async function ({ cookie, uid }) {
	const res = await request
		.post(url.gateway)
		.set({
			accept: '*/*',
			'content-type': 'application/json',
			authorization: `Bearer ${cookie[AUTHORIZATION_KEY]}`,
			contexttoken: `Bearer ${cookie[CONTEXT_KEY]}`,
		})
		.send({
			//Specific GraphQL query syntax, reverse-engineered
			operationName: 'HeaderFields',
			variables: {
				userId: uid,
				skipClasses: false,
			},
			query: 'query HeaderFields($userId: String!, $skipClasses: Boolean!) {\n  userInfo: getUserById(id: $userId) {\n    id\n    firstName\n    lastName\n    userImgUrl\n    sourceId\n    __typename\n  }\n  classes: getCourseClassesForUser @skip(if: $skipClasses) {\n    courseClasses {\n      id\n      classCode\n      slugId\n      startDate\n      endDate\n      name\n      description\n      stage\n      modality\n      version\n      courseCode\n      units {\n        id\n        current\n        title\n        sequence\n        __typename\n      }\n      instructors {\n        ...headerUserFields\n        __typename\n      }\n      students {\n        isAccommodated\n        isHonors\n        ...headerUserFields\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment headerUserFields on CourseClassUser {\n  id\n  courseClassId\n  roleName\n  baseRoleName\n  status\n  userId\n  user {\n    ...headerUser\n    __typename\n  }\n  __typename\n}\n\nfragment headerUser on User {\n  id\n  userStatus\n  firstName\n  lastName\n  userImgUrl\n  sourceId\n  lastLogin\n  __typename\n}\n',
		});

	if (res.body?.errors?.[0]?.message?.includes('401')) throw { code: 401, cookie };
	//Error handling and data validation could be improved
	if (res.error) return console.error(res.error);
	return res.body.data;
};

/**
 * Get the Halo user ID from a Halo cookie object
 * @param {Object} args Destructured arguments
 * @param {Object} args.cookie Cookie object of the user
 * @returns {Promise<string>} Halo UID, pulled from the cookie
 */
export const getUserId = async function ({ cookie }) {
	const res = await request
		.post(url.validate)
		.set({
			accept: '*/*',
			'content-type': 'application/json',
			authorization: `Bearer ${cookie[AUTHORIZATION_KEY]}`,
			contexttoken: `Bearer ${cookie[CONTEXT_KEY]}`,
		})
		.send({
			userToken: cookie[AUTHORIZATION_KEY],
			contextToken: cookie[CONTEXT_KEY],
		});

	if (res.body?.errors?.[0]?.message?.includes('401')) throw { code: 401, cookie };
	//Error handling and data validation could be improved
	if (res.error) return console.error(res.error);
	return res.body.payload.userid;
};
