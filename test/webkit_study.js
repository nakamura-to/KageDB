module("webkit_study");

asyncTest("webkitIndexedDB", function () {
    var version = 1;
    var req = webkitIndexedDB.deleteDatabase("MyDB");
    req.onsuccess = function () {
        var req = webkitIndexedDB.open("MyDB");
        req.onsuccess = function (event) {
            var db = event.target.result;
            var currentVersion = db.version || 0;
            if (db.setVersion && currentVersion < version) {
                var req = db.setVersion(version);
                req.onsuccess = function (event) {
                    var tx = event.target.result;
                    var store = db.createObjectStore("MyStore", {autoIncrement: true });
                    store.createIndex("name", "name", { unique: true });
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
                req.onerror = function (event) {
                    console.dir({ message: "setVersion onerror", event: event });
                };
            }
        };
        req.onerror = function (event) {
            console.dir({ message: "open onerror", event: event });
        };
    };
    req.onerror = function (event) {
        console.dir({ message: "deleteDatabase onerror", event: event });
    };
});

asyncTest("kageDB", function () {
    var version = 1;
    var kageDB = new KageDB();
    var req = kageDB.deleteDatabase("MyDB");
    req.onsuccess = function () {
        var req = kageDB.open("MyDB");
        req.onsuccess = function (event) {
            var db = event.target.result;
            var currentVersion = db.version || 0;
            if (db.setVersion && currentVersion < version) {
                var req = db.setVersion(version);
                req.onsuccess = function (event) {
                    var tx = event.target.result;
                    var store = db.createObjectStore("MyStore", {autoIncrement: true });
                    store.createIndex("name", "name", { unique: true });
                    var req = store.put({ name: "aaa", age: 20});
                    req.onsuccess = function () {
                        var req = store.count();
                        req.onsuccess = function (event) {
                            strictEqual(1, event.target.result);
                            start();
                        };
                    };
                };
                req.onerror = function (event) {
                    console.dir({ message: "setVersion onerror", event: event });
                };
            }
        };
        req.onerror = function (event) {
            console.dir({ message: "open onerror", event: event });
        };
    };
    req.onerror = function (event) {
        console.dir({ message: "deleteDatabase onerror", event: event });
    };
});

