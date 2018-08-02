const { expect } = require("code");
const { it, describe } = exports.lab = require("lab").script();
const axios = require("axios");
const Url = require("url");
const createAdapter = require("../adapters/hapi");

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

describe("hapi adapter", () => {

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
            let result = {};

            let adapter = createAdapter({
                redirectUri: "/",
                serverUrl: "https://r3.smarthealthit.org"
            });

            let h = {
                redirect(location) {
                    result.redirect = location;
                }
            };

            let req = {
                query: {},
                raw: {
                    req: {
                        url: "/launch",
                        connection: {},
                        headers: {
                            host: "whatever"
                        }
                    }
                },
                url: "/launch",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, h);
            expect(result.redirect).to.equal("http://whatever/")
        });

        it("using options.serverUrl and an protected server", async () => {

            let result = {};

            let adapter = createAdapter({
                redirectUri: "/",
                serverUrl: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir"
            });

            let h = {
                redirect(location) {
                    result.redirect = location;
                }
            };

            let req = {
                query: {},
                raw: {
                    req: {
                        url: "/launch",
                        connection: {},
                        headers: {
                            host: "whatever"
                        }
                    }
                },
                url: "/launch",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, h);
            expect(result.redirect).to.startWith(
                "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/authorize?"
            );
        });

        it("using query.serverUrl and an open server", async () => {
            let result = {};

            let adapter = createAdapter({
                redirectUri: "/"
            });

            let h = {
                redirect(location) {
                    result.redirect = location;
                }
            };

            let req = {
                query: {
                    fhirServiceUrl: "https://r3.smarthealthit.org"
                },
                raw: {
                    req: {
                        url: "/launch?fhirServiceUrl=https://r3.smarthealthit.org",
                        connection: {},
                        headers: {
                            host: "whatever"
                        }
                    }
                },
                url: "/launch?fhirServiceUrl=https://r3.smarthealthit.org",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, h);
            expect(result.redirect).to.equal("http://whatever/")
        });

        it("using query.serverUrl and an protected server", async () => {
            let result = {};

            let adapter = createAdapter({
                redirectUri: "/"
            });

            let h = {
                redirect(location) {
                    result.redirect = location;
                }
            };

            let req = {
                query: {
                    fhirServiceUrl: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir"
                },
                raw: {
                    req: {
                        url: "/launch?fhirServiceUrl=http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                        connection: {},
                        headers: {
                            host: "whatever"
                        }
                    }
                },
                url: "/launch?fhirServiceUrl=http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, h);
            expect(result.redirect).to.startWith(
                "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/authorize?"
            )
        });

        it("using query.iss and query.launch and an open server", async () => {
            let result = {};

            let adapter = createAdapter({
                redirectUri: "/"
            });

            let h = {
                redirect(location) {
                    result.redirect = location;
                }
            };

            let req = {
                query: {
                    iss: "https://r3.smarthealthit.org",
                    launch: "123"
                },
                raw: {
                    req: {
                        url: "/launch?launch=123&iss=https://r3.smarthealthit.org",
                        connection: {},
                        headers: {
                            host: "whatever"
                        }
                    }
                },
                url: "/launch?launch=123&iss=https://r3.smarthealthit.org",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, h);
            expect(result.redirect).to.equal("http://whatever/")
        });

        it("using query.iss and query.launch and protected server", async () => {
            let result = {};

            let adapter = createAdapter({
                redirectUri: "/"
            });

            let h = {
                redirect(location) {
                    result.redirect = location;
                }
            };

            let req = {
                query: {
                    launch: "123",
                    iss: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir"
                },
                raw: {
                    req: {
                        url: "/launch?launch=123&iss=http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                        connection: {},
                        headers: {
                            host: "whatever"
                        }
                    }
                },
                url: "/launch?launch=123&iss=http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                session: {
                    smartId: "x",
                    x: {}
                }
            };

            await adapter.authorize(req, h);
            expect(result.redirect).to.startWith(
                "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/authorize?"
            )
        });

        it("calls next if not enough arguments", async () => {
            let adapter = createAdapter({ redirectUri: "/" });
            let h = { continue: "23456aaaaa" };
            let req = { query: { launch: "123" } };
            let c = await adapter.authorize(req, h);
            expect(c).to.equal(h.continue);
        });
    });

    describe("completeAuth", { timeout: 5000 }, () => {

        it ("ends with error and error_description if provided", async () => {
            let adapter = createAdapter({
                redirectUri: "/"
            });
            let req = {
                query: {
                    error: "this is a test error",
                    error_description: "this is a test description"
                }
            };
            expect(() => adapter.completeAuth(req, {})).to.throw("this is a test error:\nthis is a test description");
            req.query.error_description = "";
            expect(() => adapter.completeAuth(req, {})).to.throw("this is a test error");
        });

        it ("handles internal errors", async () => {
            let adapter = createAdapter({
                redirectUri: "/"
            });
            let req = {
                query: {
                    code: "123",
                    state: "abc"
                }
            };
            expect(() => adapter.completeAuth(req, {})).to.throw();
        });

        it ("calls next if not enough arguments provided", async () => {
            let adapter = createAdapter({
                redirectUri: "/"
            });
            expect(adapter.completeAuth({ query: {} }, { continue: "xyz" })).to.equal("xyz");
        });

        it ("works as expected", async () => {
            let result = { redirect: "" };

            let adapter = createAdapter({
                redirectUri: "/",
                clientId   : "x",
                scope      : "offline_access",
                serverUrl  : "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir"
            });

            let h = {
                redirect(url) {
                    result.redirect = url
                }
            };

            let session = { smartId: "oldId" }

            let req = {
                query: {},
                raw: {
                    req: {
                        connection: {},
                        headers: {
                            host: "whatever"
                        },
                        url: "/",
                        session
                    }
                },
                url: "/",
                session
            };

            return adapter.authorize(req, h)
            .then(() => axios({
                url: result.redirect,
                maxRedirects: 0
            }))
            .catch(x => {
                req.url = x.response.headers.location;
                req.query = Url.parse(x.response.headers.location, true).query;
                req.raw.req.url = x.response.headers.location;
                return adapter.completeAuth(req, h)
            })
            .then(() => adapter.refreshAuth(req, h))
            .then(c => {
                expect(c).to.equal(h.continue)
            })
        });
    });

    describe("refreshAuth", { timeout: 5000 }, () => {
        it ("ends with error message if no client can be constructed", () => {
            return createAdapter({ redirectUri: "/" }).refreshAuth({session: {}})
            .then(
                () => { throw new Error("This should have failed") },
                err => {
                    expect(err.message).to.equal(
                        "No smart state found in session. Please re-authorize your app."
                    );
                }
            );
        });

        it ("handles errors", () => {
            return createAdapter({ redirectUri: "/" }).refreshAuth({session: {
                smartId: "x",
                x: {}
            }})
            .then(
                () => { throw new Error("This should have failed") },
                err => {
                    expect(err.message).to.equal(
                        "Trying to refresh but there is no refresh token"
                    );
                }
            );
        });
    });
});
