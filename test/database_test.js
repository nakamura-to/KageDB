module("database_test", {
    setup: function () {
        var myDB = this.myDB = new KageDB({
            name: "myDB",
            upgrade: function (db, complete) {
                var person = db.createObjectStore("person", { autoIncrement: true });
                person.createIndex("name", "name", { unique: true });
                person.createIndex("age", "age", { unique: false });
                db.createObjectStore("address", { autoIncrement: true });
                complete();
            },
            onerror: function (event) {
                throw new Error(event.kage_errorMessage);
            }
        });
        stop();
        myDB.deleteDatabase(start);
    }
});

asyncTest("event listeners", function () {
    var myDB = this.myDB;
    var req = myDB.tx(["person"], function (tx) {
        start();
    });
    ok(req);
    ok(req.onblocked);
    ok(req.onupgradeneeded);
    ok(req.onsuccess);
    ok(req.onerror);
});

asyncTest("name", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx) {
        strictEqual(tx.db.name, "myDB");
        start();
    });
});

asyncTest("deleteObjectStore", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx) {
        strictEqual(tx.db.objectStoreNames.contains("person"), true);
        strictEqual(tx.db.objectStoreNames.contains("address"), true);
        myDB.version += 1;
        myDB.upgrade = function (db, complete) {
            db.deleteObjectStore("address");
            complete();
        };
        myDB.tx(["person"], function(tx) {
            strictEqual(tx.db.objectStoreNames.contains("person"), true);
            strictEqual(tx.db.objectStoreNames.contains("address"), false);
            start();
        });
    });
});