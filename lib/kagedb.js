(function (env) {

    "use strict";

    // check indexedDB existent
    var indexedDB = env.indexedDB ||  env.msIndexedDB || env.webkitIndexedDB || env.mozIndexedDB;
    if (!indexedDB) {
        return;
    }

    // export
    env.indexedDB = indexedDB;
    env.IDBRequest = env.IDBRequest || env.webkitIDBRequest;
    env.IDBCursor = env.IDBCursor || env.webkitIDBCursor;
    env.IDBTransaction = env.IDBTransaction || env.webkitIDBTransaction;
    env.IDBKeyRange = env.IDBKeyRange || env.webkitIDBKeyRange;
    env.KageDB = KageDB;

    // see https://developer.mozilla.org/en/IndexedDB/IDBDatabaseException
    var ERROR_CODE_MAP = {
        1: "UNKNOWN_ERR(1): The operation failed for reasons unrelated to the database itself, and " +
            "it is not covered by any other error code; for example, a failure due to disk IO errors.",
        2: "NON_TRANSIENT_ERR(2): An operation was not allowed on an object. Unless the cause of the " +
            "error is corrected, retrying the same operation would result in failure.",
        3: "NOT_FOUND_ERR(3): The operation failed, because the requested database object could not " +
            "be found; for example, an object store did not exist but was being opened.",
        4: "CONSTRAINT_ERR(4): A mutation operation in the transaction failed because a constraint " +
            "was not satisfied. For example, an object, such as an object store or index, already " +
            "exists and a request attempted to create a new one.",
        5: "DATA_ERR(5): Data provided to an operation does not meet requirements.",
        6: "NOT_ALLOWED_ERR(6): An operation was called on an object where it is not allowed or " +
            "at a time when it is not allowed. It also occurs if a request is made on a source " +
            "object that has been deleted or removed.",
        7: "TRANSACTION_INACTIVE_ERR(7): A request was made against a transaction that is either not " +
            "currently active or is already finished.",
        8: "ABORT_ERR(8): A request was aborted, for example, through a call to IDBTransaction.abort.",
        9: "READ_ONLY_ERR(9): A mutation operation was attempted in a READ_ONLY transaction.",
        10: "TIMEOUT_ERR(10): A lock for the transaction could not be obtained in a reasonable time.",
        11: "QUOTA_ERR(11): Either there's not enough remaining storage space or the storage quota " +
            "was reached and the user declined to give more space to the database.",
        12: "VERSION_ERR(12): A request to open a database with a version lower than the one it " +
            "already has. This can only happen with IDBOpenDBRequest."
    };

    // internal helper object
    var helper = {
        bulk: function bulk(len, callback) {
            var done = false;
            var bulkReq = Object.defineProperties({}, {
                readyState: {
                    get: function () {
                        return (done) ? env.IDBRequest.DONE : env.IDBRequest.LOADING ;
                    },
                    enumerable: true
                }
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
                            if (bulkReq.onsuccess) {
                                bulkReq.onsuccess({target: bulkReq, type: "success"});
                            }
                        }
                    };
                    req.onerror = function onerror(event) {
                        done = true;
                        bulkReq.kage_cause = event;
                        if (bulkReq.onerror) {
                            bulkReq.onerror({target: bulkReq, type: "error"});
                        }
                    };
                }(i));
            }
            return bulkReq;
        },

        fetch: function fetch(req, filter, reduce, initValue) {
            filter = filter || function (value) { return value; };
            var done = false;
            var fetchReq = Object.defineProperties({}, {
                readyState: {
                    get: function () {
                        return (done) ? env.IDBRequest.DONE : env.IDBRequest.LOADING;
                    },
                    enumerable: true
                }
            });
            fetchReq.errorCode = undefined;
            fetchReq.error = undefined;
            fetchReq.result = undefined;
            fetchReq.onsuccess = null;
            fetchReq.onerror = null;
            var first = true;
            var result = [];
            var handler = function defaultHandler(value) { result.push(value); };
            if (reduce) {
                handler = function reduceHandler(value) {
                    if (first) {
                        result = (typeof initValue === "undefined") ? value : reduce(initValue, value);
                        first = false;
                    } else {
                        result = reduce(result, value);
                    }
                }
            }
            req.onsuccess = function onsuccess(event) {
                var cursor = event.target.result;
                if (cursor) {
                    var value = cursor.value;
                    if (filter(value)) {
                        handler(value);
                    }
                    cursor.continue();
                } else {
                    done = true;
                    fetchReq.result = result;
                    if (fetchReq.onsuccess) {
                        fetchReq.onsuccess({target: fetchReq, type: "success"});
                    }
                }
            };
            req.onerror = function onerror(event) {
                done = true;
                fetchReq.kage_cause = event;
                if (fetchReq.onerror) {
                    fetchReq.onerror({target: fetchReq, type: "error"});
                }
            };
            return fetchReq;
        },

        openCursor: function openCursor(source, range, direction) {
            if (range) {
                if (typeof direction === "number") {
                    return source.openCursor(range, direction);
                } else {
                    return source.openCursor(range);
                }
            } else {
                return  source.openCursor();
            }
        },

        join: function join(target, args) {
            var requests = args.length === 1 && Array.isArray(args[0])
                ? args[0]
                : Array.prototype.slice.call(args);
            var req = helper.bulk(requests.length, function (i) {
                return requests[i];
            });
            helper.bindListeners(req, target, ["error"]);
            helper.attachInfo(req, "KageDB", "join", args);
            return req;
        },

        bindListeners: function bindListener(target, source, eventNames) {
            if (target && source && eventNames) {
                eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];
                for (var i = 0, len = eventNames.length; i < len; i++) {
                    var onName = "on" + eventNames[i];
                    var listener = source[onName];
                    if (listener && onName in target) {
                        target[onName] = listener;
                    }
                }
            }
        },

        attachInfo: function (target, className, methodName, args) {
            target.kage_className = className;
            target.kage_methodName = methodName;
            target.kage_args = Array.prototype.slice.call(args);
            target.kage_getErrorMessage = function () {
                var t = (target.kage_cause && target.kage_cause.target) || target;
                var message = KageDB.getMessage(t.errorCode);
                return "[KageDB] An error occurred at { className: " + className +
                    ", methodName: " + methodName + " }. " + message;
            };
        }
    };

    function KageDB(options) {
        options = options || {};
        this._autoClose = options.autoClose !== false;
    }

    KageDB.version = "0.0.0";

    KageDB.getMessage = function getMessage(code) {
        return  ERROR_CODE_MAP[code] || "";
    };

    KageDB.prototype.open = function open(name, version) {
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
                    helper.bindListeners(db, self, ["abort", "error"]);
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
                    helper.bindListeners(db, self, ["abort", "error"]);
                    onupgradeneeded_internal.call(this, event);
                };
                req.addEventListener('upgradeneeded', onupgradeneeded);
            }
        });

        // hook onsuccess to do followings:
        // - attach a kageDB to a db
        // - abstract away the differences the existing implementations in IE, Firefox and Chrome
        // - close a db
        var onsuccess;
        Object.defineProperty(req, "onsuccess", {
            get: function () {
                return onsuccess;
            },
            set: function (onsuccess_internal) {
                req.removeEventListener('success', onsuccess);
                onsuccess = function onsuccess(event) {
                    var db = event.target.result;

                    function do_onsuccess_internal() {
                        try {
                            onsuccess_internal.call(event.target, event);
                        } catch (e) {
                            if (self._autoClose) {
                                db.close();
                            }
                            throw e;
                        }
                        if (self._autoClose) {
                            db.close();
                        }
                    }

                    db.kage_kageDB = self;
                    helper.bindListeners(db, self, ["abort", "error"]);

                    function do_onsuccess_internal() {
                        try {
                            onsuccess_internal.call(event.target, event);
                        } catch (e) {
                            if (self._autoClose) {
                                db.close();
                            }
                            throw e;
                        }
                        if (self._autoClose) {
                            db.close();
                        }
                    }

                    if (db.setVersion) {
                        // Chrome
                        var newVersion = version;
                        var oldVersion = db.version;
                        if (!oldVersion && typeof newVersion === "undefined") {
                            newVersion = 1;
                        }
                        if (oldVersion < newVersion) {
                            // Chrome, if version changed
                            var setVerReq = db.setVersion(newVersion);
                            setVerReq.onsuccess = function () {
                                if (event.target.onupgradeneeded) {
                                    event.target.onupgradeneeded(event);
                                }
                                do_onsuccess_internal();
                            };
                        } else {
                            // Chrome, if version not changed
                            do_onsuccess_internal();
                        }
                    } else {
                        // IE or Firefox
                        do_onsuccess_internal();
                    }
                };
                req.addEventListener('success', onsuccess);
            }
        });

        helper.bindListeners(req, this, ["blocked", "upgradeneeded", "success", "error"]);
        helper.attachInfo(req, "KageDB", "open", arguments);
        return req;
    };

    KageDB.prototype.deleteDatabase = function deleteDatabase(name) {
        var req = indexedDB.deleteDatabase(name);
        helper.bindListeners(req, this, ["blocked", "upgradeneeded", "error"]);
        helper.attachInfo(req, "KageDB", "deleteDatabase", arguments);
        return req;
    };

    KageDB.prototype.cmp = function cmp(first, second) {
        return indexedDB.cmp(first, second);
    };

    KageDB.prototype.join = function join() {
        return helper.join(this, arguments);
    };

    KageDB.prototype.dump = function dump(dbName, storeName) {
        if (typeof dbName !== "string")
            throw new Error("[KageDB] The dbName must be a string.");
        if (typeof storeName !== "string")
            throw new Error("[KageDB] The storeName must be a string.");

        var done = false;
        var dumpReq = Object.defineProperties({}, {
            readyState: {
                get: function () {
                    return (done) ? env.IDBRequest.DONE : env.IDBRequest.LOADING;
                },
                enumerable: true
            }
        });
        dumpReq.errorCode = 1;
        dumpReq.error = undefined;
        dumpReq.result = undefined;
        dumpReq.onsuccess = null;
        dumpReq.onerror = null;

        var req = this.open(dbName);
        req.onsuccess = function (event) {
            var db = event.target.result;
            var tx = db.transaction([storeName], env.IDBTransaction.READ_ONLY);
            var req = tx.objectStore(storeName).fetch();
            req.onsuccess = function (event) {
                done = true;
                dumpReq.result = event.target.result;
                if (dumpReq.onsuccess) {
                    dumpReq.onsuccess({target: dumpReq, type: "success"});
                }
            };
            req.onerror = function onerror(event) {
                done = true;
                dumpReq.kage_cause = event;
                if (dumpReq.onerror) {
                    dumpReq.onerror({target: dumpReq, type: "error"});
                }
            };
        };

        helper.bindListeners(dumpReq, this, ["error"]);
        helper.attachInfo(dumpReq, "KageDB", "dump", arguments);
        return dumpReq;
    };

    KageDB.prototype.onerror = function onerror(event) {
        var target = event.target;
        var message = (target && target.kage_getErrorMessage && target.kage_getErrorMessage()) || "unknown";
        var error = new Error(message);
        error.kage_event = event;
        throw error;
    };

    KageDB.prototype.onblocked = function onblocked() {
    };

    KageDB.prototype.onupgradeneeded = function onupgradeneeded() {
    };

    KageDB.prototype.onsuccess = function onsuccess() {
    };

    KageDB.prototype.onabort = function onabort() {
    };

    KageDB.prototype.oncomplete = function oncomplete() {
    };

    // customize IDBDatabase prototype
    (function () {
        var IDBDatabase = env.IDBDatabase || env.webkitIDBDatabase;
        var createObjectStore_original = IDBDatabase.prototype.createObjectStore;
        var transaction_original = IDBDatabase.prototype.transaction;
        var setVersion_original = IDBDatabase.prototype.setVersion;
        IDBDatabase.prototype.createObjectStore = function createObjectStore() {
            var store = createObjectStore_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            store.kage_kageDB = kageDB;
            return store;
        };
        IDBDatabase.prototype.transaction = function () {
            var tx = transaction_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            tx.kage_kageDB = kageDB;
            return tx;
        };
        // setVersion is deprecated in W3C Working Draft 19 April 2011,
        // but Google Chrome 19.0.1084.41 uses this function.
        if (setVersion_original) {
            IDBDatabase.prototype.setVersion = function () {
                var req = setVersion_original.apply(this, arguments);
                var kageDB = this.kage_kageDB;

                // hook onsuccess to attach a kageDB to a tx
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
                            onsuccess_internal.call(this, event);
                        };
                        req.addEventListener("success", onsuccess);
                    }
                });
                helper.attachInfo(req, "IDBDatabase", "setVersion", arguments);
                return req;
            };
        }
    }());

    // customize IDBTransaction prototype
    (function () {
        var IDBTransaction =  env.IDBTransaction || env.webkitIDBTransaction;
        var objectStore_original = IDBTransaction.prototype.objectStore;
        IDBTransaction.prototype.objectStore = function objectStore() {
            var store = objectStore_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;
            store.kage_kageDB = kageDB;
            return store;
        };
        IDBTransaction.prototype.join = function () {
            return helper.join(this.kage_kageDB, arguments);
        };
    }());

    // customize IDBObjectStore prototype
    (function () {
        var IDBObjectStore = env.IDBObjectStore || env.webkitIDBObjectStore;
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
            var req = put_original.apply(this, arguments);
            helper.attachInfo(req, "IDBObjectStore", "put", arguments);
            return req;
        };
        IDBObjectStore.prototype.add = function add() {
            var req = add_original.apply(this, arguments);
            helper.attachInfo(req, "IDBObjectStore", "add", arguments);
            return req;
        };
        IDBObjectStore.prototype["delete"] = function _delete() {
            var req = delete_original.apply(this, arguments);
            helper.attachInfo(req, "IDBObjectStore", "delete", arguments);
            return req;
        };
        IDBObjectStore.prototype.get = function get() {
            var req = get_original.apply(this, arguments);
            helper.attachInfo(req, "IDBObjectStore", "get", arguments);
            return req;
        };
        IDBObjectStore.prototype.clear = function clear() {
            var req = clear_original.apply(this, arguments);
            helper.attachInfo(req, "IDBObjectStore", "clear", arguments);
            return req;
        };
        IDBObjectStore.prototype.openCursor = function openCursor() {
            var req = openCursor_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;

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

            helper.attachInfo(req, "IDBObjectStore", "openCursor", arguments);
            return req;
        };
        IDBObjectStore.prototype.count = function count() {
            var req = count_original.apply(this, arguments);
            helper.attachInfo(req, "IDBObjectStore", "count", arguments);
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
            if (!Array.isArray(values))
                throw new Error("[KageDB] The values must be an array.");
            if (keys && !Array.isArray(keys))
                throw new Error("[KageDB] The keys must be an array.");
            if (keys && values.length !== keys.length)
                throw new Error("[KageDB] The values.length and keys.length must be same.");

            var self = this;
            var req = helper.bulk(values.length, function _put(i) {
                if (keys) {
                    return self.put(values[i], keys[i]);
                } else {
                    return self.put(values[i]);
                }
            });
            helper.attachInfo(req, "IDBObjectStore", "bulkPut", arguments);
            return req;
        };
        IDBObjectStore.prototype.bulkAdd = function bulkAdd(values, keys) {
            if (!Array.isArray(values))
                throw new Error("[KageDB] The values must be an array.");
            if (keys && !Array.isArray(keys))
                throw new Error("[KageDB] The keys must be an array.");
            if (keys && values.length !== keys.length)
                throw new Error("[KageDB] The values.length and keys.length must be same.");

            var self = this;
            var req = helper.bulk(values.length, function _add(i) {
                if (keys) {
                    return self.add(values[i], keys[i]);
                } else {
                    return self.add(values[i]);
                }
            });
            helper.attachInfo(req, "IDBObjectStore", "bulkAdd", arguments);
            return req;
        };
        IDBObjectStore.prototype.bulkDelete = function bulkDelete(keys) {
            if (keys && !Array.isArray(keys)) throw new Error("[KageDB] The keys must be array.");

            var self = this;
            var req = helper.bulk(keys.length, function _delete(i) {
                return self["delete"](keys[i]);
            });
            helper.attachInfo(req, "IDBObjectStore", "bulkDelete", arguments);
            return req;
        };
        IDBObjectStore.prototype.fetch = function fetch(range, direction, filter, reduce, initValue) {
            var req = helper.fetch(helper.openCursor(this, range, direction), filter, reduce, initValue);
            helper.attachInfo(req, "IDBObjectStore", "fetch", arguments);
            return req;
        };
    }());

    // customize IDBIndex prototype
    (function () {
        var IDBIndex = env.IDBIndex || env.webkitIDBIndex;
        var openCursor_original = IDBIndex.prototype.openCursor;
        var openKeyCursor_original = IDBIndex.prototype.openKeyCursor;
        var get_original = IDBIndex.prototype.get;
        var getKey_original = IDBIndex.prototype.getKey;
        var count_original = IDBIndex.prototype.count;
        IDBIndex.prototype.openCursor = function openCursor() {
            var req = openCursor_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;

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

            helper.attachInfo(req, "IDBIndex", "openCursor", arguments);
            return req;
        };
        IDBIndex.prototype.openKeyCursor = function openKeyCursor() {
            var req = openKeyCursor_original.apply(this, arguments);
            var kageDB = this.kage_kageDB;

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

            helper.attachInfo(req, "IDBIndex", "openKeyCursor", arguments);
            return req;
        };
        IDBIndex.prototype.get = function get() {
            var req = get_original.apply(this, arguments);
            helper.attachInfo(req, "IDBIndex", "get", arguments);
            return req;
        };
        IDBIndex.prototype.getKey = function getKey() {
            var req = getKey_original.apply(this, arguments);
            helper.attachInfo(req, "IDBIndex", "getKey", arguments);
            return req;
        };
        IDBIndex.prototype.count = function count() {
            var req = count_original.apply(this, arguments);
            helper.attachInfo(req, "IDBIndex", "count", arguments);
            return req;
        };
        IDBIndex.prototype.fetch = function fetch(range, direction, filter, reduce, initValue) {
            var req = helper.fetch(helper.openCursor(this, range, direction), filter, reduce, initValue);
            helper.attachInfo(req, "IDBIndex", "fetch", arguments);
            return req;
        };
    }());

    // customize IDBCursor prototype
    (function () {
        var IDBCursor = env.IDBCursor || env.webkitIDBCursor;
        var update_original =IDBCursor.prototype.update;
        var delete_original =IDBCursor.prototype["delete"];
        IDBCursor.prototype.update = function update() {
            var req = update_original.apply(this, arguments);
            helper.attachInfo(req, "IDBCursor", "update", arguments);
           return req;
        };
        IDBCursor.prototype["delete"] = function _delete() {
            var req = delete_original.apply(this, arguments);
            helper.attachInfo(req, "IDBCursor", "delete", arguments);
            return req;
        };
    }());

    // customize IDBCursorWithValue prototype
    (function () {
        var IDBCursorWithValue = env.IDBCursorWithValue || env.webkitIDBCursorWithValue;

        // Google Chrome 19.0.1084.41 doen't support IDBCursorWithValue
        if (IDBCursorWithValue) {
            var update_original = IDBCursorWithValue.prototype.update;
            var delete_original = IDBCursorWithValue.prototype["delete"];
            IDBCursorWithValue.prototype.update = function update() {
                var req = update_original.apply(this, arguments);
                helper.attachInfo(req, "IDBCursorWithValue", "update", arguments);
                return req;
            };
            IDBCursorWithValue.prototype["delete"] = function _delete() {
                var req = delete_original.apply(this, arguments);
                helper.attachInfo(req, "IDBCursorWithValue", "delete", arguments);
                return req;
            };
        }
    }());

}(this));