import {browser} from 'wxt/browser';
import {defineProxyService} from '@webext-core/proxy-service';
import {registerSchema, validate} from '@hyperjump/json-schema/draft-07';
import {
	BookmarkSourceNotConfiguredError, AuthenticationError, BookmarksDataNotValidError, DataNotFoundError, RepositoryNotFoundError,
} from './errors.js';
import bookmarkSchema from '@/utils/bookmarks.1-0-0.schema.json';

/**
 * @typedef {Object} BookmarkCollection
 * @property {string} $schema - The URI of this exact JSON schema. Only allowed value is 'https://frederikb.github.io/bookmarksync/schemas/bookmarks.1-0-0.schema.json'.
 * @property {string} name - Name of the bookmark collection.
 * @property {BookmarkItem[]} bookmarks - Array of bookmarks, separators or folders.
 */

/**
 * @typedef {Object} BookmarkItem
 * @property {string} [title] - Title of the bookmark or folder. Required unless 'type' is 'separator'.
 * @property {string} [url] - URL of the bookmark. Only for bookmarks.
 * @property {BookmarkItem[]} [children] - Nested bookmarks or folders. Only for folders.
 * @property {'folder' | 'bookmark' | 'separator'} [type] - Type of the item. If absent, inferred from properties.
 */

/**
 * Interface for a service capable of loading bookmark data.
 * @typedef {Object} BookmarkLoader
 * @property {function({force?: boolean, cacheEtag?: boolean}): Promise<BookmarkCollection[]>} load Loads bookmark data, optionally using cache control.
 */

registerSchema(bookmarkSchema);

/**
 * Service for synchronizing bookmarks to the browser's bookmark bar.
 */
class BookmarkSyncService {
	/**
	 * The loader for fetching bookmark data
	 * @type {BookmarkLoader}
	 */
	#loader;

	/**
	 * @param {BookmarkLoader} loader the loader for fetching bookmark data
	 */
	constructor(loader) {
		this.#loader = loader;
	}

	/**
	 * Synchronizes bookmarks retrieved via the configured loader to the browser.
	 *
	 * @param {boolean} [force=false] whether to force re-fetching and synchronization of bookmarks
	 * @returns {Promise<void>} a promise that resolves when synchronization is complete
	 */
	async synchronizeBookmarks(force = false) {
		try {
			console.log(`Starting ${force ? 'forced ' : ''}bookmark synchronization`);

			const bookmarkFiles = await this.#loader.load({force});

			if (bookmarkFiles) {
				await validateBookmarkFiles(bookmarkFiles);
				const bookmarks = bookmarkFiles.flatMap(file => file.bookmarks);
				const deduplicatedBookmarks = removeDuplicatesByTitle(bookmarks);
				await syncBookmarksToBrowser(deduplicatedBookmarks);
				await notify('Bookmarks synchronized', 'Your bookmarks have been updated.');
				console.log('Bookmarks synchronized');
			}
		} catch (error) {
			if (error instanceof BookmarkSourceNotConfiguredError) {
				// Do not error out - perhaps the user just didn't yet set it up
				console.log('Could not sync because the required configuration values are not set');
			} else if (error instanceof AuthenticationError) {
				console.error('Authentication error:', error.message, error.originalError);
				await notify('Authentication failed', error.message);
			} else if (error instanceof DataNotFoundError) {
				console.error('Data not found error:', error.message, error.originalError);
				await notify('Data not found', error.message);
			} else if (error instanceof BookmarksDataNotValidError) {
				console.error('Bookmark data not valid error:', error.message);
				await notify('Invalid bookmark data', `Canceling synchronization: ${error.message}`);
			} else if (error instanceof RepositoryNotFoundError) {
				console.error('Repository not found error:', error.message);
				await notify('Repo not found', error.message);
			} else {
				console.error('Error during synchronization:', error);
				await notify('Synchronization failed', 'Failed to update bookmarks.');
			}
		}
	}

	/**
	 * Validates that valid bookmarks can be retrieved from the configured source.
	 *
	 * Throws exceptions in case of any problems.
	 *
	 * @returns {Promise<void>} a promise that resolves when validation is complete
	 */
	async validateBookmarks() {
		console.log('Validating the configured source of bookmarks');

		const bookmarkFiles = await this.#loader.load({force: true, cacheEtag: false});
		await validateBookmarkFiles(bookmarkFiles);
	}
}

export const [registerSyncBookmarks, getSyncBookmarks] = defineProxyService(
	'SyncBookmarksService',
	loader => new BookmarkSyncService(loader),
);

/**
 * Validates bookmark files against the bookmarks JSON schema.
 *
 * @param {BookmarkCollection[]} bookmarkFiles an array of bookmark files to validate
 * @throws {BookmarksDataNotValidError} thrown if any bookmark file fails to meet the schema requirements
 * @returns {Promise<void>} a promise that resolves when all bookmark files have been validated
 */
async function validateBookmarkFiles(bookmarkFiles) {
	const BOOKMARK_SCHEMA_URI = 'https://frederikb.github.io/bookmarksync/schemas/bookmarks.1-0-0.schema.json';
	const validator = await validate(BOOKMARK_SCHEMA_URI);

	for (const bookmarkFile of bookmarkFiles) {
		const validationResult = validator(bookmarkFile);
		if (!validationResult.valid) {
			const name = bookmarkFile.name || '<name not defined>';
			throw new BookmarksDataNotValidError(`The bookmarks file with name '${name}' is not valid`);
		}
	}
}

