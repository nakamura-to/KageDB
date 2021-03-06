﻿(function (env) {

    "use strict";

    // export
    env.KageDB = KageDB;

    var indexedDB = env.indexedDB ||  env.msIndexedDB || env.webkitIndexedDB || env.mozIndexedDB;
    var IDBKeyRange = env.IDBKeyRange || env.webkitIDBKeyRange;

    var helper = {
        registerSuccessHandler: function registerSuccessHandler(target, success){
            target.onsuccess = function (event) {
                if (success) success.call(this, event.target.result);
            };
        },

        registerErrorHandler: function registerErrorHandler(target, error){
            target.onerror = function (event) {
                var message = helper.makeErrorMessage(event);
                event.kage_message = KageDB.prefix("An error occurred. " + JSON.stringify(message, null, 2));
                if (error) error.call(this, event);
            };
        },

        invokeOpenCursor: function invokeOpenCursor(criteria, openCursor) {
            var range = this.convertToRange(criteria);
            var direction = convertToDirection(criteria);

            if (range && direction) return openCursor(range, direction);
            if (range) return openCursor(range);
            if (direction) return openCursor(null, direction);
            return openCursor();

            function convertToDirection(criteria) {
                var direction = criteria && criteria.direction;
                switch (direction) {
                    case "next":
                    case "nextunique":
                    case "prev": 
                    case "prevunique": 
                        return direction;
                    default: 
                        return null;
                }
            }
        },

        convertToRange: function (criteria) {
            if (typeof criteria !== "object" || criteria === null)  return criteria;

            var lower = null;
            var lowerOpen = false;
            var upper = null;
            var upperOpen = false;
            var keys = Object.keys(criteria);
            var len = keys.length;

            for (var i = 0; i < len; i++) {
                var key = keys[i];
                var value = criteria[key];
                switch (key) {
                    case "eq": return IDBKeyRange.only(value);
                    case "ge": lower = value; break;
                    case "gt": lower = value; lowerOpen = true; break;
                    case "le": upper = value; break;
                    case "lt": upper = value;  upperOpen = true; break;
                    default: /* ignore */ break;
                }
            }

            if (lower && upper) return IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen);
            if (lower) return IDBKeyRange.lowerBound(lower, lowerOpen);
            if (upper) return IDBKeyRange.upperBound(upper, upperOpen);
            return null;
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

            function isRequest(req) {
                return req
                    && (typeof req.onsuccess !== "undefined" || req.propertyIsEnumerable("onsuccess"))
                    && (typeof req.onerror !== "undefined" || req.propertyIsEnumerable("onerror"));
            }

            for (var i = 0; i < len && pending > 0; i++) {
                (function (key) {
                    var req = requests[key];
                    if (isRequest(req)) {
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

        fetch: function fetch(instance, source, criteria, success, error) {
            var keyOnly = criteria && criteria.keyOnly;
            var openCursor = keyOnly && source.openKeyCursor
                ? source.openKeyCursor.bind(source)
                : source.openCursor.bind(source);
            var req = helper.invokeOpenCursor(criteria, openCursor);
            helper.attachInfo(req, instance, "fetch", {criteria: criteria});

            var filter;
            if (criteria && typeof criteria.filter === "function") {
                filter = criteria.filter;
            }

            var reduce;
            if (criteria && typeof criteria.reduce === "function") {
                var original_reduce = criteria.reduce;
                var prev = criteria.initialValue;
                var called;
                if (typeof prev !== "undefined") {
                    reduce = function (curr, index) {
                        prev = original_reduce(prev, curr, index);
                        return prev;
                    };
                } else {
                    reduce = function (curr, index) {
                        prev = called ? original_reduce(prev, curr, index) : curr;
                        called = true;
                        return prev;
                    };
                }
            }

            var offset;
            if (criteria && typeof criteria.offset === "number") {
                offset = criteria.offset;
            }

            var limit;
            if (criteria && typeof criteria.limit === "number") {
                limit = criteria.limit;
            }

            var result = [];
            var i = 0;
            var count = 0;
            req.onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (!offset || i >= offset) {
                        var value = keyOnly ? cursor.key : cursor.value;
                        if (!filter || filter(value, i)) {
                            if (reduce) {
                                result = reduce(value, count);
                            } else {
                                result.push(value);
                            }
                            count++;
                        }
                    }
                    if (!limit || count < limit) {
                        i++;
                        cursor["continue"]();
                    } else {
                        if (success) success.call(this, result);
                    }
                } else {
                    if (success) success.call(this, result);
                }
            };
            req.onerror = function (event) {
                var message = helper.makeErrorMessage(event);
                event.kage_message = KageDB.prefix("An error occurred. " + JSON.stringify(message, null, 2));
                if (error) error.call(this, event);
            };

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
                errorDetail: (target.error && target.error.name)
                    || target.webkitErrorMessage
                    || KageDB.errorMessages[target.errorCode]
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
            throw new Error(KageDB.prefix("`settings.name` is required."));
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
        this.txMode = settings.txMode || "readonly";
        this.debug = typeof settings.debug === "function" && settings.debug || function () {};
        this.onerror = typeof settings.onerror === "function" && settings.onerror || function (event) {
            throw new Error(event.kage_message);
        };
        this.onblocked = typeof settings.onblocked === "function" && settings.onblocked || function () {};
    }

    KageDB.version = "0.0.9";

    KageDB.indexedDB = indexedDB;

    KageDB.KageDatabase = KageDatabase;

    KageDB.KageTransaction = KageTransaction;

    KageDB.KageObjectStore = KageObjectStore;

    KageDB.KageIndex = KageIndex;

    KageDB.KageCursor = KageCursor;

    if (!KageDB.prototype.constructor.name) {
        KageDB.prototype.constructor.name = "KageDB";
    }

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

    KageDB.prototype.all = function all(success, error) {
        return this.tx([], "readonly", function (tx) {
            var requests = {};
            var stores = Array.prototype.slice.call(arguments, 1);
            stores.forEach(function (store) {
                requests[store.name] = store.fetch();
            });
            tx.join(requests, function (results) {
                if (success) success.call(this, results);
            });
        }, error);
    };

    KageDB.prototype.tx = function tx(storeNames, mode, success, error) {
        if (!storeNames) throw new Error(KageDB.prefix("`storeNames` is required."));
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
        helper.attachInfo(req, this, "tx", {storeNames: storeNames, mode: mode, operation: "open"});
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
                        {storeNames: storeNames, mode: mode, operation: "setVersion"});
                    helper.registerErrorHandler(req, error);
                    req.onsuccess = function (event) {
                        self._debug("`IDBDatabase.setVersion` is succeeded.");
                        var tx = new KageTransaction(event.target.transaction, self);
                        if (self.migration) {
                            self._migrate(db, tx, oldVersion, newVersion, function () {
                                tx.oncomplete = function () {
                                    do_onsuccess.call(openCtx);
                                };
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
                var names = storeNames.length === 0
                    ? Array.prototype.slice.call(db.objectStoreNames)
                    : storeNames;
                var tx = db.transaction(names, mode);
                var args = [tx];
                names.forEach(function (name) {
                    var store = tx.objectStore(name);
                    args.push(store);
                });
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
            if (success) success.call(this, event.target.result);
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
            _db: { value: db },
            _kageDB: { value: kageDB }
        });
    }

    KageDatabase.prototype = Object.create(Object.prototype, {
        name: {
            get: function () { return this._db.name; },
            enumerable: true
        },
        version: {
            get: function () {
                var version = parseInt(this._db.version || 0, 10);
                return isNaN(version) ? this._db.version : version;
            },
            enumerable: true
        },
        objectStoreNames: {
            get: function () { return this._db.objectStoreNames; },
            enumerable: true
        },
        onabort: {
            get: function () { return this._db.onabort;},
            set: function (value) { this._db.onabort = value; },
            enumerable: true
        },
        onerror: {
            get: function () { return this._db.onerror;},
            set: function (value) { this._db.onerror = value; },
            enumerable: true
        },
        onversionchange: {
            get: function () { return this._db.onversionchange;},
            set: function (value) { this._db.onversionchange = value; },
            enumerable: true
        }
    });

    if (!KageDatabase.prototype.constructor.name) {
        KageDatabase.prototype.constructor.name = "KageDatabase";
    }

    KageDatabase.prototype.createObjectStore = function createObjectStore(name, optionalParameters) {
        if (!name) throw new Error(KageDB.prefix("`name` is required."));

        var objectStore = this._db.createObjectStore(name, optionalParameters);
        return new KageObjectStore(objectStore, this._kageDB);
    };

    KageDatabase.prototype.deleteObjectStore = function deleteObjectStore(name) {
        if (!name) throw new Error(KageDB.prefix("`name` is required."));

        this._db.deleteObjectStore(name);
    };

    KageDatabase.prototype.transaction = function transaction(storeNames, mode) {
        if (!storeNames) throw new Error(KageDB.prefix("`storeNames` is required."));
        if (!Array.isArray(storeNames)) throw new Error(KageDB.prefix("`storeNames` must be an array."));

        mode = mode || this._kageDB.txMode;
        var transaction = this._db.transaction(storeNames, convertMode(mode));
        this._kageDB._debug("begin transaction. storeNames = " + storeNames + ", mode = '" + mode + "'");
        return new KageTransaction(transaction, this._kageDB);

        function convertMode(mode) {
            switch (mode) {
                case "r":
                case "readonly": 
                    return "readonly";
                case "rw":
                case "readwrite": 
                    return "readwrite";
                case "versionchange": 
                    return "versionchange";
                default: 
                    throw new Error("unknown mode: " + mode);
            }
        }
    };

    KageDatabase.prototype.close = function close() {
        return this._db.close();
    };

    function KageTransaction(tx, kageDB) {
        Object.defineProperties(this, {
            _tx: { value: tx },
            _kageDB: { value: kageDB }
        });
    }

    KageTransaction.prototype = Object.create(Object.prototype, {
        mode: {
            get: function () {
                return this._tx.mode;
            },
            enumerable: true
        },
        db: {
            get: function () { return new KageDatabase(this._tx.db, this._kageDB); },
            enumerable: true
        },
        error: {
            get: function () { return this._tx.error; },
            enumerable: true
        },
        onabort: {
            get: function () { return this._tx.onabort;},
            set: function (value) { this._tx.onabort = value; },
            enumerable: true
        },
        onerror: {
            get: function () { return this._tx.onerror;},
            set: function (value) { this._tx.onerror = value; },
            enumerable: true
        },
        oncomplete: {
            get: function () { return this._tx.oncomplete;},
            set: function (value) { this._tx.oncomplete = value; },
            enumerable: true
        }
    });

    if (!KageTransaction.prototype.constructor.name) {
        KageTransaction.prototype.constructor.name = "KageTransaction";
    }

    KageTransaction.prototype.objectStore =function objectStore(name) {
        if (!name) throw new Error(KageDB.prefix("`name` is required."));

        var objectStore = this._tx.objectStore(name);
        return new KageObjectStore(objectStore, this._kageDB);
    };

    KageTransaction.prototype.abort = function abort() {
        this._tx.abort();
    };

    KageTransaction.prototype.join = function join(requests, success, error) {
        if (!requests) throw new Error(KageDB.prefix("`requests` is required."));
        if (!Array.isArray(requests) && typeof requests !== "object") {
            throw new Error(KageDB.prefix("`requests` must be an array or an object."));
        }

        Object.keys(requests).forEach(function (key) {
            helper.attachInfo(requests[key], this, "join", {key: key});
        }, this);

        var req = helper.bulk(requests, success, error);
        helper.attachInfo(req, this, "join", {});
        return req;
    };

    function KageObjectStore(objectStore, kageDB) {
        Object.defineProperties(this, {
            _objectStore: { value: objectStore },
            _kageDB: { value: kageDB }
        });
    }

    KageObjectStore.prototype = Object.create(Object.prototype, {
        name: {
            get: function() { return this._objectStore.name; },
            enumerable: true
        },
        keyPath: {
            get: function () { return this._objectStore.keyPath; },
            enumerable: true
        },
        indexNames: {
            get: function () { return this._objectStore.indexNames; },
            enumerable: true
        },
        transaction: {
            get: function () { return new KageTransaction(this._objectStore.transaction, this._kageDB); },
            enumerable: true
        },
        autoIncrement: {
            get: function () { return this._objectStore.autoIncrement; },
            enumerable: true
        }
    });

    if (!KageObjectStore.prototype.constructor.name) {
        KageObjectStore.prototype.constructor.name = "KageObjectStore";
    }

    KageObjectStore.prototype.put = function put(value, key, success, error) {
        if (value == null) throw new Error(KageDB.prefix("`value` must not be nullable."));

        if (typeof key === "function") {
            error = success;
            success = key;
            key = null;
        }
        var req = key == null ? this._objectStore.put(value) :  this._objectStore.put(value, key);
        helper.attachInfo(req, this, "put", {value: value, key: key});
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
        helper.attachInfo(req, this, "add", {value: value, key: key});
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageObjectStore.prototype["delete"] = function _delete(key, success, error) {
        if (key == null) throw new Error(KageDB.prefix("`key` must not be nullable."));

        var range = helper.convertToRange(key);
        var req =  this._objectStore["delete"](range);
        helper.attachInfo(req, this, "delete", {key: key});
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
        helper.attachInfo(req, this, "get", {key: key});
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

    KageObjectStore.prototype.openCursor = function openCursor(criteria, success, error) {
        if (typeof criteria === "function") {
            error = success;
            success = criteria;
            criteria = null;
        }
        var self = this;
        var openCursor = this._objectStore.openCursor.bind(this._objectStore);
        var req = helper.invokeOpenCursor(criteria, openCursor);
        helper.attachInfo(req, this, "openCursor", {criteria: criteria});
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (success) success.call(this, cursor && new KageCursor(cursor, self._kageDB));
        };
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageObjectStore.prototype.fetch = function fetch(criteria, success, error) {
        if (typeof criteria === "function") {
            error = success;
            success = criteria;
            criteria = null;
        }
        return helper.fetch(this, this._objectStore, criteria, success, error);
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
        helper.attachInfo(req, this, "count", {key: key});
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageObjectStore.prototype.bulkPut = function bulkPut(values, keys, success, error) {
        if (!values) throw new Error(KageDB.prefix("`values` is required."));
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
            helper.attachInfo(req, this, "bulkPut", {value: value, key: key, index: i});
            return req;
        }, this);

        var req = helper.bulk(requests, success, error);
        helper.attachInfo(req, this, "bulkPut", {});
        return req;
    };

    KageObjectStore.prototype.bulkAdd = function bulkAdd(values, keys, success, error) {
        if (!values) throw new Error(KageDB.prefix("`values` is required."));
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
            helper.attachInfo(req, this, "bulkAdd", {value: value, key: key, index: i});
            return req;
        }, this);

        var req = helper.bulk(requests, success, error);
        helper.attachInfo(req, this, "bulkAdd", {});
        return req;
    };

    KageObjectStore.prototype.bulkDelete = function bulkDelete(keys, success, error) {
        if (!keys) throw new Error(KageDB.prefix("`keys` is required."));
        if (!Array.isArray(keys)) throw new Error(KageDB.prefix("`keys` must be an array."));

        var requests = keys.map(function (key, i) {
            var range = helper.convertToRange(key);
            var req = this._objectStore["delete"](range);
            helper.attachInfo(req, this, "bulkDelete", {key: key, index: i});
            return req;
        }, this);

        var req = helper.bulk(requests, success, error);
        helper.attachInfo(req, this, "bulkDelete", {});
        return req;
    };

    function KageIndex(index, kageDB) {
        Object.defineProperties(this, {
            _index: { value: index },
            _kageDB: { value: kageDB }
        });
    }

    KageIndex.prototype = Object.create(Object.prototype, {
        name: {
            get: function () { return this._index.name; },
            enumerable: true
        },
        objectStore: {
            get: function () { return new KageObjectStore(this._index.objectStore, this._kageDB); },
            enumerable: true
        },
        keyPath: {
            get: function () { return this._index.keyPath; },
            enumerable: true
        },
        multiEntry: {
            get: function () { return this._index.multiEntry; },
            enumerable: true
        }
    });

    if (!KageIndex.prototype.constructor.name) {
        KageIndex.prototype.constructor.name = "KageIndex";
    }

    KageIndex.prototype.openCursor = function openCursor(criteria, success, error) {
        if (typeof criteria === "function") {
            error = success;
            success = criteria;
            criteria = null;
        }
        var self = this;
        var req = helper.invokeOpenCursor(criteria, this._index.openCursor.bind( this._index));
        helper.attachInfo(req, this, "openCursor", {criteria: criteria});
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (success) success.call(this, cursor && new KageCursor(cursor, self._kageDB));
        };
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageIndex.prototype.openKeyCursor = function openKeyCursor(criteria, success, error) {
        if (typeof criteria === "function") {
            error = success;
            success = criteria;
            criteria = null;
        }
        var self = this;
        var req = helper.invokeOpenCursor(criteria, this._index.openKeyCursor.bind(this._index));
        helper.attachInfo(req, this, "openKeyCursor", {criteria: criteria});
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (success) success.call(this, cursor && new KageCursor(cursor, self._kageDB));
        };
        helper.registerErrorHandler(req, error);
        return req;
    };

    KageIndex.prototype.fetch = function fetch(criteria, success, error) {
        if (typeof criteria === "function") {
            error = success;
            success = criteria;
            criteria = null;
        }
        return helper.fetch(this, this._index, criteria, success, error);
    };

    KageIndex.prototype.get = function get(key, success, error) {
        if (key == null) throw new Error(KageDB.prefix("`key` must not be nullable."));

        var range = helper.convertToRange(key);
        var req = this._index.get(range);
        helper.attachInfo(req, this, "get", {key: key});
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
        helper.attachInfo(req, this, "count", {key: key});
        helper.registerSuccessHandler(req, success);
        helper.registerErrorHandler(req, error);
        return req;
    };

    function KageCursor(cursor, kageDB) {
        Object.defineProperties(this, {
            _cursor: { value: cursor },
            _kageDB: { value: kageDB }
        });
    }

    KageCursor.prototype = Object.create(Object.prototype, {
        source: {
            get: function () { return this._cursor.source; },
            enumerable: true
        },
        direction: {
            get: function () {
                return this._cursor.direction;
            },
            enumerable: true
        },
        value: {
            get: function () { return this._cursor.value; },
            enumerable: true
        },
        key: {
            get: function () { return this._cursor.key; },
            enumerable: true
        },
        primaryKey: {
            get: function () { return this._cursor.primaryKey; },
            enumerable: true
        }
    });

    if (!KageCursor.prototype.constructor.name) {
        KageCursor.prototype.constructor.name = "KageCursor";
    }

    KageCursor.prototype.update = function update(value, success, error) {
        if (value == null) throw new Error(KageDB.prefix("`value` must not be nullable."));

        var req = this._cursor.update(value);
        helper.attachInfo(req, this, "update", {value: value});
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