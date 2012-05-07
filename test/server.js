var http = require('http');
var fs = require('fs');
var path = require('path');

http.createServer(function (req, res) {
    var name = path.join(__dirname, resolvePath(req.url));
    fs.readFile(name, 'utf8', function (err, data) {
        if (err) {
            console.log('not found:', name);
            res.writeHead(404);
            res.end();
        } else {
            console.log('found:', name);
            res.writeHead(200, {'Content-Type': resolveContentType(name)});
            res.end(data);
        }
    });
}).listen(9000, '127.0.0.1');
console.log('Server running at http://127.0.0.1:9000/');

function resolvePath(url) {
    var pathname = require('url').parse(url).pathname;
    if (pathname === '/') {
        return 'index.html';
    } else if (/\/(lib|qunit)\/.*/.test(pathname)) {
        return '..' + url;
    } else {
        return pathname.substr(1);
    }
}

function resolveContentType(name) {
    var ext = path.extname(name);
    if (ext === '.css') {
        return 'text/css; charset=utf-8';
    } else if (ext === '.js') {
        return 'application/x-javascript; charset=utf-8';
    }
    return 'text/html; charset=utf-8';
}