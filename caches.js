import { LocalCache } from './classes';

export const CLASS_ANNOUNCEMENTS = new LocalCache({ path: 'class_announcements' });
export const USER_GRADES = new LocalCache({ path: 'user_grades', type: 'object' });
export const USER_INBOX = new LocalCache({ path: 'user_inbox', type: 'object' });
