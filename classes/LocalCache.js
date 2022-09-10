import klaw from 'klaw';
import { get, set } from 'lodash-es';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parse, relative, sep } from 'node:path';

export class LocalCache {
	/**
	 *
	 * @param {Object} args Desctructured arguments
	 * @param {String} args.path The filepath for the cache fiels
	 * @param {'map' | 'object'} [args.type] The type of cache. Defaults to `map`
	 */
	constructor({ path, type = 'map' }) {
		if (!path.startsWith('cache/')) path = `cache/${path}`;
		this.path = path;
		this.type = type;
		this._cache = type === 'map' ? new Map() : {};
	}

	get get() {
		const { _cache, type } = this;
		return type === 'map' ? _cache.get.bind(_cache) : (path, defaultValue = []) => get(_cache, path, defaultValue);
	}

	get set() {
		const { _cache, type } = this;
		return type === 'map' ? _cache.set.bind(_cache) : (path, value) => set(_cache, path, value);
	}

    get writeCacheFile() {
        return this.#writeCacheFile.bind(this);
    }

	/**
	 * import local cache files and reconstruct the LocalCache
	 */
	async loadCacheFiles() {
		const { path, type, _cache } = this;

		//create dir first, if it does not exist
		await mkdir('./' + relative(process.cwd(), path), { recursive: true });

		if (type === 'map')
			for await (const item of klaw('./' + relative(process.cwd(), path))) {
				const file_path = parse(item.path);
				if (file_path?.ext !== '.json') continue; //ignore directories and non-json files
				_cache.set(
					file_path.name.split('.')[0],
					JSON.parse(await readFile(item.path, 'utf8').catch(() => '[]'))
				);
			}
		else
			for await (const item of klaw('./' + relative(process.cwd(), path))) {
				const file_path = parse(item.path);
				if (file_path?.ext !== '.json') continue; //ignore directories and non-json files

				set(
					_cache,
					[file_path.dir.split(sep).pop(), file_path.name],
					JSON.parse(await readFile(item.path, 'utf8').catch(() => '[]'))
				);
			}
	}

	/**
	 *
	 * @param {Object} args Desctructured arguments
	 * @param {String} args.filepath filepath to be written to (can be nested)
	 * @param {any} args.data JSON-stringify-able data to be written to the file
	 */
	async #writeCacheFile({ filepath, data }) {
        const { path } = this;
		if (!filepath.endsWith('.json')) filepath += '.json';
		//create dir if it does not exist
		await mkdir('./' + relative(process.cwd(), parse(`${path}/${filepath}`).dir), { recursive: true });
		return writeFile('./' + relative(process.cwd(), `${path}/${filepath}`), JSON.stringify(data));
	}
}
