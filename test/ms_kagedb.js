module("ms_kagedb", {
    setup: function () {
        function open() {
            var req = kageDB.open("MyDB", 2);
            req.onsuccess = function () {
                start();
            };
        }
        stop();
        var kageDB = new KageDB();
        var req = kageDB.deleteDatabase("MyDB");
        req.onsuccess = req.onerror = open;
    }
});

asyncTest("deleteDatabase", function () {
    var kageDB = new KageDB();
    var req = kageDB.deleteDatabase("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        strictEqual(db, undefined);
        ok(event);
        start();
    };
});

asyncTest("deleteDatabase_pure", function () {
    var req = indexedDB.deleteDatabase("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        strictEqual(db, undefined);
        ok(event);
        start();
    };
});

asyncTest("open", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        ok(db);
        strictEqual(db.version, 2);
        start();
    };
});

asyncTest("open_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        ok(db);
        strictEqual(db.version, 2);
        db.close(); // important to make test success
        start();
    };
});

asyncTest("open_with_version", function () {
    expect(4);
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB", 10);
    req.onupgradeneeded = function (event) {
        var db = event.target.result;
        ok(db);
        strictEqual(db.version, 10);
    };
    req.onsuccess = function (event) {
        var db = event.target.result;
        ok(db);
        strictEqual(db.version, 10);
        start();
    };
});

asyncTest("open_with_version_pure", function () {
    expect(4);
    var req = indexedDB.open("MyDB", 10);
    req.onupgradeneeded = function (event) {
        var db = event.target.result;
        ok(db);
        strictEqual(db.version, 10);
    };
    req.onsuccess = function (event) {
        var db = event.target.result;
        ok(db);
        strictEqual(db.version, 10);
        db.close();
        start();
    };
});

asyncTest("open_with_version_error_default", function () {
    var kageDB = new KageDB();
    kageDB.onerror = function (event) {
        strictEqual(event.target.kage_className, "KageDB");
        strictEqual(event.target.kage_methodName, "open");
        deepEqual(event.target.kage_args, ["MyDB", 1]);
        strictEqual(event.target.errorCode, 12);
        var message = event.target.kage_getErrorMessage();
        ok(message, message);
        start();
    };
    kageDB.open("MyDB", 1);
});

asyncTest("open_with_version_error_custom", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB", 1);
    req.onerror = function (event) {
        strictEqual(event.target.kage_className, "KageDB");
        strictEqual(event.target.kage_methodName, "open");
        deepEqual(event.target.kage_args, ["MyDB", 1]);
        strictEqual(event.target.errorCode, 12);
        var message = event.target.kage_getErrorMessage();
        ok(message, message);
        start();
    };
});

test("cmp", function () {
    var kageDB = new KageDB();
    strictEqual(kageDB.cmp(1, 1), 0);
    strictEqual(kageDB.cmp(2, 1), 1);
    strictEqual(kageDB.cmp(1, 2), -1);
});

test("cmp_pure", function () {
    strictEqual(indexedDB.cmp(1, 1), 0);
    strictEqual(indexedDB.cmp(2, 1), 1);
    strictEqual(indexedDB.cmp(1, 2), -1);
});

module("ms_kagedb_join", {
    setup: function () {
        function open() {
            var req = kageDB.open("MyDB");
            req.onupgradeneeded = function (event) {
                var db = event.target.result;
                var store = db.createObjectStore("MyStore", { autoIncrement: true });
                store.createIndex("name", "name", { unique: true });
                start();
            };
        }
        stop();
        var kageDB = new KageDB();
        var req = kageDB.deleteDatabase("MyDB");
        req.onsuccess = req.onerror = open;
    }
});

asyncTest("join_kageDB", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = kageDB.join(
            store.put({ name: "aaa", age: 20}),
            store.put({ name: "bbb", age: 30}),
            store.put({ name: "ccc", age: 40}));
        req.onsuccess = function () {
            var req = store.count();
            req.onsuccess = function (event) {
                strictEqual(3, event.target.result);
                start();
            };
        };
    };
});

module("ms_kagedb_dump", {
    setup: function () {
        function open() {
            var req = kageDB.open("MyDB");
            req.onupgradeneeded = function (event) {
                var db = event.target.result;
                var store = db.createObjectStore("MyStore", { autoIncrement: true });
                store.createIndex("name", "name", { unique: true });
                var store2 = db.createObjectStore("MyStore2", { autoIncrement: true });
                store2.createIndex("product", "product", { unique: true });
            };
            req.onsuccess = function (event) {
                var db = event.target.result;
                var tx = db.transaction(["MyStore", "MyStore2"], IDBTransaction.READ_WRITE);
                var store = tx.objectStore("MyStore");
                var req = store.bulkAdd([
                    { name: "aaa", age: 20 },
                    { name: "bbb", age: 30 },
                    { name: "ccc", age: 40 }
                ]);
                req.onsuccess = function () {
                    var store2 = tx.objectStore("MyStore2");
                    var req = store2.bulkAdd([
                        { product: "ddd", category: 20 },
                        { product: "eee", category: 30 },
                        { product: "fff", category: 40 }
                    ]);
                    req.onsuccess = function () {
                        start();
                    };
                };
            };
        }
        stop();
        var kageDB = new KageDB();
        var req = kageDB.deleteDatabase("MyDB");
        req.onsuccess = req.onerror = open;
    }
});

asyncTest("dump", function () {
    var kageDB = new KageDB();
    var req = kageDB.dump("MyDB", ["MyStore", "MyStore2"]);
    req.onsuccess = function (event) {
        var results = event.target.result;
        ok(results.length, 2);
        deepEqual(results[0], [
            { name: "aaa", age: 20 },
            { name: "bbb", age: 30 },
            { name: "ccc", age: 40 }]);
        deepEqual(results[1], [
            { product: "ddd", category: 20 },
            { product: "eee", category: 30 },
            { product: "fff", category: 40 }]);
        start();
    };
});