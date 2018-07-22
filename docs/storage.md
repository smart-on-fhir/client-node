# The storage interface
By default this module has a built-in storage adapter that uses sessions for
storing SMART data. You can also create your own storage object. This object must
implement the following very simple interface:
```ts
/**
 * Sets (adds or updates) a value at the given key
 * @param {String} key 
 * @param {any} value 
 * @returns {Promise<any>} A promise resolved with the stored value
 */
set(key: string, value: any): Promise<any>

/**
 * Reads the value at the given key
 * @param {String} key 
 * @returns {Promise<any>} A promise resolved with the stored value or undefined
 */
get(key: string): Promise<any>

/**
 * Deletes the value at the given key (if one exists)
 * @param {String} key 
 * @returns {Promise<Boolean>} A promise resolved with true if the value
 * was removed or with false otherwise
 */
unset(key: string) Promise<boolean>
```
Then you can use the getStorage option to pass a function that will be called 
with the request object (that is the framework-specific request object that
the route handlers have received). This function must return an instance of your
storage. for example here is the default implementation of that function for
express app with express-session:
```js
function getStorage(request) {
    return {
        async set(key, value) {
            request.session[key] = value
            return value
        },
        async get(key) {
            return request.session[key]
        },
        async unset(key) {
            if (request.session.hasOwnProperty(key)) {
                delete request.session[key]
                return true
            }
            return false
        }
    };
}
```