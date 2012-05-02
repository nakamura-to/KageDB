var http = require('http');
var fs = require('fs')

http.createServer(function (req, res) {
    var path = resolvePath(req.url);
    fs.readFile(path, 'utf8', function (err, data) {
        if (err) {
            console.log('not found:', path);
            res.writeHead(404);
            res.end();
        } else {
            console.log('found:', path);
            res.writeHead(200, {'Content-Type': resolveContentType(path)});
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

function resolveContentType(path) {
    if (/\.css$/.test(path)) {
        return 'text/css; charset=utf-8';
    } else if (/\.js$/.test(path)) {
        return 'application/x-javascript; charset=utf-8';
    }
    return 'text/html; charset=utf-8';
}