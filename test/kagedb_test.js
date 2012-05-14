module("kagedb_test");

test("isAvailable", function () {
    ok(KageDB.isAvailable());
});

test("default settings", function () {
    var myDB = new KageDB({
        name: "myDB",
        upgrade: function (db, complete) {
            complete();
        }
    });
    strictEqual(myDB.name, "myDB");
    strictEqual(myDB.version, 1);
    strictEqual(typeof myDB.upgrade, "function");
    strictEqual(myDB.autoClose, true);
    strictEqual(myDB.txMode, "readwrite");
    strictEqual(typeof myDB.onerror, "function");
    strictEqual(typeof myDB.onblocked, "function");
});

test("settings: no settings", function () {
    raises(function () {
        new KageDB();
    }, function (e) {
        strictEqual(e.message, '[KageDB] `settings` is required.');
        return true;
    });
});

test("settings: no settings.name", function () {
    raises(function () {
        new KageDB({});
    }, function (e) {
        strictEqual(e.message, '[KageDB] `settings.name` is require.');
        return true;
    });
});

test("settings: no settings.upgrade", function () {
    raises(function () {
        new KageDB({ name: "myDB" });
    }, function (e) {
        strictEqual(e.message, '[KageDB] `settings.upgrade` is required. It must be a function.');
        return true;
    });
});
