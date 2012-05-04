module("moz_index", {
    setup: function () {
        function open() {
            var req = kageDB.open("MyDB");
            req.onupgradeneeded = function (event) {
                var db = event.target.result;
                var store = db.createObjectStore("MyStore", { autoIncrement: true });
                store.createIndex("name", "name", { unique: true });
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
        }
        stop();
        var kageDB = new KageDB();
        var req = kageDB.deleteDatabase("MyDB");
        req.onsuccess = req.onerror = open;
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
                ok(cursor.kage_kageDB, kageDB);
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

asyncTest("openCursor_pure", function () {
    expect(6);
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").openCursor();
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
                ok(cursor.primaryKey, cursor.primaryKey);
                ok(cursor.key, cursor.key);
                ok(cursor.value, cursor.value.name + ":" + cursor.value.age);
                cursor.continue();
            } else {
                db.close();
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
                ok(cursor.kage_kageDB, kageDB);
                ok(cursor.primaryKey, cursor.primaryKey);
                ok(cursor.key, cursor.key);
                cursor.continue();
            } else {
                start();
            }
        }
    };
});

asyncTest("openKeyCursor_pure", function () {
    expect(4);
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").openKeyCursor();
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
                ok(cursor.primaryKey, cursor.primaryKey);
                ok(cursor.key, cursor.key);
                cursor.continue();
            } else {
                db.close();
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

asyncTest("get_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").get("bbb");
        req.onsuccess = function (event) {
            var value = event.target.result;
            deepEqual(value, { name: "bbb", age: 30 });
            db.close();
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

asyncTest("getKey_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").getKey("bbb");
        req.onsuccess = function (event) {
            var key = event.target.result;
            strictEqual(key, 2);
            db.close();
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

asyncTest("count_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").count();
        req.onsuccess = function (event) {
            var count = event.target.result;
            strictEqual(count, 2);
            db.close();
            start();
        }
    };
});

asyncTest("fetch", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkAdd([
            { name: "ccc", age: 40 },
            { name: "ddd", age: 50 },
            { name: "eee", age: 60 }
        ]);
        req.onsuccess = function () {
            var req = store.index("name").fetch(IDBKeyRange.lowerBound(0), IDBCursor.NEXT, function (value) { return value.age > 40});
            req.onsuccess = function (event) {
                var values = event.target.result;
                deepEqual(values, [{ name: "ddd", age: 50 }, { name: "eee", age: 60 }]);
                start();
            };
        };
    };
});