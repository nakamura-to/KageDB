module("index_test", {
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

asyncTest("openCursor", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        var results = [];
        person.index("age").openCursor(function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { name: "aaa", age: 10 },
                    { name: "ddd", age: 10 },
                    { name: "bbb", age: 20 },
                    { name: "eee", age: 20 },
                    { name: "ccc", age: 30 },
                    { name: "fff", age: 30 }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor ge prev", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        var results = [];
        person.index("age").openCursor(tx.ge(20), "prev", function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { name: "fff", age: 30 },
                    { name: "ccc", age: 30 },
                    { name: "eee", age: 20 },
                    { name: "bbb", age: 20 }
                ]);
                start();
            }
        });
    });
});

asyncTest("openKeyCursor", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        var results = [];
        person.index("age").openKeyCursor(function (cursor) {
            if (cursor) {
                results.push(cursor.key);
                cursor.continue();
            } else {
                deepEqual(results, [10, 10, 20, 20, 30, 30]);
                start();
            }
        });
    });
});

asyncTest("openKeyCursor ge prev", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        var results = [];
        person.index("age").openKeyCursor(tx.ge(20), "prev", function (cursor) {
            if (cursor) {
                results.push(cursor.key);
                cursor.continue();
            } else {
                deepEqual(results, [30, 30, 20, 20]);
                start();
            }
        });
    });
});

asyncTest("openKeyCursor nextunique", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        var results = [];
        person.index("age").openKeyCursor("nextunique", function (cursor) {
            if (cursor) {
                results.push(cursor.key);
                cursor.continue();
            } else {
                deepEqual(results, [10, 20, 30]);
                start();
            }
        });
    });
});

asyncTest("openKeyCursor prevunique", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        var results = [];
        person.index("age").openKeyCursor("prevunique", function (cursor) {
            if (cursor) {
                results.push(cursor.key);
                cursor.continue();
            } else {
                deepEqual(results, [30, 20, 10]);
                start();
            }
        });
    });
});

asyncTest("get", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.index("age").get(20, function (value) {
            deepEqual(value, { name: "bbb", age: 20 });
            start();
        });
    });
});

asyncTest("getKey", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.index("age").getKey(20, function (value) {
            deepEqual(value, 2);
            start();
        });
    });
});