module("cursorwithvalue_test", {
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

asyncTest("update", function () {
    expect(2);
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").openCursor();
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
                var value = cursor.value;
                value.age += 1;
                var req = cursor.update(value);
                req.onsuccess = function (event) {
                    ok(event.target.result, event.target.result);
                    cursor.continue();
                };
            } else {
                start();
            }
        }
    };
});

asyncTest("delete", function () {
    expect(2);
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.index("name").openCursor();
        req.onsuccess = function (event) {
            var cursor = event.target.result;
            if (cursor) {
                var value = cursor.value;
                value.age += 1;
                var req = cursor.delete();
                req.onsuccess = function (event) {
                    ok(event.target.result, event.target.result);
                    cursor.continue();
                };
            } else {
                start();
            }
        }
    };
});