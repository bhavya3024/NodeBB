'use strict';

import { primaryDB as db } from '../../database';
import meta from '../../meta';

export default  {
	name: 'Remove allow from uri setting',
	timestamp: Date.UTC(2020, 8, 6),
	method: async function () {
		if (meta.config['allow-from-uri']) {
			await db.setObjectField('config', 'csp-frame-ancestors', meta.config['allow-from-uri']);
		}
		await db.deleteObjectField('config', 'allow-from-uri');
	},
};