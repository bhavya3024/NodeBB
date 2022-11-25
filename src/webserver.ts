
'use strict';

import * as fs from 'fs';
const util = require('util');
import path from 'path';const os = require('os');
import nconf from 'nconf';
const express = require('express');
const chalk = require('chalk');

const app = express();
app.renderAsync = util.promisify((tpl, data, callback) => app.render(tpl, data, callback));
let server;
import winston from 'winston';
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const useragent = require('express-useragent');
const favicon = require('serve-favicon');
const detector = require('spider-detector');
const helmet = require('helmet');

const Benchpress = require('benchpressjs');
import { primaryDB as db } from './database';      
    

const analytics = require('./analytics');
const file = require('./file');
const emailer = require('./emailer');
const meta = require('./meta');
const logger = require('./logger');
const plugins = require('./plugins');
const flags = require('./flags');
const topicEvents = require('./topics/events');
const privileges = require('./privileges');
const routes = require('./routes');
const auth = require('./routes/authentication');

import helpers from './helpers';

if (nconf.get('ssl')) {
	server = require('https').createServer({
		key: fs.readFileSync(nconf.get('ssl').key),
		cert: fs.readFileSync(nconf.get('ssl').cert),
	}, app);
} else {
	server = require('http').createServer(app);
	console.log('SERVER', server);
}



server.on('error', (err) => {
	if ((err as any).code === 'EADDRINUSE') {
		winston.error(`NodeBB address in use, exiting...\n${err.stack}`);
	} else {
		winston.error(err.stack);
	}

	throw err;
});

// see https://github.com/isaacs/server-destroy/blob/master/index.js
const connections  = {} as any;
server.on('connection', (conn) => {
	const key = `${conn.remoteAddress}:${conn.remotePort}`;
	connections[key] = conn;
	conn.on('close', () => {
		delete connections[key];
	});
});

export const destroy = function (callback) {
	server.close(callback);
	for (const connection of Object.values(connections) as any) {
		connection.destroy();
	}
};

// @ts-ignore
export const listen = async function () {
	emailer.registerApp(app);
	setupExpressApp(app);
	helpers.register();
	logger.init(app);
	await initializeNodeBB();
	winston.info('🎉 NodeBB Ready');

	require('./socket.io').server.emit('event:nodebb.ready', {
		'cache-buster': meta.config['cache-buster'],
		hostname: os.hostname(),
	});

	plugins.hooks.fire('action:nodebb.ready');

	await listen2();
};

async function initializeNodeBB() {
	const middleware = require('./middleware');
	await meta.themes.setupPaths();
	await plugins.init(app, middleware);
	await plugins.hooks.fire('static:assets.prepare', {});
	await plugins.hooks.fire('static:app.preload', {
		app: app,
		middleware: middleware,
	});
	await routes(app, middleware);
	await privileges.init();
	await meta.blacklist.load();
	await flags.init();
	await analytics.init();
	await topicEvents.init();
}

function setupExpressApp(app) {
	const middleware = require('./middleware');
	const pingController = require('./controllers/ping');

	const relativePath = nconf.get('relative_path');
	const viewsDir = nconf.get('views_dir');

	app.engine('tpl', (filepath, data, next) => {
		filepath = filepath.replace(/\.tpl$/, '.js');

		Benchpress.__express(filepath, data, next);
	});
	app.set('view engine', 'tpl');
	app.set('views', viewsDir);
	app.set('json spaces', global.env === 'development' ? 4 : 0);
	app.use(flash());

	app.enable('view cache');

	if (global.env !== 'development') {
		app.enable('cache');
		app.enable('minification');
	}

	if (meta.config.useCompression) {
		const compression = require('compression');
		app.use(compression());
	}
	if (relativePath) {
		app.use((req, res, next) => {
			if (!req.path.startsWith(relativePath)) {
				return require('./controllers/helpers').redirect(res, req.path);
			}
			next();
		});
	}

	app.get(`${relativePath}/ping`, pingController.ping);
	app.get(`${relativePath}/sping`, pingController.ping);

	setupFavicon(app);

	app.use(`${relativePath}/apple-touch-icon`, middleware.routeTouchIcon);

	configureBodyParser(app);

	app.use(cookieParser(nconf.get('secret')));
	app.use(useragent.express());
	app.use(detector.middleware());
	app.use(session({
		store: db.sessionStore,
		secret: nconf.get('secret'),
		key: nconf.get('sessionKey'),
		cookie: setupCookie(),
		resave: nconf.get('sessionResave') || false,
		saveUninitialized: nconf.get('sessionSaveUninitialized') || false,
	}));

	setupHelmet(app);

	app.use(middleware.addHeaders);
	app.use(middleware.processRender);
	auth.initialize(app, middleware);
	const als = require('./als');
	app.use((req, res, next) => {
		als.run({ uid: req.uid }, next);
	});
	app.use(middleware.autoLocale); // must be added after auth middlewares are added

	const toobusy = require('toobusy-js');
	toobusy.maxLag(meta.config.eventLoopLagThreshold);
	toobusy.interval(meta.config.eventLoopInterval);
}

