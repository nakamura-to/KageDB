KageDB — A thin wrapper for Indexed Database API
==================================================================

KageDB is a thin wrapper for [Indexed Database API](http://www.w3.org/TR/IndexedDB/).

KageDB supports following browsers:
- Internet Explorer 10 Platform Preview 5 and avobe
- Google Chrome 18.0.1025.168 and avobe
- Firefox 12 and avobe


## Usage

Download `kagedb.js` and include it in your page.

```html
<script src="kagedb.js"></script>
```


## Why KageDB ?

Indexed Database API is not stable and is a bit low level.

KageDB abstracts away implementation differences and provides simple API.



## Basic Examples

### Schema Definition

```js
var myDB = new KageDB({
    name: "myDB",
    migration: {
        1: function (ctx, next) {
            var db = ctx.db;
            var person = db.createObjectStore("person", { keyPath: "id", autoIncrement: true });
            person.createIndex("name", "name", { unique: true });
            next();
        }
    }
});
```

### Add

```js
myDB.tx(["person"], function (tx, person) {
    person.add({ name: "SMITH", age: 31 }, function (key) {
        console.log("done: key=" + key); // done: key=1
    });
});
```

### Get

```js
myDB.tx(["person"], function (tx, person) {
    person.get(1, function (value) {
        console.log(JSON.stringify(value));  // {"name":"SMITH","age":31,"id":1}
    });
});
```

### Put

```js
myDB.tx(["person"], function (tx, person) {
    person.put({ id:1, name: "KING", age: 28 }, function (value) {
        console.log("done: key=" + key); // done: key=1
    });
});
```

### Delete

```js
myDB.tx(["person"], function (tx, person) {
    person.delete(1, function (key) {
        console.log("done"); // done
    });
});
```