/**
 * Remove duplicate bookmark nodes based on their title.
 *
 * @param {BookmarkItem[]} bookmarks the bookmarks
 * @returns {BookmarkItem[]} the deduplicated bookmarks
 */
function removeDuplicatesByTitle(bookmarks) {
	return Array.from(new Map(bookmarks.map(item => [item.title, item])).values());
}

/**
 * Synchronize bookmarks to the browser's bookmarks bar.
 *
 * Replaces any existing bookmarks or folders with the same title.
 *
 * @param {BookmarkItem[]} newBookmarks the bookmarks
 */
async function syncBookmarksToBrowser(newBookmarks) {
	const bookmarksBarId = findBookmarksBarId();
	if (!bookmarksBarId) {
		throw new Error('Bookmarks Bar not found');
	}

	const existingBookmarksAndFolders = await getExisting(bookmarksBarId);

	for (const newBookmarkItem of newBookmarks) {
		// eslint-disable-next-line no-await-in-loop
		await syncBookmarksRootNode(bookmarksBarId, newBookmarkItem, existingBookmarksAndFolders);
	}
}

/**
 * Fetches the bookmarks bar ID based on the browser for which this extension is compiled.
 *
 * @returns {string} the bookmarks bar ID
 */
function findBookmarksBarId() {
	if (import.meta.env.FIREFOX) {
		return 'toolbar_____';
	}

	// Fallback to the id '1' which works at least in Chrome and Orion
	return '1';
}

/**
 * Retrieves the existing bookmarks under a given bookmarks bar by ID and maps them by title.
 *
 * @param {string} bookmarksBarId the ID of the bookmarks bar to retrieve children from
 * @returns {Promise<Map<string, BookmarkTreeNode>>} a map of bookmark titles to their corresponding bookmark items
 */
async function getExisting(bookmarksBarId) {
	const children = await browser.bookmarks.getChildren(bookmarksBarId);
	// eslint-disable-next-line unicorn/no-array-reduce
	return children.reduce((accumulator, item) => accumulator.set(item.title, item), new Map());
}

/**
 * Synchronize a bookmark item to the bookmark bar.
 *
 * If an existing bookmark or folder with the same title is found directly on the bookmark bar it will be replaced.
 * If the bookmark item to sync is a folder, it recursively creates its children.
 *
 * @param {string} bookmarkBarId the ID of the bookmarks bar where the bookmark or folder will be created
 * @param {BookmarkItem} newBookmarkItem the bookmark item to sync
 * @param {Map<string, BookmarkTreeNode>} existingBookmarksAndFolders a map of existing bookmark nodes and folders, keyed by title
 */
async function syncBookmarksRootNode(bookmarkBarId, newBookmarkItem, existingBookmarksAndFolders) {
	const existingNode = existingBookmarksAndFolders.get(newBookmarkItem.title);

	if (existingNode) {
		await (existingNode.url ? browser.bookmarks.remove(existingNode.id) : browser.bookmarks.removeTree(existingNode.id));
	}

	const newNode = await browser.bookmarks.create({
		parentId: bookmarkBarId,
		title: newBookmarkItem.title,
		url: newBookmarkItem.url,
	});

	if (!newBookmarkItem.url && newBookmarkItem.children) {
		await createBookmarks(newNode.id, newBookmarkItem.children);
	}
}

/**
 * Creates bookmarks recursively under a specified parent node.
 *
 * It considers environmental differences, such as feature availability in different browsers.
 *
 * @param {string} parentId the ID of the parent node where the bookmarks will be created
 * @param {BookmarkItem[]} bookmarks an array of bookmark items to create, which may include folders and separators
 * @returns {Promise} a promise that resolves when all bookmarks have been created
 */
async function createBookmarks(parentId, bookmarks) {
	/* eslint-disable no-await-in-loop */
	for (const item of bookmarks) {
		if (item.type === 'folder' || item.children) {
			const newFolder = await browser.bookmarks.create({parentId, title: item.title});
			await createBookmarks(newFolder.id, item.children);
		} else if (item.type === 'separator') {
			if (import.meta.env.FIREFOX) {
				await createSeparator(parentId);
			}
		} else {
			await browser.bookmarks.create({parentId, title: item.title, url: item.url});
		}
	}
	/* eslint-enable no-await-in-loop */
}

/**
 * Creates a bookmark separator under a specified parent node.
 *
 * This functionality is typically browser-specific and might not be supported in all browsers.
 * The caller is responsible for ensuring that this function is only called for supported browsers.
 *
 * @param {string} parentId the ID of the parent node under which to create the separator
 * @returns {Promise<BookmarkTreeNode>} a promise that resolves to the newly created bookmark separator node
 */
async function createSeparator(parentId) {
	return browser.bookmarks.create({parentId, type: 'separator'});
}

/**
 * Send a branded browser notification.
 *
 * Wrapper around the <code>browser.notifications</code> API.
 *
 * @param {string} title the title of the notification
 * @param {string} message the message content of the notification
 * @param {string} [type='basic'] the type of notification to create
 * @returns {Promise<string>} a promise that resolves to the ID of the created notification
 */
async function notify(title, message, type = 'basic') {
	const id = `sync-bookmarks-notification-${Date.now()}`;
	return browser.notifications.create(id, {
		type,
		iconUrl: browser.runtime.getURL('/icon/128.png'),
		title,
		message,
	});
}
