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