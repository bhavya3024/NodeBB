'use strict';

import path from 'path';import winston from 'winston';
import * as fs from 'fs';
const chalk = require('chalk');
import nconf from 'nconf';

import { primaryDB as db } from '../database';


const events = require('../events');
import meta from '../meta';
const plugins = require('../plugins');
const widgets = require('../widgets');
const privileges = require('../privileges');
const { paths, pluginNamePattern, themeNamePattern } = require('../constants');

export const reset = async function (options) {
	const map = {
		theme: async function () {
			let themeId = options.theme;
			if (themeId === true) {
				await resetThemes();
			} else {
				if (!themeNamePattern.test(themeId)) {
					// Allow omission of `nodebb-theme-`
					themeId = `nodebb-theme-${themeId}`;
				}

				themeId = await plugins.autocomplete(themeId);
				await resetTheme(themeId);
			}
		},
		plugin: async function () {
			let pluginId = options.plugin;
			if (pluginId === true) {
				await resetPlugins();
			} else {
				if (!pluginNamePattern.test(pluginId)) {
					// Allow omission of `nodebb-plugin-`
					pluginId = `nodebb-plugin-${pluginId}`;
				}

				pluginId = await plugins.autocomplete(pluginId);
				await resetPlugin(pluginId);
			}
		},
		widgets: resetWidgets,
		settings: resetSettings,
		all: async function () {
			await resetWidgets();
			await resetThemes();
			await resetPlugin();
			await resetSettings();
		},
	} as any;

	const tasks = Object.keys(map).filter(x => options[x]).map(x => (map as any)[x]);

	if (!tasks.length) {
		console.log([
			chalk.yellow('No arguments passed in, so nothing was reset.\n'),
			`Use ./nodebb reset ${chalk.red('{-t|-p|-w|-s|-a}')}`,
			'    -t\tthemes',
			'    -p\tplugins',
			'    -w\twidgets',
			'    -s\tsettings',
			'    -a\tall of the above',
			'',
			'Plugin and theme reset flags (-p & -t) can take a single argument',
			'    e.g. ./nodebb reset -p nodebb-plugin-mentions, ./nodebb reset -t nodebb-theme-persona',
			'         Prefix is optional, e.g. ./nodebb reset -p markdown, ./nodebb reset -t persona',
		].join('\n'));

		(process as any).exit(0);
	}

	try {
		await db.init();
		for (const task of tasks) {
			/* eslint-disable no-await-in-loop */
			await task();
		}
		winston.info('[reset] Reset complete. Please run `./nodebb build` to rebuild assets.');
		(process as any).exit(0);
	} catch (err: any) {
		winston.error(`[reset] Errors were encountered during reset -- ${err.message}`);
		(process as any).exit(1);
	}
};

async function resetSettings() {
	await privileges.global.give(['groups:local:login'], 'registered-users');
	winston.info('[reset] registered-users given login privilege');
	winston.info('[reset] Settings reset to default');
}

async function resetTheme(themeId: string) {
	try {
		await fs.promises.access(path.join(paths.nodeModules, themeId, 'package.json'));
	} catch (err: any) {
		winston.warn('[reset] Theme `%s` is not installed on this forum', themeId);
		throw new Error('theme-not-found');
	}
	await resetThemeTo(themeId);
}

async function resetThemes() {
	await resetThemeTo('nodebb-theme-persona');
}

async function resetThemeTo(themeId: string) {
	await meta.themes.set({
		type: 'local',
		id: themeId,
	});
	await meta.configs.set('bootswatchSkin', '');
	winston.info(`[reset] Theme reset to ${themeId} and default skin`);
}

async function resetPlugin(pluginId?: string) {
	try {
		if (nconf.get('plugins:active')) {
			winston.error('Cannot reset plugins while plugin state is set in the configuration (config.json, environmental variables or terminal arguments), please modify the configuration instead');
			(process as any).exit(1);
		}
		const isActive = await db.isSortedSetMember('plugins:active', pluginId);
		if (isActive) {
			await db.sortedSetRemove('plugins:active', pluginId);
			await events.log({
				type: 'plugin-deactivate',
				text: pluginId,
			});
			winston.info('[reset] Plugin `%s` disabled', pluginId);
		} else {
			winston.warn('[reset] Plugin `%s` was not active on this forum', pluginId);
			winston.info('[reset] No action taken.');
		}
	} catch (err: any) {
		winston.error(`[reset] Could not disable plugin: ${pluginId} encountered error %s\n${err.stack}`);
		throw err;
	}
}

async function resetPlugins() {
	if (nconf.get('plugins:active')) {
		winston.error('Cannot reset plugins while plugin state is set in the configuration (config.json, environmental variables or terminal arguments), please modify the configuration instead');
		(process as any).exit(1);
	}
	await db.delete('plugins:active');
	winston.info('[reset] All Plugins De-activated');
}

async function resetWidgets() {
	await plugins.reload();
	await widgets.reset();
	winston.info('[reset] All Widgets moved to Draft Zone');
}