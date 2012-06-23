module("kagedb_test");

test("isAvailable", function () {
    ok(KageDB.isAvailable());
});

test("default settings", function () {
    var myDB = new KageDB({
        name: "myDB",
        migration: {}
    });
    strictEqual(myDB.name, "myDB");
    strictEqual(myDB.version, 1);
    strictEqual(typeof myDB.migration, "object");
    strictEqual(myDB.autoClose, true);
    strictEqual(myDB.txMode, "readonly");
    strictEqual(typeof myDB.debug, "function");
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
        strictEqual(e.message, '[KageDB] `settings.name` is required.');
        return true;
    });
});

test("settings: no settings.migration", function () {
    raises(function () {
        new KageDB({ name: "myDB" });
    }, function (e) {
        strictEqual(e.message, '[KageDB] `settings.migration` is required. It must be an object.');
        return true;
    });
});

test("cmp", function () {
    var myDB = new KageDB({
        name: "myDB",
        migration: {}
    });
    strictEqual(myDB.cmp(2, 1), 1);
    strictEqual(myDB.cmp(1, 1), 0);
    strictEqual(myDB.cmp(1, 2), -1);
});

asyncTest("migrage", function () {
    expect(5);
    var myDB = new KageDB({
        name: "myDB",
        migration: {
            1: function (ctx, next) {
                strictEqual(ctx.db, "db");
                strictEqual(ctx.tx, "tx");
                next();
            },
            2: function (ctx, next) {
                strictEqual(ctx.db, "db");
                strictEqual(ctx.tx, "tx");
                next();
            }
        }
    });
    myDB._migrate("db", "tx", 0, 2, function () {
        ok(true);
        start();
    });
});

asyncTest("migrage before after", function () {
    expect(12);
    var myDB = new KageDB({
        name: "myDB",
        migration: {
            before: function (ctx, next) {
                strictEqual(ctx.db, "db");
                strictEqual(ctx.tx, "tx");
                ctx.hoge = "a";
                next();
            },
            after: function (ctx, next) {
                strictEqual(ctx.db, "db");
                strictEqual(ctx.tx, "tx");
                strictEqual(ctx.hoge, "c");
                next();
            },
            1: function (ctx, next) {
                strictEqual(ctx.db, "db");
                strictEqual(ctx.tx, "tx");
                strictEqual(ctx.hoge, "a");
                ctx.hoge = "b";
                next();
            },
            2: function (ctx, next) {
                strictEqual(ctx.db, "db");
                strictEqual(ctx.tx, "tx");
                strictEqual(ctx.hoge, "b");
                ctx.hoge = "c";
                next();
            }
        }
    });
    myDB._migrate("db", "tx", 0, 2, function () {
        ok(true);
        start();
    });
});
