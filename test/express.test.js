const { expect } = require("code");
const { it, describe } = exports.lab = require("lab").script();
// const app = require("../examples/express-patients-list");
const axios = require("axios");
const Url = require("url");
const createAdapter = require("../adapters/express");

function getDummyStorage(initialState = {}) {
    const __SESSION = { ...initialState };
    return {
        set(key, value) {
            __SESSION[key] = value;
            return Promise.resolve(value);
        },
        get(key) {
            if (!key) {
                return Promise.resolve(__SESSION);
            }
            return Promise.resolve(__SESSION[key]);
        },
        unset(key) {
            if (__SESSION.hasOwnProperty(key)) {
                delete __SESSION[key];
                return Promise.resolve(true);
            }
            return Promise.resolve(false);
        }
    };
}

describe("express adapter", () => {

    describe("getStorage", () => {
        it("returns null if session is empty", async () => {
            let adapter = createAdapter({});
            let client = await adapter.getClient({session: {}});
            expect(client).to.equal(null);
            client = await adapter.getClient({session: {smartId: "x"}});
            expect(client).to.equal(null);
        });

        it("can be set as option", async () => {
            let adapter = createAdapter({
                getStorage() {
                    return getDummyStorage({ smartId: "x", x: { a: "b" } })
                }
            });
            let client = await adapter.getClient({});
            expect(client.state.a).to.equal("b")
        });

        it("uses session storage by default", async () => {
            let adapter = createAdapter({});
            let client = await adapter.getClient({
                session: {
                    smartId: "x",
                    x: {
                        a: "b"
                    }
                }
            });
            expect(client.state.a).to.equal("b")
        });
    });

    describe("authorize", { timeout: 5000 }, () => {
        it("using options.serverUrl and an open server", async () => {
            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                code: 0,
                headers: {},
                ended: false
            };

            let adapter = createAdapter({
                redirectUri: "/",
                serverUrl: "https://r3.smarthealthit.org"
            });

            let res = {
                writeHead(code, headers = {}) {
                    result.code = code;
                    result.headers = { ...result.headers, ...headers };
                },
                end() {
                    result.ended = true;
                }
            };

            let req = {
                query: {},
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/launch",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, res, next)
            expect(nextCalls).to.equal(0)
            expect(result.ended).to.equal(true)
            expect(result.code).to.equal(302)
            expect(result.headers.location).to.equal("http://whatever/")
        });

        it("using options.serverUrl and an protected server", async () => {
            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                code: 0,
                headers: {},
                ended: false
            };

            let adapter = createAdapter({
                redirectUri: "/",
                serverUrl: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir"
            });

            let res = {
                writeHead(code, headers = {}) {
                    result.code = code;
                    result.headers = { ...result.headers, ...headers };
                },
                end() {
                    result.ended = true;
                }
            };

            let req = {
                query: {},
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/launch",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, res, next)
            expect(nextCalls).to.equal(0)
            expect(result.ended).to.equal(true)
            expect(result.code).to.equal(302)
            expect(result.headers.location).to.startWith(
                "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/authorize?"
            )
        });

        it("using query.serverUrl and an open server", async () => {
            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                code: 0,
                headers: {},
                ended: false
            };

            let adapter = createAdapter({
                redirectUri: "/"
            });

            let res = {
                writeHead(code, headers = {}) {
                    result.code = code;
                    result.headers = { ...result.headers, ...headers };
                },
                end() {
                    result.ended = true;
                }
            };

            let req = {
                query: {
                    fhirServiceUrl: "https://r3.smarthealthit.org"
                },
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/launch?fhirServiceUrl=https://r3.smarthealthit.org",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, res, next)
            expect(nextCalls).to.equal(0)
            expect(result.ended).to.equal(true)
            expect(result.code).to.equal(302)
            expect(result.headers.location).to.equal("http://whatever/")
        });

        it("using query.serverUrl and an protected server", async () => {
            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                code: 0,
                headers: {},
                ended: false
            };

            let adapter = createAdapter({
                redirectUri: "/"
            });

            let res = {
                writeHead(code, headers = {}) {
                    result.code = code;
                    result.headers = { ...result.headers, ...headers };
                },
                end() {
                    result.ended = true;
                }
            };

            let req = {
                query: {
                    fhirServiceUrl: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir"
                },
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/launch?fhirServiceUrl=http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, res, next)
            expect(nextCalls).to.equal(0)
            expect(result.ended).to.equal(true)
            expect(result.code).to.equal(302)
            expect(result.headers.location).to.startWith(
                "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/authorize?"
            )
        });

        it("using query.iss and query.launch and an open server", async () => {

            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                code: 0,
                headers: {},
                ended: false
            };

            let adapter = createAdapter({
                redirectUri: "/"
            });

            let res = {
                writeHead(code, headers = {}) {
                    result.code = code;
                    result.headers = { ...result.headers, ...headers };
                },
                end() {
                    result.ended = true;
                }
            };

            let req = {
                query: {
                    iss: "https://r3.smarthealthit.org",
                    launch: "123"
                },
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/launch?launch=123&iss=https://r3.smarthealthit.org",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, res, next)
            expect(nextCalls).to.equal(0)
            expect(result.ended).to.equal(true)
            expect(result.code).to.equal(302)
            expect(result.headers.location).to.equal("http://whatever/")
        });

        it("using query.iss and query.launch and protected server", async () => {

            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                code: 0,
                headers: {},
                ended: false
            };

            let adapter = createAdapter({
                redirectUri: "/"
            });

            let res = {
                writeHead(code, headers = {}) {
                    result.code = code;
                    result.headers = { ...result.headers, ...headers };
                },
                end() {
                    result.ended = true;
                }
            };

            let req = {
                query: {
                    iss: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                    launch: "123"
                },
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/launch?launch=123&iss=http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, res, next)
            expect(nextCalls).to.equal(0)
            expect(result.ended).to.equal(true)
            expect(result.code).to.equal(302)
            expect(result.headers.location).to.startWith(
                "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/authorize?"
            )
        });

        it("calls next if not enough arguments", async () => {

            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                code: 0,
                headers: {},
                ended: false
            };

            let adapter = createAdapter({
                redirectUri: "/"
            });

            let res = {
                writeHead(code, headers = {}) {
                    result.code = code;
                    result.headers = { ...result.headers, ...headers };
                },
                end() {
                    result.ended = true;
                }
            };

            let req = {
                query: { launch: "something" },
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/launch",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, res, next)
            expect(nextCalls).to.equal(1)
            expect(result.ended).to.equal(false)
            expect(result.headers.location).to.not.exist()
        });
    });

    describe("completeAuth", { timeout: 5000 }, () => {

        it ("ends with error and error_description if provided", async () => {
            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                ended: false,
                body: ""
            };
            let res = {
                end(str = "") {
                    result.ended = true;
                    result.body += str
                }
            };
            let adapter = createAdapter({
                redirectUri: "/"
            });
            let req = {
                query: {
                    error: "this is a test error",
                    error_description: "this is a test description"
                },
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/?error=" + encodeURIComponent("this is a test error") + "&error_description=" + encodeURIComponent("this is a test description"),
                session: {}
            };
            await adapter.completeAuth(req, res, next);
            expect(nextCalls).to.equal(0)
            expect(result.ended).to.equal(true)
            expect(result.body).to.equal("this is a test error:\nthis is a test description")

            result.body = ""
            req.query.error_description = ""
            await adapter.completeAuth(req, res, next);
            expect(result.body).to.equal("this is a test error")
        });

        it ("handles internal errors", async () => {
            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                ended: false,
                body: ""
            };
            let res = {
                writeHead(code) {
                    result.code = code
                },
                end(str = "") {
                    result.ended = true;
                    result.body += str
                }
            };
            let adapter = createAdapter({
                redirectUri: "/"
            });
            let req = {
                query: {
                    code: "123",
                    state: "abc"
                }
            };
            await adapter.completeAuth(req, res, next);
            expect(nextCalls).to.equal(0)
            expect(result.ended).to.equal(true)
            expect(result.code).to.equal(500)
        });

        it ("handles errors", async () => {
            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                ended: false,
                body: ""
            };
            let res = {
                writeHead(code) {
                    result.code = code
                },
                end(str = "") {
                    result.ended = true;
                    result.body += str
                }
            };
            let adapter = createAdapter({
                redirectUri: "/"
            });
            let req = {
                query: {
                    code: "123",
                    state: "abc"
                },
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/?code=123&state=abc",
                session: {
                    smartId: "abc",
                    abc: {
                        redirectUri: "http://whatever/",
                        tokenUri: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/token",
                        clientId: "x"
                    }
                }
            };
            await adapter.completeAuth(req, res, next);
            expect(nextCalls).to.equal(0)
            // expect(result.ended).to.equal(true)
            // expect(result.body).to.equal("this is a test error:\nthis is a test description")
            // expect(result.code).to.equal(401)
        });

        it ("calls next if not enough arguments provided", async () => {
            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                ended: false,
                body: ""
            };
            let res = {
                end(str = "") {
                    result.ended = true;
                    result.body += str
                }
            };
            let adapter = createAdapter({
                redirectUri: "/"
            });
            let req = {
                query: {
                    state: "bla"
                },
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/?state=bla",
                session: {}
            };
            await adapter.completeAuth(req, res, next);
            expect(nextCalls).to.equal(1)
            expect(result.ended).to.equal(false)
            expect(result.body).to.equal("")
        });

        it ("works as expected", async () => {
            let result = {
                code: 0,
                headers: {},
                ended: false,
                body: ""
            };

            let adapter = createAdapter({
                redirectUri: "/",
                clientId: "x",
                scope: "offline_access",
                serverUrl: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir"
            });

            let req = {
                query: {},
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/",
                session: {
                    smartId: "oldId"
                }
            };

            let res = {
                writeHead(code, headers = {}) {
                    result.code = code;
                    result.headers = { ...result.headers, ...headers };
                },
                end(message="") {
                    result.ended = true;
                    result.body += message
                },
                redirect(url) {
                    result.redirect = url
                }
            };

            await adapter.authorize(req, res);

            return axios({
                url: result.headers.location,
                maxRedirects: 0
            })
            .catch(x => {
                req.url = x.response.headers.location;
                req.query = Url.parse(x.response.headers.location, true).query;
                return adapter.completeAuth(req, res)
            })
            .then(() => {
                return adapter.refreshAuth(req, res, () => {
                    result.allDone = true
                    return true;
                });
            })
            .then(() => {
                expect(result.allDone).to.equal(true)
            })
        });
    });

    describe("refreshAuth", { timeout: 5000 }, () => {
        it ("ends with error message if no client can be constructed", async () => {
            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                ended: false,
                body: ""
            };
            let res = {
                end(str = "") {
                    result.ended = true;
                    result.body += str
                }
            };
            let adapter = createAdapter({
                redirectUri: "/"
            });
            let req = {
                query: {
                //     iss: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                //     launch: "123"
                },
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/",
                session: {
                //     smartId: "x",
                //     x: {}
                }
            };
            await adapter.refreshAuth(req, res, next);
            expect(nextCalls).to.equal(0)
            expect(result.ended).to.equal(true)
            expect(result.body).to.equal("No smart state found in session. Please re-authorize your app.")
        });

        it ("handles errors", async () => {
            let nextCalls = 0;

            let next = () => {
                nextCalls += 1
            };

            let result = {
                ended: false,
                body: ""
            };
            let res = {
                end(str = "") {
                    result.ended = true;
                    result.body += str
                }
            };
            let adapter = createAdapter({
                redirectUri: "/"
            });
            let req = {
                query: {
                //     iss: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                //     launch: "123"
                },
                connection: {},
                headers: {
                    host: "whatever"
                },
                url: "/",
                session: {
                    smartId: "x",
                    x: {}
                }
            };
            await adapter.refreshAuth(req, res, next);
            expect(nextCalls).to.equal(0)
            expect(result.ended).to.equal(true)
            expect(result.body).to.equal("Trying to refresh but there is no refresh token")
        })
    });
});
