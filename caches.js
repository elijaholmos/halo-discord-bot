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

import { LocalCache } from './classes';

export const CLASS_ANNOUNCEMENTS = new LocalCache({ path: 'class_announcements' });
export const USER_GRADES = new LocalCache({ path: 'user_grades', type: 'object' });
export const USER_INBOX = new LocalCache({ path: 'user_inbox', type: 'object' });
