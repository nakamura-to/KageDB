module("objectstore_test", {
    setup: function () {
        function open() {
            var req = kageDB.open("MyDB");
            req.onupgradeneeded = function (event) {
                var db = event.target.result;
                var store = db.createObjectStore("MyStore", { autoIncrement: true });
                var index = store.createIndex("name", "name", { unique: true });
                ok(index);
                strictEqual(index.kage_kageDB, kageDB);
                start();
            };
        }
        stop();
        var kageDB = new KageDB();
        var req = kageDB.deleteDatabase("MyDB");
        req.onsuccess = req.onerror = open;
    }
});

asyncTest("put", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.put({ name: "aaa", age: 20});
        ok(req.onsuccess);
        ok(req.onerror);
        req.onsuccess = function () {
            var req = store.count();
            req.onsuccess = function (event) {
                strictEqual(1, event.target.result);
                start();
            };
        };
    };
});

asyncTest("add", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20});
        ok(req.onsuccess);
        ok(req.onerror);
        req.onsuccess = function () {
            start();
        };
    };
});

asyncTest("get", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20});
        req.onsuccess = function (event) {
            var key = event.target.result;
            var req = store.get(key);
            ok(req.onsuccess);
            ok(req.onerror);
            req.onsuccess = function (event) {
                var value = event.target.result;
                deepEqual(value, { name: "aaa", age: 20});
                start();
            };
        };
    };
});

asyncTest("clear", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20});
        req.onsuccess = function () {
            var req = store.clear();
            ok(req.onsuccess);
            ok(req.onerror);
            req.onsuccess = function () {
                start();
            };
        };
    };
});

asyncTest("openCursor", function () {
    expect(8);
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20 });
        req.onsuccess = function () {
            var req = store.add({ name: "bbb", age: 30 });
            req.onsuccess = function () {
                var req = store.openCursor();
                ok(req.onsuccess);
                ok(req.onerror);
                req.onsuccess = function (event) {
                    var cursor = event.target.result;
                    if (cursor) {
                        ok(cursor.kage_kageDB, kageDB);
                        ok(cursor.value);
                        cursor.continue();
                    } else {
                        start();
                    }
                };
            };
        };
    };
});

asyncTest("count", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20 });
        req.onsuccess = function () {
            var req = store.add({ name: "bbb", age: 30 });
            req.onsuccess = function () {
                var req = store.count();
                ok(req.onsuccess);
                ok(req.onerror);
                req.onsuccess = function (event) {
                    var count = event.target.result;
                    strictEqual(count, 2);
                    start();
                };
            };
        };
    };
});

asyncTest("index", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20 });
        req.onsuccess = function () {
            var req = store.add({ name: "bbb", age: 30 });
            req.onsuccess = function () {
                var index = store.index("name");
                strictEqual(index.kage_kageDB,  kageDB);
                start();
            };
        };
    };
});


asyncTest("bulkPut", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkPut([
            { name: "aaa", age: 20},
            { name: "bbb", age: 30},
            { name: "ccc", age: 40}
        ]);
        ok(req.onsuccess);
        ok(req.onerror);
        req.onsuccess = function (event) {
            deepEqual(event.target.result, [1, 2, 3]);
            var req = store.count();
            req.onsuccess = function (event) {
                strictEqual(3, event.target.result);
                start();
            };
        }
    };
});

asyncTest("bulkPut_manual", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var pending = 3;
        function handle() {
            pending--;
            if (pending === 0) {
                var req = store.count();
                req.onsuccess = function (event) {
                    strictEqual(3, event.target.result);
                    start();
                };
            }
        }
        var req1 = store.put({ name: "aaa", age: 20});
        req1.onsuccess = handle;
        var req2 = store.put({ name: "bbb", age: 30});
        req2.onsuccess = handle;
        var req3 = store.put({ name: "ccc", age: 40});
        req3.onsuccess = handle;
    };
});

asyncTest("bulkAdd", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkAdd([
            { name: "aaa", age: 20},
            { name: "bbb", age: 30},
            { name: "ccc", age: 40}
        ]);
        ok(req.onsuccess);
        ok(req.onerror);
        req.onsuccess = function (event) {
            deepEqual(event.target.result, [1, 2, 3]);
            var req = store.count();
            req.onsuccess = function (event) {
                strictEqual(3, event.target.result);
                start();
            };
        }
    };
});

asyncTest("bulkDelete", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkAdd([
            { name: "aaa", age: 20},
            { name: "bbb", age: 30},
            { name: "ccc", age: 40}
        ]);
        req.onsuccess = function (event) {
            deepEqual(event.target.result, [1, 2, 3]);
            var req = store.count();
            req.onsuccess = function (event) {
                strictEqual(3, event.target.result);
                var req = store.bulkDelete([1, 2, 3]);
                req.onsuccess = function () {
                    var req = store.count();
                    req.onsuccess = function (event) {
                        strictEqual(0, event.target.result);
                        start();
                    }
                };
            };
        }
    };
});