function setupHelmet(app) {
	const options = {
		contentSecurityPolicy: false, // defaults are too restrive and break plugins that load external assets... 🔜
		crossOriginOpenerPolicy: { policy: meta.config['cross-origin-opener-policy'] },
		crossOriginResourcePolicy: { policy: meta.config['cross-origin-resource-policy'] },
		referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
	} as any;

	if (!meta.config['cross-origin-embedder-policy']) {
		options.crossOriginEmbedderPolicy = false;
	}
	if (meta.config['hsts-enabled']) {
		options.hsts = {
			maxAge: meta.config['hsts-maxage'],
			includeSubDomains: !!meta.config['hsts-subdomains'],
			preload: !!meta.config['hsts-preload'],
		} as any;
	}

	app.use(helmet(options));
}


function setupFavicon(app) {
	let faviconPath = meta.config['brand:favicon'] || 'favicon.ico';
	faviconPath = path.join(nconf.get('base_dir'), 'public', faviconPath.replace(/assets\/uploads/, 'uploads'));
	if (file.existsSync(faviconPath)) {
		app.use(nconf.get('relative_path'), favicon(faviconPath));
	}
}

function configureBodyParser(app) {
	const urlencodedOpts = nconf.get('bodyParser:urlencoded') || {};
	if (!urlencodedOpts.hasOwnProperty('extended')) {
		urlencodedOpts.extended = true;
	}
	app.use(bodyParser.urlencoded(urlencodedOpts));

	const jsonOpts = nconf.get('bodyParser:json') || {};
	app.use(bodyParser.json(jsonOpts));
}

function setupCookie() {
	const cookie = meta.configs.cookie.get();
	const ttl = meta.getSessionTTLSeconds() * 1000;
	cookie.maxAge = ttl;

	return cookie;
}
// @ts-ignore
async function listen2() {
	let port = nconf.get('port');
	const isSocket = isNaN(port) && !Array.isArray(port);
	const socketPath = isSocket ? nconf.get('port') : '';

	if (Array.isArray(port)) {
		if (!port.length) {
			winston.error('[startup] empty ports array in config.json');
			(process as any).exit();
		}

		winston.warn('[startup] If you want to start nodebb on multiple ports please use loader.js');
		winston.warn(`[startup] Defaulting to first port in array, ${port[0]}`);
		port = port[0];
		if (!port) {
			winston.error('[startup] Invalid port, exiting');
			(process as any).exit();
		}
	}
	port = parseInt(port, 10);
	if ((port !== 80 && port !== 443) || nconf.get('trust_proxy') === true) {
		winston.info('🤝 Enabling \'trust proxy\'');
		app.enable('trust proxy');
	}

	if ((port === 80 || port === 443) && (process as any).env.NODE_ENV !== 'development') {
		winston.info('Using ports 80 and 443 is not recommend; use a proxy instead. See README.md');
	}

	const bind_address = ((nconf.get('bind_address') === '0.0.0.0' || !nconf.get('bind_address')) ? '0.0.0.0' : nconf.get('bind_address'));
	const args = isSocket ? [socketPath] : [port, bind_address];
	let oldUmask;

	if (isSocket) {
		oldUmask = (process as any).umask('0000');
		try {
			await testSocket(socketPath);
		} catch (err: any) {
			winston.error(`[startup] NodeBB was unable to secure domain socket access (${socketPath})\n${err.stack}`);
			throw err;
		}
	}

	return new Promise<void>((resolve, reject) => {
		server.listen(...args.concat([function (err) {
			const onText = `${isSocket ? socketPath : `${bind_address}:${port}`}`;
			if (err) {
				winston.error(`[startup] NodeBB was unable to listen on: ${chalk.yellow(onText)}`);
				reject(err);
			}

			winston.info(`📡 NodeBB is now listening on: ${chalk.yellow(onText)}`);
			winston.info(`🔗 Canonical URL: ${chalk.yellow(nconf.get('url'))}`);
			if (oldUmask) {
				(process as any).umask(oldUmask);
			}
			resolve();
		}]));
	});
}

export const testSocket = async function (socketPath) {
	if (typeof socketPath !== 'string') {
		throw new Error(`invalid socket path : ${socketPath}`);
	}
	const net = require('net');
	const file = require('./file');
	const exists = await file.exists(socketPath);
	if (!exists) {
		return;
	}
	return new Promise<void>((resolve, reject) => {
		const testSocket = new net.Socket();
		testSocket.on('error', (err) => {
			if ((err as any).code !== 'ECONNREFUSED') {
				return reject(err);
			}
			// The socket was stale, kick it out of the way
			fs.unlink(socketPath, (err) => {
				if (err) reject(err); else resolve();
			});
		});
		testSocket.connect({ path: socketPath }, () => {
			// Something's listening here, abort
			reject(new Error('port-in-use'));
		});
	});
};

require('./promisify').promisify(exports);

export default server;