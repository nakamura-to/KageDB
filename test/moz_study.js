module("moz_study");

asyncTest("mozIndexedDB", function () {
    var req = mozIndexedDB.deleteDatabase("MyDB");
    req.onsuccess = function () {
        var req = mozIndexedDB.open("MyDB");
        req.onupgradeneeded = function (event) {
            var db = event.target.result;
            var store = db.createObjectStore("MyStore", {autoIncrement: true });
            store.createIndex("name", "name", { unique: true });
        };
        req.onsuccess = function (event) {
            var db = event.target.result;
            var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
            var store = tx.objectStore("MyStore");
            var req = store.put({ name: "aaa", age: 20});
            req.onsuccess = function () {
                var req = store.count();
                req.onsuccess = function (event) {
                    strictEqual(1, event.target.result);
                    db.close();
                    start();
                };
                req.onerror = function (event) {
                    console.dir({ message: "count onerror", event: event });
                };
            };
            req.onerror = function (event) {
                console.dir({ message: "put onerror", event: event });
            };
        };
        req.onerror = function (event) {
            console.dir({ message: "open onerror", event: event });
        };
    };
    req.onerror = function (event) {
        console.dir({ message: "deleteDatabase onerror", event: event });
    };
});

asyncTest("kageDB", function () {
    var kageDB = new KageDB();
    var req = kageDB.deleteDatabase("MyDB");
    req.onsuccess = function () {
        var req = kageDB.open("MyDB");
        req.onupgradeneeded = function (event) {
            var db = event.target.result;
            var store = db.createObjectStore("MyStore", {autoIncrement: true });
            store.createIndex("name", "name", { unique: true });
        };
        req.onsuccess = function (event) {
            var db = event.target.result;
            var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
            var store = tx.objectStore("MyStore");
            var req = store.put({ name: "aaa", age: 20});
            req.onsuccess = function () {
                var req = store.count();
                req.onsuccess = function (event) {
                    strictEqual(1, event.target.result);
                    start();
                };
            };
        };
    };
});