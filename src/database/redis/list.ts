'use strict';
import helpers from './helpers';


export default  function (module) {

	module.listPrepend = async function (key: string, value: string) {
		if (!key) {
			return;
		}
		await module.client.lpush(key, value);
	};

	module.listAppend = async function (key: string, value: string) {
		if (!key) {
			return;
		}
		await module.client.rpush(key, value);
	};

	module.listRemoveLast = async function (key: string) {
		if (!key) {
			return;
		}
		return await module.client.rpop(key);
	};

	module.listRemoveAll = async function (key: string, value: string) {
		if (!key) {
			return;
		}
		if (Array.isArray(value)) {
			const batch = module.client.batch();
			value.forEach(value => batch.lrem(key, 0, value));
			await helpers.execBatch(batch);
		} else {
			await module.client.lrem(key, 0, value);
		}
	};

	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}
		await module.client.ltrim(key, start, stop);
	};

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}
		return await module.client.lrange(key, start, stop);
	};

	module.listLength = async function (key: string) {
		return await module.client.llen(key);
	};
};