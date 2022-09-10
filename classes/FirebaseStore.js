//A local cache that stays in sync with Firestore but can be queried synchronously
import BiMap from 'bidirectional-map';
import admin from 'firebase-admin';

export class FirebaseStore {
	_cache = new BiMap(); //immutablity implies that local changes do not sync w database
	ready = false; //true when initialization is complete
	constructor({
		path = null, //firebase path to watch
		bimap = true, //whether to use a bimap or a map
	} = {}) {
		this.bimap = bimap;
		// Synchronously load data from Firestore and
		// set up watcher to keep local cache up to date
		(function createCache() {
			if (admin.apps.length === 0) return setTimeout(createCache.bind(this), 500); //wait until app is initialized
			admin
				.database()
				.ref(path)
				.on('value', (snapshot) => {
					this._cache = snapshot.exists()
						? this.bimap
							? new BiMap(snapshot.val())
							: new Map(Object.entries(snapshot.val()))
						: new (this.bimap ? BiMap : Map)();

					this.ready ||= true;
				});
		}.bind(this)());
	}

	/**
	 *
	 * @returns {Promise<boolean>} Promise that resolves to true when class has finished initialization
	 */
	awaitReady() {
		const self = this;
		return new Promise((resolve) => {
			(function resolveReady() {
				self.ready ? resolve(true) : setTimeout(resolveReady, 500);
			})();
		});
	}

	get(id) {
		//if(this.cache.has(id)) throw new Error(`Could not find ${id} in ${this.constructor.name}`);
		return this._cache.get(id) ?? (this.bimap ? this._cache.getKey(id) : null);
	}

	keys() {
		return [...this._cache.keys()];
	}

	values() {
		return [...this._cache.values()];
	}

	// Implement setter that updates local & cloud?
}
