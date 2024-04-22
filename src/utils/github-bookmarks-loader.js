import {Octokit} from '@octokit/rest';
import {retry} from '@octokit/plugin-retry';
import optionsStorage from '@/utils/options-storage.js';
import {
	AuthenticationError, DataNotFoundError, BookmarkSourceNotConfiguredError, RepositoryNotFoundError,
} from '@/utils/errors.js';

class GitHubBookmarksLoader {
	async load({force = false, cacheEtag = true} = {}) {
		const {repo, owner, pat, sourcePath, etag, githubApiUrl} = await optionsStorage.getAll();

		if (!repo || !owner || !sourcePath || !pat) {
			throw new BookmarkSourceNotConfiguredError();
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
				await optionsStorage.set({etag: response.headers.etag});
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
