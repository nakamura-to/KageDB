module("objectstore_test", {
    setup: function () {
        var myDB = this.myDB = new KageDB({
            name: "myDB",
            upgrade: function (db, complete) {
                var person = db.createObjectStore("person", { autoIncrement: true });
                person.createIndex("name", "name", { unique: true });
                var address = db.createObjectStore("address", { autoIncrement: true });
                address.createIndex("street", "street", { unique: true });
                db.join([
                    person.put({ name: "aaa", age: 10 }),
                    person.put({ name: "bbb", age: 20 }),
                    address.put({ street: "aaa" }),
                    address.put({ street: "bbb" }),
                    address.put({ street: "ccc" }),
                    address.put({ street: "ddd" }),
                    address.put({ street: "eee" })
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

asyncTest("put", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.put({ name: "xxx", age: 99 }, function (result) {
            strictEqual(result, 3);
            myDB.all("person", function (values) {
                deepEqual(values, [
                    { name: "aaa", age: 10 },
                    { name: "bbb", age: 20 },
                    { name: "xxx", age: 99 }
                ]);
                start();
            });
        });
    });
});

asyncTest("put with kye", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.put({ name: "xxx", age: 99 }, 1, function (result) {
            strictEqual(result, 1);
            myDB.all("person", function (values) {
                deepEqual(values, [
                    { name: "xxx", age: 99 },
                    { name: "bbb", age: 20 }
                ]);
                start();
            });
        });
    });
});

asyncTest("add", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.add({ name: "xxx", age: 99 }, function (result) {
            strictEqual(result, 3);
            myDB.all("person", function (values) {
                deepEqual(values, [
                    { name: "aaa", age: 10 },
                    { name: "bbb", age: 20 },
                    { name: "xxx", age: 99 }
                ]);
                start();
            });
        });
    });
});

asyncTest("add with key", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.add({ name: "xxx", age: 99 }, 1, null, function (event) {
            strictEqual(event.target.errorCode, 4);
            event.preventDefault(); // it is necessary to stopPropagation in FireFox
            event.stopPropagation();
            start();
        });
    });
});

asyncTest("delete", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.delete(2, function () {
            myDB.all("person", function (values) {
                deepEqual(values, [
                    { name: "aaa", age: 10 }
                ]);
                start();
            });
        });
    });
});

asyncTest("bulkPut", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.bulkPut([
            { name: "xxx", age: 99 },
            { name: "yyy", age: 100}
        ], function (result) {
            deepEqual(result, [3, 4]);
            myDB.all("person", function (values) {
                deepEqual(values, [
                    { name: "aaa", age: 10 },
                    { name: "bbb", age: 20 },
                    { name: "xxx", age: 99 },
                    { name: "yyy", age: 100 }
                ]);
                start();
            });
        });
    });
});

asyncTest("bulkPut with keys", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.bulkPut([
            { name: "xxx", age: 99 },
            { name: "yyy", age: 100}
        ], [
            1, 2
        ],function (result) {
            deepEqual(result, [1, 2]);
            myDB.all("person", function (values) {
                deepEqual(values, [
                    { name: "xxx", age: 99 },
                    { name: "yyy", age: 100 }
                ]);
                start();
            });
        });
    });
});

asyncTest("bulkAdd", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.bulkAdd([
            { name: "xxx", age: 99 },
            { name: "yyy", age: 100}
        ], function (result) {
            deepEqual(result, [3, 4]);
            myDB.all("person", function (values) {
                deepEqual(values, [
                    { name: "aaa", age: 10 },
                    { name: "bbb", age: 20 },
                    { name: "xxx", age: 99 },
                    { name: "yyy", age: 100 }
                ]);
                start();
            });
        });
    });
});

asyncTest("bulkAdd with keys", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.bulkAdd([
            { name: "xxx", age: 99 },
            { name: "yyy", age: 100}
        ], [
            3, 4
        ],function (result) {
            deepEqual(result, [3, 4]);
            myDB.all("person", function (values) {
                deepEqual(values, [
                    { name: "aaa", age: 10 },
                    { name: "bbb", age: 20 },
                    { name: "xxx", age: 99 },
                    { name: "yyy", age: 100 }
                ]);
                start();
            });
        });
    });
});

asyncTest("bulkDelete", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.bulkDelete([1, 2], function () {
            myDB.all("person", function (values) {
                deepEqual(values, []);
                start();
            });
        });
    });
});

asyncTest("get", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.get(2, function (value) {
            deepEqual(value, { name: "bbb", age: 20 });
            start();
        });
    });
});

asyncTest("clear", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.clear(function () {
            myDB.all("person", function (values) {
                deepEqual(values, []);
                start();
            });
        });
    });
});

asyncTest("openCursor", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor(function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "aaa" },
                    { street: "bbb" },
                    { street: "ccc" },
                    { street: "ddd" },
                    { street: "eee" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor eq", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor(tx.eq(2), function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "bbb" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor gt", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor(tx.gt(2), function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "ccc" },
                    { street: "ddd" },
                    { street: "eee" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor ge", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor(tx.ge(2), function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "bbb" },
                    { street: "ccc" },
                    { street: "ddd" },
                    { street: "eee" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor lt", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor(tx.lt(4), function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "aaa" },
                    { street: "bbb" },
                    { street: "ccc" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor le", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor(tx.le(4), function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "aaa" },
                    { street: "bbb" },
                    { street: "ccc" },
                    { street: "ddd" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor ge le", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor(tx.ge(2).le(4), function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "bbb" },
                    { street: "ccc" },
                    { street: "ddd" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor gt lt", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor(tx.gt(2).lt(4), function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "ccc" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor next", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor("next", function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "aaa" },
                    { street: "bbb" },
                    { street: "ccc" },
                    { street: "ddd" },
                    { street: "eee" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor prev", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor("prev", function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "eee" },
                    { street: "ddd" },
                    { street: "ccc" },
                    { street: "bbb" },
                    { street: "aaa" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor gt prev", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor(tx.gt(2), "prev", function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "eee" },
                    { street: "ddd" },
                    { street: "ccc" }
                ]);
                start();
            }
        });
    });
});

asyncTest("openCursor gt prev", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor(tx.gt(2), "prev", function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "eee" },
                    { street: "ddd" },
                    { street: "ccc" }
                ]);
                start();
            }
        });
    });
});

asyncTest("fetch gt prev", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        address.fetch(tx.gt(2), "prev", function (results) {
            deepEqual(results, [
                { street: "eee" },
                { street: "ddd" },
                { street: "ccc" }
            ]);
            start();
        });
    });
});

asyncTest("count", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        address.count(function (value) {
            strictEqual(value, 5);
            start();
        });
    });
});