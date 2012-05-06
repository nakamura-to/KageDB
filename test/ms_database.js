module("ms_database", {
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

asyncTest("createObjectStore", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB", 2);
    req.onupgradeneeded = function (event) {
        var db = event.target.result;
        var store = db.createObjectStore("MyStore");
        ok(store);
        strictEqual(store.kage_kageDB, kageDB);
        strictEqual(db.objectStoreNames[0], "MyStore");
        start();
    };
    req.onsuccess = function () {
    };
});

asyncTest("createObjectStore_pure", function () {
    var req = indexedDB.open("MyDB", 2);
    req.onupgradeneeded = function (event) {
        var db = event.target.result;
        var store = db.createObjectStore("MyStore");
        ok(store);
        strictEqual(db.objectStoreNames[0], "MyStore");
    };
    req.onsuccess = function (event) {
        var db = event.target.result;
        db.close();
        start();
    };
});

asyncTest("transaction", function () {
    expect(3);
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB", 2);
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
        start();
    };
});

asyncTest("transaction_pure", function () {
    expect(2);
    var req = indexedDB.open("MyDB", 2);
    req.onupgradeneeded = function (event) {
        var db = event.target.result;
        var store = db.createObjectStore("MyStore");
        ok(store);
    };
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        ok(tx);
        db.close();
        start();
    };
});