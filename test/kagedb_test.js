module("kagedb_test", {
    setup: function () {
        function open() {
            var req = kageDB.open("MyDB");
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

asyncTest("open", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        ok(db);
        strictEqual(db.version, 1);
        start();
    };
});

asyncTest("open-with-version", function () {
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

test("cmp", function () {
    var kageDB = new KageDB();
    strictEqual(kageDB.cmp(1, 1), 0);
    strictEqual(kageDB.cmp(2, 1), 1);
    strictEqual(kageDB.cmp(1, 2), -1);
});

module("kagedb_dump_test", {
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