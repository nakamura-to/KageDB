KageDB — A thin wrapper library for Indexed Database API
==================================================================

KageDB is a thin wrapper library for [Indexed Database API](http://www.w3.org/TR/IndexedDB/).

KageDB supports following browsers:
- Internet Explorer 10 Platform Preview 5 and avobe
- Google Chrome 18.0.1025.168 and avobe
- Firefox 12 and avobe


## Why KageDB ?

KageDB is compatible with Indexed Database API and provides some useful features.

### Bulk Update

```js
var kageDB = new KageDB();
var req = kageDB.open("MyDB");
req.onsuccess = function (event) {
    var db = event.target.result;
    var tx = db.transaction(["Person"], IDBTransaction.READ_WRITE);
    var store = tx.objectStore("Person");
    // Add some values at once
    var req = store.bulkAdd([
        { name: "aaa", age: 20 }, 
        { name: "bbb", age: 30 }, 
        { name: "ccc", age: 40 }]);
    req.onsuccess = function () {
        console.log("all done");
    };
};
```

### Fetch

```js
var kageDB = new KageDB();
var req = kageDB.open("MyDB");
req.onsuccess = function (event) {
    var db = event.target.result;
    var tx = db.transaction(["Person"], IDBTransaction.READ_ONLY);
    var store = tx.objectStore("Person");
    // Fetch some values at once
    var req = store.fetch(IDBKeyRange.lowerBound(0), IDBCursor.NEXT, function (p) { return p.age >= 30});
    req.onsuccess = function (event) {
        var people = event.target.result;
        console.log(JSON.stringify(people)); // [{"name":"bbb","age":30},{"name":"ccc","age":40}]
    };
};
```

### Join

```js
var kageDB = new KageDB();
var req = kageDB.open("MyDB");
req.onsuccess = function (event) {
    var db = event.target.result;
    var tx = db.transaction(["Person"], IDBTransaction.READ_WRITE);
    var store = tx.objectStore("Person");
    // Join some IDBRequest objects
    var req = kageDB.join(
        store.put({ name: "aaa", age: 20 }), 
        store.add({ name: "bbb", age: 30 }));
    req.onsuccess = function () {
        console.log("all done");
    };
};
```

### Dump

```js
var kageDB = new KageDB();
// Dump Database values
var req = kageDB.dump("MyDB", ["Person", "Address"]);
req.onsuccess = function (event) {
    var stores = event.target.result;
    // Dump Person store records
    console.log(JSON.stringify(stores[0]));
    // Dump Address store records
    console.log(JSON.stringify(stores[1]));
};
```

### Default Event Handlers

```js
var kageDB = new KageDB();

// Notified all unhandled error events 
kageDB.onerror = function (event) {
    console.error("ERROR: " + event.target.errorCode);
};

// Notified all unhandled abort events 
kageDB.onabort = function (event) {
    console.error("ABORT: " + event.target.errorCode);
};

var req = kageDB.open("MyDB");
req.onsuccess = function (event) {
    var db = event.target.result;
    var tx = db.transaction(["Person"], IDBTransaction.READ_WRITE);
    var store = tx.objectStore("Person");
    var req = store.add({ name: "bbb", age: 30 });
    req.onsuccess = function () {
        console.log("done");
    };
};
```

## Usage

Download `kagedb.js` and include it in your page.

```html
<script src="kagedb.js"></script>
```

## Examples

### Initialize Database

```js
function initDatabase(callback) {
    var kageDB = new KageDB();
    var req = kageDB.deleteDatabase("ExampleDB");
    req.onsuccess = req.onerror = function () {
        var req = kageDB.open("ExampleDB");
        req.onupgradeneeded = function (event) {
            var db = event.target.result;
            var store = db.createObjectStore("Person", { autoIncrement: true });
            store.createIndex("name", "name", { unique: false });
            store.createIndex("age", "age", { unique: false });
        };
        req.onsuccess = function (event) {
            var db = event.target.result;
            var tx = db.transaction(["Person"], IDBTransaction.READ_WRITE);
            var store = tx.objectStore("Person");
            var req = store.bulkPut([
                { name: "aaa", age: 20},
                { name: "bbb", age: 30},
                { name: "ccc", age: 40},
                { name: "ddd", age: 35},
                { name: "ddd", age: 25}
            ]);
            req.onsuccess = function () {
                callback();
            }
        };
    };
    kageDB.onerror = function (event) {
        console.error("ERROR: " + event.target.errorCode);
    }
}
```