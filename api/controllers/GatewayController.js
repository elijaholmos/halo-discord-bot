import GetAnnouncementsStudent from '../data/GetAnnouncementsStudent';
import GradeOverview from '../data/GradeOverview';
import GetAssessmentFeedback from '../data/GetAssessmentFeedback';
import HeaderFields from '../data/HeaderFields';

export class GatewayController {
	static GetAnnouncementsStudent({ courseClassId }) {
		return GetAnnouncementsStudent;
	}
	static GradeOverview({ courseClassSlugId, courseClassUserIds }) {
		return GradeOverview;
	}
	static GetAssessmentFeedback({ assessmentId, userId }) {
		return GetAssessmentFeedback;
	}
	static HeaderFields({ userId: uid, skipClasses, skipInboxCount }) {
		return HeaderFields;
	}
}
