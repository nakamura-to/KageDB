(function (global) {

    "use strict";

    // check indexedDB existent
    var indexedDB = global.indexedDB ||  global.msIndexedDB || global.webkitIndexedDB || global.mozIndexedDB;
    if (!indexedDB) {
        return;
    }

    // export
    global.indexedDB = indexedDB;
    global.IDBRequest = global.IDBRequest || global.webkitIDBRequest;
    global.IDBCursor = global.IDBCursor || global.webkitIDBCursor;
    global.IDBTransaction = global.IDBTransaction || global.webkitIDBTransaction;
    global.IDBKeyRange = global.IDBKeyRange || global.webkitIDBKeyRange;
    global.KageDB = KageDB;

    // see https://developer.mozilla.org/en/IndexedDB/IDBDatabaseException
    var ERROR_CODE_MAP = {
        1: "UNKNOWN_ERR(1): The operation failed for reasons unrelated to the database itself, and it is not covered by any other error code; for example, a failure due to disk IO errors.",
        2: "NON_TRANSIENT_ERR(2): An operation was not allowed on an object. Unless the cause of the error is corrected, retrying the same operation would result in failure.",
        3: "NOT_FOUND_ERR(3): The operation failed, because the requested database object could not be found; for example, an object store did not exist but was being opened.",
        4: "CONSTRAINT_ERR(4): A mutation operation in the transaction failed because a constraint was not satisfied. For example, an object, such as an object store or index, already exists and a request attempted to create a new one.",
        5: "DATA_ERR(5): Data provided to an operation does not meet requirements.",
        6: "NOT_ALLOWED_ERR(6): An operation was called on an object where it is not allowed or at a time when it is not allowed. It also occurs if a request is made on a source object that has been deleted or removed.",
        7: "TRANSACTION_INACTIVE_ERR(7): A request was made against a transaction that is either not currently active or is already finished.",
        8: "ABORT_ERR(8): A request was aborted, for example, through a call to IDBTransaction.abort.",
        9: "READ_ONLY_ERR(9): A mutation operation was attempted in a READ_ONLY transaction.",
        10: "TIMEOUT_ERR(10): A lock for the transaction could not be obtained in a reasonable time.",
        11: "QUOTA_ERR(11): Either there's not enough remaining storage space or the storage quota was reached and the user declined to give more space to the database.",
        12: "VERSION_ERR(12): A request to open a database with a version lower than the one it already has. This can only happen with IDBOpenDBRequest."
    };

    // internal helper object
    var helper = {
        bulk: function bulk(len, callback) {
            function callSuccessListener() {
                if (typeof bulkReq.onsuccess === "function") {
                    bulkReq.onsuccess({target: bulkReq, type: "success"});
                }
            }
            function callErrorListener() {
                if (typeof bulkReq.onerror === "function") {
                    bulkReq.onerror({target: bulkReq, type: "error"});
                }
            }
            var done = false;
            var bulkReq = Object.defineProperties({}, {
                readyState: { get: function () { return (done) ? global.IDBRequest.DONE : global.IDBRequest.LOADING ; }, enumerable: true}
            });
            bulkReq.errorCode = undefined;
            bulkReq.error = undefined;
            bulkReq.result = undefined;
            bulkReq.onsuccess = null;
            bulkReq.onerror = null;
            var pending = len;
            var results = new Array(len);
            for (var i = 0; i < len && !done ; i++) {
                (function (i) {
                    var req = callback(i);
                    req.onsuccess = function onsuccess(event) {
                        results[i] = event.target.result;
                        pending--;
                        if (pending === 0) {
                            done = true;
                            bulkReq.result = results;
                            callSuccessListener();
                        }
                    };
                    req.onerror = function onerror(event) {
                        done = true;
                        bulkReq.error = event.target.error;
                        bulkReq.errorCode = event.target.errorCode;
                        callErrorListener();
                    };
                }(i));
            }
            return bulkReq;
        },

        fetch: function fetch(callback, filter) {
            function callSuccessListener() {
                if (typeof fetchReq.onsuccess === "function") {
                    fetchReq.onsuccess({target: fetchReq, type: "success"});
                }
            }
            function callErrorListener() {
                if (typeof fetchReq.onerror === "function") {
                    fetchReq.onerror({target: fetchReq, type: "error"});
                }
            }
            var done = false;
            var fetchReq = Object.defineProperties({}, {
                readyState: { get: function () { return (done) ? global.IDBRequest.DONE : global.IDBRequest.LOADING ; }, enumerable: true}
            });
            fetchReq.errorCode = undefined;
            fetchReq.error = undefined;
            fetchReq.result = undefined;
            fetchReq.onsuccess = null;
            fetchReq.onerror = null;
            var req = callback();
            var results = [];
            req.onsuccess = function onsuccess(event) {
                var cursor = event.target.result;
                if (cursor) {
                    var value = cursor.value;
                    if (filter(value)) {
                        results.push(value);
                    }
                    cursor.continue();
                } else {
                    done = true;
                    fetchReq.result = results;
                    callSuccessListener();
                }
            };
            req.onerror = function onerror(event) {
                done = true;
                fetchReq.error = event.target.error;
                fetchReq.errorCode = event.target.errorCode;
                callErrorListener();
            };
            return fetchReq;
        }
    };

    function KageDB(options) {
        if (!indexedDB) {
            throw new Error("[KageDB] Your browser doesn't support indexedDB.");
        }
        options = options || {};
        this.autoClose = options.autoClose !== false;
        this.className = "KageDB";
    }

    KageDB.fromEventToError = function fromEventToError(event) {
        var code = event.target ? event.target.errorCode : 1;
        var message = ERROR_CODE_MAP[code] || "";
        var e = new Error("[KageDB] An error occurred at " + event.kage_className +
            (event.kage_methodName ? "." + event.kage_methodName : "") + ". " + message);
        e.kage_event = event;
        e.kage_eventName = event.kage_eventName;
        e.kage_className = event.kage_className;
        e.kage_methodName = event.kage_methodName;
        return e;
    };

    KageDB.prototype.open = function open(name, version) {
        var methodName = "open";
        var req = (typeof version === 'number') ? indexedDB.open(name, version) : indexedDB.open(name);
        var self = this;

        // hook onblocked to attach a kageDB to a db
        var onblocked;
        Object.defineProperty(req, "onblocked", {
            get: function () {
                return onblocked;
            },
            set: function (onblocked_internal) {
                req.removeEventListener('blocked', onblocked);
                onblocked = function onblocked(event) {
                    var db = event.target.result;
                    db.kage_kageDB = self;
                    self.bindListener("abort", db, "IDBDatabase", null);
                    self.bindListener("error", db, "IDBDatabase", null);
                    onblocked_internal.call(this, event);
                };
                req.addEventListener('blocked', onblocked);
            }
        });

        // hook onupgradeneeded to attach a kageDB to a db
        var onupgradeneeded;
        Object.defineProperty(req, "onupgradeneeded", {
            get: function () {
                return onupgradeneeded;
            },
            set: function (onupgradeneeded_internal) {
                req.removeEventListener('upgradeneeded', onupgradeneeded);
                onupgradeneeded = function onupgradeneeded(event) {
                    var db = event.target.result;
                    db.kage_kageDB = self;
                    self.bindListener("abort", db, "IDBDatabase", null);
                    self.bindListener("error", db, "IDBDatabase", null);
                    onupgradeneeded_internal.call(this, event);
                };
                req.addEventListener('upgradeneeded', onupgradeneeded);
            }
        });

        // hook onsuccess to attach a kageDB to a db and close the db
        var onsuccess;
        Object.defineProperty(req, "onsuccess", {
            get: function () {
                return onsuccess;
            },
            set: function (onsuccess_internal) {
                req.removeEventListener('success', onsuccess);
                onsuccess = function onsuccess(event) {
                    var db = event.target.result;
                    db.kage_kageDB = self;
                    self.bindListener("abort", db, "IDBDatabase", null);
                    self.bindListener("error", db, "IDBDatabase", null);
                    onsuccess_internal.call(this, event);
                    if (self.autoClose) {
                        db.close();
                    }
                };
                req.addEventListener('success', onsuccess);
            }
        });

        self.bindListener("blocked", req, this.className, methodName);
        self.bindListener("upgradeneeded", req, this.className, methodName);
        self.bindListener("success", req, this.className, methodName);
        self.bindListener("error", req, this.className, methodName);
        return req;
    };

    KageDB.prototype.deleteDatabase = function deleteDatabase(name) {
        var methodName = "deleteDatabase";
        var req = indexedDB.deleteDatabase(name);
        this.bindListener("blocked", req, this.className, methodName);
        this.bindListener("upgradeneeded", req, this.className, methodName);
        this.bindListener("success", req, this.className, methodName);
        this.bindListener("error", req, this.className, methodName);
        return req;
    };

    KageDB.prototype.cmp = function cmp(first, second) {
        return indexedDB.cmp(first, second);
    };

    KageDB.prototype.join = function join() {
        var requests = arguments.length === 1 && Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
        var methodName = "join";
        var req = helper.bulk(requests.length, function (i) {
            return requests[i];
        });
        this.bindListener("success", req, this.className, methodName);
        this.bindListener("error", req, this.className, methodName);
        return req;
    };

    KageDB.prototype.dump = function dump(dbName, storeNames) {
        if (typeof dbName !== "string") throw new Error("[KageDB] The dbName must be a string.");
        if (typeof storeNames !== "string" && !Array.isArray(storeNames)) throw new Error("[KageDB] The storeNames must be a string or an array of string.");

        storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];

        function callSuccessListener() {
            if (typeof dumpReq.onsuccess === "function") {
                dumpReq.onsuccess({target: dumpReq, type: "success"});
            }
        }
        function callErrorListener() {
            if (typeof dumpReq.onerror === "function") {
                dumpReq.onerror({target: dumpReq, type: "error"});
            }
        }
        var methodName = "dump";
        var done = false;
        var dumpReq = Object.defineProperties({}, {
            readyState: { get: function () { return (done) ? global.IDBRequest.DONE : global.IDBRequest.LOADING ; }, enumerable: true}
        });
        dumpReq.errorCode = 1;
        dumpReq.error = undefined;
        dumpReq.result = undefined;
        dumpReq.onsuccess = null;
        dumpReq.onerror = null;

        var req = this.open(dbName);
        req.onsuccess = function (event) {
            var db = event.target.result;
            var tx = db.transaction(storeNames, global.IDBTransaction.READ_ONLY);
            var len = storeNames.length;
            var pending = len;
            var results = new Array(len);
            for (var i = 0; i < len && !done; i++) {
                (function (i) {
                    var req = tx.objectStore(storeNames[i]).fetch();
                    req.onsuccess = function (event) {
                        results[i] = event.target.result;
                        pending--;
                        if (pending === 0) {
                            done = true;
                            dumpReq.result = results;
                            callSuccessListener();
                        }
                    };
                    req.onerror = function onerror(event) {
                        done = true;
                        dumpReq.error = event.target.error;
                        dumpReq.errorCode = event.target.errorCode;
                        callErrorListener();
                    };
                }(i));
            }
        };
        this.bindListener("success", dumpReq, this.className, methodName);
        this.bindListener("error", dumpReq, this.className, methodName);
        return dumpReq;
    };

    KageDB.prototype.bindListener = function bindListener(eventName, target, className, methodName) {
        var onName = "on" + eventName;
        var listener = this[onName];
        if (listener && onName in target) {
            target[onName] = function (event) {
                event.kage_eventName = eventName;
                event.kage_className = className;
                event.kage_methodName = methodName;
                listener.call(this, event);
            };
        }
    };

    KageDB.prototype.onerror = function onerror(event) {
        var error = KageDB.fromEventToError(event);
        throw error;
    };

    KageDB.prototype.onblocked = function onblocked(event) {
    };

    KageDB.prototype.onupgradeneeded = function onupgradeneeded(event) {
    };

    KageDB.prototype.onsuccess = function onsuccess(event) {
    };

    KageDB.prototype.onabort = function onabort(event) {
    };

    KageDB.prototype.oncomplete = function oncomplete(event) {
    };

    // customize IDBDatabase prototype
    (function () {
        var IDBDatabase = global.IDBDatabase || global.webkitIDBDatabase;
        var className = "IDBDatabase";
        var createObjectStore_original = IDBDatabase.prototype.createObjectStore;
        var transaction_original = IDBDatabase.prototype.transaction;
        var setVersion_original = IDBDatabase.prototype.setVersion;
        IDBDatabase.prototype.createObjectStore = function createObjectStore() {
            var store = createObjectStore_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                store.kage_kageDB = kageDB;
            }
            return store;
        };
        IDBDatabase.prototype.transaction = function () {
            var tx = transaction_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                tx.kage_kageDB = kageDB;
                kageDB.bindListener("abort", tx, "IDBTransaction", null);
                kageDB.bindListener("complete", tx, "IDBTransaction", null);
                kageDB.bindListener("error", tx, "IDBTransaction", null);
            }
            return tx;
        };
        // setVersion is deprecated in W3C Working Draft 19 April 2011, but Google Chrome 19.0.1084.41 uses this function.
        if (setVersion_original) {
            IDBDatabase.prototype.setVersion = function () {
                var methodName = "setVersion";
                var req = setVersion_original.apply(this, arguments);
                var kageDB = this.kage_kageDB;
                if (kageDB) {
                    // hook onsuccess to attach a kageDB to a cursor
                    var onsuccess;
                    Object.defineProperty(req, "onsuccess", {
                        get: function () {
                            return onsuccess;
                        },
                        set: function (onsuccess_internal) {
                            req.removeEventListener('success', onsuccess);
                            onsuccess = function (event) {
                                var tx = event.target.result;
                                tx.kage_kageDB = kageDB;
                                kageDB.bindListener("abort", tx, "IDBTransaction", null);
                                kageDB.bindListener("complete", tx, "IDBTransaction", null);
                                kageDB.bindListener("error", tx, "IDBTransaction", null);
                                onsuccess_internal.call(this, event);
                            };
                            req.addEventListener("success", onsuccess);
                        }
                    });

                    kageDB.bindListener("success", req, className, methodName);
                    kageDB.bindListener("error", req, className, methodName);
                }
                return req;
            };
        }
    }());

    // customize IDBTransaction prototype
    (function () {
        var IDBTransaction =  global.IDBTransaction || global.webkitIDBTransaction;
        var objectStore_original = IDBTransaction.prototype.objectStore;
        IDBTransaction.prototype.objectStore = function objectStore() {
            var store = objectStore_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            store.kage_kageDB = kageDB;
            return store;
        };
    }());

    // customize IDBObjectStore prototype
    (function () {
        var IDBObjectStore = global.IDBObjectStore || global.webkitIDBObjectStore;
        var className = "IDBObjectStore";
        var put_original = IDBObjectStore.prototype.put;
        var add_original = IDBObjectStore.prototype.add;
        var delete_original = IDBObjectStore.prototype["delete"];
        var get_original = IDBObjectStore.prototype.get;
        var clear_original = IDBObjectStore.prototype.clear;
        var openCursor_original = IDBObjectStore.prototype.openCursor;
        var count_original = IDBObjectStore.prototype.count;
        var createIndex_original = IDBObjectStore.prototype.createIndex;
        var index_original = IDBObjectStore.prototype.index;
        IDBObjectStore.prototype.put = function put() {
            var methodName = "put";
            var req = put_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBObjectStore.prototype.add = function add() {
            var methodName = "add";
            var req = add_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBObjectStore.prototype["delete"] = function _delete() {
            var methodName = "delete";
            var req = delete_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBObjectStore.prototype.get = function get() {
            var methodName = "get";
            var req = get_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBObjectStore.prototype.clear = function clear() {
            var methodName = "clear";
            var req = clear_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBObjectStore.prototype.openCursor = function openCursor() {
            var methodName = "openCursor";
            var req = openCursor_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                // hook onsuccess to attach a kageDB to a cursor
                var onsuccess;
                Object.defineProperty(req, "onsuccess", {
                    get: function () {
                        return onsuccess;
                    },
                    set: function (onsuccess_internal) {
                        req.removeEventListener('success', onsuccess);
                        onsuccess = function (event) {
                            var cursor = event.target.result;
                            if (cursor) {
                                cursor.kage_kageDB = kageDB;
                            }
                            onsuccess_internal.call(this, event);
                        };
                        req.addEventListener("success", onsuccess);
                    }
                });

                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBObjectStore.prototype.count = function count() {
            var methodName = "count";
            var req = count_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBObjectStore.prototype.createIndex = function createIndex() {
            var index = createIndex_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            index.kage_kageDB = kageDB;
            return index;
        };
        IDBObjectStore.prototype.index = function index() {
            var index = index_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            index.kage_kageDB = kageDB;
            return index;
        };
        IDBObjectStore.prototype.bulkPut = function bulkPut(values, keys) {
            if (!Array.isArray(values)) throw new Error("[KageDB] The values must be array.");
            if (keys && !Array.isArray(keys)) throw new Error("[KageDB] The keys must be array.");
            if (keys && values.length !== keys.length) throw new Error("[KageDB] The values.length and keys.length must be same.");

            var methodName = "bulkPut";
            var self = this;
            var req = helper.bulk(values.length, function _put(i) {
                if (keys) {
                    return self.put(values[i], keys[i]);
                } else {
                    return self.put(values[i]);
                }
            });

            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBObjectStore.prototype.bulkAdd = function bulkAdd(values, keys) {
            if (!Array.isArray(values)) throw new Error("[KageDB] The values must be array.");
            if (keys && !Array.isArray(keys)) throw new Error("[KageDB] The keys must be array.");
            if (keys && values.length !== keys.length) throw new Error("[KageDB] The values.length and keys.length must be same.");

            var methodName = "bulkAdd";
            var self = this;
            var req = helper.bulk(values.length, function _add(i) {
                if (keys) {
                    return self.add(values[i], keys[i]);
                } else {
                    return self.add(values[i]);
                }
            });

            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBObjectStore.prototype.bulkDelete = function bulkDelete(keys) {
            if (keys && !Array.isArray(keys)) throw new Error("[KageDB] The keys must be array.");

            var methodName = "bulkDelete";
            var self = this;
            var req = helper.bulk(keys.length, function _delete(i) {
                return self["delete"](keys[i]);
            });

            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBObjectStore.prototype.fetch = function fetch(range, direction, filter) {
            var methodName = "fetch";
            var self = this;
            var req = helper.fetch(function () {
                if (range) {
                    if (typeof direction === "number") {
                        return self.openCursor(range, direction);
                    } else {
                        return self.openCursor(range);
                    }
                } else {
                    return  self.openCursor();
                }
            }, filter || function (value) { return value; });

            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
    }());

    // customize IDBIndex prototype
    (function () {
        var IDBIndex = global.IDBIndex || global.webkitIDBIndex;
        var className = "IDBIndex";
        var openCursor_original = IDBIndex.prototype.openCursor;
        var openKeyCursor_original = IDBIndex.prototype.openKeyCursor;
        var get_original = IDBIndex.prototype.get;
        var getKey_original = IDBIndex.prototype.getKey;
        var count_original = IDBIndex.prototype.count;
        IDBIndex.prototype.openCursor = function openCursor() {
            var methodName = "openCursor";
            var req = openCursor_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                // hook onsuccess to attach a kageDB to a cursor
                var onsuccess;
                Object.defineProperty(req, "onsuccess", {
                    get: function () {
                        return onsuccess;
                    },
                    set: function (onsuccess_internal) {
                        req.removeEventListener('success', onsuccess);
                        onsuccess = function (event) {
                            var cursor = event.target.result;
                            if (cursor) {
                                cursor.kage_kageDB = kageDB;
                            }
                            onsuccess_internal.call(this, event);
                        };
                        req.addEventListener('success', onsuccess);
                    }
                });

                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBIndex.prototype.openKeyCursor = function openKeyCursor() {
            var methodName = "openKeyCursor";
            var req = openKeyCursor_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                // hook onsuccess to attach a kageDB to a cursor
                var onsuccess;
                Object.defineProperty(req, "onsuccess", {
                    get: function () {
                        return onsuccess;
                    },
                    set: function (onsuccess_internal) {
                        req.removeEventListener('success', onsuccess);
                        onsuccess = function (event) {
                            var cursor = event.target.result;
                            if (cursor) {
                                cursor.kage_kageDB = kageDB;
                            }
                            onsuccess_internal.call(this, event);
                        };
                        req.addEventListener('success', onsuccess);
                    }
                });

                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBIndex.prototype.get = function get() {
            var methodName = "get";
            var req = get_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBIndex.prototype.getKey = function getKey() {
            var methodName = "getKey";
            var req = getKey_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBIndex.prototype.count = function count() {
            var methodName = "count";
            var req = count_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
        IDBIndex.prototype.fetch = function fetch(range, direction, filter) {
            var methodName = "fetch";
            var self = this;
            var req = helper.fetch(function () {
                if (range) {
                    if (typeof direction === "number") {
                        return self.openCursor(range, direction);
                    } else {
                        return self.openCursor(range);
                    }
                } else {
                    return  self.openCursor();
                }
            }, filter || function (value) { return value; });

            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
    }());

    // customize IDBCursor prototype
    (function () {
        var IDBCursor = global.IDBCursor || global.webkitIDBCursor;
        var className = "IDBCursor";
        var update_original =IDBCursor.prototype.update;
        var delete_original =IDBCursor.prototype["delete"];
       IDBCursor.prototype.update = function update() {
            var methodName = "update";
            var req = update_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
       IDBCursor.prototype["delete"] = function _delete() {
            var methodName = "delete";
            var req = delete_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            if (kageDB) {
                kageDB.bindListener("success", req, className, methodName);
                kageDB.bindListener("error", req, className, methodName);
            }
            return req;
        };
    }());

    // customize IDBCursorWithValue prototype
    (function () {
        var IDBCursorWithValue = global.IDBCursorWithValue || global.webkitIDBCursorWithValue;

        // Google Chrome 19.0.1084.41 doen't support IDBCursorWithValue
        if (IDBCursorWithValue) {
            var className = "IDBCursorWithValue";
            var update_original = IDBCursorWithValue.prototype.update;
            var delete_original = IDBCursorWithValue.prototype["delete"];
            IDBCursorWithValue.prototype.update = function update() {
                var methodName = "update";
                var req = update_original.apply(this, arguments);
                var kageDB = this.kage_kageDB;
                if (kageDB) {
                    kageDB.bindListener("success", req, className, methodName);
                    kageDB.bindListener("error", req, className, methodName);
                }
                return req;
            };
            IDBCursorWithValue.prototype["delete"] = function _delete() {
                var methodName = "delete";
                var req = delete_original.apply(this, arguments);
                var kageDB = this.kage_kageDB;
                if (kageDB) {
                    kageDB.bindListener("success", req, className, methodName);
                    kageDB.bindListener("error", req, className, methodName);
                }
                return req;
            };
        }
    }());

}(this));