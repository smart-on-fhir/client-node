# client-node
SMART client for NodeJS

- [Usage with Express](https://github.com/smart-on-fhir/client-node/blob/master/docs/express.md#using-the-smart-client-with-express)
- [Usage with HAPI](https://github.com/smart-on-fhir/client-node/blob/master/docs/express.md#using-the-smart-client-with-express)
- [Usage with pure NodeJS](https://github.com/smart-on-fhir/client-node/blob/master/docs/express.md#using-the-smart-client-with-express)
- Configuration Options
- The storage interface

# API

## Options
- `clientId    ` - *string, **required*** - The Client ID that you were given after registering your app with the authorization server.
- `redirectUri ` - *string, **required*** - The location to redirect to, once the user have authorized the launch.
- `serverUrl   ` - *string, **optional*** - The base URL of the Fhir server. If you specify this in your options you will be able to call your launchUri endpoint without any parameters and it will initiate a standalone launch sequence against this server. You can also pass a `fhirServiceUrl` query parameter to your launchUri endpoint which will take precedence over the config option value. Finally, if your launch endpoint is called with `iss` and `launch` parameters (which will happen when launched from EHR), `iss` will become the used server and the `fhirServiceUrl` url parameter (if any) and the `serverUrl` option (if any) will be ignored.
- `scope       ` - *string, **optional*** - Space-separated list of scopes as described in http://docs.smarthealthit.org/authorization/scopes-and-launch-context/. Strictly speaking, this is option is not required but you will typically want access to certain resources and the scope should be used to request that access.
- `clientSecret` - *string, **optional*** If you registered your app as confidential client you should have been given a **clientSecret** that you have to set here.
- `getStorage(request)` - *function, **optional*** A function that will return a custom storage object. See *The storage interface* below for details.


## Low-level API

### `authorize(request, response, options, storage)`
This function should be called when you have a request to an URL with
`launch` and `iss` parameters or alternatively a `fhirServiceUrl` parameter.
When you launch your app from outside (from an EHR or a test launcher like
https://launch.smarthealthit.org), your `launchUri` endpoint will be called
with `launch` and `iss` parameters. Than you can use this function to initiate
the launch sequence. An **express** example might look like this:
```js
app.get("/launch", (req, res) => smart.authorize(req, res, options, storage));
```


### `completeAuth(request, response, options, storage)`
The login function above will redirect the browser to the authorization endpoint
of the SMART server. Depending on the requested scopes, the user might be asked
to select a patient or practitioner, authorize the app and so on. Eventually, the
user will be redirected back to your site at your `options.redirectUri`. At that
point you should have received a code that needs to be exchanged for an access
token. To do so, you can use the `completeAuth` like so (express example):
```js
app.get("/redirect", (req, res) => {
    smart.completeAuth(req, res, options, storage)
        .then(client => client.request("/Patient"))
        .then(
            result => res.json(result.data),
            error => res.status(500).send(error.stack);
        )
})
```

Express example using express-session:
```js
app.get("/fhir/:path", async (req, res) => {
    try {
        const state = req.session[req.session.smartId];
        const fhirClient = new smart.Client(state);
        const result = await fhirClient.request(req.params.path);
        res.json(result.data);
    }
    catch (error) {
        res.end(error.stack);
    }
});
```

### The storage interface
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
       set(key, value) {
            request.session[key] = value
            return Promise.resolve(value)
        },
        get(key) {
            return Promise.resolve(request.session[key])
        },
        unset(key) {
            if (request.session.hasOwnProperty(key)) {
                delete request.session[key];
                return Promise.resolve(true)
            }
            return Promise.resolve(false)
        }
    };
}
```
