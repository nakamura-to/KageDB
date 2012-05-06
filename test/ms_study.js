module("ms_study");

/*
asyncTest("open_twice", function () {
    var kageDB = new KageDB();
    kageDB.onerror = function (event) {
        console.dir(event.target);
    };
    var req = kageDB.deleteDatabase("MyDB");
    req.onsuccess = function () {
        var req = kageDB.open("MyDB", 10);
        req.onupgradeneeded = function (event) {
            var db = event.target.result;
            var store = db.createObjectStore("MyStore", { autoIncrement: true });
        };
        req.onsuccess = function (event) {
            var db = event.target.result;
            var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
            var store = tx.objectStore("MyStore");
            var req = store.put({name: "hoge"});
            req.onsuccess = function (event) {
                var req = kageDB.open("MyDB", 1);
                req.onsuccess = function (event) {
                    var db2 = event.target.result;
                    var tx2 = db2.transaction(["MyStore"], IDBTransaction.READ_WRITE);
                    var store2 = tx2.objectStore("MyStore");
                    var req = store2.put({name: "foo"});
                    req.onsuccess = function (event) {
                        ok(true);
                        db.close();
                        db2.close();
                        start();
                    };
                };
            };
        };
    };
});
*/
/*

asyncTest("open_twice", function () {
    var req = indexedDB.deleteDatabase("MyDB");
    req.onsuccess = function () {
        var req = indexedDB.open("MyDB", 10);
        req.onupgradeneeded = function (event) {
            var db = event.target.result;
            var store = db.createObjectStore("MyStore", { autoIncrement: true });
        };
        req.onsuccess = function (event) {
            var db = event.target.result;
            var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
            var store = tx.objectStore("MyStore");
            var req = store.put({name: "hoge"});
            req.onsuccess = function (event) {
                var req = indexedDB.open("MyDB", 1);
                req.onsuccess = function (event) {
                    var db2 = event.target.result;
                    var tx2 = db2.transaction(["MyStore"], IDBTransaction.READ_WRITE);
                    var store2 = tx2.objectStore("MyStore");
                    var req = store2.put({name: "foo"});
                    req.onsuccess = function (event) {
                        ok(true);
                        db.close();
                        db2.close();
                        start();
                    };
                };
                req.onerror = function (event) {
                    console.dir(event);
                    console.dir(event.target);
                    throw new Error();
                }
            }
        };
    };
});
*/