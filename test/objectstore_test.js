module("objectstore_test", {
    setup: function () {
        var myDB = this.myDB = new KageDB({
            name: "myDB",
            migration: {
                1: function (ctx, next) {
                    var db = ctx.db;
                    var tx = ctx.tx;
                    var person = db.createObjectStore("person", { autoIncrement: true });
                    person.createIndex("name", "name", { unique: true });
                    var address = db.createObjectStore("address", { autoIncrement: true });
                    address.createIndex("street", "street", { unique: true });
                    tx.join([
                        person.put({ name: "aaa", age: 10 }),
                        person.put({ name: "bbb", age: 20 }),
                        address.put({ street: "aaa" }),
                        address.put({ street: "bbb" }),
                        address.put({ street: "ccc" }),
                        address.put({ street: "ddd" }),
                        address.put({ street: "eee" })
                    ], next);
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

asyncTest("put", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.put({ name: "xxx", age: 99 }, function (result) {
            strictEqual(result, 3);
            myDB.all(function (values) {
                deepEqual(values.person, [
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
            myDB.all(function (values) {
                deepEqual(values.person, [
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
            myDB.all(function (values) {
                deepEqual(values.person, [
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
            if (event.target.error) {
                ok(event.target.error, event.target.error);
            } else {
                strictEqual(event.target.errorCode, 4);
            }
            event.preventDefault(); // it is necessary to stopPropagation in FireFox
            event.stopPropagation();
            start();
        });
    });
});

asyncTest("add constraint error", function () {
    expect(4);
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.add({ name: "aaa", age: 99 }, function () {}, function (event) {
            if (event.target.error) {
                ok(event.target.error, event.target.error);
            } else {
                strictEqual(event.target.errorCode, 4);
            }
            ok(event.kage_message, event.kage_message);
        });
    }, function (event) {
        if (event.target.error) {
            ok(event.target.error, event.target.error);
        } else {
            strictEqual(event.target.errorCode, 4);
        }
        ok(event.kage_message, event.kage_message);
        event.preventDefault(); // it is necessary to make test success in FireFox
        start();
    });

});

asyncTest("delete", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.delete(2, function () {
            myDB.all(function (values) {
                deepEqual(values.person, [
                    { name: "aaa", age: 10 }
                ]);
                start();
            });
        });
    });
});

asyncTest("delete with key range", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.delete({ge: 1, le: 2}, function () {
            myDB.all(function (values) {
                deepEqual(values.person, []);
                start();
            });
        });
    });
});

asyncTest("del", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.del(2, function () {
            myDB.all(function (values) {
                deepEqual(values.person, [
                    { name: "aaa", age: 10 }
                ]);
                start();
            });
        });
    });
});

asyncTest("del with key range", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.del({ge: 1, le: 2}, function () {
            myDB.all(function (values) {
                deepEqual(values.person, []);
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
            myDB.all(function (values) {
                deepEqual(values.person, [
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
            myDB.all(function (values) {
                deepEqual(values.person, [
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
            myDB.all(function (values) {
                deepEqual(values.person, [
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
            myDB.all(function (values) {
                deepEqual(values.person, [
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
            myDB.all(function (values) {
                deepEqual(values.person, []);
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

// Chrome doesn't support `get(keyRange)`
if (typeof webkitIndexedDB === "undefined") {
    asyncTest("get with key", function () {
        var myDB = this.myDB;
        myDB.tx(["person"], function (tx, person) {
            person.get({gt:1, le:10}, function (value) {
                deepEqual(value, { name: "bbb", age: 20 });
                start();
            });
        });
    });
}

asyncTest("clear", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.clear(function () {
            myDB.all(function (values) {
                deepEqual(values.person, []);
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
        address.openCursor({eq: 2}, function (cursor) {
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
        address.openCursor({gt: 2}, function (cursor) {
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
        address.openCursor({ge: 2}, function (cursor) {
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
        address.openCursor({lt: 4}, function (cursor) {
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
        address.openCursor({le: 4}, function (cursor) {
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
        address.openCursor({ge: 2, le: 4}, function (cursor) {
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
        address.openCursor({gt: 2, lt: 4}, function (cursor) {
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
        address.openCursor({gt: 2}, "prev", function (cursor) {
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

asyncTest("openCursor ge prev", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.openCursor({ge: 2}, "prev", function (cursor) {
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "eee" },
                    { street: "ddd" },
                    { street: "ccc" },
                    { street: "bbb" }
                ]);
                start();
            }
        });
    });
});

asyncTest("fetch gt prev", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        address.fetch({gt: 2}, "prev", function (results) {
            deepEqual(results, [
                { street: "eee" },
                { street: "ddd" },
                { street: "ccc" }
            ]);
            start();
        });
    });
});

asyncTest("fetch gt prev filter", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        address.fetch({gt: 2, filter: filter }, "prev", function (results) {
            deepEqual(results, [
                { street: "ddd" }
            ]);
            start();
        });
    });

    function filter(address, i) {
        return address.street === "ddd" && i == 1;
    }
});

asyncTest("fetch offset limit", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        address.fetch({ offset: 1, limit: 3 }, function (results) {
            deepEqual(results, [
                { street: "bbb" },
                { street: "ccc" },
                { street: "ddd" }
            ]);
            start();
        });
    });
});

asyncTest("fetch reduce", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        address.fetch({ offset: 1, limit: 3, reduce: reduce }, function (result) {
            strictEqual(result.val, "bbbcccddd");
            start();
        });
    });

    function reduce(prev, curr) {
        return { val: (prev.val ? prev.val : prev.street) + curr.street };
    }
});

asyncTest("fetch reduce initialValue", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        address.fetch({ offset: 1, limit: 3, reduce: reduce, initialValue: "" }, function (result) {
            strictEqual(result, "bbbcccddd");
            start();
        });
    });

    function reduce(prev, curr) {
        return prev + curr.street;
    }
});

asyncTest("fetch keyOnly", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        address.fetch({ offset: 1, limit: 3, reduce: reduce, keyOnly: true }, function (result) {
            strictEqual(result, 9);
            start();
        });
    });

    function reduce(prev, curr) {
        return prev + curr;
    }
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

asyncTest("count with key range", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        address.count({gt: 3}, function (value) {
            strictEqual(value, 2);
            start();
        });
    });
});