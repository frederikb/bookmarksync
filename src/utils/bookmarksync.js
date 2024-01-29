import {browser} from 'wxt/browser';
import {defineProxyService} from '@webext-core/proxy-service';
import {AuthenticationError, DataNotFoundError} from './errors.js';

export const [registerSyncBookmarks, getSyncBookmarks] = defineProxyService(
	'SyncBookmarksService',
	loader => async function (force = false) {
		try {
			console.log(`Starting ${force ? 'forced ' : ''}bookmark synchronization`);
			const bookmarksJson = await loader.load(force);
			if (bookmarksJson) {
				await syncBookmarksToBrowser(bookmarksJson);
				await notify('Bookmarks synchronized', 'Your bookmarks have been updated.');
				console.log('Bookmarks synchronized');
			}
		} catch (error) {
			if (error instanceof AuthenticationError) {
				console.error('Authentication error:', error.message, error.originalError);
				await notify('Authentication failed', 'Please check your Personal Access Token settings.');
			} else if (error instanceof DataNotFoundError) {
				console.error('Data not found error:', error.message, error.originalError);
				await notify('Data not found', 'The bookmarks could not be found. Please check the configured repo and path.');
			} else {
				console.error('Error during synchronization:', error);
				await notify('Synchronization failed', 'Failed to update bookmarks.');
			}
		}
	},
);

async function syncBookmarksToBrowser(newBookmarks) {
	const bookmarksBarId = await findBookmarksBarId();
	if (!bookmarksBarId) {
		throw new Error('Bookmarks Bar not found');
	}

	const existingBookmarksAndFolders = await getExisting(bookmarksBarId);

	const syncPromises = [];
	for (const newFolder of newBookmarks) {
		syncPromises.push(syncBookmarksRootNode(bookmarksBarId, newFolder, existingBookmarksAndFolders));
	}

	await Promise.all(syncPromises);
}

async function findBookmarksBarId() {
	if (import.meta.env.FIREFOX) {
		return 'toolbar_____';
	}

	// Assume that the bookmark bar has id '1' which works at least in Chrome and Orion
	return '1';
}

async function getExisting(bookmarksBarId) {
	const children = await browser.bookmarks.getChildren(bookmarksBarId);
	const map = {};

	for (const item of children) {
		map[item.title] = item;
	}

	return map;
}

async function syncBookmarksRootNode(parentId, node, existingBookmarksAndFolders) {
	const existingNode = existingBookmarksAndFolders[node.title];
	if (existingNode && existingNode.url) {
		await browser.bookmarks.remove(existingNode.id);
	} else if (existingNode && !existingNode.url) {
		await browser.bookmarks.removeTree(existingNode.id);
	}

	const newNode = await browser.bookmarks.create({parentId, title: node.title, url: node.url});
	if (!node.url) {
		await createBookmarks(newNode.id, node.children);
	}
}

async function createBookmarks(parentId, bookmarks) {
	const createPromises = bookmarks.map(item => {
		if (item.type === 'folder' || item.children) {
			return browser.bookmarks.create({parentId, title: item.title})
				.then(newFolder => createBookmarks(newFolder.id, item.children));
		}

		if (item.type === 'separator') {
			if (import.meta.env.FIREFOX) {
				return createSeparator(parentId);
			}

			return;
		}

		return browser.bookmarks.create({parentId, title: item.title, url: item.url});
	});

	return Promise.all(createPromises);
}

async function createSeparator(parentId) {
	return browser.bookmarks.create({parentId, type: 'separator'});
}

async function notify(title, message, type = 'basic') {
	const id = `sync-bookmarks-notification-${Date.now()}`;
	return browser.notifications.create(id, {
		type,
		iconUrl: browser.runtime.getURL('icon/128.png'),
		title,
		message,
	});
}
