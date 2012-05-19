(function (env) {

    "use strict";

    var indexedDB = env.indexedDB ||  env.msIndexedDB || env.webkitIndexedDB || env.mozIndexedDB;
    var IDBCursor = env.IDBCursor || env.webkitIDBCursor;
    var IDBTransaction = env.IDBTransaction || env.webkitIDBTransaction;
    var IDBKeyRange = env.IDBKeyRange || env.webkitIDBKeyRange;

    // export
    env.KageDB = KageDB;

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
        this.transactionMode = settings.transactionMode || "readwrite";
        this.onerror = settings.onerror || function (event) {
            console.error(event.kage_message);
        };
        this.onblocked = settings.onblocked || function (event) {
            console.log(event.kage_message);
        };
    }

    KageDB.version = "0.0.2";

    KageDB.prefix = function (message) {
        return "[KageDB] " + message;
    };

    KageDB.isAvailable = function () {
        return !!indexedDB
    };

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
        this._attachInfo(req, "KageDB", "tx", { storeNames: storeNames, mode: mode, operation: "open" });
        this._registerErrorHandler(req, error);

        req.onblocked = function (event) {
            var message = self.makeBlockedMessage(event);
            event.kage_message = KageDB.prefix("A blocking occurred. " + JSON.stringify(message, null, 2));
            if (self.onblocked) self.onblocked.call(this, event);
        };

        req.onupgradeneeded = function (event) {
            var db = self._wrapDatabase(event.target.result);
            self._registerErrorHandler(db, error);
            var tx = self._wrapTransaction(event.target.transaction);

            upgradeLock = true;
            self._migrate(db, tx, event.oldVersion, event.newVersion, function () {
                upgradeLock = false;
            });
        };

        req.onsuccess = function (event) {
            var openCtx = this;
            var db = self._wrapDatabase(event.target.result);
            self._registerErrorHandler(db, error);

            if (db._db.setVersion) {
                // Chrome
                var newVersion = self.version;
                var oldVersion = db.version;
                if (oldVersion < newVersion) {
                    // Chrome, if version changed
                    var req = db._db.setVersion(newVersion);
                    self._attachInfo(req, "KageDB", "tx",
                        { storeNames: storeNames, mode: mode, operation: "setVersion" });
                    self._registerErrorHandler(req, error);
                    req.onsuccess = function (event) {
                        var tx = self._wrapTransaction(event.target.transaction);
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
        var req = indexedDB.deleteDatabase(this.name);
        this._attachInfo(req, "KageDB", "deleteDatabase", {});
        this._registerSuccessHandler(req, success);
        this._registerErrorHandler(req, error);
        return req;
    };

    KageDB.prototype.makeErrorMessage = function makeErrorMessage(event) {
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
    };

    KageDB.prototype.makeBlockedMessage = function makeBlockedMessage(event) {
        event = event || {};
        var target = event.target || {};
        return {
            eventType: event.type,
            eventTarget: target.toString(),
            className: target.kage_className,
            methodName: target.kage_methodName,
            additionalInfo: target.kage_additinalInfo
        };
    };

    KageDB.prototype._migrate = function _migrate(db, tx, oldVersion, newVersion, complete) {
        var executor = selectExecutor(this.migration || {}, oldVersion, newVersion);
        var ctx = { db: db, transaction: tx, oldVersion: oldVersion, newVersion: newVersion };
        var migrate = executor.reduceRight(function (next, curr) {
            return function () {
                curr.call(null, ctx, next);
            }
        }, complete);
        migrate();

        function selectExecutor(migration, oldVersion, newVersion) {
            var keys = Object.keys(migration).sort();
            var results = [];
            for (var i = 0, len = keys.length; i < len; i++) {
                var key = keys[i];
                if (key > oldVersion && key <= newVersion) {
                    var value =  migration[key];
                    if (typeof value === "function") {
                        results.push(value);
                    }
                }
                if (key > newVersion) {
                    break;
                }
            }
            return results;
        }
    };

    KageDB.prototype._wrapDatabase = function _wrapDatabase(db){
        var self = this;
        return Object.create({}, {
            _db: {
                value: db
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
            },
            createObjectStore: {
                value: function (name, optionalParameters) {
                    if (!name) throw new Error(KageDB.prefix("`name` is require."));

                    var objectStore = db.createObjectStore(name, optionalParameters);
                    return self._wrapObjectStore(objectStore);
                },
                enumerable: true
            },
            deleteObjectStore: {
                value: function (name) {
                    if (!name) throw new Error(KageDB.prefix("`name` is require."));

                    db.deleteObjectStore(name);
                },
                enumerable: true
            },
            transaction: {
                value: function (storeNames, mode) {
                    if (!storeNames) throw new Error(KageDB.prefix("`storeNames` is require."));
                    if (!Array.isArray(storeNames)) throw new Error(KageDB.prefix("`storeNames` must be an array."));

                    mode = convertMode(mode || self.transactionMode);
                    var transaction = db.transaction(storeNames, mode);
                    return self._wrapTransaction(transaction);

                    function convertMode(mode) {
                        var constantDefined = typeof IDBTransaction.READ_ONLY !== "undefined";
                        switch (mode) {
                            case "readonly":
                                return constantDefined ? IDBTransaction.READ_ONLY : mode;
                            case "readwrite":
                                return constantDefined ? IDBTransaction.READ_WRITE : mode;
                            case "versionchange":
                                return constantDefined ? IDBTransaction.VERSION_CHANGE : mode;
                            default:
                                throw new Error("unknown mode: " + mode);
                        }
                    }
                },
                enumerable: true
            },
            close: {
                value: function () {
                    return db.close();
                },
                enumerable: true
            },
            join: {
                value: function (requests, success, error) {
                    if (!requests) throw new Error(KageDB.prefix("`requests` is require."));
                    if (!Array.isArray(requests)) throw new Error(KageDB.prefix("`requests` must be an array."));

                    var req = self._bulk(requests.length, execute, success, error);
                    self._attachInfo(req, "Database", "join", {});
                    return req;

                    function execute(i) {
                        var req = requests[i];
                        self._attachInfo(req, "Database", "join", { index: i });
                        return req;
                    }
                }
            }
        });
    };

    KageDB.prototype._wrapTransaction = function _wrapTransaction(transaction) {
        var self = this;
        return Object.create({}, {
            _transaction: {
                value: transaction
            },
            mode: {
                get: function () {
                    return convertMode(transaction.mode);

                    function convertMode(mode) {
                        if (typeof mode === "string") {
                            return mode;
                        }
                        switch (mode) {
                            case IDBTransaction.READ_ONLY:
                                return "readonly";
                            case IDBTransaction.READ_WRITE:
                                return "readwrite";
                            case IDBTransaction.VERSION_CHANGE:
                                return "versionchange";
                            default:
                                return mode;
                        }
                    }
                },
                enumerable: true
            },
            db: {
                get: function () {
                    var db = transaction.db;
                    return self._wrapDatabase(db);
                },
                enumerable: true
            },
            error: {
                get: function () { return transaction.error; },
                enumerable: true
            },
            onabort: {
                get: function () { return transaction.onabort;},
                set: function (value) { transaction.onabort = value; },
                enumerable: true
            },
            onerror: {
                get: function () { return transaction.onerror;},
                set: function (value) { transaction.onerror = value; },
                enumerable: true
            },
            oncomplete: {
                get: function () { return transaction.oncomplete;},
                set: function (value) { transaction.oncomplete = value; },
                enumerable: true
            },
            objectStore: {
                value: function (name) {
                    if (!name) throw new Error(KageDB.prefix("`name` is require."));

                    var objectStore = transaction.objectStore(name);
                    return self._wrapObjectStore(objectStore);
                },
                enumerable: true
            },
            abort: {
                value:  function () {
                    transaction.abort();
                },
                enumerable: true
            },
            join: {
                value: function (requests, success, error) {
                    if (!requests) throw new Error(KageDB.prefix("`requests` is require."));
                    if (!Array.isArray(requests)) throw new Error(KageDB.prefix("`requests` must be an array."));

                    var req = self._bulk(requests.length, execute, success, error);
                    self._attachInfo(req, "Transaction", "join", {});
                    return req;

                    function execute(i) {
                        var req = requests[i];
                        self._attachInfo(req, "Transaction", "join", { index: i });
                        return req;
                    }
                }
            }
        });
    };

    KageDB.prototype._wrapObjectStore = function _wrapObjectStore(objectStore){
        var self = this;
        return Object.create({}, {
            _objectStore: {
                value: objectStore
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
                get: function () { return self._wrapTransaction(objectStore.transaction); },
                enumerable: true
            },
            autoIncrement: {
                get: function () { return objectStore.autoIncrement; },
                enumerable: true
            },
            put: {
                value: function (value, key, success, error) {
                    if (value == null) throw new Error(KageDB.prefix("`value` must not be nullable."));

                    if (typeof key === "function") {
                        error = success;
                        success = key;
                        key = null;
                    }
                    var req = key == null ?  objectStore.put(value) : objectStore.put(value, key);
                    self._attachInfo(req, "ObjectStore", "put", { value: value, key: key });
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            add: {
                value: function (value, key, success, error) {
                    if (value == null) throw new Error(KageDB.prefix("`value` must not be nullable."));

                    if (typeof key === "function") {
                        error = success;
                        success = key;
                        key = null;
                    }
                    var req = key == null ? objectStore.add(value): objectStore.add(value, key);
                    self._attachInfo(req, "ObjectStore", "add", { value: value, key: key });
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            "delete": {
                value: function (key, success, error) {
                    if (key == null) throw new Error(KageDB.prefix("`key` must not be nullable."));

                    var range = self._convertToRange(key);
                    var req = objectStore["delete"](range);
                    self._attachInfo(req, "ObjectStore", "delete", { key: key });
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            // alias of `delete`
            remove: {
                value: function () {
                    this["delete"].apply(this, arguments);
                },
                enumerable: true
            },
            get: {
                value: function (key, success, error) {
                    if (key == null) throw new Error(KageDB.prefix("`key` must not be nullable."));

                    var range = self._convertToRange(key);
                    var req = objectStore.get(range);
                    self._attachInfo(req, "IDBObjectStore", "get", { key: key });
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            clear: {
                value: function (success, error) {
                    var req = objectStore.clear();
                    self._attachInfo(req, "IDBObjectStore", "clear", {});
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            openCursor: {
                value: function (range, direction, success, error) {
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
                    var req = self._invokeOpenCursor(range, direction, objectStore.openCursor.bind(objectStore));
                    self._attachInfo(req, "ObjectStore", "openCursor", { range: range, direction: direction});
                    req.onsuccess = function (event) {
                        var cursor = event.target.result;
                        if (success) success.call(this, cursor && self._wrapCursor(cursor), event);
                    };
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            fetch: {
                value: function (range, direction, success, error) {
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
                    var req = self._invokeOpenCursor(range, direction, objectStore.openCursor.bind(objectStore));
                    self._attachInfo(req, "ObjectStore", "fetch", { range: range, direction: direction });
                    req.onsuccess = function (event) {
                        var cursor = event.target.result;
                        if (cursor) {
                            results.push(cursor.value);
                            cursor["continue"]();
                        } else {
                            if (success) success.call(this, results, event);
                        }
                    };
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            createIndex: {
                value: function (name, keyPath, optionalParameters) {
                    if (name == null) throw new Error(KageDB.prefix("`name` must not be nullable."));
                    if (keyPath == null) throw new Error(KageDB.prefix("`keyPath` must not be nullable."));

                    var index = objectStore.createIndex(name, keyPath, optionalParameters);
                    return self._wrapIndex(index);
                },
                enumerable: true
            },
            index: {
                value: function (name) {
                    if (name == null) throw new Error(KageDB.prefix("`name` must not be nullable."));

                    var index = objectStore.index(name);
                    return self._wrapIndex(index);
                },
                enumerable: true
            },
            deleteIndex: {
                value: function (name) {
                    if (name == null) throw new Error(KageDB.prefix("`name` must not be nullable."));
                    objectStore.deleteIndex(name);
                },
                enumerable: true
            },
            count: {
                value: function (key, success, error) {
                    if (typeof key === "function") {
                        error = success;
                        success = key;
                        key = null;
                    }

                    var range  = self._convertToRange(key);
                    var req = range == null ? objectStore.count() : objectStore.count(range);
                    self._attachInfo(req, "ObjectStore", "count", { key: key });
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                },
                enumerable: true
            },
            bulkPut: {
                value: function (values, keys, success, error) {
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
                    var req = self._bulk(values.length, execute, success, error);
                    self._attachInfo(req, "ObjectStore", "bulkPut", {});
                    return req;

                    function execute(i) {
                        var value = values[i];
                        var key = keys[i];
                        var req = key == null ? objectStore.put(value) : objectStore.put(value, key);
                        self._attachInfo(req, "ObjectStore", "bulkPut", { value: value, key: key, index: i });
                        return req;
                    }
                },
                enumerable: true
            },
            bulkAdd: {
                value: function (values, keys, success, error) {
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
                    var req = self._bulk(values.length, execute, success, error);
                    self._attachInfo(req, "ObjectStore", "bulkAdd", {});
                    return req;

                    function execute(i) {
                        var value = values[i];
                        var key = keys[i];
                        var req = key == null ? objectStore.add(value) : objectStore.add(value, key);
                        self._attachInfo(req, "ObjectStore", "bulkAdd", { value: value, key: key, index: i });
                        return req;
                    }
                },
                enumerable: true
            },
            bulkDelete: {
                value: function (keys, success, error) {
                    if (!keys) throw new Error(KageDB.prefix("`keys` is require."));
                    if (!Array.isArray(keys)) throw new Error(KageDB.prefix("`keys` must be an array."));

                    var req = self._bulk(keys.length, execute, success, error);
                    self._attachInfo(req, "ObjectStore", "bulkDelete", {});
                    return req;

                    function execute(i) {
                        var key = keys[i];
                        var range = self._convertToRange(key);
                        var req = objectStore["delete"](range);
                        self._attachInfo(req, "ObjectStore", "bulkDelete", { key: key, index: i });
                        return req;
                    }
                },
                enumerable: true
            },
            // alias of `bulkDelete`
            bulkRemove: {
                value: function () {
                    this.bulkDelete.apply(this, arguments);
                },
                enumerable: true
            }
        });
    };

    KageDB.prototype._wrapIndex = function _wrapIndex(index) {
        var self = this;
        return Object.create({}, {
            _index: {
                value: index
            },
            name: {
                get: function () { return index.name; },
                enumerable: true
            },
            objectStore: {
                get: function () { return self._wrapObjectStore(index.objectStore); },
                enumerable: true
            },
            keyPath: {
                get: function () { return index.keyPath; },
                enumerable: true
            },
            multiEntry: {
                get: function () { return index.multiEntry; },
                enumerable: true
            },
            openCursor: {
                value: function (range, direction, success, error) {
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
                    var req = self._invokeOpenCursor(range, direction, index.openCursor.bind(index));
                    self._attachInfo(req, "Index", "openCursor", { range: range, direction: direction });
                    req.onsuccess = function (event) {
                        var cursor = event.target.result;
                        if (success) success.call(this, cursor && self._wrapCursor(cursor), event);
                    };
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            openKeyCursor: {
                value: function (range, direction, success, error) {
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
                    var req = self._invokeOpenCursor(range, direction, index.openKeyCursor.bind(index));
                    self._attachInfo(req, "Index", "openKeyCursor", { range: range, direction: direction });
                    req.onsuccess = function (event) {
                        var cursor = event.target.result;
                        if (success) success.call(this, cursor && self._wrapCursor(cursor), event);
                    };
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            fetch: {
                value: function (range, direction, success, error) {
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
                    var req = self._invokeOpenCursor(range, direction, index.openCursor.bind(index));
                    self._attachInfo(req, "Index", "fetch", { range: range, direction: direction });
                    req.onsuccess = function (event) {
                        var cursor = event.target.result;
                        if (cursor) {
                            results.push(cursor.value);
                            cursor["continue"]();
                        } else {
                            if (success) success.call(this, results, event);
                        }
                    };
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            get: {
                value: function (key, success, error) {
                    if (key == null) throw new Error(KageDB.prefix("`key` must not be nullable."));

                    var range = self._convertToRange(key);
                    var req = index.get(range);
                    self._attachInfo(req, "Index", "get", { key: key });
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            getKey: {
                value: function (key, success, error) {
                    if (key == null) throw new Error(KageDB.prefix("`key` must not be nullable."));

                    key = self._convertToRange(key);
                    var req = index.getKey(key);
                    self._attachInfo(req, "Index", "getKey", null);
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            count: {
                value: function (key, success, error) {
                    if (typeof key === "function") {
                        error = success;
                        success = key;
                        key = null;
                    }

                    var range  = self._convertToRange(key);
                    var req = range == null ? index.count() : index.count(range);
                    self._attachInfo(req, "Index", "count", { key: key });
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                },
                enumerable: true
            }
        });
    };

    KageDB.prototype._wrapCursor = function _wrapCursor(cursor) {
        var self = this;
        return Object.create({}, {
            _cursor: {
                value: cursor
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
                            case IDBCursor.NEXT:
                                return "next";
                            case IDBCursor.NEXT_NO_DUPLICATE:
                                return "nextunique";
                            case IDBCursor.PREV:
                                return "prev";
                            case IDBCursor.PREV_NO_DUPLICATE:
                                return "prevunique";
                            default:
                                return direction;
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
            },
            update: {
                value: function (value, success, error) {
                    if (value == null) throw new Error(KageDB.prefix("`value` must not be nullable."));

                    var req = cursor.update(value);
                    self._attachInfo(req, "Cursor", "update", { value: value });
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            advance: {
                value: function (count) {
                    if (cursor.advance) {
                        cursor.advance(count);
                    } else {
                        throw new Error(KageDB.prefix("`IDBCursor.advance` is not supported in this browser."));
                    }
                },
                enumerable: true
            },
            "continue": {
                value: function (key) {
                    key == null ? cursor["continue"]() : cursor["continue"](key);
                },
                enumerable: true
            },
            // alias of `continue`
            next: {
                value: function () {
                    this["continue"].apply(this, arguments);
                },
                enumerable: true
            },
            "delete": {
                value: function (success, error) {
                    var req = cursor["delete"]();
                    self._attachInfo(req, "Cursor", "delete", {});
                    self._registerSuccessHandler(req, success);
                    self._registerErrorHandler(req, error);
                    return req;
                },
                enumerable: true
            },
            // alias of `delete`
            remove: {
                value: function () {
                    this["delete"].apply(this, arguments);
                },
                enumerable: true
            }
        });
    };

    KageDB.prototype._registerSuccessHandler = function _registerSuccessHandler(target, success){
        target.onsuccess = function (event) {
            if (success) success.call(this, event.target.result, event);
        };
    };

    KageDB.prototype._registerErrorHandler = function _registerErrorHandler(target, error){
        var self = this;
        target.onerror = function (event) {
            var message = self.makeErrorMessage(event);
            event.kage_message = KageDB.prefix("An error occurred. " + JSON.stringify(message, null, 2));
            if (error) error.call(this, event);
        };
    };

    KageDB.prototype._invokeOpenCursor = function _invokeOpenCursor(range, direction, openCursor) {
        range = this._convertToRange(range);
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
            var constantDefined = typeof IDBCursor.NEXT !== "undefined";
            switch (direction) {
                case "next":
                    return constantDefined ? IDBCursor.NEXT : direction;
                case "nextunique":
                    return constantDefined ? IDBCursor.NEXT_NO_DUPLICATE : direction;
                case "prev":
                    return constantDefined ? IDBCursor.PREV : direction;
                case "prevunique":
                    return constantDefined ? IDBCursor.PREV_NO_DUPLICATE : direction;
                default:
                    return null;
            }
        }
    };

    KageDB.prototype._convertToRange = function (range) {
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
    };

    KageDB.prototype._bulk = function _bulk(len, execute, success, error) {
        var pending = len;
        var results = new Array(len);
        for (var i = 0; i < len && pending > 0; i++) {
            (function (i) {
                var req = execute(i);
                if (req) {
                    req.onsuccess = function (event) {
                        pending--;
                        results[i] = (event && event.target) ? event.target.result : event;
                        if (pending === 0 && success) success.call(this, results, event);
                    };
                    req.onerror = function(event) {
                        pending = 0;
                        if (error) error.call(this, event);
                    }
                } else {
                    pending--;
                }
            }(i));
        }
        return Object.create({}, {
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
    };

    KageDB.prototype._attachInfo = function _attachInfo(target, className, methodName, additionalInfo) {
        if (target) {
            target.kage_className = className;
            target.kage_methodName = methodName;
            target.kage_additinalInfo = additionalInfo;
        }
    };

}(this));