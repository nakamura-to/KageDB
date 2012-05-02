module("transaction_test");

asyncTest("objectStore", function () {
    expect(3);
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
            var store = tx.objectStore("MyStore");
            ok(store);
            strictEqual(store.kage_kageDB, kageDB);
            start();
        };
    };
});