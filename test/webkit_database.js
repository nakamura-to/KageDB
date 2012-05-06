module("webkit_database", {
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
        // onupgradeneeded isn't called
        var db = event.target.result;
        var store = db.createObjectStore("MyStore");
        ok(store);
        strictEqual(store.kage_kageDB, kageDB);
        strictEqual(db.objectStoreNames[0], "MyStore");
        start();
    };
    req.onsuccess = function (event) {
        var db = event.target.result;
        var req = db.setVersion(2);
        req.onsuccess = function () {
            var store = db.createObjectStore("MyStore");
            ok(store);
            strictEqual(store.kage_kageDB, kageDB);
            strictEqual(db.objectStoreNames[0], "MyStore");
            start();
        };
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
        var req = db.setVersion(2);
        req.onsuccess = function () {
            var store = db.createObjectStore("MyStore");
            ok(store);
            strictEqual(db.objectStoreNames[0], "MyStore");
            db.close();
            start();
        };
    };
});


asyncTest("transaction", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onupgradeneeded = function (event) {
        // onupgradeneeded isn't called
        var db = event.target.result;
        var store = db.createObjectStore("MyStore");
        ok(store);
    };
    req.onsuccess = function (event) {
        var db = event.target.result;
        var req = db.setVersion(1);
        req.onsuccess = function (event) {
            var tx = event.target.result;
            ok(tx);

            var store = db.createObjectStore("MyStore");
            ok(store);
            strictEqual(store.kage_kageDB, kageDB);
            strictEqual(db.objectStoreNames[0], "MyStore");

            // reopen to start new transaction
            var req = kageDB.open("MyDB");
            req.onsuccess = function (event) {
                var db = event.target.result;
                var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
                ok(tx);
                strictEqual(tx.kage_kageDB, kageDB);
                start();
            };
        };
    };
});

asyncTest("transaction_pure", function () {
    var req = indexedDB.open("MyDB", 2);
    req.onupgradeneeded = function (event) {
        var db = event.target.result;
        var store = db.createObjectStore("MyStore");
        ok(store);
    };
    req.onsuccess = function (event) {
        var db = event.target.result;
        var req = db.setVersion(2);
        req.onsuccess = function (event) {
            var store = db.createObjectStore("MyStore");
            ok(store);
            strictEqual(db.objectStoreNames[0], "MyStore");

            // reopen to start new transaction
            db.close();
            var req = indexedDB.open("MyDB");
            req.onsuccess = function (event) {
                var db = event.target.result;
                var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
                ok(tx);
                db.close();
                start();
            };
        };
    };
});
