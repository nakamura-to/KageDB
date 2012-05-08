module("moz_objectstore", {
    setup: function () {
        function open() {
            var req = kageDB.open("MyDB");
            req.onupgradeneeded = function (event) {
                var db = event.target.result;
                var store = db.createObjectStore("MyStore", { autoIncrement: true });
                var index = store.createIndex("name", "name", { unique: true });
                ok(index);
                strictEqual(index.kage_kageDB, kageDB);
                start();
            };
        }
        stop();
        var kageDB = new KageDB();
        var req = kageDB.deleteDatabase("MyDB");
        req.onsuccess = req.onerror = open;
    }
});

asyncTest("put", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.put({ name: "aaa", age: 20});
        req.onsuccess = function () {
            var req = store.count();
            req.onsuccess = function (event) {
                strictEqual(1, event.target.result);
                start();
            };
        };
    };
});

asyncTest("put_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.put({ name: "aaa", age: 20});
        req.onsuccess = function () {
            var req = store.count();
            req.onsuccess = function (event) {
                strictEqual(1, event.target.result);
                db.close();
                start();
            };
        };
    };
});

asyncTest("add", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20});
        req.onsuccess = function () {
            start();
        };
    };
});

asyncTest("add_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20});
        req.onsuccess = function () {
            db.close();
            start();
        };
    };
});

asyncTest("get", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20});
        req.onsuccess = function (event) {
            var key = event.target.result;
            var req = store.get(key);
            req.onsuccess = function (event) {
                var value = event.target.result;
                deepEqual(value, { name: "aaa", age: 20});
                start();
            };
        };
    };
});

asyncTest("get_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20});
        req.onsuccess = function (event) {
            var key = event.target.result;
            var req = store.get(key);
            req.onsuccess = function (event) {
                var value = event.target.result;
                deepEqual(value, { name: "aaa", age: 20});
                db.close();
                start();
            };
        };
    };
});

asyncTest("clear", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20});
        req.onsuccess = function () {
            var req = store.clear();
            req.onsuccess = function () {
                start();
            };
        };
    };
});

asyncTest("clear_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20});
        req.onsuccess = function () {
            var req = store.clear();
            req.onsuccess = function () {
                db.close();
                start();
            };
        };
    };
});

asyncTest("openCursor", function () {
    expect(6);
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20 });
        req.onsuccess = function () {
            var req = store.add({ name: "bbb", age: 30 });
            req.onsuccess = function () {
                var req = store.openCursor();
                req.onsuccess = function (event) {
                    var cursor = event.target.result;
                    if (cursor) {
                        ok(cursor.kage_kageDB, kageDB);
                        ok(cursor.value);
                        cursor.continue();
                    } else {
                        start();
                    }
                };
            };
        };
    };
});

asyncTest("openCursor_pure", function () {
    expect(4);
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20 });
        req.onsuccess = function () {
            var req = store.add({ name: "bbb", age: 30 });
            req.onsuccess = function () {
                var req = store.openCursor();
                req.onsuccess = function (event) {
                    var cursor = event.target.result;
                    if (cursor) {
                        ok(cursor.value);
                        cursor.continue();
                    } else {
                        db.close();
                        start();
                    }
                };
            };
        };
    };
});

asyncTest("count", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20 });
        req.onsuccess = function () {
            var req = store.add({ name: "bbb", age: 30 });
            req.onsuccess = function () {
                var req = store.count();
                req.onsuccess = function (event) {
                    var count = event.target.result;
                    strictEqual(count, 2);
                    start();
                };
            };
        };
    };
});

asyncTest("count_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20 });
        req.onsuccess = function () {
            var req = store.add({ name: "bbb", age: 30 });
            req.onsuccess = function () {
                var req = store.count();
                req.onsuccess = function (event) {
                    var count = event.target.result;
                    strictEqual(count, 2);
                    db.close();
                    start();
                };
            };
        };
    };
});

asyncTest("index", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20 });
        req.onsuccess = function () {
            var req = store.add({ name: "bbb", age: 30 });
            req.onsuccess = function () {
                var index = store.index("name");
                strictEqual(index.kage_kageDB,  kageDB);
                start();
            };
        };
    };
});

asyncTest("index_pure", function () {
    var req = indexedDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.add({ name: "aaa", age: 20 });
        req.onsuccess = function () {
            var req = store.add({ name: "bbb", age: 30 });
            req.onsuccess = function () {
                var index = store.index("name");
                ok(index);
                db.close();
                start();
            };
        };
    };
});

asyncTest("bulkPut", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkPut([
            { name: "aaa", age: 20},
            { name: "bbb", age: 30},
            { name: "ccc", age: 40}
        ]);
        req.onsuccess = function (event) {
            deepEqual(event.target.result, [1, 2, 3]);
            var req = store.count();
            req.onsuccess = function (event) {
                strictEqual(3, event.target.result);
                start();
            };
        }
    };
});

