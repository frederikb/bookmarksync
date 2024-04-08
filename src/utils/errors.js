class AuthenticationError extends Error {
	constructor(message, originalError) {
		super(message);
		this.name = 'AuthenticationError';
		this.originalError = originalError;
	}
}

class BookmarkSourceNotConfiguredError extends Error {
	constructor(message) {
		super(message);
		this.name = 'BookmarkSourceNotConfiguredError';
	}
}

class DataNotFoundError extends Error {
	constructor(message, originalError) {
		super(message);
		this.name = 'DataNotFoundError';
		this.originalError = originalError;
	}
}

class BookmarksDataNotValidError extends Error {
	constructor(message) {
		super(message);
		this.name = 'BookmarksDataNotValidError';
	}
}

class RepositoryNotFoundError extends Error {
	constructor(message, originalError) {
		super(message);
		this.name = 'RepositoryNotFoundError';
		this.originalError = originalError;
	}
}

export {
	AuthenticationError, DataNotFoundError, BookmarksDataNotValidError, BookmarkSourceNotConfiguredError, RepositoryNotFoundError,
};
