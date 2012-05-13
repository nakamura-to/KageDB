module("cursor_test", {
    setup: function () {
        var myDB = this.myDB = new KageDB({
            name: "myDB",
            upgrade: function (db, complete) {
                var person = db.createObjectStore("person", { autoIncrement: true });
                person.createIndex("name", "name", { unique: true });
                person.createIndex("age", "age", { unique: false });
                var address = db.createObjectStore("address", { autoIncrement: true });
                address.createIndex("street", "street", { unique: false });
                db.join([
                    person.put({ name: "aaa", age: 10 }),
                    person.put({ name: "bbb", age: 20 }),
                    person.put({ name: "ccc", age: 30 }),
                    person.put({ name: "ddd", age: 10 }),
                    person.put({ name: "eee", age: 20 }),
                    person.put({ name: "fff", age: 30 }),
                    address.put({ street: "aaa", city: "NY" }),
                    address.put({ street: "bbb", city: "TOKYO" }),
                    address.put({ street: "aaa", city: "Paris" })
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

asyncTest("update", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.index("age").openCursor(function (cursor) {
            if (cursor) {
                var value = cursor.value;
                value.age2 = value.age * 2;
                cursor.update(value);
                cursor.continue();
            } else {
                myDB.all('person', function (results) {
                    deepEqual(results, [
                        { name: "aaa", age:10, age2: 20 },
                        { name: "bbb", age:20, age2: 40 },
                        { name: "ccc", age:30, age2: 60 },
                        { name: "ddd", age:10, age2: 20 },
                        { name: "eee", age:20, age2: 40 },
                        { name: "fff", age:30, age2: 60 }
                    ]);
                    start();
                });
            }
        });
    });
});

asyncTest("delete", function () {
    var myDB = this.myDB;
    myDB.tx(["person"], function (tx, person) {
        person.index("age").openCursor(function (cursor) {
            if (cursor) {
                var value = cursor.value;
                if (value.name > "d") {
                    cursor.delete();
                }
                cursor.continue();
            } else {
                myDB.all('person', function (results) {
                    deepEqual(results, [
                        { name: "aaa", age:10 },
                        { name: "bbb", age:20 },
                        { name: "ccc", age:30 }
                    ]);
                    start();
                });
            }
        });
    });
});

asyncTest("direction default", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.index("street").openCursor(function (cursor) {
            if (cursor) {
                strictEqual(cursor.direction, "next");
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "aaa", city: "NY" },
                    { street: "aaa", city: "Paris" },
                    { street: "bbb", city: "TOKYO" }
                ]);
                start();
            }
        });
    });
});

asyncTest("direction next", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.index("street").openCursor(function (cursor) {
            if (cursor) {
                strictEqual(cursor.direction, "next");
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "aaa", city: "NY" },
                    { street: "aaa", city: "Paris" },
                    { street: "bbb", city: "TOKYO" }
                ]);
                start();
            }
        });
    });
});

asyncTest("direction nextunique", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.index("street").openCursor("nextunique", function (cursor) {
            if (cursor) {
                strictEqual(cursor.direction, "nextunique");
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "aaa", city: "NY" },
                    { street: "bbb", city: "TOKYO" }
                ]);
                start();
            }
        });
    });
});

asyncTest("direction prev", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.index("street").openCursor("prev", function (cursor) {
            if (cursor) {
                strictEqual(cursor.direction, "prev");
                results.push(cursor.value);
                cursor.continue();
            } else {
                deepEqual(results, [
                    { street: "bbb", city: "TOKYO" },
                    { street: "aaa", city: "Paris" },
                    { street: "aaa", city: "NY" }
                ]);
                start();
            }
        });
    });
});

asyncTest("direction prevunique", function () {
    var myDB = this.myDB;
    myDB.tx(["address"], function (tx, address) {
        var results = [];
        address.index("street").openCursor("prevunique", function (cursor) {
            if (cursor) {
                strictEqual(cursor.direction, "prevunique");
                results.push(cursor.value);
                cursor.continue();
            } else {
                if (typeof mozIndexedDB !== "undefined") {
                    // Firefox's bug ?
                    deepEqual(results, [
                        { street: "bbb", city: "TOKYO" },
                        { street: "aaa", city: "NY" }
                    ]);
                } else {
                    deepEqual(results, [
                        { street: "bbb", city: "TOKYO" },
                        { street: "aaa", city: "Paris" }
                    ]);
                }
                start();
            }
        });
    });
});