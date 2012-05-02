module("index_test", {
    setup: function () {
        stop();
        var kageDB = new KageDB();
        var req = kageDB.deleteDatabase("MyDB");
        req.onsuccess = function () {
            var req = kageDB.open("MyDB");
            req.onupgradeneeded = function (event) {
                var db = event.target.result;
                var store = db.createObjectStore("MyStore", { autoIncrement: true });
                var index = store.createIndex("name", "name", { unique: true });
            };
            req.onsuccess = function (event) {
                var db = event.target.result;
                var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
                var store = tx.objectStore("MyStore");
                var req = store.add({ name: "aaa", age: 20 });
                req.onsuccess = function () {
                    var req = store.add({ name: "bbb", age: 30 });
                    req.onsuccess = function () {
                        start();
                    };
                }
            };
        };
    }
});

asyncTest("openCursor", function () {
    expect(10);
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").openCursor();
        ok(req.onsuccess);
        ok(req.onerror);
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
                ok(cursor.kage_kageDB, kageDB)
                ok(cursor.primaryKey, cursor.primaryKey);
                ok(cursor.key, cursor.key);
                ok(cursor.value, cursor.value.name + ":" + cursor.value.age);
                cursor.continue();
            } else {
                start();
            }
        }
    };
});

asyncTest("openKeyCursor", function () {
    expect(8);
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").openKeyCursor();
        ok(req.onsuccess);
        ok(req.onerror);
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
                ok(cursor.kage_kageDB, kageDB)
                ok(cursor.primaryKey, cursor.primaryKey);
                ok(cursor.key, cursor.key);
                cursor.continue();
            } else {
                start();
            }
        }
    };
});

asyncTest("get", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").get("bbb");
        ok(req.onsuccess);
        ok(req.onerror);
        req.onsuccess = function (event) {
            var value = event.target.result;
            deepEqual(value, { name: "bbb", age: 30 });
            start();
        }
    };
});

asyncTest("getKey", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").getKey("bbb");
        ok(req.onsuccess);
        ok(req.onerror);
        req.onsuccess = function (event) {
            var key = event.target.result;
            strictEqual(key, 2);
            start();
        }
    };
});

asyncTest("count", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").count();
        ok(req.onsuccess);
        ok(req.onerror);
        req.onsuccess = function (event) {
            var count = event.target.result;
            strictEqual(count, 2);
            start();
        }
    };
});