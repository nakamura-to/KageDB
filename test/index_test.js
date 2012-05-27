module("index_test", {
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
        person.index("age").openCursor({ge: 20}, "prev", function (cursor) {
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
        person.index("age").openKeyCursor({ge: 20}, "prev", function (cursor) {
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

// Chrome doesn't support `get(keyRange)`
if (typeof webkitIndexedDB === "undefined") {
    asyncTest("get with key range", function () {
        var myDB = this.myDB;
        myDB.tx(["person"], function (tx, person) {
            person.index("age").get({gt: 10}, function (value) {
                deepEqual(value, { name: "bbb", age: 20 });
                start();
            });
        });
    });
}

asyncTest("getKey", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.index("age").getKey(20, function (value) {
            deepEqual(value, 2);
            start();
        });
    });
});

// Chrome doesn't support `get(keyRange)`
if (typeof webkitIndexedDB === "undefined") {
    asyncTest("getKey with key range", function () {
        var myDB = this.myDB;
        myDB.tx(["person"], function (tx, person) {
            person.index("age").getKey({gt: 10}, function (value) {
                deepEqual(value, 2);
                start();
            });
        });
    });
}

asyncTest("count", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.index("age").count(20, function (value) {
            deepEqual(value, 2);
            start();
        });
    });
});

asyncTest("count with key range", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.index("age").count({ge: 20}, function (value) {
            deepEqual(value, 4);
            start();
        });
    });
});