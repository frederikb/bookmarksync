// eslint-disable-next-line import/no-unassigned-import
import 'webext-base-css';
import './options.css';
import optionsStorage from '@/utils/options-storage.js';
import {getSyncBookmarks} from '@/utils/bookmarksync.js';

const bookmarkSyncService = getSyncBookmarks();

/**
 * @typedef {'success' | 'error' | 'in-progress' | null} CheckStatus
 */

async function init() {
	const form = document.querySelector('#options-form');

	const checkConnectionButton = document.querySelector('.check-connection-btn');
	const connectionMessage = document.querySelector('.connection-message');

	let isChecking = false;
	let cancelCurrentCheck = false;

	/**
	 * Displays a connection message.
	 * @param {CheckStatus} status - The status of the connection check.
	 * @param {string} message - The message to display.
	 */
	const showConnectionMessage = (status, message) => {
		connectionMessage.textContent = message;
		connectionMessage.className = '';
		connectionMessage.classList.add('connection-message', status);
	};

	/**
	 * Clear the connection message display.
	 */
	const clearConnectionMessage = () => {
		connectionMessage.textContent = '';
		connectionMessage.className = '';
		connectionMessage.classList.add('connection-message', 'hidden');
	};

	/**
	 * Updates the text and appearance of the check connection button given a status.
	 * @param {CheckStatus} status - The status of the connection check.
	 */
	const updateButton = status => {
		checkConnectionButton.textContent = status === 'in-progress' ? 'Checking…' : 'Check Connection(s)';
		checkConnectionButton.disabled = status === 'in-progress';
	};

	checkConnectionButton.addEventListener('click', async () => {
		if (isChecking) {
			return;
		}

		isChecking = true;
		cancelCurrentCheck = false;
		clearConnectionMessage();
		updateButton('in-progress');

		try {
			await bookmarkSyncService.validateBookmarks();
			if (cancelCurrentCheck) {
				updateButton(null);
				return;
			}

			updateButton('success');
			showConnectionMessage('success', 'Success');
		} catch (error) {
			if (cancelCurrentCheck) {
				updateButton(null);
				return;
			}

			updateButton('error');
			showConnectionMessage('error', error.message);
		} finally {
			isChecking = false;
			cancelCurrentCheck = false;
		}
	});

	const resetCheckConnection = () => {
		if (!isChecking) {
			updateButton(null);
			clearConnectionMessage();
		}
	};

	async function setupConnectionSource(form, sourceId) {
		const section = document.querySelector(`div#${sourceId}`);

		const showCustomHostInput = show => {
			const customHostContainer = section.querySelector('.custom-host-container');
			if (show) {
				customHostContainer.classList.remove('hidden');
			} else {
				customHostContainer.classList.add('hidden');
			}

			customHostContainer.querySelector('input').required = show;
		};

		const clearCustomHostInput = () => {
			section.querySelector(`[name='${sourceId}_githubApiUrl']`).value = '';
		};

		const setupCustomHostInput = async () => {
			const useCustomHostPropertyName = `${sourceId}_useCustomHost`;
			const githubApiUrlPropertyName = `${sourceId}_githubApiUrl`;

			const {[useCustomHostPropertyName]: useCustomHost = false} = await optionsStorage.getAll();
			showCustomHostInput(useCustomHost);
			if (!useCustomHost) {
				await optionsStorage.set({[githubApiUrlPropertyName]: ''});
				clearCustomHostInput();
			}
		};

		function setupActivateAdditionalBookmarkSource() {
			return async function () {
				const activePropertyName = `${sourceId}_active`;
				const {[activePropertyName]: active = true} = await optionsStorage.getAll();
				for (const input of section.querySelectorAll('input:not([type="checkbox"])')) {
					input.required = active;
				}

				if (active) {
					section.classList.remove('hidden');
				} else {
					section.classList.add('hidden');
				}
			};
		}

		const syncActivateAdditionalBookmarkSource = setupActivateAdditionalBookmarkSource();

		form.addEventListener('options-sync:form-synced', async () => {
			await setupState();
		});

		async function setupState() {
			await syncActivateAdditionalBookmarkSource();
			await setupCustomHostInput();
			cancelCurrentCheck = true;
			resetCheckConnection();
		}

		await setupState();
	}

	await setupConnectionSource(form, 'source1');
	await setupConnectionSource(form, 'source2');

	await optionsStorage.syncForm(form);
}

init();
