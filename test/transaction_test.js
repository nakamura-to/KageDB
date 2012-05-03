module("transaction_test", {
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

asyncTest("objectStore", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        ok(store);
        strictEqual(store.kage_kageDB, kageDB);
        start();
    };
});

asyncTest("objectStore_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        ok(store);
        db.close();
        start();
    };
});