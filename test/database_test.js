module("database_test");

asyncTest("createObjectStore", function () {
    var kageDB = new KageDB();
    var req = kageDB.deleteDatabase("MyDB");
    req.onsuccess = function () {
        var req = kageDB.open("MyDB");
        req.onupgradeneeded = function (event) {
            var db = event.target.result;
            var store = db.createObjectStore("MyStore");
            ok(store);
            strictEqual(store.kage_kageDB, kageDB);
            strictEqual(db.objectStoreNames[0], "MyStore");
            start();
        };
        req.onsuccess = function (event) {
        };
    };
});

asyncTest("transaction", function () {
    expect(6);
    var kageDB = new KageDB();
    var req = kageDB.deleteDatabase("MyDB");
    req.onsuccess = function () {
        var req = kageDB.open("MyDB");
        req.onupgradeneeded = function (event) {
            var db = event.target.result;
            var store = db.createObjectStore("MyStore");
            ok(store);
        };
        req.onsuccess = function (event) {
            var db = event.target.result;
            var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
            ok(tx);
            strictEqual(tx.kage_kageDB, kageDB);
            ok(tx.onabort);
            ok(tx.oncomplete);
            ok(tx.onerror);
            start();
        };
    };
});