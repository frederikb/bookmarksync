import './popup.css';
import logo from '@/assets/bookmarksync-icon.svg';
import {getSyncBookmarks} from '@/utils/bookmarksync.js';

const syncBookmarks = getSyncBookmarks();

document.querySelector('#bookmarksync-logo').src = logo;
document.querySelector('#sync-now').addEventListener('click', () => {
	try {
		console.log('Manual sync triggered');
		syncBookmarks(true);
	} catch (error) {
		console.error('Error triggering manual bookmark sync:', error);
	}
});
