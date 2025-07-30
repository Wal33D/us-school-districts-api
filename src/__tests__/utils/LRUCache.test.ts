import { LRUCache } from '../../utils/LRUCache';

describe('LRUCache', () => {
	let cache: LRUCache<string>;

	beforeEach(() => {
		cache = new LRUCache<string>(3);
	});

	describe('basic operations', () => {
		test('should store and retrieve values', () => {
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');

			expect(cache.get('key1')).toBe('value1');
			expect(cache.get('key2')).toBe('value2');
		});

		test('should return undefined for non-existent keys', () => {
			expect(cache.get('nonexistent')).toBeUndefined();
		});

		test('should update existing values', () => {
			cache.set('key1', 'value1');
			cache.set('key1', 'updated');

			expect(cache.get('key1')).toBe('updated');
			expect(cache.size()).toBe(1);
		});
	});

	describe('LRU eviction', () => {
		test('should evict least recently used item when capacity is exceeded', () => {
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');
			cache.set('key3', 'value3');
			cache.set('key4', 'value4'); // This should evict key1

			expect(cache.get('key1')).toBeUndefined();
			expect(cache.get('key2')).toBe('value2');
			expect(cache.get('key3')).toBe('value3');
			expect(cache.get('key4')).toBe('value4');
		});

		test('should update access order on get', () => {
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');
			cache.set('key3', 'value3');

			// Access key1 to make it most recently used
			cache.get('key1');

			// Add key4, should evict key2 (least recently used)
			cache.set('key4', 'value4');

			expect(cache.get('key1')).toBe('value1');
			expect(cache.get('key2')).toBeUndefined();
			expect(cache.get('key3')).toBe('value3');
			expect(cache.get('key4')).toBe('value4');
		});

		test('should handle updating existing key without eviction', () => {
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');
			cache.set('key3', 'value3');

			// Update key1
			cache.set('key1', 'updated');

			// All keys should still be present
			expect(cache.get('key1')).toBe('updated');
			expect(cache.get('key2')).toBe('value2');
			expect(cache.get('key3')).toBe('value3');
			expect(cache.size()).toBe(3);
		});
	});

	describe('utility methods', () => {
		test('has() should correctly check key existence', () => {
			cache.set('key1', 'value1');

			expect(cache.has('key1')).toBe(true);
			expect(cache.has('key2')).toBe(false);
		});

		test('size() should return correct cache size', () => {
			expect(cache.size()).toBe(0);

			cache.set('key1', 'value1');
			expect(cache.size()).toBe(1);

			cache.set('key2', 'value2');
			expect(cache.size()).toBe(2);

			cache.set('key1', 'updated');
			expect(cache.size()).toBe(2);
		});

		test('clear() should empty the cache', () => {
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');

			cache.clear();

			expect(cache.size()).toBe(0);
			expect(cache.get('key1')).toBeUndefined();
			expect(cache.get('key2')).toBeUndefined();
		});
	});

	describe('edge cases', () => {
		test('should handle cache with size 1', () => {
			const smallCache = new LRUCache<string>(1);

			smallCache.set('key1', 'value1');
			expect(smallCache.get('key1')).toBe('value1');

			smallCache.set('key2', 'value2');
			expect(smallCache.get('key1')).toBeUndefined();
			expect(smallCache.get('key2')).toBe('value2');
		});

		test('should handle empty gets without errors', () => {
			expect(() => cache.get('nonexistent')).not.toThrow();
		});
	});
});