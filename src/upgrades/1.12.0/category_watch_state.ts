/* eslint-disable no-await-in-loop */

'use strict';

import * as database from '../../database';
const db = database as any;
const batch = require('../../batch');
import categories from '../../categories';
export default  {
	name: 'Update category watch data',
	timestamp: Date.UTC(2018, 11, 13),
	method: async function () {
		const { progress } = this as any;

		const cids = await db.getSortedSetRange('categories:cid', 0, -1);
		const keys = cids.map((cid) => `cid:${cid}:ignorers`);

		await batch.processSortedSet('users:joindate', async (uids) => {
			progress.incr(uids.length);
			for (const cid of cids) {
				const isMembers = await db.isSortedSetMembers(`cid:${cid}:ignorers`, uids);
				uids = uids.filter((uid, index) => isMembers[index]);
				if (uids.length) {
					const states = uids.map(() => categories.watchStates.ignoring);
					await db.sortedSetAdd(`cid:${cid}:uid:watch:state`, states, uids);
				}
			}
		}, {
			progress: progress,
			batch: 500,
		});

		await db.deleteAll(keys);
	},
};
