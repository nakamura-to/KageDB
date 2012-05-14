module("transaction_test", {
    setup: function () {
        var myDB = this.myDB = new KageDB({
            name: "myDB",
            upgrade: function (db, complete) {
                var person = db.createObjectStore("person", { autoIncrement: true });
                person.createIndex("name", "name", { unique: true });
                person.createIndex("age", "age", { unique: false });
                db.join([
                    person.put({ name: "aaa", age: 10 }),
                    person.put({ name: "bbb", age: 20 }),
                    person.put({ name: "ccc", age: 30 }),
                    person.put({ name: "ddd", age: 10 }),
                    person.put({ name: "eee", age: 20 }),
                    person.put({ name: "fff", age: 30 })
                ], function () {
                    complete();
                });
            },
            onerror: function (event) {
                throw new Error(event.kage_errorMessage);
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
            myDB.all("person", function (values) {
                deepEqual(values, [
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
            myDB.all("person", function (values) {
                deepEqual(values, [
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
            myDB.all("person", function (values) {
                deepEqual(values, [
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
            person.delete(2),
            person.bulkPut(
                [{ name: "yyy", age: 100 }, { name: "zzz", age: 101 }],
                [3, 4]
            )
        ], function () {
            myDB.all("person", function (values) {
                deepEqual(values, [
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
            person.delete(2),
            tx.join([
                person.put({ name: "yyy", age: 100 }, 3),
                person.put({ name: "zzz", age: 101 }, 4)]
            )
        ], function () {
            myDB.all("person", function (values) {
                deepEqual(values, [
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