asyncTest("bulkPut_manual", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var pending = 3;
        function handle() {
            pending--;
            if (pending === 0) {
                var req = store.count();
                req.onsuccess = function (event) {
                    strictEqual(3, event.target.result);
                    db.close();
                    start();
                };
            }
        }
        var req1 = store.put({ name: "aaa", age: 20});
        req1.onsuccess = handle;
        var req2 = store.put({ name: "bbb", age: 30});
        req2.onsuccess = handle;
        var req3 = store.put({ name: "ccc", age: 40});
        req3.onsuccess = handle;
    };
});

asyncTest("bulkPut_error", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkPut([
            { name: "aaa", age: 20},
            { name: "bbb", age: 30},
            { name: "aaa", age: 40} // duplication
        ]);
        req.onerror = function (event) {
            ok(true);
            strictEqual(event.target.kage_className, "IDBObjectStore");
            strictEqual(event.target.kage_methodName, "bulkPut");
            deepEqual(event.target.kage_args[0], [
                { name: "aaa", age: 20},
                { name: "bbb", age: 30},
                { name: "aaa", age: 40}
            ]);
            ok(event.target.kage_cause);
            ok(event.target.kage_cause.target);
            strictEqual(event.target.kage_cause.target.errorCode, 4);
            var message = event.target.kage_getErrorMessage();
            ok(message, message);
            event.target.kage_cause.stopPropagation();
            // it is important to call preventDefault() to make this test success in firefox
            event.target.kage_cause.preventDefault();
            start();
        };
    };
});


asyncTest("bulkAdd", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkAdd([
            { name: "aaa", age: 20},
            { name: "bbb", age: 30},
            { name: "ccc", age: 40}
        ]);
        req.onsuccess = function (event) {
            deepEqual(event.target.result, [1, 2, 3]);
            var req = store.count();
            req.onsuccess = function (event) {
                strictEqual(3, event.target.result);
                start();
            };
        }
    };
});

asyncTest("bulkDelete", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkAdd([
            { name: "aaa", age: 20},
            { name: "bbb", age: 30},
            { name: "ccc", age: 40}
        ]);
        req.onsuccess = function (event) {
            deepEqual(event.target.result, [1, 2, 3]);
            var req = store.count();
            req.onsuccess = function (event) {
                strictEqual(3, event.target.result);
                var req = store.bulkDelete([1, 2, 3]);
                req.onsuccess = function () {
                    var req = store.count();
                    req.onsuccess = function (event) {
                        strictEqual(0, event.target.result);
                        start();
                    }
                };
            };
        }
    };
});

asyncTest("fetch", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkAdd([
            { name: "aaa", age: 20 },
            { name: "bbb", age: 30 },
            { name: "ccc", age: 40 },
            { name: "ddd", age: 50 },
            { name: "eee", age: 60 }
        ]);
        req.onsuccess = function () {
            var req = store.fetch(IDBKeyRange.lowerBound(0), IDBCursor.NEXT, function (value) { return value.age > 30});
            req.onsuccess = function (event) {
                var values = event.target.result;
                deepEqual(values, [{ name: "ccc", age: 40 }, { name: "ddd", age: 50 }, { name: "eee", age: 60 }]);
                start();
            };
        };
    };
});

asyncTest("fetch_reduce", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkAdd([
            { name: "aaa", age: 20 },
            { name: "bbb", age: 30 },
            { name: "ccc", age: 40 },
            { name: "ddd", age: 50 },
            { name: "eee", age: 60 }
        ]);
        req.onsuccess = function () {
            var req = store.fetch(IDBKeyRange.lowerBound(0),
                IDBCursor.NEXT,
                function (value) { return value.age > 30},
                function (prev, curr) { return {age: prev.age + curr.age};});
            req.onsuccess = function (event) {
                var sum = event.target.result;
                deepEqual(sum, { age: 150 });
                start();
            };
        };
    };
});

asyncTest("fetch_reduce_initValue", function () {
    var kageDB = new KageDB();
    var req = kageDB.open("MyDB");
    req.onsuccess = function (event) {
        var db = event.target.result;
        var tx = db.transaction(["MyStore"], IDBTransaction.READ_WRITE);
        var store = tx.objectStore("MyStore");
        var req = store.bulkAdd([
            { name: "aaa", age: 20 },
            { name: "bbb", age: 30 },
            { name: "ccc", age: 40 },
            { name: "ddd", age: 50 },
            { name: "eee", age: 60 }
        ]);
        req.onsuccess = function () {
            var req = store.fetch(IDBKeyRange.lowerBound(0),
                IDBCursor.NEXT,
                function (value) { return value.age > 30},
                function (prev, curr) { return prev + curr.age},
                0);
            req.onsuccess = function (event) {
                var sum = event.target.result;
                strictEqual(sum, 150);
                start();
            };
        };
    };
});