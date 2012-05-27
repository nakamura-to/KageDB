(function (env) {

    "use strict";

    // export
    env.KageDB = KageDB;

    var indexedDB = env.indexedDB ||  env.msIndexedDB || env.webkitIndexedDB || env.mozIndexedDB;
    var IDBCursor = env.IDBCursor || env.webkitIDBCursor;
    var IDBTransaction = env.IDBTransaction || env.webkitIDBTransaction;
    var IDBKeyRange = env.IDBKeyRange || env.webkitIDBKeyRange;

    var helper = {
        registerSuccessHandler: function registerSuccessHandler(target, success){
            target.onsuccess = function (event) {
                if (success) success.call(this, event.target.result, event);
            };
        },

        registerErrorHandler: function registerErrorHandler(target, error){
            target.onerror = function (event) {
                var message = helper.makeErrorMessage(event);
                event.kage_message = KageDB.prefix("An error occurred. " + JSON.stringify(message, null, 2));
                if (error) error.call(this, event);
            };
        },

        invokeOpenCursor: function invokeOpenCursor(range, direction, openCursor) {
            range = this.convertToRange(range);
            direction = convertDirection(direction);

            if (range && direction) {
                return openCursor(range, direction);
            }
            if (range) {
                return openCursor(range);
            }
            if (direction) {
                return openCursor(null, direction);
            }
            return openCursor();

            function convertDirection(direction) {
                var defined = typeof IDBCursor.NEXT !== "undefined";
                switch (direction) {
                    case "next": return defined ? IDBCursor.NEXT : direction;
                    case "nextunique": return defined ? IDBCursor.NEXT_NO_DUPLICATE : direction;
                    case "prev": return defined ? IDBCursor.PREV : direction;
                    case "prevunique": return defined ? IDBCursor.PREV_NO_DUPLICATE : direction;
                    default: return null;
                }
            }
        },

        convertToRange: function (range) {
            if (typeof range !== "object" || range === null) {
                return range;
            }

            var lower = null;
            var lowerOpen = false;
            var upper = null;
            var upperOpen = false;
            var keys = Object.keys(range);
            var len = keys.length;

            for (var i = 0; i < len; i++) {
                var key = keys[i];
                var value = range[key];
                switch (key) {
                    case "eq": return IDBKeyRange.only(value);
                    case "ge": lower = value; break;
                    case "gt": lower = value; lowerOpen = true; break;
                    case "le": upper = value; break;
                    case "lt": upper = value;  upperOpen = true; break;
                    default: /* ignore */ break;
                }
            }

            if (lower && upper) {
                return IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen);
            } else if (lower) {
                return IDBKeyRange.lowerBound(lower, lowerOpen);
            } else if (upper) {
                return IDBKeyRange.upperBound(upper, upperOpen);
            } else {
                return null;
            }
        },

        bulk: function bulk(requests, success, error) {
            var keys = Object.keys(requests);
            var len = keys.length;
            var pending = len;
            var results = Array.isArray(requests) ? [] : {};

            function tryComplete() {
                pending--;
                if (pending === 0 && success) success.call(null, results);
            }

            for (var i = 0; i < len && pending > 0; i++) {
                (function (key) {
                    var req = requests[key];
                    if (req && typeof req.onsuccess !== "undefined" && typeof req.onerror !== "undefined") {
                        req.onsuccess = function (event) {
                            results[key] = (event && event.target) ? event.target.result : event;
                            tryComplete();
                        };
                        req.onerror = function(event) {
                            pending = 0;
                            if (error) error.call(this, event);
                        };
                    } else {
                        results[key] = req;
                        tryComplete();
                    }
                }(keys[i]));
            }

            return Object.create(Object.prototype, {
                onsuccess: {
                    get: function () { return success; },
                    set: function (value) { success = value; },
                    enumerable: true
                },
                onerror: {
                    get: function () { return error; },
                    set: function (value) { error = value; },
                    enumerable: true
                }
            });
        },

        attachInfo: function attachInfo(target, instance, methodName, additionalInfo) {
            if (target) {
                target.kage_className = instance && instance.constructor && instance.constructor.name;
                target.kage_methodName = methodName;
                target.kage_additinalInfo = additionalInfo;
            }
        },

        makeErrorMessage: function makeErrorMessage(event) {
            event = event || {};
            var target = event.target || {};
            var source = target.source || {};
            var currentTarget = event.currentTarget || {};
            return {
                eventType: event.type,
                eventTarget: target.toString(),
                eventCurrentTarget: currentTarget.toString(),
                sourceName: source.name,
                className: target.kage_className,
                methodName: target.kage_methodName,
                additionalInfo: target.kage_additinalInfo,
                errorCode: target.errorCode,
                errorDetail: target.webkitErrorMessage || KageDB.errorMessages[target.errorCode]
            };
        },

        makeBlockedMessage: function makeBlockedMessage(event) {
            event = event || {};
            var target = event.target || {};
            return {
                eventType: event.type,
                eventTarget: target.toString(),
                className: target.kage_className,
                methodName: target.kage_methodName,
                additionalInfo: target.kage_additinalInfo
            };
        },

        defineConstructorName: function defineConstructorName(instance) {
            if (instance && instance.constructor && typeof instance.constructor.name === "undefined") {
                var constructor = instance.constructor;
                Object.defineProperty(constructor, "name", {
                    value: constructor.toString().match(/^function (\w*)/)[1]
                });
            }
        }
    };

    function KageDB(settings) {
        if (!KageDB.isAvailable()) {
            throw new Error(KageDB.prefix("Indexed Database API is not supported in this browser."));
        }
        if (!settings) {
            throw new Error(KageDB.prefix("`settings` is required."));
        }
        if (!settings.name) {
            throw new Error(KageDB.prefix("`settings.name` is require."));
        }
        if (settings.version != null && typeof settings.version !== "number") {
            throw new Error(KageDB.prefix("`settings.version` must be a number."));
        }
        if (typeof settings.migration !== "object" || settings.migration === null) {
            throw new Error(KageDB.prefix("`settings.migration` is required. It must be an object."));
        }
        this.name = settings.name;
        this.version = settings.version || 1;
        this.migration = settings.migration;
        this.autoClose = settings.autoClose !== false;
        this.txMode = settings.txMode || "readwrite";
        this.debug = typeof settings.debug === "function" && settings.debug || function () {};
        this.onerror = typeof settings.onerror === "function" && settings.onerror || function (event) {
            throw new Error(event.kage_message);
        };
        this.onblocked = typeof settings.onblocked === "function" && settings.onblocked || function () {};
        helper.defineConstructorName(this);
    }

    KageDB.version = "0.0.4";

    KageDB.KageDatabase = KageDatabase;

    KageDB.KageTransaction = KageTransaction;

    KageDB.KageObjectStore = KageObjectStore;

    KageDB.KageIndex = KageIndex;

    KageDB.KageCursor = KageCursor;

    KageDB.prefix = function (message) {
        return "[KageDB] " + message;
    };

    KageDB.isAvailable = function () {
        return !!indexedDB
    };

    KageDB.helper = helper;

    // see https://developer.mozilla.org/en/IndexedDB/IDBDatabaseException
    KageDB.errorMessages = {
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

    KageDB.prototype.cmp = function cmp(first, second) {
        return indexedDB.cmp(first, second);
    };

    KageDB.prototype.all = function all(storeName, success, error) {
        if (!storeName) throw new Error(KageDB.prefix("`storeName` is require."));

        return this.tx([storeName], "readonly", function (tx, store) {
            store.fetch(function (results, event) {
                if (success) success.call(this, results, event);
            });
        }, error);
    };

    KageDB.prototype.tx = function tx(storeNames, mode, success, error) {
        if (!storeNames) throw new Error(KageDB.prefix("`storeNames` is require."));
        if (!Array.isArray(storeNames)) throw new Error(KageDB.prefix("`storeNames` must be an array."));

        if (typeof mode === "function") {
            error = success;
            success = mode;
            mode = null;
        }

        error = error || this.onerror;
        var self = this;
        var upgradeLock = false;  // it is used to adapt old IndexedDB API
        var req = indexedDB.open(this.name, this.version);
        this._debug("`IDBFactory.open` is called. name = '" + this.name + "', version = " + this.version);
        helper.attachInfo(req, this, "tx", { storeNames: storeNames, mode: mode, operation: "open" });
        helper.registerErrorHandler(req, error);

        req.onblocked = function (event) {
            self._debug("`IDBOpenDBRequest.onblocked` is called.");
            var message = helper.makeBlockedMessage(event);
            event.kage_message = KageDB.prefix("A blocking occurred. " + JSON.stringify(message, null, 2));
            if (self.onblocked) self.onblocked.call(this, event);
        };

        req.onupgradeneeded = function (event) {
            self._debug("`IDBOpenDBRequest.onupgradeneeded` is called.");
            var db = new KageDatabase(event.target.result, self);
            helper.registerErrorHandler(db, error);
            var tx = new KageTransaction(event.target.transaction, self);

            upgradeLock = true;
            self._migrate(db, tx, event.oldVersion, event.newVersion, function () {
                upgradeLock = false;
            });
        };

        req.onsuccess = function (event) {
            self._debug("`IDBFactory.open` is succeeded.");
            var openCtx = this;
            var db = new KageDatabase(event.target.result, self);
            helper.registerErrorHandler(db, error);

            if (db._db.setVersion) {
                // Chrome
                var newVersion = self.version;
                var oldVersion = db.version;
                if (oldVersion < newVersion) {
                    // Chrome, if version changed
                    var req = db._db.setVersion(newVersion);
                    self._debug("`IDBDatabase.setVersion` is called. newVersion = " + newVersion);
                    helper.attachInfo(req, self, "tx",
                        { storeNames: storeNames, mode: mode, operation: "setVersion" });
                    helper.registerErrorHandler(req, error);
                    req.onsuccess = function (event) {
                        self._debug("`IDBDatabase.setVersion` is succeeded.");
                        var tx = new KageTransaction(event.target.transaction, self);
                        if (self.migration) {
                            self._migrate(db, tx, oldVersion, newVersion, function () {
                                do_onsuccess.call(openCtx);
                            });
                        }
                    };
                } else {
                    // Chrome, if version not changed
                    do_onsuccess.call(this);
                }
            } else {
                // IE or Firefox
                if (!upgradeLock) do_onsuccess.call(this);
            }

            function do_onsuccess() {
                var tx = db.transaction(storeNames, mode);
                var args = [tx];
                storeNames.forEach(function (name) {
                    var store = tx.objectStore(name);
                    args.push(store);
                });
                args.push(event);
                if (success) success.apply(this, args);
                if (self.autoClose) {
                    db.close();
                }
            }
        };
        return req;
    };

    KageDB.prototype.deleteDatabase = function deleteDatabase(success, error) {
        error = error || this.onerror;
        var self = this;
        var req = indexedDB.deleteDatabase(this.name);
        this._debug("`IDBFactory.deleteDatabase` is called. name = " + this.name);
        helper.attachInfo(req, this, "deleteDatabase", {});
        req.onsuccess = function(event) {
            self._debug("IDBFactory.deleteDatabase is succeeded.");
            if (success) success.call(this, event.target.result, event);
        };
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageDB.prototype._migrate = function _migrate(db, tx, oldVersion, newVersion, complete) {
        var self = this;
        var migration = this.migration || {};
        var targets = selectTargets(migration, oldVersion, newVersion);
        if (typeof migration.before === "function") {
            targets.unshift(function () {
                self._debug("migration `before`.");
                migration.before.apply(this, arguments);
            });
        }
        if (typeof migration.after === "function") {
            targets.push(function () {
                self._debug("migration `after`.");
                migration.after.apply(this, arguments);
            });
        }
        var ctx = { db: db, tx: tx, oldVersion: oldVersion, newVersion: newVersion };
        var migrate = targets.reduceRight(function (next, curr) {
            return function () {
                curr.call(migration, ctx, next);
            }
        }, function () {
            self._debug("migration `complete`.");
            complete.apply(this, arguments);
        });
        migrate();

        function selectTargets(migration, oldVersion, newVersion) {
            var keys = Object.keys(migration).sort();
            var results = [];
            for (var i = 0, len = keys.length; i < len; i++) {
                var version = parseInt(keys[i], 10);
                if (isNaN(version)) {
                    continue;
                }
                if (version > oldVersion && version <= newVersion) {
                    var value =  migration[version];
                    if (typeof value === "function") {
                        results.push(function (version, value) {
                            return function () {
                                self._debug("migration version = " + version + "");
                                value.apply(this, arguments);
                            };
                        }(version, value));
                    }
                }
                if (version > newVersion) {
                    break;
                }
            }
            return results;
        }
    };

    KageDB.prototype._debug = function _debug(s) {
        if (typeof this.debug === "function") {
            this.debug(KageDB.prefix("debug: " + s));
        }
    };

    function KageDatabase(db, kageDB) {
        Object.defineProperties(this, {
            _db: {
                value: db
            },
            _kageDB: {
                value: kageDB
            },
            name: {
                get: function () { return db.name; },
                enumerable: true
            },
            version: {
                get: function () {
                    var version = parseInt(db.version || 0, 10);
                    return isNaN(version) ? db.version : version;
                },
                enumerable: true
            },
            objectStoreNames: {
                get: function () { return db.objectStoreNames; },
                enumerable: true
            },
            onabort: {
                get: function () { return db.onabort;},
                set: function (value) { db.onabort = value; },
                enumerable: true
            },
            onerror: {
                get: function () { return db.onerror;},
                set: function (value) { db.onerror = value; },
                enumerable: true
            },
            onversionchange: {
                get: function () { return db.onversionchange;},
                set: function (value) { db.onversionchange = value; },
                enumerable: true
            }
        });
        helper.defineConstructorName(this);
    }

    KageDatabase.prototype.createObjectStore = function createObjectStore(name, optionalParameters) {
        if (!name) throw new Error(KageDB.prefix("`name` is require."));

        var objectStore = this._db.createObjectStore(name, optionalParameters);
        return new KageObjectStore(objectStore, this._kageDB);
    };

    KageDatabase.prototype.deleteObjectStore = function deleteObjectStore(name) {
        if (!name) throw new Error(KageDB.prefix("`name` is require."));

        this._db.deleteObjectStore(name);
    };

    KageDatabase.prototype.transaction = function transaction(storeNames, mode) {
        if (!storeNames) throw new Error(KageDB.prefix("`storeNames` is require."));
        if (!Array.isArray(storeNames)) throw new Error(KageDB.prefix("`storeNames` must be an array."));

        mode = mode || this._kageDB.txMode;
        var transaction = this._db.transaction(storeNames, convertMode(mode));
        this._kageDB._debug("begin transaction. storeNames = " + storeNames + ", mode = '" + mode + "'");
        return new KageTransaction(transaction, this._kageDB);

        function convertMode(mode) {
            var defined = typeof IDBTransaction.READ_ONLY !== "undefined";
            switch (mode) {
                case "readonly": return defined ? IDBTransaction.READ_ONLY : mode;
                case "readwrite": return defined ? IDBTransaction.READ_WRITE : mode;
                case "versionchange": return defined ? IDBTransaction.VERSION_CHANGE : mode;
                default: throw new Error("unknown mode: " + mode);
            }
        }
    };

    KageDatabase.prototype.close = function close() {
        return this._db.close();
    };

    function KageTransaction(tx, kageDB) {
        Object.defineProperties(this, {
            _tx: {
                value: tx
            },
            _kageDB: {
                value: kageDB
            },
            mode: {
                get: function () {
                    if (typeof tx.mode === "string") {
                        return tx.mode;
                    }
                    switch (tx.mode) {
                        case IDBTransaction.READ_ONLY: return "readonly";
                        case IDBTransaction.READ_WRITE: return "readwrite";
                        case IDBTransaction.VERSION_CHANGE: return "versionchange";
                        default: return tx.mode;
                    }
                },
                enumerable: true
            },
            db: {
                get: function () {
                    return new KageDatabase(tx.db, kageDB);
                },
                enumerable: true
            },
            error: {
                get: function () { return tx.error; },
                enumerable: true
            },
            onabort: {
                get: function () { return tx.onabort;},
                set: function (value) { tx.onabort = value; },
                enumerable: true
            },
            onerror: {
                get: function () { return tx.onerror;},
                set: function (value) { tx.onerror = value; },
                enumerable: true
            },
            oncomplete: {
                get: function () { return tx.oncomplete;},
                set: function (value) { tx.oncomplete = value; },
                enumerable: true
            }
        });
        helper.defineConstructorName(this);
    }

    KageTransaction.prototype.objectStore =function objectStore(name) {
        if (!name) throw new Error(KageDB.prefix("`name` is require."));

        var objectStore = this._tx.objectStore(name);
        return new KageObjectStore(objectStore, this._kageDB);
    };

    KageTransaction.prototype.abort = function abort() {
        this._tx.abort();
    };

    KageTransaction.prototype.join = function join(requests, success, error) {
        if (!requests) throw new Error(KageDB.prefix("`requests` is require."));
        if (!Array.isArray(requests) && typeof requests !== "object") {
            throw new Error(KageDB.prefix("`requests` must be an array or an object."));
        }

        Object.keys(requests).forEach(function (key) {
            helper.attachInfo(requests[key], this, "join", { key: key });
        }, this);

        var req = helper.bulk(requests, success, error);
        helper.attachInfo(req, this, "join", {});
        return req;
    };

    function KageObjectStore(objectStore, kageDB) {
        Object.defineProperties(this, {
            _objectStore: {
                value: objectStore
            },
            _kageDB: {
                value: kageDB
            },
            name: {
                get: function() { return objectStore.name; },
                enumerable: true
            },
            keyPath: {
                get: function () { return objectStore.keyPath; },
                enumerable: true
            },
            indexNames: {
                get: function () { return objectStore.indexNames; },
                enumerable: true
            },
            transaction: {
                get: function () { return new KageTransaction(objectStore.transaction, kageDB); },
                enumerable: true
            },
            autoIncrement: {
                get: function () { return objectStore.autoIncrement; },
                enumerable: true
            }
        });
        helper.defineConstructorName(this);
    }

    KageObjectStore.prototype.put = function put(value, key, success, error) {
        if (value == null) throw new Error(KageDB.prefix("`value` must not be nullable."));

        if (typeof key === "function") {
            error = success;
            success = key;
            key = null;
        }
        var req = key == null ? this._objectStore.put(value) :  this._objectStore.put(value, key);
        helper.attachInfo(req, this, "put", { value: value, key: key });
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageObjectStore.prototype.add = function add(value, key, success, error) {
        if (value == null) throw new Error(KageDB.prefix("`value` must not be nullable."));

        if (typeof key === "function") {
            error = success;
            success = key;
            key = null;
        }
        var req = key == null ?  this._objectStore.add(value):  this._objectStore.add(value, key);
        helper.attachInfo(req, this, "add", { value: value, key: key });
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageObjectStore.prototype["delete"] = function _delete(key, success, error) {
        if (key == null) throw new Error(KageDB.prefix("`key` must not be nullable."));

        var range = helper.convertToRange(key);
        var req =  this._objectStore["delete"](range);
        helper.attachInfo(req, this, "delete", { key: key });
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    // alias of `delete`
    KageObjectStore.prototype.del = KageObjectStore.prototype["delete"];

    KageObjectStore.prototype.get = function get(key, success, error) {
        if (key == null) throw new Error(KageDB.prefix("`key` must not be nullable."));

        var range = helper.convertToRange(key);
        var req = this._objectStore.get(range);
        helper.attachInfo(req, this, "get", { key: key });
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageObjectStore.prototype.clear = function clear(success, error) {
        var req = this._objectStore.clear();
        helper.attachInfo(req, this, "clear", {});
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageObjectStore.prototype.openCursor = function openCursor(range, direction, success, error) {
        if (typeof range === "function" || typeof range === "string") {
            error = success;
            success = direction;
            direction = range;
            range = null;
        }
        if (typeof direction === "function") {
            error = success;
            success = direction;
            direction = null;
        }
        var self = this;
        var openCursor = this._objectStore.openCursor.bind(this._objectStore);
        var req = helper.invokeOpenCursor(range, direction, openCursor);
        helper.attachInfo(req, this, "openCursor", { range: range, direction: direction});
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (success) success.call(this, cursor && new KageCursor(cursor, self._kageDB), event);
        };
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageObjectStore.prototype.fetch = function fetch(range, direction, success, error) {
        if (typeof range === "function" || typeof range === "string") {
            error = success;
            success = direction;
            direction = range;
            range = null;
        }
        if (typeof direction === "function") {
            error = success;
            success = direction;
            direction = null;
        }
        var results = [];
        var fetch = this._objectStore.openCursor.bind(this._objectStore);
        var req = helper.invokeOpenCursor(range, direction, fetch);
        helper.attachInfo(req, this, "fetch", { range: range, direction: direction });
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
                results.push(cursor.value);
                cursor["continue"]();
            } else {
                if (success) success.call(this, results, event);
            }
        };
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageObjectStore.prototype.createIndex = function createIndex(name, keyPath, optionalParameters) {
        if (name == null) throw new Error(KageDB.prefix("`name` must not be nullable."));
        if (keyPath == null) throw new Error(KageDB.prefix("`keyPath` must not be nullable."));

        var index = this._objectStore.createIndex(name, keyPath, optionalParameters);
        return new KageIndex(index, this._kageDB);
    };

    KageObjectStore.prototype.index = function index(name) {
        if (name == null) throw new Error(KageDB.prefix("`name` must not be nullable."));

        var index = this._objectStore.index(name);
        return new KageIndex(index, this._kageDB);
    };

    KageObjectStore.prototype.deleteIndex = function deleteIndex(name) {
        if (name == null) throw new Error(KageDB.prefix("`name` must not be nullable."));
        this._objectStore.deleteIndex(name);
    };

    KageObjectStore.prototype.count =  function count(key, success, error) {
        if (typeof key === "function") {
            error = success;
            success = key;
            key = null;
        }

        var range  = helper.convertToRange(key);
        var req = range == null ? this._objectStore.count() : this._objectStore.count(range);
        helper.attachInfo(req, this, "count", { key: key });
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
    };

    KageObjectStore.prototype.bulkPut = function bulkPut(values, keys, success, error) {
        if (!values) throw new Error(KageDB.prefix("`values` is require."));
        if (!Array.isArray(values)) throw new Error(KageDB.prefix("`values` must be an array."));

        if (typeof keys === "function") {
            error = success;
            success = keys;
            keys = [];
        }
        if (!Array.isArray(keys)) {
            keys = [];
        }

        var requests = values.map(function (value, i) {
            var key = keys[i];
            var req = key == null ? this._objectStore.put(value) : this._objectStore.put(value, key);
            helper.attachInfo(req, this, "bulkPut", { value: value, key: key, index: i });
            return req;
        }, this);

        var req = helper.bulk(requests, success, error);
        helper.attachInfo(req, this, "bulkPut", {});
        return req;
    };

    KageObjectStore.prototype.bulkAdd = function bulkAdd(values, keys, success, error) {
        if (!values) throw new Error(KageDB.prefix("`values` is require."));
        if (!Array.isArray(values)) throw new Error(KageDB.prefix("`values` must be an array."));

        if (typeof keys === "function") {
            error = success;
            success = keys;
            keys = [];
        }
        if (!Array.isArray(keys)) {
            keys = [];
        }

        var requests = values.map(function (value, i) {
            var key = keys[i];
            var req = key == null ? this._objectStore.add(value) : this._objectStore.add(value, key);
            helper.attachInfo(req, this, "bulkAdd", { value: value, key: key, index: i });
            return req;
        }, this);

        var req = helper.bulk(requests, success, error);
        helper.attachInfo(req, this, "bulkAdd", {});
        return req;
    };

    KageObjectStore.prototype.bulkDelete = function bulkDelete(keys, success, error) {
        if (!keys) throw new Error(KageDB.prefix("`keys` is require."));
        if (!Array.isArray(keys)) throw new Error(KageDB.prefix("`keys` must be an array."));

        var requests = keys.map(function (key, i) {
            var range = helper.convertToRange(key);
            var req = this._objectStore["delete"](range);
            helper.attachInfo(req, this, "bulkDelete", { key: key, index: i });
            return req;
        }, this);

        var req = helper.bulk(requests, success, error);
        helper.attachInfo(req, this, "bulkDelete", {});
        return req;
    };

    function KageIndex(index, kageDB) {
        Object.defineProperties(this, {
            _index: {
                value: index
            },
            _kageDB: {
                value: kageDB
            },
            name: {
                get: function () { return index.name; },
                enumerable: true
            },
            objectStore: {
                get: function () { return new KageObjectStore(index.objectStore, kageDB); },
                enumerable: true
            },
            keyPath: {
                get: function () { return index.keyPath; },
                enumerable: true
            },
            multiEntry: {
                get: function () { return index.multiEntry; },
                enumerable: true
            }
        });
        helper.defineConstructorName(this);
    }

    KageIndex.prototype.openCursor = function openCursor(range, direction, success, error) {
        if (typeof range === "function" || typeof range === "string") {
            error = success;
            success = direction;
            direction = range;
            range = null;
        }
        if (typeof direction === "function") {
            error = success;
            success = direction;
            direction = null;
        }
        var self = this;
        var req = helper.invokeOpenCursor(range, direction, this._index.openCursor.bind( this._index));
        helper.attachInfo(req, this, "openCursor", { range: range, direction: direction });
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (success) success.call(this, cursor && new KageCursor(cursor, self._kageDB), event);
        };
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageIndex.prototype.openKeyCursor = function openKeyCursor(range, direction, success, error) {
        if (typeof range === "function" || typeof range === "string") {
            error = success;
            success = direction;
            direction = range;
            range = null;
        }
        if (typeof direction === "function") {
            error = success;
            success = direction;
            direction = null;
        }
        var self = this;
        var req = helper.invokeOpenCursor(range, direction, this._index.openKeyCursor.bind(this._index));
        helper.attachInfo(req, this, "openKeyCursor", { range: range, direction: direction });
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (success) success.call(this, cursor && new KageCursor(cursor, self._kageDB), event);
        };
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageIndex.prototype.fetch = function fetch(range, direction, success, error) {
        if (typeof range === "function" || typeof range === "string") {
            error = success;
            success = direction;
            direction = range;
            range = null;
        }
        if (typeof direction === "function") {
            error = success;
            success = direction;
            direction = null;
        }
        var results = [];
        var req = helper.invokeOpenCursor(range, direction, this._index.openCursor.bind(this._index));
        helper.attachInfo(req, this, "fetch", { range: range, direction: direction });
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
                results.push(cursor.value);
                cursor["continue"]();
            } else {
                if (success) success.call(this, results, event);
            }
        };
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageIndex.prototype.get = function get(key, success, error) {
        if (key == null) throw new Error(KageDB.prefix("`key` must not be nullable."));

        var range = helper.convertToRange(key);
        var req = this._index.get(range);
        helper.attachInfo(req, this, "get", { key: key });
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageIndex.prototype.getKey = function getKey(key, success, error) {
        if (key == null) throw new Error(KageDB.prefix("`key` must not be nullable."));

        key = helper.convertToRange(key);
        var req = this._index.getKey(key);
        helper.attachInfo(req, this, "getKey", null);
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageIndex.prototype.count = function count(key, success, error) {
        if (typeof key === "function") {
            error = success;
            success = key;
            key = null;
        }

        var range  = helper.convertToRange(key);
        var req = range == null ? this._index.count() : this._index.count(range);
        helper.attachInfo(req, this, "count", { key: key });
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
    };

    function KageCursor(cursor, kageDB) {
        Object.defineProperties(this, {
            _cursor: {
                value: cursor
            },
            _kageDB: {
                value: kageDB
            },
            source: {
                get: function () { return cursor.source; },
                enumerable: true
            },
            direction: {
                get: function () {
                    return convertDirection(cursor.direction);

                    function convertDirection(direction) {
                        if (typeof direction === "string") {
                            return direction;
                        }
                        switch (direction) {
                            case IDBCursor.NEXT: return "next";
                            case IDBCursor.NEXT_NO_DUPLICATE: return "nextunique";
                            case IDBCursor.PREV: return "prev";
                            case IDBCursor.PREV_NO_DUPLICATE: return "prevunique";
                            default: return direction;
                        }
                    }
                },
                enumerable: true
            },
            value: {
                get: function () { return cursor.value; },
                enumerable: true
            },
            key: {
                get: function () { return cursor.key; },
                enumerable: true
            },
            primaryKey: {
                get: function () { return cursor.primaryKey; },
                enumerable: true
            }
        });
        helper.defineConstructorName(this);
    }

    KageCursor.prototype.update = function update(value, success, error) {
        if (value == null) throw new Error(KageDB.prefix("`value` must not be nullable."));

        var req = this._cursor.update(value);
        helper.attachInfo(req, this, "update", { value: value });
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageCursor.prototype.advance = function advance(count) {
        if (this._cursor.advance) {
            this._cursor.advance(count);
        } else {
            throw new Error(KageDB.prefix("`IDBCursor.advance` is not supported in this browser."));
        }
    };

    KageCursor.prototype["continue"] = function _continue(key) {
        key == null ? this._cursor["continue"]() : this._cursor["continue"](key);
    };

    // alias of `continue`
    KageCursor.prototype.cont = KageCursor.prototype["continue"];

    KageCursor.prototype["delete"] = function (success, error) {
        var req = this._cursor["delete"]();
        helper.attachInfo(req, this, "delete", {});
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    // alias of `delete`
    KageCursor.prototype.del = KageCursor.prototype["delete"];

}(this));