# SMART Client

This library includes a class called `Client`, having the following methods:

### `constructor(state)`
You typically don't want to use the constructor directly. Instead, a client instance
is returned for you from the `completeAuth` function. You can also obtain an
instance by calling the `getClient(req)` method of your framework-specific adapter
and passing the request object. Those methods will "extract" the necessary state
from the session associated with that request and then use the constructor to create
and return a Client instance.

### `client.request(urlOrOptions)`
Makes an HTTP request to your fhir server and returns a promise that should be
resolved with the result or rejected with an error. The argument can be a string
URL (relative to the server root) or an [`axios` request options](https://github.com/axios/axios#request-config).
Allows you to do the following:
1. Use relative URLs (treat them as relative to the "serverUrl" option)
2. Automatically authorize requests with your accessToken (if any)
3. Automatically re-authorize using the refreshToken (if available)
4. Automatically parse error operation outcomes and turn them into
    JavaScript Error objects with which the resulting promises are rejected

### `client.refresh()`
Use the refresh token to obtain new access token. If the refresh token is expired
it will be deleted from the state, so that we don't enter into loops trying to
re-authorize. NOTE that you can just use `client.request()` and it will automatically
`refresh` for you if needed.

### `client.getPatientId()`
Returns the ID of the selected patient or null. You should have requested
`launch` or `launch/patient` scope. Otherwise you will not receive a patient
context and this will return null. This can be used to fetch the current
patient like so:
```js
client.request("Patient/" + client.getPatientId());
```

### `client.getEncounterId()`
Returns the ID of the selected encounter or null. You should have requested 
`launch` or `launch/encounter` scope. Otherwise you will not receive an encounter
context and this will return null. NOTE that not all servers support this so this
method might return null regardless of the requested scopes. This can be used to
fetch the current patient like so:
```js
client.request("Encounter/" + client.getEncounterId());
```

### `client.getIdToken()`
Returns the (decoded) `id_token` if any. You need to request `openid` and
`profile` scopes if you need to receive an `id_token` (if you need to know
who the logged-in user is).

### `client.getUserProfile()`
Returns the profile of the logged_in user (if any). This is a string having the
following shape: `{user type}/{user id}`. For example:
**Practitioner/abc** or **Patient/xyz**. This can be used to fetch the current
user like so:
```js
client.request(client.getUserProfile());
```

### `client.getUserId()`
Returns the ID of the logged-in user or `null`.

### `client.getUserType()`
Returns the type of the logged-in user or `null`. The result can be
"**Practitioner**", "**Patient**" or "**RelatedPerson**".

### `client.getPages(urlOrOptions, maxPages = 100)`
Gets multiple bundle entries from multiple pages and returns an array with all
their entries. This can be used to walk a server and download all the resources
from certain type. For example, this is how you can fetch all the patients from
the server (assuming that there are no more than 100 pages):
```js
client.getPages("/Patient");
```
