module("transaction_test", {
    setup: function () {
        var myDB = this.myDB = new KageDB({
            name: "myDB",
            migration: {
                1: function (ctx, next) {
                    var db = ctx.db;
                    var tx = ctx.tx;
                    var person = db.createObjectStore("person", { autoIncrement: true });
                    person.createIndex("name", "name", { unique: true });
                    person.createIndex("age", "age", { unique: false });
                    tx.join([
                        person.put({ name: "aaa", age: 10 }),
                        person.put({ name: "bbb", age: 20 }),
                        person.put({ name: "ccc", age: 30 }),
                        person.put({ name: "ddd", age: 10 }),
                        person.put({ name: "eee", age: 20 }),
                        person.put({ name: "fff", age: 30 })
                    ], next);
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

asyncTest("abort", function () {
    expect(3);
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        tx.onabort = function () {
            ok(true);
        };
        person.put({ name: "xxx", age: 99 }, 1, function (result) {
            strictEqual(result, 1);
            tx.abort();
            myDB.all(function (values) {
                deepEqual(values.person, [
                    { name: "aaa", age: 10 },
                    { name: "bbb", age: 20 },
                    { name: "ccc", age: 30 },
                    { name: "ddd", age: 10 },
                    { name: "eee", age: 20 },
                    { name: "fff", age: 30 }
                ]);
                start();
            });
        });
    });
});

asyncTest("objectStore", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx) {
        var person = tx.objectStore("person");
        person.put({ name: "xxx", age: 99 }, 1, function (result) {
            strictEqual(result, 1);
            myDB.all(function (values) {
                deepEqual(values.person, [
                    { name: "xxx", age: 99 },
                    { name: "bbb", age: 20 },
                    { name: "ccc", age: 30 },
                    { name: "ddd", age: 10 },
                    { name: "eee", age: 20 },
                    { name: "fff", age: 30 }
                ]);
                start();
            });
        });
    });
});

asyncTest("mode default", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx) {
        strictEqual(tx.mode, "readwrite");
        start();
    });
});

asyncTest("mode readonly", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], "readonly", function (tx) {
        strictEqual(tx.mode, "readonly");
        start();
    });
});

asyncTest("mode readwrite", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], "readwrite", function (tx) {
        strictEqual(tx.mode, "readwrite");
        start();
    });
});

asyncTest("join", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        tx.join([
            person.put({ name: "xxx", age: 99 }, 1),
            person.delete(2)
        ], function () {
            myDB.all(function (values) {
                deepEqual(values.person, [
                    { name: "xxx", age: 99 },
                    { name: "ccc", age: 30 },
                    { name: "ddd", age: 10 },
                    { name: "eee", age: 20 },
                    { name: "fff", age: 30 }
                ]);
                start();
            });
        });
    });
});

asyncTest("join include bulkPut", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        tx.join([
            person.put({ name: "xxx", age: 99 }, 1),
            person.del(2),
            person.bulkPut(
                [{ name: "yyy", age: 100 }, { name: "zzz", age: 101 }],
                [3, 4]
            )
        ], function () {
            myDB.all(function (values) {
                deepEqual(values.person, [
                    { name: "xxx", age: 99 },
                    { name: "yyy", age: 100 },
                    { name: "zzz", age: 101 },
                    { name: "eee", age: 20 },
                    { name: "fff", age: 30 }
                ]);
                start();
            });
        });
    });
});

asyncTest("join include join", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        tx.join([
            person.put({ name: "xxx", age: 99 }, 1),
            person.del(2),
            tx.join([
                person.put({ name: "yyy", age: 100 }, 3),
                person.put({ name: "zzz", age: 101 }, 4)]
            )
        ], function () {
            myDB.all(function (values) {
                deepEqual(values.person, [
                    { name: "xxx", age: 99 },
                    { name: "yyy", age: 100 },
                    { name: "zzz", age: 101 },
                    { name: "eee", age: 20 },
                    { name: "fff", age: 30 }
                ]);
                start();
            });
        });
    });
});

asyncTest("join named results", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        tx.join({
            putResult: person.put({ name: "xxx", age: 99 }, 1),
            deleteResult: person.delete(2),
            notRequest: "aaa"
        }, function (results) {
            strictEqual(results.putResult, 1);
            strictEqual(results.notRequest, "aaa");
            myDB.all(function (values) {
                deepEqual(values.person, [
                    { name: "xxx", age: 99 },
                    { name: "ccc", age: 30 },
                    { name: "ddd", age: 10 },
                    { name: "eee", age: 20 },
                    { name: "fff", age: 30 }
                ]);
                start();
            });
        });
    });
});
