module("database_test", {
    setup: function () {
        var myDB = this.myDB = new KageDB({
            name: "myDB",
            migration: {
                1: function (ctx, next) {
                    var db = ctx.db;
                    var person = db.createObjectStore("person", { autoIncrement: true });
                    person.createIndex("name", "name", { unique: true });
                    person.createIndex("age", "age", { unique: false });
                    db.createObjectStore("address", { autoIncrement: true });
                    next();
                }
            },
            onerror: function (event) {
                throw new Error(event.kage_message);
            }
        });
        stop();
        KageDB.indexedDB.open(myDB.name).onsuccess = function (event) {
            var db = event.target.result;
            db.close();
            KageDB.indexedDB.deleteDatabase(myDB.name).onsuccess = function () {
                start();
            };
        };
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
        myDB.version = 2;
        myDB.migration["2"] = function (ctx, next) {
            var db = ctx.db;
            db.deleteObjectStore("address");
            next();
        };
        myDB.tx(["person"], function(tx) {
            strictEqual(tx.db.objectStoreNames.contains("person"), true);
            strictEqual(tx.db.objectStoreNames.contains("address"), false);
            start();
        });
    });
});

asyncTest("debug", function () {
    var myDB = this.myDB;
    var results = [];
    myDB.debug = function (s) {
        results.push(s);
    };
    myDB.tx(["person"], function (tx) {
        ok(results.length > 0, results);
        start();
    });
});

asyncTest("all", function () {
    var myDB = this.myDB;
    myDB.tx(["person", "address"], function (tx, person, address) {
        tx.join([
            person.add({ name: "aaa", age: 20 }),
            person.add({ name: "bbb", age: 30 }),
            address.add({ street: "ccc" })
        ], function () {
            myDB.all(function (values) {
                deepEqual(values.person, [
                    { name: "aaa", age: 20 },
                    { name: "bbb", age: 30 }
                ]);
                deepEqual(values.address, [
                    { street: "ccc" }
                ]);
                start();
            });
        });
    });
});