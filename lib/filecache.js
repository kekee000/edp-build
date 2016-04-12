/**
 * @file 缓存文件管理，缓存less、stylus等文件内容，为请求做出优化
 * @author mengke01(kekee000@gmail.com)
 */

var fs = require('fs');
var path = require('path');

var cachedFiles = {};
var cacheDir;
var CACHE_INFO_PATH = 'info.json';
var modifiedTimes = {};

/**
 * 按照依赖改动时间排序，最新改动的排前面
 * @param  {Array} deps 依赖列表
 * @return {Array}      排序后的列表
 */
function sortDeps(deps) {
    var modifiedTimes = {};
    var now = Date.now();
    for (var i = 0, l = deps.length; i < l; i++) {
        var depPath = deps[i];
        if (modifiedTimes[depPath]) {
            continue;
        }

        if (!fs.existsSync(depPath)) {
            modifiedTimes[depPath] = now;
        }
        else {
            modifiedTimes[depPath] = fs.statSync(deps[i]).mtime;
        }
    }
    deps.sort(function (a, b) {
        return modifiedTimes[b] - modifiedTimes[a];
    });
    return deps;
}

/**
 * 获取缓存文件名称
 *
 * @param {string} filePath 文件路径
 * @return {Object}
 */
function getCacheName(filePath) {
    return filePath.replace(/[^\w.]/g, '_');
}

exports.getCacheName = getCacheName;

/**
 * 加载上次的缓存信息
 *
 * @param {string} config 缓存目录
 * @return {string}
 */
exports.load = function (config) {
    cacheDir = config.dir;
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir);
        return;
    }

    var infoPath = path.join(cacheDir, CACHE_INFO_PATH);
    if (fs.existsSync(infoPath)) {
        var content = fs.readFileSync(infoPath, 'utf-8');
        cachedFiles = JSON.parse(content);
    }
};

/**
 * 保存本次的缓存信息
 *
 * @param {string} config 缓存目录
 * @return {string}
 */
exports.save = function (config) {
    if (config.dir) {
        cacheDir = config.dir;
    }

    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir);
    }

    Object.keys(cachedFiles).forEach(function (filePath) {
        sortDeps(cachedFiles[filePath].deps);
        // cachedFiles[filePath].cachePath = cacheFilePath;

        var cacheFilePath = path.join(cacheDir, getCacheName(filePath));
        fs.writeFileSync(cacheFilePath, cachedFiles[filePath].content);
        delete cachedFiles[filePath].content;
    });

    var infoPath = path.join(cacheDir, CACHE_INFO_PATH);
    fs.writeFileSync(infoPath, JSON.stringify(cachedFiles));
};


/**
 * 获取当前文件缓存
 *
 * @param {string} filePath 文件路径
 * @return {string}
 */
exports.get = function (filePath) {
    var cachePath = path.join(cacheDir, getCacheName(filePath));
    return fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf-8') : false;
};

/**
 * 检查是否改动，并获取当前文件缓存
 *
 * @param  {string} filePath 路径
 * @return {boolean|string} 成功则返回缓存内容，失败则返回`false`
 */
exports.check = function (filePath) {
    if (!cachedFiles[filePath]) {
        return false;
    }

    var cached = cachedFiles[filePath];
    var lastModified = cached.lastModified;
    var deps = cached.deps;
    var now = Date.now();

    // 检查依赖文件改动
    for (var i = 0, l = deps.length; i < l; i++) {
        var mtime = modifiedTimes[deps[i]];
        // 获取修改时间
        if (!mtime) {
            if (!fs.existsSync(deps[i])) {
                mtime = now;
            }
            else {
                mtime = fs.statSync(deps[i]).mtime;
            }
            modifiedTimes[deps[i]] = mtime;
        }

        if (mtime - lastModified > 0) {
            return false;
        }
    }

    return this.get(filePath);
};

/**
 * 保存缓存的文件
 *
 * @param  {string} filePath 文件路径
 * @param  {Array} deps     依赖列表
 * @param  {string} content 缓存内容
 */
exports.set = function (filePath, deps, content) {
    deps = deps || [];
    deps.push(filePath);
    cachedFiles[filePath] = {
        lastModified: Date.now(),
        deps: deps,
        content: content
    };
};
