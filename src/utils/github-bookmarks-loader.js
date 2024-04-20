import {Octokit} from '@octokit/rest';
import {retry} from '@octokit/plugin-retry';
import optionsStorage from '@/utils/options-storage.js';
import {
	AuthenticationError, DataNotFoundError, BookmarkSourceNotConfiguredError, RepositoryNotFoundError,
} from '@/utils/errors.js';

class GitHubBookmarksLoader {
	async load(options = {}) {
		const bookmarkFilesSource1 = await this.loadFromSource('source1', options);
		const {source2_active} = await optionsStorage.getAll(); // eslint-disable-line camelcase
		let bookmarkFilesSource2 = null;
		if (source2_active) { // eslint-disable-line camelcase
			bookmarkFilesSource2 = await this.loadFromSource('source2', options);
		}

		if (bookmarkFilesSource1 === null && bookmarkFilesSource2 === null) {
			return null;
		}

		const bookmarkFiles = [];
		if (bookmarkFilesSource1 !== null) {
			bookmarkFiles.push(...bookmarkFilesSource1);
		}

		if (bookmarkFilesSource2 !== null) {
			bookmarkFiles.push(...bookmarkFilesSource2);
		}

		return bookmarkFiles;
	}

	async loadFromSource(sourceId, {force = false, cacheEtag = true} = {}) {
		const options = await optionsStorage.getAll();
		const repo = options[`${sourceId}_repo`];
		const owner = options[`${sourceId}_owner`];
		const pat = options[`${sourceId}_pat`];
		const sourcePath = options[`${sourceId}_sourcePath`];
		const etag = options[`${sourceId}_etag`];
		const githubApiUrl = options[`${sourceId}_githubApiUrl`];

		if (!repo || !owner || !sourcePath || !pat) {
			throw new BookmarkSourceNotConfiguredError('Missing some or all required configuration values for the bookmark source');
		}

		const MyOctokit = Octokit.plugin(retry);
		const octokit = new MyOctokit({auth: pat, baseUrl: githubApiUrl || null});

		console.info(`Starting sync with GitHub using ${owner}/${repo}/${sourcePath}`);

		try {
			// Explicitly checking for the existence of the repo is slower, but enables more specific error messages
			// otherwise, we cannot differentiate between a wrong path and a wrong repo
			await octokit.rest.repos.get({
				owner,
				repo,
			});
		} catch (error) {
			if (error.status === 401) {
				throw new AuthenticationError('Authentication with GitHub failed. Please check your PAT.', error);
			} else if (error.status === 404) {
				throw new RepositoryNotFoundError(`The repository '${owner}/${repo}' does not exist or is not accessible with the provided PAT.`, error);
			}

			throw error;
		}

		try {
			const response = await octokit.rest.repos.getContent({
				owner,
				repo,
				path: sourcePath,
				mediaType: {
					format: sourcePath.endsWith('.json') ? 'raw' : 'json',
				},
				headers: etag && !force ? {'If-None-Match': etag} : {},
			});

			let bookmarkFileResponses = [];
			if (Array.isArray(response.data)) {
				if (response.data.length === 0) {
					throw new DataNotFoundError('No bookmark data found in folder.');
				}

				const files = response.data
					.filter(item => item.type === 'file')
					.filter(file => file.name.endsWith('.json'));
				const contentPromises = files.map(file => octokit.rest.repos.getContent({
					owner,
					repo,
					path: file.path,
					mediaType: {
						format: 'raw',
					},
				}));

				bookmarkFileResponses = await Promise.all(contentPromises);
			} else {
				bookmarkFileResponses = [response];
			}

			const bookmarkFiles = bookmarkFileResponses.map(file => JSON.parse(file.data));

			if (cacheEtag) {
				const etagPropertyName = `${sourceId}_etag`;
				await optionsStorage.set({[etagPropertyName]: response.headers.etag});
			}

			return bookmarkFiles;
		} catch (error) {
			if (error.status === 304) {
				console.log('No changes detected in bookmarks - nothing to sync');
				return null;
			}

			if (error.status === 401) {
				throw new AuthenticationError('Authentication with GitHub failed. Please check your PAT.', error);
			} else if (error.status === 404) {
				throw new DataNotFoundError(`The specified bookmarks file or folder '${sourcePath}' was not found.`, error);
			} else {
				throw error;
			}
		}
	}
}

export default GitHubBookmarksLoader;
